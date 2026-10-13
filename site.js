/* revontuli — shared site code for every page: settings, the (simulated) clock, the Turku sky & weather
   model, the dock (menu) generated from data.js, and the command line with its read-only repository.
   Plain JS, no libraries. Needs data.js first. */
(() => {
'use strict';
const RV = window.RV = window.RV || {};
const SITE = window.SITE;
const $ = (s, r = document) => r.querySelector(s);
const Q = new URLSearchParams(location.search);
const ROOT = '';
const PAGE = document.body.dataset.page || 'home';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
Object.assign(RV, { PAGE, clamp, smooth, esc, hex, mix, rgba });

/* ================= storage: per-visitor niceties only, always in try/catch ================= */
const P = 'rv.';
const store = {
  get(k, d) { try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(P + k); } catch (e) {} },
  sget(k, d) { try { const v = sessionStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  sset(k, v) { try { sessionStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
};
RV.store = store;

/* ================= settings (persist across pages) ================= */
/* The stone-skipping luck: skips are drawn from a Poisson distribution with this mean.
   Change it here, or live with the command `luck <value>` (which is remembered per visitor). */
const SKIP_LAMBDA = 3.5;
RV.SKIP_LAMBDA = SKIP_LAMBDA;
const DEFAULTS = { hog: 'on', hogSpeed: 1, rain: 'auto', rainOffAt: 0, snow: 'auto', aurora: 'auto', window: 'auto', smoke: 'auto',
  saunaUntil: 0, motion: 'auto', dock: 'open', luck: null, sim: null };
let S = Object.assign({}, DEFAULTS, store.get('settings', {}));
const listeners = [];
const emit = patch => listeners.forEach(f => { try { f(patch); } catch (e) { console.error(e); } });
RV.settings = () => S;
RV.set = (patch, quiet) => { Object.assign(S, patch); store.set('settings', S); applyMotion(); if (!quiet) emit(patch); };
RV.onChange = f => listeners.push(f);
RV.luck = () => (S.luck > 0 ? S.luck : SKIP_LAMBDA);
// URL overrides for testing (never persisted): ?t=ISO &speed= &rain= &snow= &aurora= &smoke= &hog= &window=
const URLOV = {};
for (const k of ['rain', 'snow', 'aurora', 'smoke']) if (Q.has(k)) URLOV[k] = Q.get(k) === '0' ? 'off' : 'on';
if (Q.has('hog')) URLOV.hog = Q.get('hog') === '0' ? 'off' : 'on';
if (Q.has('window')) URLOV.window = Q.get('window');
RV.opt = k => (k in URLOV ? URLOV[k] : S[k]);
RV.setOpt = (k, v) => { delete URLOV[k]; RV.set({ [k]: v }); };
addEventListener('storage', e => {
  if (e.key === P + 'settings') { S = Object.assign({}, DEFAULTS, store.get('settings', {})); applyMotion(); emit({ all: true }); }
});
const mq = matchMedia('(prefers-reduced-motion: reduce)');
RV.reduced = () => S.motion === 'reduced' ? true : S.motion === 'full' ? false : mq.matches;
function applyMotion() { document.documentElement.classList.toggle('rv-reduced', RV.reduced()); }
applyMotion();

/* ================= the clock: real, or simulated / time-lapsed (the simulation persists across pages) ================= */
let URLSIM = null;
if (Q.get('t') && isFinite(Date.parse(Q.get('t')))) URLSIM = { real: Date.now(), sim: Date.parse(Q.get('t')), speed: Math.max(0, parseFloat(Q.get('speed')) || 1) };
else if (Q.get('speed')) URLSIM = { real: Date.now(), sim: Date.now(), speed: Math.max(0, parseFloat(Q.get('speed')) || 1) };
const simConf = () => URLSIM || S.sim;
RV.now = () => { const c = simConf(); return c ? c.sim + (Date.now() - c.real) * c.speed : Date.now(); };
RV.speed = () => (simConf() || { speed: 1 }).speed;
RV.simulated = () => !!simConf();
RV.setClock = (simMs, speed) => {
  const now = RV.now(), sp = speed == null ? RV.speed() : speed;
  let c = { real: Date.now(), sim: simMs == null ? now : simMs, speed: sp };
  if (Math.abs(c.sim - Date.now()) < 30e3 && c.speed === 1) c = null;
  URLSIM = null; RV.set({ sim: c }, true); emit({ clock: true });
};
RV.resetClock = () => { URLSIM = null; RV.set({ sim: null }, true); emit({ clock: true }); };
RV.reset = () => {
  S = Object.assign({}, DEFAULTS); for (const k in URLOV) delete URLOV[k]; URLSIM = null;
  store.set('settings', S); store.del('skipBest'); applyMotion(); emit({ all: true, clock: true });
};

/* ================= astronomy for Turku (after Meeus / suncalc; ~0.1° for the Sun) ================= */
const RAD = Math.PI / 180, DAY = 864e5, OBL = RAD * 23.4397;
const LAT = 60.4518, LON = 22.2666;
const toDays = ms => ms / DAY - 0.5 + 2440588 - 2451545;
function altAz(ra, dec, d, lat = LAT, lon = LON) {
  const phi = RAD * lat, H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / RAD, az: ((az / RAD + 180) % 360 + 360) % 360 };
}
function sunRaDec(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  return { ra: Math.atan2(Math.sin(L) * Math.cos(OBL), Math.cos(L)), dec: Math.asin(Math.sin(OBL) * Math.sin(L)) };
}
const sunPos = (ms, lat = LAT, lon = LON) => { const d = toDays(ms), s = sunRaDec(d); return altAz(s.ra, s.dec, d, lat, lon); };
function moonPos(ms) {
  const d = toDays(ms);
  const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
  const ra = Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l));
  return altAz(ra, dec, d);
}
function moonPhase(ms) { const Pm = 29.530588853, age = (((ms - Date.UTC(2000, 0, 6, 18, 14)) / DAY) % Pm + Pm) % Pm; return { age, frac: (1 - Math.cos(2 * Math.PI * age / Pm)) / 2, waxing: age < Pm / 2 }; }
const fmtParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', weekday: 'short' });
function local(ms) { const o = {}; for (const p of fmtParts.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = p.type === 'weekday' ? p.value : +p.value; o.hour %= 24; o.doy = Math.floor((Date.UTC(o.year, o.month - 1, o.day) - Date.UTC(o.year, 0, 0)) / DAY); o.md = o.month * 100 + o.day; return o; }
function tzOff(ms) { const p = local(ms); return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000); }
function localMidnight(ms) { const off = tzOff(ms); const wall = ms + off * 6e4; return Math.floor(wall / DAY) * DAY - off * 6e4; }
function fromLocal(y, mo, d, h = 12, mi = 0) { let ms = Date.UTC(y, mo - 1, d, h, mi); for (let i = 0; i < 2; i++) ms = Date.UTC(y, mo - 1, d, h, mi) - tzOff(ms) * 6e4; return ms; }
const hm = ms => { const p = local(ms); return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'); };
function dayInfo(ms) {
  const m0 = localMidnight(ms), step = 12e4, H0 = -0.833;
  let prev = sunPos(m0).alt, rise = null, set = null, len = 0, max = prev;
  for (let i = 1; i <= 720; i++) {
    const t = m0 + i * step, a = sunPos(t).alt; max = Math.max(max, a);
    if (prev < H0 && a >= H0 && rise === null) rise = t - step * (a - H0) / (a - prev);
    if (prev >= H0 && a < H0) set = t - step * (a - H0) / (a - prev);
    if (a >= H0 && prev >= H0) len += step; else if (a >= H0 || prev >= H0) len += step * Math.abs((a >= H0 ? a - H0 : prev - H0) / (a - prev));
    prev = a;
  }
  return { rise, set, len, max };
}
RV.astro = { RAD, DAY, LAT, LON, toDays, altAz, sunPos, moonPos, moonPhase, local, tzOff, localMidnight, fromLocal, hm, dayInfo };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const when = ms => { const L = local(ms); return `${L.weekday} ${L.day} ${MON[L.month - 1]} ${L.year}, ${hm(ms)}`; };
RV.when = when;

/* the sky's palette, keyed by solar altitude (the lake, the dial and the merits window share it) */
const SKY = [
  [-90, '#070B14', '#0A101C', '#0F1827'], [-18, '#0A1120', '#0E1829', '#152238'], [-12, '#0C1527', '#142039', '#233354'],
  [-8, '#111D35', '#1E2D50', '#44507A'], [-5, '#172745', '#2B3D68', '#86789F'], [-2, '#1F3157', '#3A4F80', '#CC958C'],
  [0.4, '#28406A', '#4B6594', '#E9AE8A'], [2.6, '#7FA4CC', '#A9C0DA', '#F1CDA3'], [7, '#88AED5', '#B7CDE2', '#EDDBC2'],
  [18, '#8BB4DB', '#BBD4EA', '#E4ECEF'], [55, '#80AEDC', '#B4D1EC', '#E2EDF4']
].map(r => [r[0], hex(r[1]), hex(r[2]), hex(r[3])]);
RV.skyAt = (alt, grey = 0) => {
  let i = 0; while (i < SKY.length - 2 && alt > SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1], t = clamp((alt - a[0]) / (b[0] - a[0]), 0, 1);
  const out = [1, 2, 3].map(k => mix(a[k], b[k], t));
  if (grey > 0) return out.map(c => { const g = c[0] * .3 + c[1] * .55 + c[2] * .15; return mix(c, [g * 1.02, g, g * 1.03], grey); });
  return out;
};

/* ================= weather over Turku: deterministic, from Perlin noise =================
   A day is rainy when a 1-D Perlin fBm of the day-of-year (rank-transformed to a uniform number) falls
   below the seasonal chance — lowest in March–April, highest in October–November. On a rainy day a
   second, faster Perlin noise of the clock decides when the showers start and stop.                 */
function hash(i, s) { let h = Math.imul(i ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(s + 0x632BE5AB, 0xC2B2AE35); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15; return (h >>> 0) / 4294967296; }
function perlin(x, s) { const i = Math.floor(x), f = x - i, g0 = hash(i, s) * 2 - 1, g1 = hash(i + 1, s) * 2 - 1, u = f * f * f * (f * (f * 6 - 15) + 10); return (g0 * f) * (1 - u) + (g1 * (f - 1)) * u; }
const fbm = (x, s) => perlin(x, s) + 0.5 * perlin(x * 2.03 + 17.1, s + 1) + 0.25 * perlin(x * 4.1 + 3.3, s + 2);
const CDF = (() => { const a = new Float32Array(4001); for (let i = 0; i <= 4000; i++) a[i] = fbm(i * 0.6173 + 0.311, 99); a.sort(); return a; })();
function uniform(v) { let lo = 0, hi = CDF.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (CDF[m] < v) lo = m + 1; else hi = m; } return lo / (CDF.length - 1); }
RV.noiseU = (x, s) => uniform(fbm(x, s));
const MONTH_P = [0.36, 0.30, 0.19, 0.17, 0.24, 0.30, 0.36, 0.41, 0.44, 0.53, 0.56, 0.45];   // chance that a day brings showers
function seasonP(doy) {
  const mids = MONTH_P.map((p, m) => 15 + m * 30.44), x = ((doy % 365.25) + 365.25) % 365.25;
  let i = mids.findIndex(v => v > x); if (i < 0) i = 12; const i0 = (i + 11) % 12, i1 = i % 12;
  const x0 = i === 0 ? mids[11] - 365.25 : mids[i0], x1 = i === 12 ? mids[0] + 365.25 : mids[i1];
  const t = (x - x0) / (x1 - x0), u = (1 - Math.cos(Math.PI * t)) / 2;
  return MONTH_P[i0] + (MONTH_P[i1] - MONTH_P[i0]) * u;
}
const dayWet = L => uniform(fbm(L.doy / 4.2 + (L.year % 1000) * 7.31, 11));
function precipAt(ms) {
  const L = local(ms), p = seasonP(L.doy), u = dayWet(L);
  if (u >= p) return 0;
  const depth = (p - u) / p, f = 0.26 + 0.5 * depth;
  const v = uniform(fbm(ms / 3.6e6 / 3.2 + 500, 23)), x = (v - (1 - f)) / 0.05;
  return x <= 0 ? 0 : smooth(0, 1, x) * (0.45 + 0.55 * depth);
}
RV.snowSeason = L => L.md >= 1122 || L.md <= 325;
RV.weather = (ms = RV.now()) => {
  const L = local(ms), snowS = RV.snowSeason(L);
  let raw = precipAt(ms);
  const w = { L, p: seasonP(L.doy), rainyDay: dayWet(L) < seasonP(L.doy), kind: snowS ? 'snow' : 'rain', auto: raw };
  const force = RV.opt(snowS ? 'snow' : 'rain');
  if (force === 'on') raw = Math.max(raw, 0.75);
  if (force === 'off') raw = 0;
  w.intensity = raw; w.raining = !snowS && raw > 0; w.snowing = snowS && raw > 0;
  // minutes since the rain ended (for the rainbow): a manual stop (`rain off`, `rainbow`), or a natural one
  w.sinceEnd = Infinity; w.endedAt = null;
  if (!snowS && raw === 0) {
    if (S.rainOffAt) { const m = (ms - S.rainOffAt) / 6e4; if (m >= 0 && m < 30) { w.sinceEnd = m; w.endedAt = S.rainOffAt; } }
    if (RV.opt('rain') !== 'off') for (let m = 0.5; m <= 15; m += 0.5) if (precipAt(ms - m * 6e4) > 0) { if (m - 0.25 < w.sinceEnd) { w.sinceEnd = m - 0.25; w.endedAt = Math.ceil((ms - w.sinceEnd * 6e4) / 6e4) * 6e4; } break; }
  }
  return w;
};
RV.forecast = (ms = RV.now()) => {           // today's shower windows (local time, to the minute), [start, end] pairs
  const m0 = localMidnight(ms), spans = []; let cur = null;
  for (let t = m0; t <= m0 + DAY; t += 6e4) { const on = precipAt(t) > 0; if (on && !cur) cur = [t, t]; if (on) cur[1] = t + 6e4; if (!on && cur) { spans.push(cur); cur = null; } }
  if (cur) spans.push(cur);
  return spans;
};
/* the cabin's schedule: sauna on odd days of the year in the evening (or when someone typed `sauna`);
   smoke for the sauna and all through the cold season; steam after sauna, frost on cold mornings */
RV.env = (ms = RV.now()) => {
  const L = local(ms), sun = sunPos(ms), w = RV.weather(ms);
  const cold = L.md >= 1115 || L.md <= 331;
  const eveningSauna = L.doy % 2 === 1 && L.hour >= 18 && L.hour < 23;
  const manualSauna = S.saunaUntil > ms && S.saunaUntil - ms < 3 * 36e5;
  const sauna = eveningSauna || manualSauna;
  const so = RV.opt('smoke'), smoke = so === 'on' ? true : so === 'off' ? false : (sauna || cold);
  const wo = RV.opt('window'), wm = { ice: 'frost', icy: 'frost', frost: 'frost', steam: 'steam', clear: 'clear' }[wo];
  const win = wm || (sauna ? 'steam' : cold && (L.hour < 10 || L.hour >= 22) ? 'frost' : 'clear');
  return { L, sun, w, cold, sauna, eveningSauna, manualSauna, smoke, smokeWhy: smoke ? (sauna ? 'sauna' : so === 'on' ? 'you' : 'cold') : '', win,
    lamp: sun.alt < -2 && (L.hour >= 15 || L.hour < 1), frozen: L.md >= 1215 || L.md <= 412 };
};

/* ================= the dock (menu + command line), generated from SITE.nav / SITE.explorers ================= */
const ICON = {
  term: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4l4 4-4 4M8 12.5h5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  chev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const cur = k => PAGE === k ? ' aria-current="page"' : '';
let dock, out, log, sheet, pop, toastEl, input;
function mk(html, parent = document.body) { const d = document.createElement('div'); d.innerHTML = html.trim(); const e = d.firstChild; parent.appendChild(e); return e; }
function buildDock() {
  dock = mk(`<nav class="rv-dock" id="rvDock" aria-label="Site" data-open="true">
    <a class="rv-home" href="index.html" aria-label="Home — the lake"${cur('home')}><svg class="rv-dial" id="rvDial" viewBox="0 0 34 34" aria-hidden="true"></svg><span class="rv-name">home</span></a>
    <ul class="rv-links">${SITE.nav.filter(n => n.key !== 'home' && n.menu !== false).map(n => `<li><a href="${n.href}"${cur(n.key)}>${esc(n.label)}</a></li>`).join('')}
      <li><a href="${SITE.CV}" target="_blank" rel="noopener">cv <span class="rv-arr" aria-hidden="true">↗</span></a></li>
      <li><button type="button" id="rvExpBtn" aria-expanded="false" aria-controls="rvExp">misc. <span class="rv-arr" aria-hidden="true">▴</span></button></li></ul>
    <span class="rv-sep" aria-hidden="true"></span>
    <form class="rv-cli" id="rvCli" autocomplete="off" role="search" aria-label="Command line"><label class="rv-ps" id="rvPs" for="rvIn">~ $</label><input id="rvIn" type="text" placeholder="type help" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Command line — type help for the list of commands"></form>
    <span class="rv-chip clock" id="rvClock"><span class="rv-chip-t" id="rvClockT"></span><button type="button" id="rvClockX" aria-label="Back to the real time" title="back to the real time">⟲</button></span>
    <button type="button" class="rv-chip wx" id="rvWx" aria-label="Today’s showers"></button>
    <button class="rv-icon rv-only-s" id="rvCliBtn" type="button" aria-label="Open the command line">${ICON.term}</button>
    <button class="rv-icon rv-only-s rv-menu" id="rvMenuBtn" type="button" aria-expanded="false" aria-controls="rvSheet" aria-label="Menu">${ICON.menu}</button>
    <button class="rv-icon rv-only-l rv-collapse" id="rvCollapse" type="button" aria-expanded="true" aria-label="Collapse the menu">${ICON.chev}</button>
  </nav>`);
  out = mk(`<section class="rv-panel rv-out" id="rvOut" aria-label="Command line output"><div class="rv-out-head"><span>terminal · <span id="rvWhere"></span></span><span><button type="button" id="rvClear" aria-label="Clear the terminal">clear</button><button type="button" id="rvX" aria-label="Close the terminal">×</button></span></div><div class="rv-log" id="rvLog" role="log" aria-live="polite"></div><div class="rv-chips" id="rvChips"></div></section>`);
  log = $('#rvLog');
  sheet = mk(`<nav class="rv-panel rv-sheet" id="rvSheet" aria-label="Menu"><ul>
    ${SITE.nav.filter(n => n.key !== 'home' && n.menu !== false).map(n => `<li><a href="${n.href}"${cur(n.key)}>${esc(n.label)}<small>${esc(n.note)}</small></a></li>`).join('')}
    <li><a href="${SITE.CV}" target="_blank" rel="noopener">cv ↗<small>PDF</small></a></li><li><a href="about.html#contact">contact<small>mail · github · telegram</small></a></li>
    <li class="rv-sub">misc.</li>${SITE.explorers.map(e => `<li><a href="${e.href}">${esc(e.short)}<small>${esc(e.blurb)}</small></a></li>`).join('')}
    <li><span class="soon">photos<small>coming later</small></span></li></ul></nav>`);
  pop = mk(`<nav class="rv-panel rv-pop" id="rvExp" aria-label="Misc."><p>small interactive side projects</p>${SITE.explorers.map(e => `<a href="${e.href}">${esc(e.title)}<small>${esc(e.blurb)}</small></a>`).join('')}</nav>`);
  toastEl = mk(`<div class="rv-toast" id="rvToast" role="status" aria-live="polite"></div>`);
  const CHIPS = { home: ['help', 'weather', 'ls', 'hog come', 'luck', 'date -s 19:30', 'sauna', 'cd research', 'fortune'], research: ['help', 'papers', 'talks', 'analyzer 45', 'analyzer turn', 'plate 2', 'ls assets/pdfs', 'cd ~'],
    about: ['help', 'contact', 'cv', 'whoami', 'man vlad', 'cd research', 'cd ~'], merits: ['help', 'ls assets/pdfs', 'weather', 'cd about', 'cd ~'] };
  $('#rvChips').innerHTML = (CHIPS[PAGE] || CHIPS.home).map(c => `<button type="button" data-run="${esc(c)}">${esc(c)}</button>`).join('');
  input = $('#rvIn');
  document.body.classList.add('rv-has-dock');
}
let toastT = 0;
RV.toast = (msg, ms = 3200) => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); };
const narrow = () => innerWidth <= 820;
function panel(el, on) {
  for (const p of [out, sheet, pop]) if (p !== el || !on) p.classList.remove('on');
  if (el && on) el.classList.add('on');
  $('#rvMenuBtn').setAttribute('aria-expanded', sheet.classList.contains('on'));
  $('#rvExpBtn').setAttribute('aria-expanded', pop.classList.contains('on'));
}
function placePop() { const b = $('#rvExpBtn'); if (!b || narrow()) return; const r = b.getBoundingClientRect(); pop.style.left = clamp(r.left + r.width / 2, 190, innerWidth - 190) + 'px'; }
function setDock(open) { dock.dataset.open = open; const c = $('#rvCollapse'); c.setAttribute('aria-expanded', open); c.setAttribute('aria-label', open ? 'Collapse the menu' : 'Expand the menu'); }
function cliMode(on) {
  dock.classList.toggle('cli', on);
  const b = $('#rvCliBtn'); b.setAttribute('aria-label', on ? 'Close the command line' : 'Open the command line'); b.innerHTML = on ? ICON.x : ICON.term;
  if (on) { panel(sheet, false); input.focus(); openLog(); }
  else { input.blur(); panel(out, false); }
}
function openLog() { if (!log.childNodes.length) greet(); panel(out, true); log.scrollTop = log.scrollHeight; }
RV.openTerm = openLog;
function initDock() {
  buildDock();
  setDock(S.dock !== 'closed');
  $('#rvCollapse').addEventListener('click', () => { const o = dock.dataset.open !== 'true'; setDock(o); RV.set({ dock: o ? 'open' : 'closed' }, true); if (!o) panel(null, false); });
  $('#rvMenuBtn').addEventListener('click', e => { e.stopPropagation(); panel(sheet, !sheet.classList.contains('on')); });
  $('#rvCliBtn').addEventListener('click', e => { e.stopPropagation(); cliMode(!dock.classList.contains('cli')); });
  $('#rvExpBtn').addEventListener('click', e => { e.stopPropagation(); placePop(); panel(pop, !pop.classList.contains('on')); if (pop.classList.contains('on')) pop.querySelector('a').focus({ preventScroll: true }); });
  $('#rvX').addEventListener('click', () => { panel(out, false); if (narrow()) cliMode(false); });
  $('#rvClear').addEventListener('click', () => { clearLog(); input.focus(); });
  $('#rvCli').addEventListener('click', () => input.focus());
  $('#rvClockX').addEventListener('click', e => { e.stopPropagation(); RV.resetClock(); RV.toast('back to the real time'); });
  $('#rvWx').addEventListener('click', e => { e.stopPropagation(); run('weather'); if (!narrow()) input.focus({ preventScroll: true }); });
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest && t.closest('[data-run]') && (out.contains(t) || t.closest('.rv-cmdlink'))) { e.preventDefault(); run(t.closest('[data-run]').dataset.run, true); return; }
    if (!dock.contains(t) && !out.contains(t) && !sheet.contains(t) && !pop.contains(t)) { panel(sheet, false); panel(pop, false); if (out.classList.contains('on') && !narrow() && document.activeElement !== input) panel(out, false); }
  });
  sheet.addEventListener('click', e => { if (e.target.closest('a')) panel(sheet, false); });
  $('#rvCli').addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; hIdx = hist.length; run(v); });
  input.addEventListener('focus', openLog);
  input.addEventListener('keydown', onKey);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (out.classList.contains('on') || sheet.classList.contains('on') || pop.classList.contains('on')) { const back = pop.classList.contains('on') ? $('#rvExpBtn') : null; panel(null, false); if (dock.classList.contains('cli')) cliMode(false); input.blur(); if (back) back.focus(); } return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if ((e.key === '/' || e.key === '`') && !['input', 'textarea', 'select'].includes(tag) && !e.target.isContentEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); if (dock.dataset.open !== 'true') setDock(true); if (narrow()) cliMode(true); else input.focus();
    }
  });
  $('#rvWhere').textContent = location.pathname.split('/').pop() || 'index.html';
  if (window.visualViewport) {      // keep the dock above an on-screen keyboard
    const vv = window.visualViewport, kb = () => { const k = Math.max(0, innerHeight - vv.height - vv.offsetTop); document.documentElement.style.setProperty('--rv-kb', (k > 60 ? k : 0) + 'px'); };
    vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb);
  }
  addEventListener('resize', () => { panel(pop, false); placePop(); });
  restoreLog(); prompt(); status(); setInterval(status, 20000);
  RV.onChange(p => { if (p.clock || p.all) status(); });
}
/* the dial: the real sun (or moon) over Turku; the chips: a simulated clock, and the showers */
function drawDial() {
  const el = $('#rvDial'); if (!el) return;
  const ms = RV.now(), sun = sunPos(ms), sky = RV.skyAt(sun.alt), a = sun.alt;
  const y = 18 - clamp(a, -30, 60) / 60 * 12, up = a > -0.8, mp = moonPos(ms), moonUp = !up && mp.alt > 0;
  el.innerHTML = `<defs><clipPath id="rvdc"><circle cx="17" cy="17" r="16.5"/></clipPath></defs>` +
    `<g clip-path="url(#rvdc)"><rect width="34" height="34" fill="${rgba(sky[0])}"/><rect y="12" width="34" height="9" fill="${rgba(mix(sky[1], sky[2], .6))}" opacity=".8"/>` +
    `<circle cx="${moonUp ? 23 : 17}" cy="${(moonUp ? 18 - clamp(mp.alt, 0, 60) / 60 * 12 : y).toFixed(1)}" r="4" fill="${up ? '#F6C27E' : moonUp ? '#EFEAD9' : 'none'}" stroke="${up || moonUp ? 'none' : '#E9DFC9'}" stroke-width="1.1"/>` +
    `<path d="M0 21.5h34V34H0z" fill="${rgba(mix(sky[1], [10, 20, 30], .5))}"/><path d="M3 21.5l2-4 2 4M8 21.5l1.6-3 1.6 3M26 21.5l2-4.5 2 4.5" fill="${rgba(mix(sky[2], [8, 14, 12], .75))}"/></g>` +
    (RV.simulated() ? `<circle cx="17" cy="17" r="16" fill="none" stroke="#EBB96B" stroke-width="1.6" stroke-dasharray="3 2.2"/>` : '');
}
function status() {
  drawDial();
  const c = $('#rvClock'); if (!c) return;
  c.classList.toggle('on', RV.simulated());
  if (RV.simulated()) { const L = local(RV.now()); $('#rvClockT').textContent = `${L.day} ${MON[L.month - 1]} ${hm(RV.now())}${RV.speed() !== 1 ? ' ×' + RV.speed() : ''}`; c.title = 'simulated Turku time — ⟲ returns to now'; }
  if (RV.hooks.wxChip) RV.hooks.wxChip();
}
RV.status = status;
/* home sets this: a small on-screen readout of today's showers while it rains (or just stopped) */
RV.wxChip = (text, label) => { const b = $('#rvWx'); if (!b) return; b.classList.toggle('on', !!text); b.innerHTML = text ? '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 1.2C4.6 3.4 3 5.2 3 7.2a3 3 0 0 0 6 0c0-2-1.6-3.8-3-6z" fill="currentColor"/></svg><span class="rv-chip-t">' + esc(text) + '</span>' : ''; if (label) { b.setAttribute('aria-label', label); b.title = text; } };
RV.hooks = RV.hooks || {};

/* ================= the repository, as a tiny read-only file system ================= */
const MANIFEST = `.gitignore	41
CygX2/app.mjs	43068
CygX2/data/11001313002.json	4576885
CygX2/data/11001313004.json	5073536
CygX2/data/11001313006.json	4223779
CygX2/data/11001313008.json	4197102
CygX2/data/11001313010.json	4066568
CygX2/data/11001313012.json	4862768
CygX2/data/11001313013.json	79573
CygX2/data/11001313014.json	4332976
CygX2/data/11001313015.json	102675
CygX2/data/11001313016.json	5434986
CygX2/data/30001141002.json	9746921
CygX2/data/30801012002.json	4764835
CygX2/data/80511301002.json	4627609
CygX2/data/80511301004.json	4881643
CygX2/downlad_script.sh	2281
CygX2/hid_math.mjs	3325
CygX2/index.html	5522
CygX2/peacock_math.mjs	2357
CygX2/snail_math.mjs	2222
CygX2/style.css	9104
CygX2/swan_math.mjs	2653
README.md	45
about.html	24728
assets/images/alive_2/frame01.jpg	22279
assets/images/alive_2/frame02.jpg	30861
assets/images/alive_2/frame03.jpg	45745
assets/images/alive_2/frame04.jpg	45496
assets/images/alive_2/frame05.jpg	23754
assets/images/alive_2/frame06.jpg	18544
assets/images/alive_2/frame07.jpg	15150
assets/images/alive_2/frame08.jpg	13158
assets/images/alive_2/frame09.jpg	11994
assets/images/alive_2/frame10.jpg	13158
assets/images/alive_2/frame11.jpg	15150
assets/images/alive_2/frame12.jpg	18544
assets/images/alive_2/frame13.jpg	23754
assets/images/alive_2/frame14.jpg	45496
assets/images/alive_2/frame15.jpg	45745
assets/images/alive_2/frame16.jpg	30861
assets/images/cities/new-york.jpg	169805
assets/images/cities/newcastle.jpg	178285
assets/images/cities/saint-petersburg.jpg	59245
assets/images/cities/turku.jpg	225266
assets/images/clouds_tiled.png	1984970
assets/images/favicon/hedgehog-180.png	18757
assets/images/favicon/hedgehog-32.png	7778
assets/images/favicon/hedgehog.ico	829
assets/images/flowers_tiled2.png	3573883
assets/images/headshot.jpeg	23941
assets/images/hog_frames/hog_0001.png	7456
assets/images/hog_frames/hog_0002.png	8224
assets/images/hog_frames/hog_0003.png	7619
assets/images/hog_frames/hog_0004.png	7108
assets/images/hog_frames/hog_0005.png	7281
assets/images/hog_frames/hog_0006.png	13217
assets/images/hog_frames/hog_0007.png	13426
assets/images/hog_frames/hog_0008.png	13521
assets/images/hog_sprite.png	69757
assets/images/hog_sprites.png	190130
assets/images/lighthouse_bg.png	1495756
assets/images/lighthouse_bg2.png	2818891
assets/images/logos/CSC_logo.png	18873
assets/images/logos/FI_logo.png	47608
assets/images/logos/HEPRO_VIII_logo.png	536240
assets/images/logos/NVIDIA_DLI_logo.png	57367
assets/images/logos/SPBU_logo.jpg	43323
assets/images/logos/UTU_logo.png	30860
assets/images/logos/YKI_logo.png	122890
assets/images/logos/YKI_upscaled_logo.png	51462
assets/images/logos/monero-xmr-logo.png	16554
assets/images/madheadshot.jpeg	194215
assets/images/pattern_tiled.png	3932560
assets/images/piano.jpg	89711
assets/images/recaman.png	216185
assets/images/tile1.png	38635
assets/images/tile2.png	38538
assets/images/tile3.png	38666
assets/images/tile4.png	37505
assets/images/wha.png	740472
assets/images/working3.jpeg	63039
assets/pdfs/2020_AA_Loktev_oblate_pol.pdf	619555
assets/pdfs/2022_AA_Loktev_Pol_Schwarzschild.pdf	2709042
assets/pdfs/2023_AA_Bobrikova_AMSP_Compton.pdf	1083180
assets/pdfs/2023_Loktev_ARTPOL.pdf	1752683
assets/pdfs/2025_AA_Loktev_4U1538.pdf	12162058
assets/pdfs/CCA_certificate.pdf	409885
assets/pdfs/CSCSSCC.pdf	39810
assets/pdfs/CV_Loktev.pdf	74558
assets/pdfs/Certificate_ML1.pdf	271962
assets/pdfs/Certificate_ML_DATPAR.pdf	290088
assets/pdfs/Diploma1.pdf	751499
assets/pdfs/EAS_4U1538.pdf	2107344
assets/pdfs/EAS_WMNS.pdf	1502053
assets/pdfs/HEPROVIII_poster.pdf	1586631
assets/pdfs/HEPRO_award.pdf	96269
assets/pdfs/LoktevBohemianWorkshop.pdf	2001719
assets/pdfs/LoktevCV23.pdf	100793
assets/pdfs/Loktev_EXACTUS.pdf	3042722
assets/pdfs/Mondragone2022Loktev.pdf	2439340
assets/pdfs/PhDdegree.pdf	319442
assets/pdfs/Random_variable_regular_tournaments.pdf	209292
assets/pdfs/YKItodistus.pdf	75632
book.css	5508
collatztree/data/tree-10-rules-n×3+1_(n+1)÷2+1.json	26093
collatztree/data/tree-11-rules-n×2+1_(n-1)÷3+1_n×4-1.json	17178
collatztree/data/tree-25.json	27279
collatztree/data/tree-265-rules-n÷2+3_3×n+1.json	8438
collatztree/data/tree-3.json	3424
collatztree/data/tree-4.json	6082
collatztree/data/tree-5-rules-(n÷2)-1_(3×n)+1_(n÷2)+1_(3×n)+1.json	35227
collatztree/data/tree-55_complex5bush.json	28659
collatztree/grid/PROJECT_DESCRIPTION.md	7419
collatztree/grid/index.html	6942
collatztree/grid/static/css/style.css	18737
collatztree/grid/static/js/collatz_engine.js	15001
collatztree/grid/static/js/script.js	35134
collatztree/help.html	42344
collatztree/index.html	6682
collatztree/style.css	9993
collatztree/trajectory_9_light.png	84714
collatztree/tree.md	21892
collatztree/tree_99_light.png	320055
collatztree/tree_math.js	10324
collatztree/tree_ui.js	46847
data.js	22533
favicon.ico	829
google6c75a693b5d196cc.html	53
index.html	152208
mandelburger/.mandelburger-publish	187
mandelburger/css/app.css	14540
mandelburger/index.html	17235
mandelburger/js/core/cocycle.js	15308
mandelburger/js/core/complex.js	3218
mandelburger/js/core/diophantine.js	2871
mandelburger/js/core/expr.js	39570
mandelburger/js/core/fft.js	2026
mandelburger/js/core/model.js	5111
mandelburger/js/core/orbit.js	7081
mandelburger/js/core/section.js	1163
mandelburger/js/core/solver.js	17563
mandelburger/js/core/structure.js	5331
mandelburger/js/core/tasks.js	15827
mandelburger/js/main.js	57741
mandelburger/js/ui/colors.js	4559
mandelburger/js/ui/paths.js	2646
mandelburger/js/ui/plane.js	17007
mandelburger/js/ui/plots.js	12251
mandelburger/js/workers/compute.worker.js	532
mandelburger/js/workers/pool.js	3476
merits.html	14880
old/Geisha.html	31101
old/Geisha_old.html	23728
old/Okiya.html	6793
old/assets/css/home.css	1056
old/assets/css/main.css	4833
old/assets/css/merits.css	1538
old/assets/css/okiya.css	13833
old/assets/css/projects.css	840
old/assets/css/talks.css	2556
old/assets/html/CygX3.html	552
old/assets/html/Dice.html	3511
old/assets/html/Heart.html	1615
old/assets/html/Home.html	5751
old/assets/html/Mandelbrot.html	3137
old/assets/html/Merits.html	3237
old/assets/html/Projects.html	3029
old/assets/html/Recaman.html	578
old/assets/html/Talks.html	7989
old/assets/js/classes.js	15690
old/assets/js/cygx3.js	2971
old/assets/js/dice.js	15767
old/assets/js/flipbook.js	998
old/assets/js/heart.js	6829
old/assets/js/hog.js	11922
old/assets/js/mandelbrot.js	3779
old/assets/js/okiya-libs.js	4129
old/assets/js/okiya.js	34419
old/assets/js/recaman.js	4511
old/assets/js/script.js	7574
old/assets/js/secondary.js	2655
old/favicon.ico	6164
old/index.html	4520
research.html	82781
site.css	11710
site.js	81313`;
// the underside stays under the ice: never listed, never found, never opened from here
const SECRET = [/^old\//, /^second\.html$/, /^Okiya\.html$/, /^Geisha(_old)?\.html$/, /okiya/i, /^assets\/html\/(Recaman|Heart|Mandelbrot|Dice)\.html$/, /^assets\/js\/(recaman|heart|mandelbrot|dice|secondary)\.js$/, /^assets\/images\/recaman\.png$/];
const FS = { files: new Map(), dirs: new Map([['', { d: new Set(), f: new Set() }]]), hidden: 0 };
for (const line of MANIFEST.trim().split('\n')) {
  const [p, n] = line.split('\t'); if (!p) continue;
  if (SECRET.some(r => r.test(p))) { FS.hidden++; continue; }
  FS.files.set(p, +n);
  const parts = p.split('/'); let acc = '';
  for (let i = 0; i < parts.length - 1; i++) { const nx = acc ? acc + '/' + parts[i] : parts[i]; if (!FS.dirs.has(nx)) FS.dirs.set(nx, { d: new Set(), f: new Set() }); FS.dirs.get(acc).d.add(parts[i]); acc = nx; }
  FS.dirs.get(acc).f.add(parts[parts.length - 1]);
}
let cwd = store.sget('cwd', ''); if (!FS.dirs.has(cwd)) cwd = '';
const HOMEDIR = '/home/vlad/belliavesha.github.io';
function resolve(arg) {
  if (arg == null || arg === '' || arg === '.') return cwd;
  if (arg === '~' || arg === '/' || arg === '~/') return '';
  const parts = arg.startsWith('/') || arg.startsWith('~') ? [] : cwd ? cwd.split('/') : [];
  for (const s of arg.replace(/^~\/?/, '').replace(/^\//, '').split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(s);
  }
  return parts.join('/');
}
const isDir = p => FS.dirs.has(p), isFile = p => FS.files.has(p);
const human = n => n < 1024 ? n + 'B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + 'K' : (n / 1048576).toFixed(1) + 'M';
const dirSize = p => { let s = 0; for (const [f, n] of FS.files) if (!p || f.startsWith(p + '/')) s += n; return s; };
const urlOf = p => ROOT + p.split('/').map(encodeURIComponent).join('/');
const TEXT = /\.(md|txt|css|js|mjs|html|sh|tsv|json)$|(^|\/)(\.gitignore|Untitled)$/;
function prompt() { const p = $('#rvPs'); if (!p) return; p.textContent = (cwd ? '~/' + cwd : '~') + ' $'; p.title = HOMEDIR + (cwd ? '/' + cwd : ''); store.sset('cwd', cwd); }

/* ================= terminal output ================= */
let logH = store.sget('log', []);           // the session's log survives page changes
function print(html, cls = 'o') {
  const d = document.createElement('div'); d.className = 'l ' + cls; d.innerHTML = html; log.appendChild(d);
  logH.push([cls, html]); if (logH.length > 160) logH = logH.slice(-160); store.sset('log', logH);
  log.scrollTop = log.scrollHeight; return d;
}
const say = (lines, cls) => (Array.isArray(lines) ? lines : [lines]).forEach(l => print(l, cls));
RV.say = (html, cls) => print(html, cls === 'o warn' || cls === 'warn' ? 'r' : cls || 'o');
function clearLog() { log.innerHTML = ''; logH = []; store.sset('log', logH); }
function restoreLog() { log.innerHTML = logH.map(([c, h]) => `<div class="l ${c}">${h}</div>`).join(''); }
function greet() { print(`<span class="m">moi! this is a small shell for the site. try</span> ${cmdLink('help')}<span class="m">,</span> ${cmdLink('ls')} <span class="m">or</span> ${cmdLink('weather')}<span class="m">. tab completes · ↑ recalls · / brings you back.</span>`, 'm'); }
const cmdLink = (c, label) => `<button class="e a" data-run="${esc(c)}">${esc(label || c)}</button>`;
RV.cmdLink = cmdLink;
const onHome = () => PAGE === 'home';
const homeOnly = what => [`${what} lives by the lake. ${cmdLink('cd ~', 'cd ~')} <span class="m">takes you there — the setting is saved either way.</span>`];
function go(href, label) {
  const [file, hash] = href.split('#'), here = location.pathname.split('/').pop() || 'index.html';
  if ((file === here || !file) && hash) { const t = document.getElementById(hash); if (t) { t.scrollIntoView({ behavior: RV.reduced() ? 'auto' : 'smooth', block: 'start' }); history.replaceState(null, '', '#' + hash); return [`<span class="m">→ #${esc(hash)}</span>`]; } }
  if (file === here && !hash) return [`<span class="m">you are already here.</span>`];
  setTimeout(() => { location.href = href; }, RV.reduced() ? 60 : 260);
  return [`<span class="m">→ ${esc(label || href)}</span>`];
}
RV.go = go;
function openURL(u, label) { const w = window.open(u, '_blank', 'noopener'); if (!w) setTimeout(() => { location.href = u; }, 60); return [`<span class="m">opening ${esc(label || u)} ↗</span>`]; }

/* ---- time words: 21:30 · 2026-12-21 18:00 · +3h · -2d · tomorrow · 24 joulukuuta · joulu · juhannus · vappu … ---- */
const FI_MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function monthOf(w) {
  w = w.toLowerCase().replace(/\.$/, '');
  let i = FI_MONTHS.findIndex(m => w === m || w.startsWith(m + 'kuu')); if (i >= 0) return i + 1;
  i = EN_MONTHS.findIndex(m => w.startsWith(m)); return i >= 0 && w.length >= 3 ? i + 1 : 0;
}
function midsummerEve(y) { let d = 19; while (new Date(Date.UTC(y, 5, d)).getUTCDay() !== 5) d++; return d; }
function parseWhen(s) {
  s = s.trim().replace(/^["']|["']$/g, ''); if (!s) return null;
  const now = RV.now(), L = local(now), low = s.toLowerCase().replace(/\s+/g, ' ');
  let m;
  if (/^(now|nyt|today|tänään)$/.test(low)) return Date.now();
  if (/^(tomorrow|huomenna)$/.test(low)) return now + DAY;
  if (/^(yesterday|eilen)$/.test(low)) return now - DAY;
  if ((m = low.match(/^([+-])\s*(\d+(?:\.\d+)?)\s*(m|min|h|d|w)?$/))) return now + (m[1] === '-' ? -1 : 1) * parseFloat(m[2]) * { m: 6e4, min: 6e4, h: 36e5, d: DAY, w: 7 * DAY }[m[3] || 'h'];
  // a time of day may follow any of the forms below
  let tod = null; const mt = low.match(/(?:^|\s)(?:klo\s*)?(\d{1,2})[:.](\d{2})$/);
  let rest = low; if (mt) { tod = [+mt[1], +mt[2]]; rest = low.slice(0, mt.index).trim(); }
  const at = (y, mo, d, h, mi) => tod ? fromLocal(y, mo, d, tod[0], tod[1]) : fromLocal(y, mo, d, h, mi);
  if (!rest && tod) return fromLocal(L.year, L.month, L.day, tod[0], tod[1]);
  const named = {
    midsummer: () => at(L.year, 6, midsummerEve(L.year), 23, 30), juhannus: () => at(L.year, 6, midsummerEve(L.year), 23, 30), juhannusaatto: () => at(L.year, 6, midsummerEve(L.year), 23, 30),
    christmas: () => at(L.year, 12, 24, 16, 0), xmas: () => at(L.year, 12, 24, 16, 0), joulu: () => at(L.year, 12, 24, 16, 0), jouluaatto: () => at(L.year, 12, 24, 16, 0),
    'new year': () => at(L.year, 12, 31, 23, 55), uusivuosi: () => at(L.year, 12, 31, 23, 55), 'uudenvuodenaatto': () => at(L.year, 12, 31, 23, 55),
    vappu: () => at(L.year, 4, 30, 19, 0), kaamos: () => at(L.year, 12, 21, 13, 0), equinox: () => at(L.year, 3, 20, 18, 30), 'päiväntasaus': () => at(L.year, 3, 20, 18, 30),
    'itsenäisyyspäivä': () => at(L.year, 12, 6, 18, 0), sauna: () => { let t = fromLocal(L.year, L.month, L.day, 19, 30); if (local(t).doy % 2 === 0) t += DAY; return t; }
  };
  if (named[rest]) return named[rest]();
  if ((m = rest.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:t(\d{1,2}):(\d{2}))?$/))) return at(+m[1], +m[2], +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
  if ((m = rest.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/))) return at(m[3] ? +m[3] : L.year, +m[2], +m[1], 12, 0);            // 24.12. (Finnish order)
  if ((m = rest.match(/^(\d{1,2})\.?\s+([a-zäö]+)\.?(?:\s+(\d{4}))?$/)) && monthOf(m[2])) return at(m[3] ? +m[3] : L.year, monthOf(m[2]), +m[1], 12, 0);   // 24 joulukuuta · 3 oct
  if ((m = rest.match(/^([a-zäö]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/)) && monthOf(m[1])) return at(m[3] ? +m[3] : L.year, monthOf(m[1]), +m[2], 12, 0);         // oct 3
  if ((m = rest.match(/^([a-zäö]+)$/)) && monthOf(m[1])) return at(L.year, monthOf(m[1]), 15, 12, 0);                                                         // lokakuu
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s) && isFinite(Date.parse(s))) return Date.parse(s);
  return null;
}
RV.parseWhen = parseWhen;
function describeTime() {
  const ms = RV.now(), L = local(ms), sun = sunPos(ms), sp = RV.speed();
  return [`${when(ms)} in Turku <span class="m">(day ${L.doy} of the year · ${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC)</span>`,
    `<span class="m">sun ${sun.alt.toFixed(1)}° ${sun.alt >= 0 ? 'up' : 'below the horizon'}, azimuth ${sun.az.toFixed(0)}° · ${RV.simulated() ? `simulated clock${sp !== 1 ? `, running ×${sp}` : ''} — </span>${cmdLink('date --reset')}` : 'real time</span>'}`];
}
function weatherReport() {
  const ms = RV.now(), e = RV.env(ms), w = e.w, L = w.L, sp = RV.forecast(ms), sun = e.sun;
  const pct = Math.round(w.p * 100), span = s => `${hm(s[0])}–${hm(s[1])}`;
  const season = [3, 4].includes(L.month) ? ' — spring is the driest time here' : [10, 11].includes(L.month) ? ' — autumn is the wet season' : '';
  const kind = w.kind === 'snow' ? 'snow' : 'rain';
  const lines = [`<span class="hd">Turku, ${when(ms)}</span>`,
    `<span class="m">${w.kind === 'snow' ? 'snow' : 'showers'} on ${pct}% of days this time of year${season}.</span>`,
    sp.length ? `today: ${kind} <span class="a">${sp.map(span).join(', ')}</span>` : 'today: dry all day.'];
  const forced = (RV.opt('rain') !== 'auto' && kind === 'rain') || (RV.opt('snow') !== 'auto' && kind === 'snow');
  const nowTxt = w.raining ? 'raining' : w.snowing ? 'snowing' : 'dry';
  const curSpan = sp.find(s => ms >= s[0] && ms <= s[1]);
  lines.push(`now: ${nowTxt}${curSpan && (w.raining || w.snowing) && !forced ? ` <span class="m">(since ${hm(curSpan[0])}, until about ${hm(curSpan[1])})</span>` : ''}${forced ? ' <span class="r">(forced by you — </span>' + cmdLink('weather auto') + '<span class="r">)</span>' : ''}`);
  if (w.sinceEnd < 10) lines.push(`<span class="a">the rain stopped at ${hm(w.endedAt || ms)} — rainbow minutes until ${hm((w.endedAt || ms) + 10 * 6e4)}.</span> <span class="m">${sun.alt > 42 ? 'but the sun is too high for a bow.' : sun.alt < -1 ? 'but there is no sunlight.' : 'look away from the sun.'}</span>`);
  lines.push(`<span class="m">chimney: ${e.smoke ? (e.smokeWhy === 'sauna' ? 'smoking — the sauna is on' : e.smokeWhy === 'cold' ? 'smoking — it is cold' : 'smoking') : 'quiet'} · window: ${{ clear: 'clear', steam: 'steamed up', frost: 'frosted' }[e.win]}</span>`);
  return lines;
}
function rainbowTalk() {
  const ms = RV.now(), sun = sunPos(ms), w = RV.weather(ms);
  const h = Math.max(0, sun.alt), cd = Math.cos(42 * RAD) / Math.cos(h * RAD), delta = cd < 1 ? Math.acos(cd) / RAD : 0;
  const legs = [sun.az + 180 - delta, sun.az + 180 + delta].map(a => ((a % 360) + 360) % 360), inView = legs.filter(a => Math.abs(a - 180) <= 90);
  const lines = ['<span class="m">A rainbow is a 42° circle around the point opposite the sun. It needs rain that stopped less than 10 minutes ago, a sun lower than 42°, and its legs (≈138° of azimuth from the sun) in the half of the sky the lake faces — so the sun must be low in the east or west, never at noon.</span>'];
  if (w.kind === 'snow') { lines.push(`<span class="m">It is the snowy season; snow makes no rainbows. Try a warmer day: </span>${cmdLink('date -s 2026-08-20 19:30')}`); return lines; }
  if (sun.alt >= 42) lines.push(`<span class="m">Right now the sun is ${sun.alt.toFixed(0)}° high — the whole bow is below the horizon. Try an evening: </span>${cmdLink('date -s 19:30')}`);
  else if (sun.alt < -1) lines.push(`<span class="m">Right now the sun is down. Try </span>${cmdLink('date -s 19:00')} <span class="m">or</span> ${cmdLink('date -s 07:30')}`);
  else if (!inView.length) lines.push(`<span class="m">The sun is at azimuth ${sun.az.toFixed(0)}° — both legs (${legs.map(a => a.toFixed(0) + '°').join(', ')}) fall behind you.</span>`);
  else if (w.raining) lines.push(`<span class="m">It is still raining. When it stops, look away from the sun — or </span>${cmdLink('rain off')}<span class="m">.</span>`);
  else {
    lines.push(`<span class="a">Now is good: a leg stands at azimuth ${inView.map(a => a.toFixed(0) + '°').join(' and ')}.</span>`);
    if (!(w.sinceEnd < 10)) { RV.set({ rainOffAt: ms - 20e3 }); lines.push('<span class="m">…so a small shower passes over the lake, just for you.</span>'); }
    if (!onHome()) lines.push(`<span class="m">It is at the lake: </span>${cmdLink('cd ~')}`);
  }
  return lines;
}
const MAN = {
  vlad: ['VLAD(1)                        Lakeside Manual                        VLAD(1)', '', '<span class="hd">NAME</span>', '    vlad — astrophysicist; X-ray polarimetry, X-ray binaries, relativistic plasma', '', '<span class="hd">SYNOPSIS</span>', '    vlad [--polarize] [--ray-trace] [--simulate-plasma] [--climb 6b] [--fish kuha]', '', '<span class="hd">DESCRIPTION</span>', '    Postdoctoral researcher at the Astronomical Institute of the Czech Academy of', '    Sciences (since October 2026), with Dr. Michal Dovčiak: the spectro-polarimetric', '    and timing properties of X-ray binaries and relativistic plasma physics.', '', '<span class="hd">HISTORY</span>', '    MSc Saint Petersburg · PhD Turku (IXPE) · CCA Flatiron · Helsinki (runko) ·', '    Newcastle &amp; Durham (X-MAPS) · ASU CAS.', '', '<span class="hd">BUGS</span>', '    Progressively loses the ability to play the piano and the guitar.', '    Favourite fish (kuha) differs from favourite fish to eat (salmon, tho).', '    Favourite lorem is ipsum, especially of the dolor variety, but sit amet.', '', '<span class="hd">SEE ALSO</span>', `    ${cmdLink('about')}, ${cmdLink('research')}, ${cmdLink('cv')}, ${cmdLink('contact')}, ${cmdLink('man hedgehog')}, ${cmdLink('man sauna')}`],
  hedgehog: ['<span class="hd">hedgehog</span> — lives on the shore; shy', '    hog on|off · hog come · hog sleep · hog wake · hog roll · hog speed &lt;0.25–4&gt; · hog status', '    Don’t be afraid of him, but do not scare him either. Come too close and he rolls', '    into a ball; linger and he keeps an eye on you. He can be picked up.', '<span class="hd">NOTES</span>', '    Hedgehogs, as everyone knows, carry apples home on their backs.'],
  sauna: ['<span class="hd">sauna</span>(8) — heat the kiuas, throw löyly', '    On odd days of the year the cabin sauna is heated in the evening: smoke from', '    the chimney, steam on the window. `sauna` heats it now, for 90 lake-minutes.', '<span class="hd">CAVEATS</span>', '    Afterwards, the brave go to the avanto.'],
  date: ['date                          show the (possibly simulated) time in Turku', 'date -s "2026-12-21 18:00"    set the clock (Turku time). Also: 18:00 · +3h · -2d · tomorrow ·', '                              24.12. · 24 joulukuuta · lokakuu · joulu · juhannus · vappu · kaamos', 'date --speed 600              time-lapse (×600); 1 = normal', 'date --reset                  back to the real now'],
  luck: ['luck             how lucky your throws are: the mean number of skips (a Poisson λ)', 'luck 5           a better arm. remembered in this browser; `reset` puts it back to ' + SKIP_LAMBDA],
  ls: ['ls [-a] [-l] [dir]   list the repository of this site (names are clickable)'],
  cd: ['cd &lt;dir&gt;    move around the repository', 'cd &lt;page&gt;   go to a page: ~ (home), research, about, merits, papers, talks, contact'],
  cat: ['cat &lt;file&gt;   print a text file from the repository · head [-n N] &lt;file&gt; prints the first lines'],
  open: ['open &lt;file|page&gt;   open a PDF, image or page'],
  weather: ['weather                  today’s showers over the lake, to the minute', 'rain on|off|auto · snow on|off|auto · aurora on|off|auto', 'weather clear · weather auto', 'rainbow                  what a rainbow needs (and, when the sun is right, a shower)'],
  motion: ['motion reduced|full|auto   calm the animations (auto follows your system setting)'],
  window: ['window clear|steam|frost|auto   the cabin window (sauna steam, winter frost)'],
  smoke: ['smoke on|off|auto   the chimney (sauna evenings on odd days of the year; all winter)']
};
MAN.hog = MAN.hedgehog;
const HELP = () => {
  const n = narrow();
  return [
    '<span class="hd">getting around</span>',
    `  ${SITE.nav.map(x => cmdLink(x.key)).join(' · ')} · ${cmdLink('papers')} · ${cmdLink('talks')} · ${cmdLink('contact')} · ${cmdLink('cv')}`,
    `  ${cmdLink('explorers')} · ${cmdLink('ads')} · ${cmdLink('orcid')} · ${cmdLink('github')} · ${cmdLink('telegram')} · ${cmdLink('email')}${n ? '' : ' · photos'}`,
    '<span class="hd">the repository</span>',
    `  ${cmdLink('ls')} [-la] · cd &lt;dir|page&gt; · ${cmdLink('pwd')} · ${cmdLink('tree')} · find &lt;text&gt; · cat · head · open`,
    '<span class="hd">the lake</span> <span class="m">(remembered on every page)</span>',
    `  hog on|off|come|sleep|wake|roll|speed &lt;x&gt; · ${cmdLink('fish')} · ${cmdLink('skip')} · ${cmdLink('luck')}`,
    `  ${cmdLink('weather')} · rain|snow|aurora on|off|auto · ${cmdLink('rainbow')} · ${cmdLink('sky')}`,
    `  window clear|steam|frost|auto · smoke on|off|auto · ${cmdLink('sauna')}`,
    '<span class="hd">time</span>',
    `  ${cmdLink('date')} · date -s &lt;when&gt; <span class="m">(19:30 · 24.12. · joulu · juhannus · +3h)</span> · date --speed 600 · ${cmdLink('date --reset')}`,
    '<span class="hd">comfort</span>',
    `  motion reduced|full|auto · ${cmdLink('settings')} · ${cmdLink('reset')} · ${cmdLink('clear')} · ${cmdLink('history')} · man &lt;cmd&gt;`,
    ...(extraHelp.length ? ['<span class="hd">this page</span>', ...extraHelp.map(h => '  ' + h)] : []),
    `<span class="m">and: ${cmdLink('whoami')}, ${cmdLink('man vlad')}, ${cmdLink('fortune')}, sudo …, ${cmdLink('uname')}, ${cmdLink('ping')}. tab completes, ↑ recalls.</span>`
  ];
};
const extraHelp = [];
function lsOut(args) {
  const flags = args.filter(x => x.startsWith('-')).join(''), target = args.find(x => !x.startsWith('-')), all = flags.includes('a'), long = flags.includes('l');
  if (target && /^\.?\/?\.burrow\/?$/.test(target)) return ['<span class="r">ls: cannot open directory \'.burrow\': Permission denied</span>'];
  const p = resolve(target);
  if (p == null || (!isDir(p) && !isFile(p))) { if (target && PAGES[target.toLowerCase()]) return [`<span class="m">ls: ${esc(target)} is a page, not a folder — </span>${cmdLink('cd ' + target)}`]; return [`<span class="r">ls: cannot access '${esc(target)}': No such file or directory</span>`]; }
  if (isFile(p)) return [long ? `${human(FS.files.get(p)).padStart(6)}  ${fmtFile(p, p.split('/').pop())}` : fmtFile(p, p.split('/').pop())];
  const D = FS.dirs.get(p);
  let names = [...[...D.d].map(n => [n, true]), ...[...D.f].map(n => [n, false])].sort((x, y) => (y[1] - x[1]) || x[0].replace(/^\./, '').localeCompare(y[0].replace(/^\./, ''), 'en', { sensitivity: 'base' }));
  if (!all) names = names.filter(n => !n[0].startsWith('.'));
  const full = n => p ? p + '/' + n : n, root = p === '';
  const res = [];
  if (long) {
    const rows = names.map(([n, d]) => `<span class="dim">${d ? 'drwxr-xr-x' : '-rw-r--r--'}</span> ${(d ? human(dirSize(full(n))) : human(FS.files.get(full(n)))).padStart(6)}  ${fmtFile(full(n), n)}`);
    if (all) rows.unshift('<span class="dim">drwxr-xr-x      -  ./</span>', '<span class="dim">drwxr-xr-x      -  ../</span>');
    if (all && root) rows.splice(2, 0, `<span class="dim">d?????????      ?  .burrow/</span>   <span class="m">(it’s dark in there)</span>`);
    res.push(rows.join('\n') || '<span class="dim">(empty)</span>');
  } else {
    const items = (all ? ['<span class="dim">./</span>', '<span class="dim">../</span>'] : []).concat(all && root ? ['<span class="dim">.burrow/</span>'] : []).concat(names.map(([n]) => fmtFile(full(n), n)));
    res.push(`<div class="grid">${items.map(x => `<span>${x}</span>`).join('')}</div>`);
  }
  if (all && root) res.push(`<span class="m">…and ${FS.hidden} more that don’t show up in any listing. something is down there, under the ice.</span>`);
  return res;
}
function fmtFile(p, name) {
  if (isDir(p)) return `<button class="e dir" data-run="cd ${esc(p ? '~/' + p : '~')}">${esc(name)}/</button>`;
  const r = TEXT.test(p) && FS.files.get(p) < 60000 ? 'cat' : 'open';
  return `<button class="e" data-run="${r} ~/${esc(p)}">${esc(name)}</button>`;
}
async function catOut(args, headN) {
  const t = args.find(x => !x.startsWith('-'));
  if (!t) return ['<span class="m">cat: which file? (try </span>' + cmdLink('ls') + '<span class="m">)</span>'];
  if (/^(vlad|hog|hedgehog)$/i.test(t)) return [`<span class="m">cat: that’s not a file, that’s a mammal. try </span>${cmdLink('man ' + t.toLowerCase())}`];
  if (/\.burrow/.test(t)) return ['<span class="r">cat: .burrow: Permission denied</span>'];
  const p = resolve(t);
  if (p == null || !isFile(p)) { if (PAGES[t.toLowerCase()]) return [`<span class="m">${esc(t)} is a page, not a file — </span>${cmdLink('open ' + t)}`]; return [`<span class="r">cat: ${esc(t)}: ${p != null && isDir(p) ? 'Is a directory' : 'No such file or directory'}</span>`]; }
  const n = FS.files.get(p), name = p.split('/').pop();
  if (!TEXT.test(p)) return [`<span class="m">cat: ${esc(name)} is ${/\.pdf$/i.test(p) ? 'a PDF' : /\.(png|jpe?g|ico)$/i.test(p) ? 'an image' : 'not text'} — </span>${cmdLink('open ~/' + p, 'open ' + name)}`];
  if (n > 150000 && !headN) return [`<span class="m">cat: ${human(n)} of ${esc(p.split('.').pop().toUpperCase())}? that would flood the lake. </span>${cmdLink('head ~/' + p)} <span class="m">or</span> ${cmdLink('open ~/' + p, 'open')}`];
  const holder = print('<span class="m">reading…</span>', 'm');
  try {
    const r = await fetch(urlOf(p)); if (!r.ok) throw new Error(r.status);
    const lines = (await r.text()).split('\n'), N = headN || 120;
    holder.remove(); logH.pop();
    return [`<pre>${esc(lines.slice(0, N).join('\n'))}</pre>`].concat(lines.length > N ? [`<span class="m">… ${lines.length - N} more lines — </span>${cmdLink('open ~/' + p, 'open the whole file')}`] : []);
  } catch (e) { holder.remove(); logH.pop(); return [`<span class="m">cat: this copy of the site doesn’t carry ${esc(name)} right now. </span>${cmdLink('open ~/' + p, 'open')} <span class="m">might.</span>`]; }
}
function openOut(arg) {
  if (!arg) return ['<span class="m">open what? a page (research, about…) or a file (</span>' + cmdLink('ls') + '<span class="m">)</span>'];
  const k = arg.toLowerCase().replace(/\.html$/, '').replace(/\/$/, '');
  if (k === '~' || k === 'home' || k === 'index') return go('index.html', 'the lake');
  if (PAGES[k]) return go(PAGES[k], k);
  if (EXT[k]) return openURL(EXT[k][0], EXT[k][1]);
  const ex = SITE.explorers.find(e => e.key === k); if (ex) return go(ex.href, ex.title);
  if (/\.burrow/.test(k)) return ['<span class="r">open: .burrow: Permission denied</span>'];
  const p = resolve(arg);
  if (p != null && isDir(p)) { if (FS.dirs.get(p).f.has('index.html')) return go(urlOf(p) + '/', p + '/'); return [`<span class="m">open: ${esc(arg)} is a folder — </span>${cmdLink('cd ~/' + p, 'cd')} <span class="m">into it</span>`]; }
  if (p == null || !isFile(p)) return [`<span class="r">open: ${esc(arg)}: No such file or directory</span>`];
  return openURL(urlOf(p), p);
}
function cdOut(arg) {
  if (!arg || arg === '~' || arg === '~/') { cwd = ''; prompt(); if (!onHome()) return go('index.html', 'home, to the lake'); return ['<span class="m">you are home — by the lake.</span>']; }
  const k = arg.toLowerCase().replace(/\.html$/, '').replace(/\/$/, '');
  if (/^\.?\/?\.burrow$/.test(k)) return ['<span class="r">cd: .burrow: Permission denied</span>', '<span class="m">it belongs to the hedgehog. he only lets in whoever brings an apple.</span>'];
  const p = resolve(arg);
  if ((p == null || !isDir(p)) && (PAGES[k] || k === 'home' || k === 'index')) return openOut(k);
  if (p == null) return ['<span class="m">there is nothing above the root. below, maybe — but that’s under the ice.</span>'];
  if (!isDir(p)) { const ex = SITE.explorers.find(e => e.key === k); if (ex) return go(ex.href, ex.title); return [`<span class="r">cd: ${esc(arg)}: ${isFile(p) ? 'Not a directory' : 'No such file or directory'}</span>` + (isFile(p) ? ` <span class="m">(</span>${cmdLink('open ~/' + p, 'open')}<span class="m">)</span>` : '')]; }
  cwd = p; prompt(); return [];
}
function treeOut(arg) {
  const p = resolve(arg); if (p == null || !isDir(p)) return [`<span class="r">tree: ${esc(arg || '')}: not a directory</span>`];
  const lines = [p ? p + '/' : '.']; let nd = 0, nf = 0;
  const walk = (dp, pre, depth) => {
    const D = FS.dirs.get(dp), items = [...[...D.d].map(n => [n, 1]), ...[...D.f].filter(n => !n.startsWith('.')).map(n => [n, 0])].sort((x, y) => x[0].localeCompare(y[0]));
    items.forEach(([n, d], i) => {
      const last = i === items.length - 1, full = dp ? dp + '/' + n : n;
      lines.push(pre + (last ? '└── ' : '├── ') + fmtFile(full, n));
      if (d) { nd++; if (depth < (p ? 3 : 1)) walk(full, pre + (last ? '    ' : '│   '), depth + 1); else if (FS.dirs.get(full).d.size + FS.dirs.get(full).f.size) lines.push(pre + (last ? '    ' : '│   ') + '└── <span class="dim">…</span>'); }
      else nf++;
    });
  };
  walk(p, '', 0);
  return [`<pre>${lines.join('\n')}</pre>`, `<span class="m">${nd} directories, ${nf} files shown</span>`];
}
function settingsOut() {
  const rows = [['hedgehog', `${RV.opt('hog')}, ×${S.hogSpeed}`], ['luck', `λ = ${RV.luck()}`], ['clock', RV.simulated() ? when(RV.now()) + (RV.speed() !== 1 ? ' ×' + RV.speed() : '') : 'real'], ['rain', RV.opt('rain')], ['snow', RV.opt('snow')], ['aurora', RV.opt('aurora')], ['window', RV.opt('window')], ['smoke', RV.opt('smoke')], ['motion', S.motion + (RV.reduced() ? ' (calm)' : '')], ['directory', '~' + (cwd ? '/' + cwd : '')]];
  return [`<div class="tbl">${rows.map(r => `<span>${r[0]}</span><span class="a">${esc(r[1])}</span>`).join('')}</div>`, `<span class="m">stored in this browser only · </span>${cmdLink('reset')}<span class="m"> puts everything back</span>`];
}
function skyOut() {
  const now = RV.now(), s = sunPos(now), di = dayInfo(now), ph = moonPhase(now), mo = moonPos(now);
  const pn = ph.frac < 0.04 ? 'new moon' : ph.frac > 0.96 ? 'full moon' : (ph.waxing ? 'waxing ' : 'waning ') + (ph.frac < 0.45 ? 'crescent' : ph.frac < 0.55 ? 'half' : 'gibbous');
  const light = s.alt > 6 ? 'daylight' : s.alt > -0.833 ? 'low sun' : s.alt > -6 ? 'civil twilight' : s.alt > -12 ? 'the blue hour' : s.alt > -18 ? 'astronomical twilight' : 'proper night';
  return [`<div class="tbl"><span>Turku</span><span>${when(now)} · ${light}</span><span>sun</span><span>${s.alt.toFixed(1)}° up, azimuth ${s.az.toFixed(0)}°</span><span>sunrise · sunset</span><span>${di.rise ? hm(di.rise) : '—'} · ${di.set ? hm(di.set) : '—'}</span><span>daylight</span><span>${Math.floor(di.len / 36e5)} h ${Math.round(di.len % 36e5 / 6e4)} min</span><span>moon</span><span>${pn}, ${(ph.frac * 100).toFixed(0)}% lit, ${mo.alt > 0 ? mo.alt.toFixed(0) + '° up' : 'below the horizon'}</span></div>`];
}
const onoff = v => ({ on: 'on', off: 'off', auto: 'auto', yes: 'on', no: 'off', '1': 'on', '0': 'off', true: 'on', false: 'off', stop: 'off' }[String(v || '').toLowerCase()]);
function dive() {
  print('<span class="m">you walk out on the jetty, take a breath and slip into the avanto…</span>');
  print('<span class="dim">brrr. it’s darker down here than you’d think.</span>');
  const d = document.createElement('div'); d.className = 'rv-dive'; document.body.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('on')));
  setTimeout(() => { location.href = ROOT + 'old/index.html'; }, RV.reduced() ? 150 : 1300);
}
RV.descend = function (cx, cy) {       // the iris closing on the hedgehog's burrow (home)
  const iris = document.createElement('div'); iris.className = 'rv-iris';
  const big = Math.hypot(innerWidth, innerHeight) * 2.2;
  Object.assign(iris.style, { left: cx + 'px', top: cy + 'px', width: big + 'px', height: big + 'px', marginLeft: -big / 2 + 'px', marginTop: -big / 2 + 'px' });
  document.body.appendChild(iris); RV.descending = true;
  requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(iris.style, { width: '0px', height: '0px', marginLeft: '0px', marginTop: '0px' })));
  setTimeout(() => { location.href = ROOT + 'old/index.html'; }, RV.reduced() ? 150 : 1150);
};

/* ================= the commands ================= */
const PAGES = { research: 'research.html', about: 'about.html', merits: 'merits.html', papers: 'research.html#papers', talks: 'research.html#talks', plates: 'research.html#plate1', figures: 'research.html#plate1',
  interests: 'research.html#interests', path: 'research.html#path', career: 'research.html#path', contact: 'about.html#contact', contacts: 'about.html#contact', bio: 'about.html', wall: 'merits.html', certificates: 'merits.html', cabin: 'merits.html', lake: 'index.html' };
for (const n of SITE.nav) if (!PAGES[n.key] && n.key !== 'home') PAGES[n.key] = n.href;
const EXT = { cv: [SITE.CV, 'CV_Loktev.pdf'], ads: [SITE.ADS, 'all publications on ADS'], orcid: ['https://orcid.org/' + SITE.ORCID, 'ORCID ' + SITE.ORCID], github: [SITE.GITHUB, 'github.com/belliavesha'], telegram: [SITE.TELEGRAM, 'telegram.me/belliavesha'] };
const hookHome = (name, arg) => { if (!onHome()) return null; const f = RV.hooks[name]; return f ? f(arg) : null; };
const C = {
  help: a => a[0] ? (MAN[a[0].toLowerCase()] || [`<span class="m">no extra help for ${esc(a[0])}; try it and see.</span>`]) : HELP(),
  man: a => !a[0] ? ['<span class="m">What manual page do you want? Try </span>' + cmdLink('man vlad')] : MAN[a[0].toLowerCase()] || (C[a[0].toLowerCase()] && !HIDDEN.has(a[0].toLowerCase()) ? [`<span class="m">${esc(a[0])}: it does what it says. </span>${cmdLink('help')}`] : [`<span class="r">No manual entry for ${esc(a[0])}</span>`]),
  home: () => cdOut('~'),
  explorers: () => SITE.explorers.map(e => `  ${cmdLink('open ' + e.key, e.key.padEnd(12))} ${esc(e.title)} <span class="m">— ${esc(e.blurb)}</span>`),
  email: () => SITE.contacts.filter(c => c.user).map(c => `${esc(c.user)} [at] ${esc(c.domain)}`).concat([`<span class="m">(and the rest: </span>${cmdLink('contact')}<span class="m">)</span>`]),
  gallery: () => ['gallery: coming soon.', '<span class="m">the photos are still drying in the sauna.</span>'],
  ixpe: () => ['the IXPE control panel is still on the launch pad.', '<span class="m">it will have simulated observations. countdown: T-minus someday.</span>'],
  ls: a => lsOut(a), cd: a => cdOut(a[0]), pwd: () => [HOMEDIR + (cwd ? '/' + cwd : '')],
  tree: a => treeOut(a[0]),
  cat: a => catOut(a),
  head: a => { let n = 10; const rest = []; for (let k = 0; k < a.length; k++) { if (a[k] === '-n' && /^\d+$/.test(a[k + 1] || '')) { n = +a[++k]; } else if (/^-n?\d+$/.test(a[k])) n = +a[k].replace(/\D/g, ''); else rest.push(a[k]); } return catOut(rest, n || 10); },
  open: a => openOut(a.join(' ')),
  find: a => { const q = a.join(' ').toLowerCase().replace(/^-name\s+/, '').replace(/\*/g, ''); if (!q) return ['<span class="m">find what? e.g. </span>' + cmdLink('find 4U')]; const hits = [...FS.files.keys()].filter(p => p.toLowerCase().includes(q)); return hits.length ? hits.slice(0, 40).map(p => fmtFile(p, p)).concat(hits.length > 40 ? [`<span class="m">… ${hits.length - 40} more</span>`] : []) : [`<span class="m">nothing matches “${esc(q)}”.</span>`]; },
  hog: a => {
    const s = (a[0] || 'status').toLowerCase();
    if (onoff(s) === 'on' || onoff(s) === 'off') { RV.setOpt('hog', onoff(s)); return [onoff(s) === 'on' ? 'the hedgehog is back on the shore.' : `the hedgehog went to visit his cousins. <span class="m">(</span>${cmdLink('hog on')}<span class="m"> brings him back)</span>`].concat(onHome() ? [] : homeOnly('the hedgehog')); }
    if (s === 'speed') { const x = parseFloat(a[1]); if (!isFinite(x) || x <= 0) return ['<span class="m">hog speed &lt;0.25–4&gt;, e.g. </span>' + cmdLink('hog speed 2')]; const v = clamp(x, 0.25, 4); RV.set({ hogSpeed: v }); return [v > 2 ? `speed ×${v}. he is not built for this.` : v < 0.6 ? `speed ×${v}. a very thoughtful hedgehog.` : `speed ×${v}.`]; }
    if (['come', 'here', 'sleep', 'nap', 'wake', 'roll'].includes(s)) { if (RV.opt('hog') === 'off') return ['<span class="m">he’s away — </span>' + cmdLink('hog on') + '<span class="m"> first.</span>']; const r = hookHome('hog', s === 'here' ? 'come' : s === 'nap' ? 'sleep' : s); return r ? [r] : homeOnly('the hedgehog'); }
    const st = hookHome('hogStatus');
    return [`the hedgehog: <span class="a">${RV.opt('hog') === 'on' ? 'on the shore' : 'away'}</span>, speed ×${S.hogSpeed}${st ? ' · ' + esc(st) : ''}`, '<span class="m">hog on|off|come|sleep|wake|roll|speed &lt;x&gt;|status</span>'];
  },
  date: a => {
    if (!a.length) return describeTime();
    const f = a[0].toLowerCase();
    if (f === '--reset' || f === 'reset' || f === '-r') { RV.resetClock(); return ['back to the real now.', ...describeTime()]; }
    if (f === '--speed' || f === 'speed') { const x = parseFloat(a[1]); if (!isFinite(x) || x < 0) return ['<span class="m">date --speed &lt;x&gt;, e.g. </span>' + cmdLink('date --speed 600')]; RV.setClock(null, Math.min(x, 100000)); return [x === 1 ? 'time runs normally.' : x === 0 ? 'time stands still. (enjoy it.)' : `time-lapse ×${Math.min(x, 100000)}. ${cmdLink('speed 1')} to stop.`]; }
    const arg = f === '-s' || f === '--set' || f === 'set' ? a.slice(1).join(' ') : a.join(' ');
    const t = parseWhen(arg);
    if (t === null || !isFinite(t)) return ['<span class="r">date: couldn’t read that.</span> <span class="m">try 21:30 · 2026-12-21 18:00 · 24.12. · 24 joulukuuta · +3h · -2d · tomorrow · joulu · juhannus · vappu · kaamos</span>'];
    RV.setClock(t); return describeTime().concat(onHome() ? [] : ['<span class="m">(the lake follows this clock.)</span>']);
  },
  speed: a => a.length ? C.date(['--speed', a[0]]) : [`time runs at ×${RV.speed()}`],
  time: () => describeTime(),
  weather: a => {
    const s = (a[0] || '').toLowerCase();
    if (['clear', 'sunny', 'fair', 'off'].includes(s)) { const was = RV.weather().raining; RV.setOpt('rain', 'off'); RV.setOpt('snow', 'off'); if (was) RV.set({ rainOffAt: RV.now() }); return ['clear skies ordered. <span class="m">(</span>' + cmdLink('weather auto') + '<span class="m"> to undo)</span>']; }
    if (s === 'auto' || s === 'reset') { for (const k of ['rain', 'snow', 'aurora']) RV.setOpt(k, 'auto'); return ['nature decides again.', ...weatherReport()]; }
    return weatherReport().concat(onHome() ? [] : ['<span class="m">(it is happening at the lake: </span>' + cmdLink('cd ~') + '<span class="m">)</span>']);
  },
  forecast: () => weatherReport(),
  rain: a => {
    const v = onoff(a[0]); if (!v) return [`rain: <span class="a">${RV.opt('rain')}</span> · ${RV.weather().raining ? 'it is raining' : 'dry'}`, '<span class="m">rain on|off|auto</span>'];
    const was = RV.weather().raining; RV.setOpt('rain', v);
    if (v === 'off') RV.set({ rainOffAt: was ? RV.now() : 0 });
    const snowy = RV.snowSeason(local(RV.now()));
    return [v === 'on' ? (snowy ? 'it’s the snowy season, so it falls as snow.' : 'it’s raining. (autumn in Turku, basically.)') : v === 'off' ? (was ? 'the rain stops. the next ten minutes are rainbow minutes — if the sun is low in the east or west.' : 'no rain.') : 'rain follows the noise of the calendar again.'].concat(onHome() ? [] : homeOnly('the weather'));
  },
  snow: a => { const v = onoff(a[0]); if (!v) return [`snow: <span class="a">${RV.opt('snow')}</span>`]; RV.setOpt('snow', v); return [v === 'on' ? 'lumisade — it falls in the snowy season (late Nov – Mar). in summer, try ' + cmdLink('date -s joulu') : v === 'off' ? 'no snow.' : 'snow follows the weather again.'].concat(onHome() ? [] : homeOnly('the snow')); },
  aurora: a => { const v = onoff(a[0]); if (!v) return [`aurora: <span class="a">${RV.opt('aurora')}</span>`, '<span class="m">northern lights show only when the sky is dark enough.</span>']; RV.setOpt('aurora', v); return [v === 'on' ? 'revontulet! they appear once the sun is 10° below the horizon — try ' + cmdLink('date -s 23:30') : v === 'off' ? 'no northern lights.' : 'the aurora follows the sky again.'].concat(onHome() ? [] : homeOnly('the northern lights')); },
  revontulet: a => C.aurora(a.length ? a : ['on']),
  rainbow: () => rainbowTalk(),
  sky: () => skyOut(), almanac: () => skyOut(),
  smoke: a => { const v = onoff(a[0]); if (!v) return MAN.smoke; RV.setOpt('smoke', v); return [v === 'on' ? 'smoke from the chimney.' : v === 'off' ? 'the chimney is quiet.' : 'the chimney follows the sauna calendar and the cold again.'].concat(onHome() ? [] : homeOnly('the chimney')); },
  window: a => { const m = { clear: 'clear', steam: 'steam', steamy: 'steam', ice: 'frost', icy: 'frost', frost: 'frost', auto: 'auto' }[(a[0] || '').toLowerCase()]; if (!m) return MAN.window; RV.setOpt('window', m); return [{ clear: 'the window is clear. hello!', steam: 'steam on the glass. wipe it with the cursor.', frost: 'jääkukkia — ice flowers on the glass. rub them away.', auto: 'the window follows the weather again: steam after sauna, frost on cold mornings.' }[m]].concat(onHome() ? [] : homeOnly('the cabin window')); },
  sauna: () => { RV.set({ saunaUntil: RV.now() + 90 * 6e4 }); return ['löylyä! the kiuas is heating — smoke from the chimney, steam on the window, for the next 90 lake-minutes.', '<span class="dim">afterwards, the brave ones go to the avanto.</span>'].concat(onHome() ? [] : homeOnly('the sauna')); },
  fish: () => { const r = hookHome('fish'); return r ? [r] : homeOnly('the jetty'); },
  skip: () => { const r = hookHome('skip'); return r === null ? homeOnly('the lake') : r ? [r] : []; },
  luck: a => {
    if (!a.length) return [`luck: λ = <span class="a">${RV.luck()}</span> <span class="m">— the mean number of skips (Poisson). default ${SKIP_LAMBDA}.</span>`];
    if (/^(reset|default|auto)$/i.test(a[0])) { RV.set({ luck: null }); return [`luck back to λ = ${SKIP_LAMBDA}.`]; }
    const x = parseFloat(a[0]); if (!isFinite(x) || x <= 0 || x > 30) return ['<span class="m">luck &lt;λ&gt;, a number between 0.1 and 30 — e.g. </span>' + cmdLink('luck 6')];
    RV.set({ luck: x }); return [`luck: λ = ${x}. ${x > 8 ? 'the lake has never seen an arm like that.' : x < 1.5 ? 'mostly plums, then.' : 'ok.'}`];
  },
  motion: a => { const m = { reduce: 'reduced', reduced: 'reduced', off: 'reduced', calm: 'reduced', full: 'full', on: 'full', auto: 'auto' }[(a[0] || '').toLowerCase()]; if (!m) return [`motion: <span class="a">${S.motion}</span>${RV.reduced() ? ' (calm)' : ''}`, '<span class="m">' + MAN.motion[0] + '</span>']; RV.set({ motion: m }); return [m === 'reduced' ? 'calmer: no drifting, falling or wobbling.' : m === 'full' ? 'everything moves.' : 'following your system setting.']; },
  effects: a => C.motion([onoff(a[0]) === 'off' ? 'reduced' : onoff(a[0]) === 'on' ? 'full' : 'auto']),
  settings: () => settingsOut(),
  reset: () => { RV.reset(); cwd = ''; prompt(); return ['all settings back to defaults; the clock is real again, the hedgehog is home, and your record is forgotten.']; },
  clear: () => { clearLog(); return []; },
  history: () => hist.slice(-30).map((h, i) => `<span class="m">${String(hist.length - Math.min(30, hist.length) + i + 1).padStart(4)}</span>  ${cmdLink(h)}`),
  echo: (a, raw) => [esc(raw.replace(/^\s*echo\s?/, ''))],
  exit: () => { setTimeout(() => { panel(out, false); if (narrow()) cliMode(false); input.blur(); }, 900); return ['moi moi! <span class="m">(there is no exit from the lake — only the sauna.)</span>']; },
  whoami: () => ['a visitor — a welcome one.', '<span class="m">(vlad is the astrophysicist. the hedgehog is in charge.)</span>'],
  who: () => ['vlad      lake       (probably fishing)', 'hedgehog  shore      (definitely not fishing)', 'guest     here'],
  sudo: (a, raw) => { const r = raw.replace(/^\s*sudo\s*/, ''); if (/make me a sandwich/i.test(r)) return ['okay. one voileipä — throw it at the lake and count the leipää.']; if (/^rm\b/.test(r)) return ['<span class="r">nice try. the hedgehog is sitting on that.</span>']; return ['<span class="r">guest is not in the sudoers file. this incident will be reported to the hedgehog.</span>']; },
  rm: () => ['<span class="r">rm: read-only lake.</span> <span class="m">nothing here gets deleted, not even the lorem ipsum.</span>'],
  vim: () => ['you are now inside vim. <span class="m">(just kidding. type :q anyway, for old times’ sake)</span>'],
  ':q': () => ['you have escaped vim. few can say that.'],
  moi: () => ['moi! <span class="m">(hello in Finnish. “moi moi” is goodbye. yes, really.)</span>'],
  fortune: () => { const f = SITE.fortunes, p = SITE.psst; if (Math.random() < 0.45) { const x = f[Math.floor(Math.random() * f.length)]; return (x[0] ? [`<b lang="fi">${esc(x[0])}</b>`] : []).concat([esc(x[1])]); } return [SITE.md(p[Math.floor(Math.random() * p.length)].text)]; },
  uptime: () => ['up since 2013 (astronomy), load average: polarized, turbulent, rotating.'],
  ping: () => ['pong · 0.04 ms · from a lake at 60.45° N (it’s all in your browser)'],
  uname: () => ['Lakeside 6.0-birch #1 SMP PREEMPT hedgehog-powered aarch64 GNU/Mökki'],
  lorem: () => ['ipsum — especially of the dolor variety, but sit amet.'],
  climb: () => ['6b, confidently. anything above: “projecting”.'],
  piano: () => ['♪ … (progressively losing this skill) …'],
  sisu: () => ['sisu: running… (it doesn’t stop; that’s the point)'],
  apple: () => [onHome() ? '<span class="m">the apple grows on the birch (yes, on the birch). knock it down: it rolls off the roof, bounces off the mailbox and lands on the same spot every time. hedgehogs, as everyone knows, carry apples home on their backs — when one lands on them.</span>' : '<span class="m">the apple is on the birch, by the lake.</span>'],
  // the underside: undocumented. a hole in the ice, and down you go.
  avanto: () => { dive(); return []; }
};
const ALIAS = { photos: 'gallery', ll: 'ls', dir: 'ls', less: 'cat', more: 'cat', emacs: 'vim', nano: 'vim', vi: 'vim', hei: 'moi', hello: 'moi', hi: 'moi', terve: 'moi', guitar: 'piano', polarizer: 'analyzer', filter: 'analyzer', hedgehog: 'hog', logout: 'exit', quit: 'exit', now: 'time', cls: 'clear', xdg: 'open' };
const HIDDEN = new Set(['avanto', ':q', 'who', 'lorem', 'climb', 'piano', 'sisu', 'apple', 'uptime', 'revontulet', 'forecast', 'effects', 'time', 'almanac', 'interests', 'career', 'contacts', 'bio', 'wall', 'certificates', 'cabin', 'lake', 'figures']);
for (const k of Object.keys(PAGES)) if (!C[k]) C[k] = () => openOut(k);
for (const k of Object.keys(EXT)) if (!C[k]) C[k] = () => openURL(EXT[k][0], EXT[k][1]);
for (const e of SITE.explorers) if (!C[e.key]) C[e.key] = () => go(e.href, e.title);
C.analyzer = () => ['the polarizing filter lives on the research page, over the plates. ' + cmdLink('cd research')];
C.plate = () => ['the plates are on the research page. ' + cmdLink('cd research')];
/* pages add their own commands: RV.register('name', fn(args, raw) → lines, { help: 'shown under “this page”', hidden }) */
RV.register = (name, fn, o = {}) => { C[name] = fn; if (o.hidden) HIDDEN.add(name); else HIDDEN.delete(name); if (o.help) extraHelp.push(o.help); };
RV.commands = C;

let hist = store.get('hist', []), hIdx = hist.length;
async function run(line, fromClick, quiet) {
  line = String(line || '').trim();
  if (!log.childNodes.length && !quiet) greet();
  panel(out, true);
  if (!line) return;
  if (!quiet) { print(`<b>${esc($('#rvPs').textContent)}</b> ${esc(line)}`, 'cmd'); if (hist[hist.length - 1] !== line) hist.push(line); hist = hist.slice(-60); hIdx = hist.length; store.set('hist', hist); }
  for (const part of line.split(/\s*(?:&&|;)\s*/).filter(Boolean)) {
    const words = part.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    let name = words[0].toLowerCase(); const args = words.slice(1).map(w => w.replace(/^["']|["']$/g, ''));
    if (name === 'll') args.unshift('-l');
    if (name in ALIAS) name = ALIAS[name];
    let r;
    try {
      if (name && C[name]) r = C[name](args, part);
      else if (/^\.?\/?\.burrow/.test(words[0])) r = ['<span class="r">.burrow: Permission denied</span>'];
      else {
        const w = words[0].toLowerCase(), near = Object.keys(C).filter(k => !HIDDEN.has(k) && (k.startsWith(w.slice(0, 2)) || (w.startsWith(k) && k.length > 2))).slice(0, 3);
        r = [`<span class="m">${esc(words[0])}: command not found.${near.length ? ' did you mean ' + near.map(k => cmdLink(k)).join(', ') + '?' : ''} </span>${cmdLink('help')}`];
      }
      if (r && r.then) r = await r;
    } catch (e) { console.error(e); r = ['<span class="r">something went wrong there. the hedgehog is looking into it.</span>']; }
    if (r && r.length) say(r, 'o');
  }
  if (fromClick && !narrow()) input.focus({ preventScroll: true });
}
RV.run = run;
function commonPrefix(arr) { if (!arr.length) return ''; let p = arr[0]; for (const s of arr) while (!s.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1); return p; }
const SUB = { hog: ['on', 'off', 'come', 'sleep', 'wake', 'roll', 'speed', 'status'], date: ['-s', '--speed', '--reset'], weather: ['clear', 'auto'], rain: ['on', 'off', 'auto'], snow: ['on', 'off', 'auto'], aurora: ['on', 'off', 'auto'],
  smoke: ['on', 'off', 'auto'], window: ['clear', 'steam', 'frost', 'auto'], motion: ['reduced', 'full', 'auto'], man: ['vlad', 'hedgehog', 'sauna', 'date', 'luck', 'ls', 'cd', 'weather'], analyzer: ['on', 'off', 'turn', '0', '45', '90', '135'], plate: ['1', '2', '3'], luck: ['reset'] };
function complete() {
  const v = input.value, parts = v.split(/\s+/), last = parts[parts.length - 1];
  let cands = [];
  if (parts.length === 1) cands = Object.keys(C).filter(c => !HIDDEN.has(c) && c.startsWith(last.toLowerCase()));
  else {
    const c = parts[0].toLowerCase();
    if (SUB[c] && parts.length === 2) cands = SUB[c].filter(x => x.startsWith(last));
    else if (['cd', 'ls', 'cat', 'head', 'open', 'less', 'tree', 'more'].includes(c)) {
      const slash = last.lastIndexOf('/'), base = slash >= 0 ? last.slice(0, slash + 1) : '', frag = slash >= 0 ? last.slice(slash + 1) : last;
      const dp = resolve(base || '.');
      if (dp != null && isDir(dp)) { const D = FS.dirs.get(dp); cands = [...[...D.d].map(n => base + n + '/'), ...(c === 'cd' || c === 'tree' ? [] : [...D.f].map(n => base + n))].filter(n => n.slice(base.length).startsWith(frag) && (frag.startsWith('.') || !n.slice(base.length).startsWith('.'))); }
      if (!base && ['cd', 'open'].includes(c)) cands = cands.concat(['~', ...Object.keys(PAGES).filter(p => !HIDDEN.has(p)), ...SITE.explorers.map(e => e.key)].filter(p => p.startsWith(frag)));
    }
  }
  cands = [...new Set(cands)];
  if (!cands.length) return;
  const pre = commonPrefix(cands);
  if (cands.length === 1) { parts[parts.length - 1] = cands[0] + (cands[0].endsWith('/') ? '' : ' '); input.value = parts.join(' '); }
  else if (pre.length > last.length) { parts[parts.length - 1] = pre; input.value = parts.join(' '); }
  else { openLog(); print(`<div class="grid">${cands.slice(0, 60).map(x => `<span>${esc(x)}</span>`).join('')}</div>`, 'm'); }
}
function onKey(e) {
  if (e.key === 'Tab') { if (input.value.trim()) { e.preventDefault(); complete(); } }
  else if (e.key === 'ArrowUp') { if (hist.length) { hIdx = Math.max(0, hIdx - 1); input.value = hist[hIdx] || ''; e.preventDefault(); } }
  else if (e.key === 'ArrowDown') { hIdx = Math.min(hist.length, hIdx + 1); input.value = hist[hIdx] || ''; e.preventDefault(); }
  else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); clearLog(); }
  else if (e.key === 'c' && e.ctrlKey && !getSelection().toString()) { print(`<b>${esc(input.value)}</b>^C`, 'cmd'); input.value = ''; }
}

/* ================= little shared behaviours ================= */
// e-mail addresses are assembled here, never written whole in the HTML
RV.mails = (root = document) => root.querySelectorAll('[data-u][data-d]').forEach(a => {
  if (a.tagName === 'A') a.href = 'mailto:' + a.dataset.u + '@' + a.dataset.d;
  const t = a.querySelector('.addr') || a; if (!t.textContent.trim()) t.textContent = a.dataset.u + ' [at] ' + a.dataset.d;
});
initDock(); RV.mails();   // site.js is loaded at the end of <body>, so the page is there
})();
