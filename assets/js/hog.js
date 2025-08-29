(() => {
  "use strict";

  // ====== Configuration ======
  const CFG = {
    size: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hog-frame-size')) || 96,
    scale: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hog-scale')) || 1,
    framesWalk: [0,1,2,3,4],          // indices 0..4
    framesRollSeq: [5,6,7],           // roll-up animation frames
    coastRollFrames: 3,           // move this many roll frames before stopping ("momentum")
    fpsWalk: 8,                       // walking animation speed
    fpsRoll: 8,                      // roll-up animation speed
    spriteSheetPath: 'assets/images/hog_sprite.png',    // preferred
    framePath: (i) => `assets/images/hog_frames/hog_${String(i).padStart(4,'0')}.png`, // 1..8
    proximity: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hog-proximity')) || 120,
    safeDelay: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hog-safe-delay-ms')) || 5000,
    speedMin: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hog-speed-min')) || 110,
    speedMax: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hog-speed-max')) || 160,
    wanderMin: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hog-wander-ms-min')) || 1200,
    wanderMax: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hog-wander-ms-max')) || 3000,
    bouncePadding: 2,                 // avoid clipping into edges
    preferSpritesheet: true,          // try sprite.png first; fall back to individual frames
    startDirection: 'left'            // initial heading: 'left' biases the first vector
  };

  // ====== State ======
  const state = {
    assetsMode: 'pending', // 'sheet' | 'frames'
    sheetReady: false,
    framesReady: false,
    walkFrameIdx: 0,
    rollFrameIdx: 0,
    animAccum: 0,
    x: innerWidth * 0.7,  // default start roughly right side so it goes left
    y: innerHeight * 0.6,
    vx: 0, vy: 0,         // px/s
    moving: true,
    rolled: false,
    rollAnimating: false,
    coastFramesLeft: 0,
    dragging: false,
    lastTs: performance.now(),
    nextWanderChangeAt: 0,
    lastDangerTs: 0,
    lastSafeTs: performance.now(),
    pointerX: -1e9,
    pointerY: -1e9,
  };

  // ====== DOM ======
  const hog = document.createElement('div');
  hog.id = 'hedgehog';
  document.body.appendChild(hog);

  // Helpers
  const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));
  const rand = (min,max)=>min + Math.random()*(max-min);
  const pick = arr => arr[(Math.random()*arr.length)|0];

  // ====== Assets: try spritesheet, then frames ======
  function preloadAssets() {
    return new Promise((resolve) => {
      if (CFG.preferSpritesheet) trySheetElseFrames(); else tryFramesElseSheet();

      function trySheetElseFrames(){
        const img = new Image();
        img.onload = () => { state.assetsMode = 'sheet'; state.sheetReady = true; resolve(); };
        img.onerror = () => { tryFramesElseSheet(); };
        img.src = CFG.spriteSheetPath;
      }
      function tryFramesElseSheet(){
        const images = new Array(8).fill(null);
        let loaded = 0, failed = false;
        for (let i=1;i<=8;i++){
          const im = new Image();
          im.onload = () => { images[i-1] = im; if(++loaded===8 && !failed){ state.assetsMode='frames'; state.framesReady=true; resolve(); } };
          im.onerror = () => { if (!failed){ failed=true; /* last resort: try spritesheet if we haven’t yet */ if (!state.sheetReady){ const im2 = new Image(); im2.onload=()=>{ state.assetsMode='sheet'; state.sheetReady=true; resolve(); }; im2.onerror=()=>{ /* give up but still resolve to allow page to load; we’ll show a placeholder */ state.assetsMode='none'; resolve(); }; im2.src = CFG.spriteSheetPath; } else { state.assetsMode='none'; resolve(); } } };
          im.src = CFG.framePath(i);
        }
      }
    });
  }

  function setFrame(frameIndex){
    // frameIndex: 0..7
    if (state.assetsMode === 'sheet' && state.sheetReady){
      // Set sprite sheet background and offset
      hog.style.backgroundImage = `url(${CFG.spriteSheetPath})`;
      hog.style.backgroundSize = `${CFG.size*8}px ${CFG.size}px`;
      hog.style.backgroundPosition = `${-frameIndex*CFG.size}px 0px`;
    } else if (state.assetsMode === 'frames' && state.framesReady){
      const path = CFG.framePath(frameIndex+1);
      hog.style.backgroundImage = `url(${path})`;
      hog.style.backgroundSize = `${CFG.size}px ${CFG.size}px`;
      hog.style.backgroundPosition = `0 0`;
    } else {
      // Fallback: colored square placeholder so you can still see motion
      hog.style.backgroundImage = 'none';
      hog.style.backgroundColor = '#6b705c';
    }
  }

  // ====== Movement & animation ======
  function chooseNewVector(forceBiasLeft=false){
    const speed = rand(CFG.speedMin, CFG.speedMax)*CFG.scale;
    let angle;
    if (forceBiasLeft || CFG.startDirection==='left' && state.vx===0 && state.vy===0){
      // bias: mostly left, with a little random vertical component
      angle = Math.PI + rand(-0.5, 0.5); // around 180°
    } else {
      angle = rand(-Math.PI/6, Math.PI/6);
      if (rand(-0.5, 0.5) < 0) angle += Math.PI; // reverse if going left
    }
    state.vx = Math.cos(angle) * speed;
    state.vy = Math.sin(angle) * speed;
    // schedule next wander change
    state.nextWanderChangeAt = performance.now() + rand(CFG.wanderMin, CFG.wanderMax);
  }

  function updateFlip(){
    if (state.vx > 1) {
      hog.style.transform = `scaleX(-1) scale(${CFG.scale})`;
    } else if (state.vx < -1) {
      hog.style.transform = `scaleX(1) scale(${CFG.scale})`;
    }
  }

  function keepInBounds(){
    const w = innerWidth, h = innerHeight;
    const s = CFG.size * CFG.scale;
    let bounced = false;
    if (state.x < CFG.bouncePadding){ state.x = CFG.bouncePadding; state.vx = Math.abs(state.vx); bounced = true; }
    if (state.x > w - s - CFG.bouncePadding){ state.x = w - s - CFG.bouncePadding; state.vx = -Math.abs(state.vx); bounced = true; }
    if (state.y < CFG.bouncePadding){ state.y = CFG.bouncePadding; state.vy = Math.abs(state.vy); bounced = true; }
    if (state.y > h - s - CFG.bouncePadding){ state.y = h - s - CFG.bouncePadding; state.vy = -Math.abs(state.vy); bounced = true; }
    if (bounced) updateFlip();
  }

  function setPos(){
    hog.style.left = `${state.x}px`;
    hog.style.top  = `${state.y}px`;
  }

  // ====== Danger / proximity logic ======
  function pointerDistance(){
    const cx = state.x + (CFG.size*CFG.scale)/2;
    const cy = state.y + (CFG.size*CFG.scale)/2;
    const dx = state.pointerX - cx;
    const dy = state.pointerY - cy;
    return Math.hypot(dx, dy);
  }

  function updateDanger(now){
    const tooClose = pointerDistance() <= CFG.proximity;
    if (tooClose) {
      state.lastDangerTs = now;
      if (!state.rolled && !state.rollAnimating) triggerRoll();
    } else {
      state.lastSafeTs = now;
    }

    if ((state.rolled || state.rollAnimating) && (now - state.lastDangerTs) >= CFG.safeDelay) {
      // time to unroll back to walking
      state.rolled = false;
      state.rollAnimating = false;
      state.walkFrameIdx = 0;
      state.animAccum = 0;
      state.moving = true;
      chooseNewVector();
    }
  }

  function triggerRoll(){
    state.rollAnimating = true;
    state.coastFramesLeft = CFG.coastRollFrames; // keep momentum for this many frames
    state.animAccum = 0;
    state.rollFrameIdx = 0;
    state.moving = true; // keep moving during the first roll frames
  }

  // ====== Dragging ======
  let drag = {active:false, dx:0, dy:0, id:null};
  hog.addEventListener('pointerdown', (e)=>{
    drag.active = true; drag.id = e.pointerId; hog.setPointerCapture(drag.id);
    hog.classList.add('grabbing');
    const rect = hog.getBoundingClientRect();
    drag.dx = e.clientX - rect.left; drag.dy = e.clientY - rect.top;
    state.dragging = true; state.moving = false;
  });
  hog.addEventListener('pointermove', (e)=>{
    if (drag.active && e.pointerId === drag.id){
      state.x = clamp(e.clientX - drag.dx, CFG.bouncePadding, innerWidth - CFG.size*CFG.scale - CFG.bouncePadding);
      state.y = clamp(e.clientY - drag.dy, CFG.bouncePadding, innerHeight - CFG.size*CFG.scale - CFG.bouncePadding);
      setPos();
    }
  });
  const endDrag = (e)=>{
    if (drag.active && (!e || e.pointerId === drag.id)){
      drag.active = false; hog.releasePointerCapture(drag.id);
      hog.classList.remove('grabbing');
      state.dragging = false;
      // If not in danger, resume motion immediately; otherwise will wait for safe-delay logic
      if (!state.rolled && !state.rollAnimating) { 
        state.moving = true; 
        chooseNewVector(); 
        updateFlip();
      }
    }
  };
  hog.addEventListener('pointerup', endDrag);
  hog.addEventListener('pointercancel', endDrag);

  // Hover also counts as danger
  hog.addEventListener('pointerenter', ()=>{ state.lastDangerTs = performance.now(); if (!state.rolled && !state.rollAnimating) triggerRoll(); });

  // Track pointer globally for proximity checks
  window.addEventListener('pointermove', (e)=>{ state.pointerX = e.clientX; state.pointerY = e.clientY; });
  window.addEventListener('pointerleave', ()=>{ state.pointerX = -1e9; state.pointerY = -1e9; });

  // Keep inside on resize
  window.addEventListener('resize', ()=>{ keepInBounds(); setPos(); });

  // ====== Main loop ======
  function tick(now){
    const dt = Math.min(0.05, (now - state.lastTs) / 1000); // cap for tab-jump
    state.lastTs = now;

    // proximity logic
    updateDanger(now);

    // movement
    if (!state.dragging && state.moving && !state.rolled && (!state.rollAnimating || state.coastFramesLeft > 0)){
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      keepInBounds();
      setPos();
      if (now >= state.nextWanderChangeAt) chooseNewVector();
      updateFlip();
    }

    // animation
    if (state.rollAnimating){
      state.animAccum += dt;
      const frameDur = 1 / CFG.fpsRoll;
      while (state.animAccum >= frameDur && state.rollFrameIdx < CFG.framesRollSeq.length){
        state.animAccum -= frameDur;
        const frame = CFG.framesRollSeq[state.rollFrameIdx];
        setFrame(frame);
        state.rollFrameIdx++;
        if (state.coastFramesLeft > 0) {
          state.coastFramesLeft--;
          if (state.coastFramesLeft === 0) {
            // stop moving after consuming momentum frames
            state.moving = false;
          }
        }
      }
      if (state.rollFrameIdx >= CFG.framesRollSeq.length){
        // stay curled at last frame
        setFrame(CFG.framesRollSeq[CFG.framesRollSeq.length-1]);
        state.rollAnimating = false;
        state.rolled = true;
      }
    } else if (state.rolled){
      setFrame(CFG.framesRollSeq[CFG.framesRollSeq.length-1]);
    } else {
      // walking loop
      state.animAccum += dt;
      const frameDur = 1 / CFG.fpsWalk;
      if (state.animAccum >= frameDur){
        state.animAccum -= frameDur;
        state.walkFrameIdx = (state.walkFrameIdx + 1) % CFG.framesWalk.length;
        setFrame(CFG.framesWalk[state.walkFrameIdx]);
      }
    }

    requestAnimationFrame(tick);
  }

  // ====== Boot ======
  preloadAssets().then(() => {
    // Ensure initial frame visible
    setFrame(CFG.framesWalk[0]);

    // Place somewhere reasonable (inside viewport), bias right so it starts moving left
    state.x = clamp(state.x, CFG.bouncePadding, innerWidth - CFG.size*CFG.scale - CFG.bouncePadding);
    state.y = clamp(state.y, CFG.bouncePadding, innerHeight - CFG.size*CFG.scale - CFG.bouncePadding);
    setPos();

    // initial vector: left-ish
    chooseNewVector(true);
    updateFlip();

    requestAnimationFrame((t)=>{ state.lastTs = t; tick(t); });
  });
})();