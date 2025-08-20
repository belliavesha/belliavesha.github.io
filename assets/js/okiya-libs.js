// okiya-lib.js
// Constants + utility helpers (no DOM, no Firebase).

export const ALL_PLANTS = [
  {key:'maple',  emoji:'🍁', label:'Maple'},
  {key:'cherry', emoji:'🌸', label:'Cherry'},
  {key:'elm',    emoji:'🌳', label:'Elm'},
  {key:'lotus',  emoji:'🪷', label:'Lotus'},
  {key:'pine',   emoji:'🌲', label:'Pine'},
  {key:'bamboo', emoji:'🎋', label:'Bamboo'},
  {key:'cycas',  emoji:'🌴', label:'Cycas'},
  {key:'rose',   emoji:'🌹', label:'Rose'},
  {key:'cactus', emoji:'🌵', label:'Cactus'},
  {key:'iris',   emoji:'🌿', label:'Iris'},
  {key:'bonsai', emoji:'🪴', label:'Bonsai'}, 
  {key:'stone',  emoji:'🪨', label:'Stone'},
  {key:'ginkgo', emoji:'🍂', label:'Ginkgo'},
  {key:'hibiscus', emoji:'🌺', label:'Hibiscus'},
];

export const ALL_MOTIFS = [
  {key:'sun',  emoji:'☀️', label:'Sun'},
  {key:'rain', emoji:'🌧️', label:'Rain'},
  {key:'haiku', emoji:'📝', label:'Haiku'},
  {key:'crane', emoji:'🐦', label:'Crane'},
  {key:'moon', emoji:'🌙', label:'Moon'},
  {key:'wave', emoji:'🌊', label:'Wave'},
  {key:'fan',  emoji:'🪭', label:'Fan'},
  {key:'koi', emoji:'🐠', label:'Koi'},
  {key:'tea', emoji:'🍵', label:'Tea'},
  {key:'lamp', emoji:'🏮', label:'Lamp'},
  {key:'star', emoji:'⭐', label:'Star'},
  {key:'fuji', emoji:'⛰️', label:'Fuji'},
  {key:'dragon', emoji:'🐉', label:'Dragon'},
  {key:'yinyang', emoji:'☯️', label:'Yin-Yang'},
  {key:'kintsugi', emoji:'🪞', label:'Kintsugi'},
  {key:'zen', emoji:'🧘‍♂️', label:'Zen'},
  {key:'castle', emoji:'🏯', label:'Castle'},
  {key:'doll', emoji:'🎎', label:'Doll'},
  {key:'kimono', emoji:'👘', label:'Kimono'},
  {key:'torii', emoji:'⛩️', label:'Torii'},
];



// ---------- N-player constants ----------
export const SEAT_IDS = ['p1','p2','p3','p4','p5','p6'];
export const PLAYER_LABELS = ['Red','Blue','Green','Yellow','White','Purple']; // 1..6

function seatIndex(seatId) { return Math.max(0, SEAT_IDS.indexOf(seatId)); }
export function seatLabel(seatId) { const i = seatIndex(seatId); return PLAYER_LABELS[i] || `P${i+1}`; }
export function seatCssVar(seatId){ const i = seatIndex(seatId)+1; return `var(--p${i})`; }
export function nextSeatLocal(seatId, max) {
    const idx = seatIndex(seatId);
    const next = (idx + 1) % Math.max(1, Math.min(max, 6));
    return SEAT_IDS[next];
    
}
export function prevSeatLocal(seatId, max) {
  const idx = seatIndex(seatId);
  const m = Math.max(1, Math.min(max, 6));
  const prev = (idx - 1 + m) % m;
  return SEAT_IDS[prev];
}

// — RNG helpers —
export function xfnv1a(string) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < string.length; i++) {
    hash ^= string.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => hash >>> 0;
}

export function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRngFromSeed(seed) {
  const h = xfnv1a(String(seed))();
  return mulberry32(h);
}

export function randomSeedString() {
  if (window.crypto && crypto.getRandomValues) {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(x => x.toString(16).padStart(8,'0')).join('').slice(0,8);
  }
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
}

export function shuffled(array, rng = Math.random) {
  return array.map(v => [rng(), v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
}

// — Board helpers —
export function isBorderCell(R, C, r, c) {
  return r === 0 || c === 0 || r === R - 1 || c === C - 1;
}


export function toNotation(r, c) {
  return `${String.fromCharCode(97 + c)}${r + 1}`;
}

export function cloneGrid(g) {
  return g.map(row => row.map(cell => ({ ...cell })));
}

// — Data helpers (pure) —


export function plantInfo(plants, key) {
  return plants.find(p => p.key === key);
}

export function motifInfo(motifs, key) {
  return motifs.find(m => m.key === key);
}

