// Colour maps for the parameter plane. The plane is a dark plate in both themes,
// so these are fixed colours, not theme tokens.
//
// Per pixel the renderer stores: esc (smooth escape time, or -1 if bounded),
// lam (fibre Lyapunov exponent), k (sheet count; 0 = no finite structure,
// -1 = not computed).

export const CATS = [
  { id: 'esc', label: 'escapes', color: '#1c2333' },
  { id: 'k1', label: '1 smooth graph', hue: 214, sat: 0.62 },
  { id: 'k2', label: '2 sheets', hue: 36, sat: 0.85 },
  { id: 'k3', label: '3 sheets', hue: 150, sat: 0.55 },
  { id: 'k4', label: '4 sheets', hue: 336, sat: 0.6 },
  { id: 'k5', label: '≥5 sheets', hue: 268, sat: 0.5 },
  { id: 'sna', label: 'no sheets, λ<0 (strange nonchaotic)', hue: 300, sat: 0.25 },
  { id: 'neutral', label: 'λ ≈ 0, no sheets (neutral, quasi-periodic)', hue: 168, sat: 0.22 },
  { id: 'chaos', label: 'λ ≥ 0 (chaotic)', hue: 8, sat: 0.8 },
];

export function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}
function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function swatch(cat) {
  if (cat.color) return cat.color;
  const [r, g, b] = hsl(cat.hue, cat.sat, 0.55);
  return `rgb(${r},${g},${b})`;
}

/** |λ| below this with no sheet structure counts as neutral (quasi-periodic motion). */
export const NEUTRAL_TOL = 0.005;

export function category(esc, lam, k) {
  if (esc >= 0) return 'esc';
  if (Math.abs(lam) < NEUTRAL_TOL) {
    // neutral: k invariant curves (not attracting), or no curves at all
    if (k >= 1) return k >= 5 ? 'k5' : `k${k}`;
    return 'neutral';
  }
  if (!(lam < 0)) return 'chaos';
  if (k === 0) return 'sna';
  if (k < 0) return 'k1';
  return k >= 5 ? 'k5' : `k${k}`;
}

const escBase = hex('#0d111a');
const escTop = hex('#3a4763');
const catByID = Object.fromEntries(CATS.map((c) => [c.id, c]));

/** Classification colouring. Brightness inside a component follows the multiplier e^λ. */
export function colorClassify(esc, lam, k, out, o) {
  if (esc >= 0) {
    // slow escape is lighter: the filaments around the set glow faintly
    const t = Math.max(0, Math.min(1, Math.log(1 + esc) / Math.log(200)));
    out[o] = escBase[0] + (escTop[0] - escBase[0]) * t;
    out[o + 1] = escBase[1] + (escTop[1] - escBase[1]) * t;
    out[o + 2] = escBase[2] + (escTop[2] - escBase[2]) * t;
    out[o + 3] = 255;
    return;
  }
  const id = category(esc, lam, k);
  const c = catByID[id];
  let l;
  if (id === 'chaos') l = 0.45 + 0.35 * Math.min(1, lam / 0.7);
  else if (id === 'neutral') l = 0.62;
  else {
    const m = Math.exp(Math.min(0, Math.max(-12, lam))); // |multiplier| in (0, 1]
    l = 0.16 + 0.62 * Math.pow(m, 0.6);
  }
  const [r, g, b] = hsl(c.hue, c.sat, l);
  out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
}

/** Diverging map on λ: blue (attracting) — white (λ = 0) — red (chaotic). */
export function colorLyap(esc, lam, k, out, o) {
  if (esc >= 0) {
    out[o] = 10; out[o + 1] = 12; out[o + 2] = 18; out[o + 3] = 255;
    return;
  }
  let r, g, b;
  if (lam < 0) {
    const t = Math.min(1, -lam / 2.5);
    const s = Math.pow(t, 0.55);
    r = 245 - 215 * s; g = 247 - 170 * s; b = 255 - 75 * s;
  } else {
    const t = Math.min(1, lam / 1.0);
    const s = Math.pow(t, 0.55);
    r = 255 - 45 * s; g = 245 - 180 * s; b = 235 - 195 * s;
  }
  out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
}

/** Classic smooth escape-time palette; bounded orbits dark. */
const ESC_STOPS = ['#0b1026', '#1f3a8a', '#5aa2e0', '#f4f1de', '#e8a33d', '#8c2d19', '#0b1026'].map(hex);
export function colorEscape(esc, lam, k, out, o) {
  if (esc < 0) {
    out[o] = 6; out[o + 1] = 7; out[o + 2] = 10; out[o + 3] = 255;
    return;
  }
  const t = ((Math.sqrt(Math.max(0, esc)) * 0.18) % 1) * (ESC_STOPS.length - 1);
  const i = Math.floor(t), f = t - i;
  const A = ESC_STOPS[i], B = ESC_STOPS[i + 1];
  out[o] = A[0] + (B[0] - A[0]) * f;
  out[o + 1] = A[1] + (B[1] - A[1]) * f;
  out[o + 2] = A[2] + (B[2] - A[2]) * f;
  out[o + 3] = 255;
}

export const COLORERS = { classify: colorClassify, lyap: colorLyap, escape: colorEscape };

/** sheet colours for line plots (works on light and dark backgrounds) */
export const SHEET_COLORS = ['#3b6fe0', '#e0892b', '#2f9e6a', '#d1477a', '#8a63d2', '#c9a227', '#2aa6b8', '#b5533c'];
