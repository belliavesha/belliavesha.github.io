// okiya-main.js
//  Imports helpers from okiya-libs.js.
import {
  ALL_PLANTS, ALL_MOTIFS,SEAT_IDS,PLAYER_LABELS,
  shuffled, makeRngFromSeed, randomSeedString,
  isBorderCell, toNotation, plantInfo, motifInfo,
  seatLabel, seatCssVar, nextSeatLocal,prevSeatLocal
} from './okiya-libs.js';


// ========== Multiplayer (Firebase) ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getDatabase, ref, onValue, set, runTransaction,
  update, get, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// ========== UI handles ==========
const boardEl     = document.getElementById('board');
const tileTpl     = document.getElementById('tileTpl');
const statusBox   = document.getElementById('statusBox');
const lastTileEl  = document.getElementById('lastTile');
const turnText    = document.getElementById('turnText');
const turnSwatch  = document.getElementById('turnSwatch');
const playerText    = document.getElementById('playerText');
const playerSwatch  = document.getElementById('playerSwatch');
const newGameBtn  = document.getElementById('newGameBtn');
const undoBtn     = document.getElementById('undoBtn');
// const tooltip     = document.getElementById('tooltip');
// const sizeSeg     = document.getElementById('sizeSeg');
const legendBox   = document.getElementById('legendBox');
const winLenSel   = document.getElementById('winLenSel');
const diagBtn     = document.getElementById('diagBtn');
const sqBtn       = document.getElementById('sqBtn');
const seedInput   = document.getElementById('seedInput');

const logBox      = document.getElementById('logBox');
const roomEl      = document.getElementById('roomId');
const copyBtn     = document.getElementById('copyLink');
const newRoomBtn  = document.getElementById('newRoomBtn');

const labelsTop    = document.getElementById('labels-top');
const labelsBottom = document.getElementById('labels-bottom');
const labelsLeft   = document.getElementById('labels-left');
const labelsRight  = document.getElementById('labels-right');


const plantsCount = document.getElementById('plantsCount');
const motifsCount = document.getElementById('motifsCount');


const playerCountSel = document.getElementById('playerCountSel'); // optional


// ========== Game state ==========

const state = {
    turn: 'p1',
    lastRemoved: null,
    history: [],
    winner: null,
    moveLog: [],
    grid: [],
};

// — serialize/deserialize —

function serializeState(s) {
    return {
        turn:       s.turn ?? 'p1',
        lastRemoved: (s.lastRemoved && s.lastRemoved.plant != null && s.lastRemoved.motif != null)
          ? { plant: s.lastRemoved.plant, motif: s.lastRemoved.motif }
          : null,
        history:    s.history ?? [], 
        winner:     s.winner ?? null,
        moveLog:    Array.isArray(s.moveLog) ? s.moveLog.map(m => ({
                      player: m?.player ?? null, r: m?.r ?? null, c: m?.c ?? null, not: m?.not ?? ''
                    })) : [],
        grid: (s.grid ?? []).map(row => row.map(cell => ({
          r: cell?.r ?? 0,
          c: cell?.c ?? 0,
          plant: cell?.plant ?? null,
          motif: cell?.motif ?? null,
          takenBy: cell?.takenBy ?? null
        })))       
    };
  }
  
  
  function deserializeStateInto(target, o) {
    target.lastRemoved= o.lastRemoved ? { ...o.lastRemoved } : null;
    target.turn       = o.turn || 'p1';
    target.winner     = o.winner ?? null;
    target.history    = Array.isArray(o.history) ? [...o.history] : [];
    target.moveLog    = Array.isArray(o.moveLog) ? [...o.moveLog] : [];
    target.grid       = o.grid.map(row => row.map(cell => ({ ...cell })));
  }
  
const settings = {
    rows: 4,      
    cols: 4, 
    plants: [],
    motifs: [],
    winLen: 4,
    diagOn: true,
    squareOn: true,
    seed: "",
    playersNum: 2,
};


function serializeSettings(s) {
    const rows = s.rows ?? 4;
    const cols = s.cols ?? 4;
    return {
      rows: rows,
      cols: cols,
      plants: null,
      motifs: null,
      winLen:     s.winLen ?? Math.min(rows, cols),
      diagOn:     !!s.diagOn,
      squareOn:   !!s.squareOn,
      playersNum: s.playersNum ?? 1,
      seed:       s.seed ?? '',                     
    };
  }
  
  
function deserializeSettingsInto(target, o) {
    target.rows      = o.rows;
    target.cols      = o.cols;
    target.plants = ALL_PLANTS.slice(0, o.rows);
    target.motifs = ALL_MOTIFS.slice(0, o.cols);
    target.winLen    = o.winLen;
    target.diagOn    = !!o.diagOn;
    target.squareOn  = !!o.squareOn;
    target.playersNum= o.playersNum ?? target.playersNum ?? 1;
    target.seed      = o.seed ?? '';
}
  



// ========== Helpers bound to state ==========
function genDeck() {
  const deck = [];
  for (const plant of settings.plants) {
    for (const motif of settings.motifs) {
      deck.push({ plant: plant.key, motif: motif.key });
    }
  }
  return shuffled(deck, makeRngFromSeed(settings.seed));
}


function rebuildLegend() {
  const plants = settings.plants.map(x => `${x.emoji} ${x.label}`).join(' · ');
  const motifs = settings.motifs.map(x => `${x.emoji} ${x.label}`).join(' · ');
  legendBox.innerHTML = `<strong>Plants:</strong> ${plants}<br><strong>Motifs:</strong> ${motifs}`;
}


function buildLabels() {
  const letters = Array.from({ length: settings.cols }, (_, i) => String.fromCharCode(65 + i)); // A..Z
  const numbers = Array.from({ length: settings.rows }, (_, i) => String(i + 1));               // 1..R

  // Top / Bottom (columns A..)
  labelsTop.innerHTML = '';
  labelsBottom.innerHTML = '';
  labelsTop.style.gridTemplateColumns = `repeat(${settings.cols}, 1fr)`;
  labelsBottom.style.gridTemplateColumns = `repeat(${settings.cols}, 1fr)`;
  for (const L of letters) {
    const s1 = document.createElement('span'); s1.textContent = L; labelsTop.appendChild(s1);
    const s2 = document.createElement('span'); s2.textContent = L; labelsBottom.appendChild(s2);
  }

  // Left / Right (rows 1..)
  labelsLeft.innerHTML = '';
  labelsRight.innerHTML = '';
  labelsLeft.style.gridTemplateRows = `repeat(${settings.rows}, 1fr)`;
  labelsRight.style.gridTemplateRows = `repeat(${settings.rows}, 1fr)`;
  for (const N of numbers) {
    const s1 = document.createElement('span'); s1.textContent = N; labelsLeft.appendChild(s1);
    const s2 = document.createElement('span'); s2.textContent = N; labelsRight.appendChild(s2);
  }
}


function buildGameSelOptions(){
  playerCountSel.innerHTML = '';
  for (let k = 1; k <= 6; k++) {
    const opt = document.createElement('option');
    opt.value = String(k);
    opt.textContent = `${k} player${k === 1 ? '' : 's'}`;
    if (k === settings.playersNum) opt.selected = true;
    playerCountSel.appendChild(opt);
  }
  plantsCount.innerHTML = '';
  motifsCount.innerHTML = '';
  for (let k = 2; k <= 10; k++) {
    const opt1 = document.createElement('option');
    opt1.value = String(k);
    opt1.textContent = `${k} plant${k === 1 ? '' : 's'}`;
    if (k === settings.rows) opt1.selected = true;
    plantsCount.appendChild(opt1);
    const opt2 = document.createElement('option');
    opt2.value = String(k);
    opt2.textContent = `${k} motif${k === 1 ? '' : 's'}`;
    if (k === settings.cols) opt2.selected = true;
    motifsCount.appendChild(opt2);
  }
}

function buildWinLenOptions() {
  winLenSel.innerHTML = '';
  const rows = settings.rows;
  const cols = settings.cols;
  const longest = Math.max(rows, cols);
  if (settings.winLen > longest) {
    settings.winLen = longest + 1; 
  }

  for (let k = 2; k <= longest + 1; k++) {
    const opt = document.createElement('option');
    opt.value = String(k);
    opt.textContent = `${k} in a row`;
    if (k === settings.winLen) opt.selected = true;
    winLenSel.appendChild(opt);
  }
}


function setDimensions(rows, cols) {
  settings.rows = rows;
  settings.cols = cols;

  settings.plants = ALL_PLANTS.slice(0, rows);
  settings.motifs = ALL_MOTIFS.slice(0, cols);

  buildLabels();
  rebuildLegend();
  buildWinLenOptions();
}

// Keep old API working:


function resetGameState() {
  state.turn = 'p1';
  state.lastRemoved = null;
  state.history = [];
  state.winner = null;
  state.moveLog = [];
}


function updateTurnDisplay() {
  const seat = state.turn;
  turnText.textContent = seatLabel(seat);
  turnSwatch.style.background = seatCssVar(seat);
  lastTileEl.textContent = '—';
}

function updatePlayerBadge() {
  const seat = mySeat();
  const badge = document.getElementById('playerBadge');

  if (!seat) {
    // Spectator (no seat claimed yet)
    playerText.textContent = 'Spectator';
    playerSwatch.style.background = 'var(--muted, #666)';
    badge?.classList.add('spectator');
    return;
  }

  const label = seatLabel(seat) || seat.toUpperCase();
  const cssVar = seatCssVar(seat) || 'var(--p1)';

  playerText.textContent = label;
  playerSwatch.style.background = cssVar;
  badge?.classList.remove('spectator');
}


function legalMoves(lastRemoved, grid) {
    const R = grid.length;
    const C = grid[0].length;
//   const R = state.rows, C = state.cols;

  const moves = [];
  const has = !!lastRemoved;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = grid[r][c];
    if (cell.takenBy) continue;
    if (!has) {
      if (r===0 || c===0 || r===R-1 || c===C-1) moves.push({ r, c });
    } else if (cell.plant === lastRemoved.plant || cell.motif === lastRemoved.motif) {
      moves.push({ r, c });
    }
  }
  return moves;
}


function canClick(cell) {
  if (state.winner) return false;
  if (cell.takenBy) return false;
  if (!state.lastRemoved) return isBorderCell(settings.rows, settings.cols , cell.r, cell.c);
  return cell.plant === state.lastRemoved.plant || cell.motif === state.lastRemoved.motif;
}

// ========== Rendering ==========

function renderLog() {
  if (!state.moveLog.length) { logBox && (logBox.textContent = '—'); return; }
  const lines = [];
  for (let i = 0; i < state.moveLog.length; i++) {
    const mv = state.moveLog[i];
    const num = Math.floor(i / settings.playersNum) + 1;
    const prefix = (i % settings.playersNum === 0) ? `\n${num}.` : `; `;
    const lbl = seatLabel(mv.player);
    lines.push(`${prefix} ${lbl[0]} ${mv.not}`);
  }
  if (logBox) {
    logBox.textContent = lines.join('');
    logBox.scrollTop = logBox.scrollHeight;
  }
}

function render() {
    renderSettings(); // rebuilds settings-driven UI
    renderState();    // renders state-driven UI (board, turn, etc.)
}     


function updateRuleButtonsFromSettings() {
    // Toggle rule buttons to mirror current settings
    if (diagBtn) diagBtn.classList.toggle('active', !!settings.diagOn);
    if (sqBtn)   sqBtn.classList.toggle('active',  !!settings.squareOn);
}
  
function renderSettings() {
    console.log(`Render settings:`, settings);
    // Rebuild any UI derived from settings
    setDimensions(settings.rows, settings.cols);
    buildGameSelOptions();
    updatePlayerBadge(); 
    updateRuleButtonsFromSettings();
    // rebuildLegend();
    // buildLabels();
    
}
  
function renderState() {
    // State-driven bits (no settings rebuilds here)
    renderLog();
    updateTurnDisplay();
  
    const seat = state.turn;
    if (turnText)   turnText.textContent = seatLabel(seat);
    if (turnSwatch) turnSwatch.style.background = seatCssVar(seat);
  
    if (state.lastRemoved) {
      const p = plantInfo(settings.plants, state.lastRemoved.plant);
      const m = motifInfo(settings.motifs, state.lastRemoved.motif);
      lastTileEl.innerHTML = `<span>${p.emoji}</span> ${p.label} / <span>${m.emoji}</span> ${m.label}`;
    } else {
      lastTileEl.textContent = '— (first move from border)';
    }
  
    if (state.winner) {
      const who = seatLabel(state.winner);
      statusBox.innerHTML = `<span class="winner">${who}</span> wins!`;
    } else {
      const count = legalMoves(state.lastRemoved, state.grid).length;
      statusBox.textContent = `${count} legal move${count === 1 ? '' : 's'} available.`;
    }
  
    // Board render from current state + settings dimensions
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${settings.cols}, 1fr)`;
  
    for (let r = 0; r < settings.rows; r++) {
      for (let c = 0; c < settings.cols; c++) {
        const cell = state.grid[r][c];
        const node = tileTpl.content.firstElementChild.cloneNode(true);
        node.dataset.r = r; node.dataset.c = c;
  
        const p = plantInfo(settings.plants, cell.plant);
        const m = motifInfo(settings.motifs, cell.motif);
  
        node.querySelector('.sym-emoji').textContent = `${p.emoji} ${m.emoji}`;
        node.querySelector('.sym-text').textContent  = `${p.label} | ${m.label}`;
  
        const clickable = canClick(cell);
        node.classList.toggle('disabled', !clickable);
        node.classList.toggle('highlight', clickable);
  
        if (cell.takenBy) {
          const tok = document.createElement('div');
          tok.className = `token ${cell.takenBy}`;
          tok.textContent = seatLabel(cell.takenBy).toUpperCase();
          node.appendChild(tok);
        }
  
        node.addEventListener('click', () => placeToken(cell));
        boardEl.appendChild(node);
      }
    }
  }
  


// ========== Local moves (offline) ==========
function placeToken(cell) {
    if (!state.grid || !state.grid.length) return;
    if (!canClick(cell)) return;
  

    if (isOnline()) {
        publishMove(cell.r, cell.c);
        return; // Realtime will re-render everyone
    }
    render();
}

function undo() {
  if (isOnline()) return; // disabled in MP
  const step = state.history.pop();
  if (!step) return;

  state.moveLog.pop();
  renderLog();

  const cell = state.grid[step.r][step.c];
  cell.takenBy   = null;
  state.lastRemoved = step.prevLast;
  state.turn     = step.prevTurn;
  state.winner   = step.prevWinner || null;

  render();
}


// ========== New game ==========
function newGame() {
    console.log(`New game:`, state, settings);
  const R = settings.rows, C = settings.cols;
  setDimensions(R, C);
  

  const seedValue = (seedInput.value || "").trim();
  if (seedValue) {
    settings.seed = seedValue;
  } else {
    const rs = randomSeedString();
    settings.seed = rs;
    seedInput.value = rs;
  }

  resetGameState();

  state.grid = Array.from({ length: R }, () => Array.from({ length: C }, () => ({})));
  const deck = genDeck();
  let i = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    state.grid[r][c] = { r, c, ...deck[i++], takenBy: null };
  }

  renderState();

  if (isOnline() && mySeat() === 'p1') {
    // Only the host sets the canonical fresh state
    console.log(`Pushing full state to room: ${room}`);
    pushFullStateFromLocal();
  }
}



// ========== Wiring: local UI ==========
newGameBtn?.addEventListener('click', () => newGame());
undoBtn?.addEventListener('click', undo);


winLenSel?.addEventListener('change', () => {
  settings.winLen = parseInt(winLenSel.value, 10);
});
diagBtn?.addEventListener('click', () => {
  settings.diagOn = !settings.diagOn;
  diagBtn.classList.toggle('active', settings.diagOn);
});
sqBtn?.addEventListener('click', () => {
  settings.squareOn = !settings.squareOn;
  sqBtn.classList.toggle('active', settings.squareOn);
});

newRoomBtn?.addEventListener('click', createNewRoom);
copyBtn?.addEventListener('click', copyShareLink);

playerCountSel?.addEventListener('change', () => {
  settings.playersNum = parseInt(playerCountSel.value, 10);
  console.log(`Players: ${settings.playersNum}`);
});

plantsCount?.addEventListener('change', () => {
  settings.rows =  parseInt(plantsCount.value, 10) || 4;
  setDimensions(settings.rows, settings.cols);
});

motifsCount?.addEventListener('change', () => {
  settings.cols =  parseInt(motifsCount.value, 10) || 4;
  setDimensions(settings.rows, settings.cols);
});


// — Config (use yours; these are the ones you tested earlier)
const firebaseConfig = {
  apiKey: "AIzaSyDJh-4cEA7Xk_XPMpZaDBYzq7o5CRO2I-A",
  authDomain: "tic-tac-toe-4ce01.firebaseapp.com",
  databaseURL: "https://tic-tac-toe-4ce01-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tic-tac-toe-4ce01",
  storageBucket: "tic-tac-toe-4ce01.firebasestorage.app",
  messagingSenderId: "774317002305",
  appId: "1:774317002305:web:a48925302e0195161280c0",
  measurementId: "G-3DLBD5VH45"
};

let app, db, auth, uid = null;
let room = null;
let seats = {};


function initRealtime() {
  app = initializeApp(firebaseConfig);
  db  = getDatabase(app);
  auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    if (user) {uid = user.uid;  updatePlayerBadge();}
    else signInAnonymously(auth).catch(console.error);
  });
}



// returns a Promise that resolves once uid exists
function waitForAuthReady() {
    return new Promise((resolve) => {
      const stop = onAuthStateChanged(auth, (user) => {
        if (user) { uid = user.uid; stop(); resolve(); }
        else signInAnonymously(auth).catch(console.error);
      });
    });
  }


function roomFromHash() {
  const h = (location.hash || '').replace('#','').trim();
  return h || null;
}


async function createNewRoom() {
    console.log(`Creating new room`, settings, state);
    const id = `room-${Math.random().toString(36).slice(2,8)}`;
    location.hash = id;
    renderSettings();
    //   newGame();
    return joinRoom(id);
}

async function pushFullStateFromLocal() {
    if (!isOnline()) return;
    const rootRef = ref(db, `okiya/${room}`);
    await runTransaction(rootRef, (root) => {
      root = root || {};
    //   if (root.state) return root; // someone already initialized; no-op
      root.settings = serializeSettings(settings);
      root.state    = serializeState(state);
      return root;
    });
  }


async function joinRoom(roomId) {
    // Ensure we're authenticated
    if (!uid) { await waitForAuthReady(); }
  
    // Resolve room id & update UI
    room = roomId || roomFromHash() || `room-${Math.random().toString(36).slice(2,8)}`;
    if (!location.hash) location.hash = room;
    if (roomEl) roomEl.textContent = room;
    console.log(`Joining room: ${room} (uid: ${uid})`);
  
    const rootRef      = ref(db, `okiya/${room}`);
    const playersRef   = ref(db, `okiya/${room}/players`);
    const settingsRef  = ref(db, `okiya/${room}/settings`);
    const stateRef     = ref(db, `okiya/${room}/state`);
  
    // Upsert players & claim a seat (seat count guided by settings.playersNum if present)
    await runTransaction(rootRef, (root) => {
      root = root || {};
      root.players = root.players || {};
  
      // Prefer server settings.playersNum, else local settings, else 1
      const maxSeats =
        Math.max(1, Math.min(6,
          (root.settings && typeof root.settings.playersNum === 'number' && root.settings.playersNum) ||
          (typeof settings.playersNum === 'number' && settings.playersNum) || 1
        ));
  
      for (let i = 0; i < maxSeats; i++) {
        const s = SEAT_IDS[i];
        if (!root.players[s] || root.players[s] === uid) { root.players[s] = uid; break; }
      }
  
      // Keep explicit nulls to signal "not yet initialized"
      if (root.state     === undefined) root.state     = null;
      if (root.settings  === undefined) root.settings  = null;
  
      return root;
    });
  
    // Presence heartbeat
    const presRef = ref(db, `okiya_presence/${room}/${uid}`);
    update(presRef, { id: uid, at: serverTimestamp() });
    onDisconnect(presRef).remove();
  
    updatePlayerBadge();
  
    // --- Live subscriptions ---
  
    // Players / seats
    onValue(playersRef, (snap) => {
      seats = snap.val() || seats;
      updatePlayerBadge();
      if (typeof updateHostControls === 'function') updateHostControls();
    });
  
    // Settings
    onValue(settingsRef, (snap) => {
      const s = snap.val();
      if (!s) return; // host will publish on new game start
      deserializeSettingsInto(settings, s);
      // Avoid rendering the board until we also have state (grid)
      renderSettings();
      if (roomEl) roomEl.textContent = room;
    });
  
    // State
    onValue(stateRef, async (snap) => {
      const s = snap.val();
  
      if (!s) {
        statusBox.textContent = 'Waiting for host to start a game…';
        // if (mySeat() === 'p1') {
        //   newGame();
        // } else {
        // }
        return;
      }
      console.log(`State update for room ${room}:`, s);
      deserializeStateInto(state, s);
      renderState();
      if (roomEl) roomEl.textContent = room;
    });
}
  

function isOnline() { return !!room && !!uid; }

function mySeat() {
  if (!uid) return null;
  for (const s of SEAT_IDS) if (seats[s] === uid) return s;
  return null;
}

async function copyShareLink() {
  const url = `${location.origin}${location.pathname}#${room || roomFromHash() || ''}`;
  try { await navigator.clipboard.writeText(url); statusBox.textContent = 'Link copied.'; } catch {}
}

async function publishMove(r, c) {
    if (!isOnline()) return;
  
    const rootRef = ref(db, `okiya/${room}`);
    await runTransaction(rootRef, (root) => {
      root = root || {};
      const st   = root.state;
      const sets = root.settings;
      const me   = mySeatFromRoot(root, uid);
  
      // Must have state, settings, and a seat
      if (!st || !sets || !me) return root;
  
      // Enforce turn order & basic legality
      if (st.winner) return root;
      if (st.turn !== me) return root;
      if (!st.grid?.[r]?.[c]) return root;
  
      const cell = st.grid[r][c];
      if (cell.takenBy) return root;
  
      // First pick must be on the border; later picks must match lastRemoved by plant or motif
      const first = !st.lastRemoved;
      const onBorder = (r === 0 || c === 0 || r === sets.rows - 1 || c === sets.cols - 1);
      const matchesLast = (!first && (cell.plant === st.lastRemoved.plant || cell.motif === st.lastRemoved.motif));
      if (!(first ? onBorder : matchesLast)) return root;
  
      // Apply move
      st.lastRemoved = { plant: cell.plant, motif: cell.motif };
      cell.takenBy = me;
  
      st.moveLog = st.moveLog || [];
      st.moveLog.push({ player: me, r, c, not: toNotation(r, c) });
  
      // Win / next turn
      if (checkWinForDB(me, st, sets)) {
        st.winner = me;
      } else {
        st.turn = nextSeatLocal(st.turn, sets.playersNum);
        if (!hasAnyLegalMove(st, sets)) st.winner = me; // opponent has no legal moves
      }
  
      root.state = st; // persist only state changes; settings remain untouched
      return root;
    });
}
  
function mySeatFromRoot(root, who) {
    for (const s of SEAT_IDS) if (root.players && root.players[s] === who) return s;
    return null;
}

    // — DB-side win checks (pure on POJO) —
    // Uses immutable `sets` (settings) for board geometry and rules.
function checkWinForDB(player, st, sets) {
    const k = sets.winLen;
    const R = sets.rows, C = sets.cols;
  
    const needK = (line) => { 
      let run = 0; 
      for (const v of line) { 
        run = (v === player) ? run + 1 : 0; 
        if (run >= k) return true; 
      } 
      return false; 
    };
  
    // Rows
    for (let r = 0; r < R; r++) { 
      const line = []; 
      for (let c = 0; c < C; c++) line.push(st.grid[r][c].takenBy); 
      if (needK(line)) return true; 
    }
    // Columns
    for (let c = 0; c < C; c++) { 
      const line = []; 
      for (let r = 0; r < R; r++) line.push(st.grid[r][c].takenBy); 
      if (needK(line)) return true; 
    }
  
    // Diagonals
    if (sets.diagOn) {
      // ↘ diagonals starting from top row
      for (let c0 = 0; c0 < C; c0++) { 
        const line = []; 
        for (let r = 0, c = c0; r < R && c < C; r++, c++) line.push(st.grid[r][c].takenBy); 
        if (needK(line)) return true; 
      }
      // ↘ diagonals starting from left column (skip [0,0] to avoid duplicate)
      for (let r0 = 1; r0 < R; r0++) { 
        const line = []; 
        for (let r = r0, c = 0; r < R && c < C; r++, c++) line.push(st.grid[r][c].takenBy); 
        if (needK(line)) return true; 
      }
      // ↙ diagonals starting from top row
      for (let c0 = C - 1; c0 >= 0; c0--) { 
        const line = []; 
        for (let r = 0, c = c0; r < R && c >= 0; r++, c--) line.push(st.grid[r][c].takenBy); 
        if (needK(line)) return true; 
      }
      // ↙ diagonals starting from right column (skip [0,C-1] to avoid duplicate)
      for (let r0 = 1; r0 < R; r0++) { 
        const line = []; 
        for (let r = r0, c = C - 1; r < R && c >= 0; r++, c--) line.push(st.grid[r][c].takenBy); 
        if (needK(line)) return true; 
      }
    }
  
    // 2x2 squares
    if (sets.squareOn) {
      for (let r = 0; r < R - 1; r++) {
        for (let c = 0; c < C - 1; c++) {
          if (st.grid[r][c].takenBy     === player &&
              st.grid[r+1][c].takenBy   === player &&
              st.grid[r][c+1].takenBy   === player &&
              st.grid[r+1][c+1].takenBy === player) return true;
        }
      }
    }
  
    return false;
}
  
function hasAnyLegalMove(st, sets) {
    const first = !st.lastRemoved;
    if (first) return true; // if nothing removed yet, any border move is legal; existence guaranteed by board geometry
  
    const R = sets.rows, C = sets.cols;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = st.grid[r][c];
      if (cell.takenBy) continue;
      if (cell.plant === st.lastRemoved.plant || cell.motif === st.lastRemoved.motif) return true;
    }
    return false;
}
  

function isHost() { 
  return mySeat() === 'p1'; 
}

function updateHostControls() {
  const host = isHost();

  // knobs you want host-only:
  [winLenSel, diagBtn, sqBtn, seedInput, newGameBtn, motifsCount, plantsCount, playerCountSel, newRoomBtn, undoBtn
  ].forEach(el => {
    if (!el) return;
    el.toggleAttribute('disabled', !host);
    el.classList.toggle('readonly', !host);
  });
}


// ========== Boot ==========
async function boot() {
    initRealtime();
  
    await joinRoom();
  
  }

boot();
