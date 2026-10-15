// Mandelburger — UI orchestration.
// State lives in `S`; heavy work goes to two worker pools:
//   pool      — parameter-plane strips, border rays, slices (all cores but one)
//   analyst   — single worker for the per-parameter analysis (never queued behind the plane)

import { parse, evaluate, ExprError, describe, diff, FUNCTION_DOCS } from './core/expr.js';
import { coordinatesOf, getCoord, setCoord, defaultValue, isZ0Axis, buildModel, cocycleKindOf } from './core/model.js';
import { convergents, chooseReturnPair, formatCF } from './core/diophantine.js';
import { recordLength } from './core/orbit.js';
import { describeStructure } from './core/structure.js';
import { fft, nextPow2 } from './core/fft.js';
import { fmt } from './core/complex.js';
import { Pool } from './workers/pool.js';
import { PlaneView } from './ui/plane.js';
import { pointAt, vertexTs } from './ui/paths.js';
import { sectionIndices } from './core/section.js';
import { CATS, swatch, category, NEUTRAL_TOL } from './ui/colors.js';
import { plotGraph, plotPhase, plotSpectrum, plotSlice, placeholder, resizeAll, plotCocycleSpectrum, plotCocycleOrbit, plotTangent } from './ui/plots.js';

const $ = (id) => document.getElementById(id);
const TWO_PI = 2 * Math.PI;

// ---------------------------------------------------------------- presets
const GOLDEN = '2*pi*(sqrt(5)-1)/2';
const C = ['c1.re', 'c1.im'];

// ---- path helpers for preset slices (points in the preset's plane coordinates)
const TAU = 2 * Math.PI;
const SQ3 = Math.sqrt(3);
const seg = (name, a, b) => ({ name, kind: 'line', pts: [a, b] });
const curveOf = (name, f, t0 = 0, t1 = TAU, n = 240) => ({ name, kind: 'curve', pts: Array.from({ length: n + 1 }, (_, i) => f(t0 + ((t1 - t0) * i) / n)) });
const circleOf = (name, cx, cy, r) => curveOf(name, (t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)]);
/** c = μ/2 − μ²/4 with |μ| = m: where z² + c has a fixed point of multiplier μ (m = 1: the main cardioid). */
const cardioidOf = (name, m) => curveOf(name, (t) => {
  const a = (m * Math.cos(t)) / 2, b = (m * Math.sin(t)) / 2; // a + ib = μ/2 = fixed point
  return [a - (a * a - b * b), b - 2 * a * b];
});
/** c = μ·e^(−μ), |μ| = m: where c·e^z has a fixed point (z = μ) of multiplier μ. */
const expComponentOf = (name, m) => curveOf(name, (t) => {
  const x = m * Math.cos(t), y = m * Math.sin(t), e = Math.exp(-x);
  return [e * (x * Math.cos(y) + y * Math.sin(y)), e * (y * Math.cos(y) - x * Math.sin(y))];
});
// Each preset carries one or two slices worth looking at (MATH.md §9a says what each shows).
// They are added when the preset is loaded and computed when the Slice tab is opened.
const PRESET_SLICES = {
  mandel: [
    cardioidOf('|2a₀| = 0.9: λ = log 0.9 exactly (Jensen)', 0.9),
    cardioidOf('main cardioid |2a₀| = 1: small divisors', 1),
  ],
  twosided: [
    cardioidOf('|2a₀| = 0.9: λ ≠ log 0.9, Jensen fails', 0.9),
    seg('real axis: one graph → 2 sheets → escape', [0.35, 0], [-1.45, 0]),
  ],
  sine: [
    circleOf('|c1| = 0.55: λ depends on arg c1', 0, 0, 0.55),
    circleOf('|c1| = 0.62: in and out of the lobes', 0, 0, 0.62),
  ],
  powers: [
    seg('Re c1 = 0.66: through the 2-sheet bulbs, SNA at their edges', [0.66, -0.5], [0.66, 0.5]),
    seg('real axis', [-1.2, 0], [1.2, 0]),
  ],
  logplane: [
    seg('through r1 = −√3, inclined: chaos, period-3 window, SNA islands, 2 → 1', [-SQ3 - 0.25 * Math.cos(Math.PI / 12), -0.25 * Math.sin(Math.PI / 12)], [-SQ3 + 1.6 * Math.cos(Math.PI / 12), 1.6 * Math.sin(Math.PI / 12)]),
    seg('r2 = 0: the unforced logistic bifurcation diagram', [0.3, 0], [-2, 0]),
  ],
  'warp-rot': [
    circleOf('|c1| = 0.3: λ varies with arg c1 (constant without the stretching)', 0, 0, 0.3),
    circleOf('|c1| = 0.45: across the lopsided border', 0, 0, 0.45),
  ],
  linear: [
    circleOf('unit circle: λ = log max(|cos t|, |sin t|) exactly', 0, 0, 1),
    seg('diagonal r2 = r3: λ = log|r2|, out through the corner', [-1.4, -1.4], [1.4, 1.4]),
  ],
  flower: [
    seg('r3 = 0.5: escape → neutral → 4 curves → neutral → escape', [-1.6, 0.5], [1.6, 0.5]),
    seg('r2 = 0.5: up through the root crossing the unit circle at r3 = 0', [0.5, -1], [0.5, 2]),
  ],
  'warp-lin-mobius': [
    circleOf('unit circle: λ = log|e^{it} − r1| exactly', 0, 0, 1),
    seg('real axis: the two disc pieces meet at c1 = 1', [-1.2, 0], [2.4, 0]),
  ],
  'warp-lin-hooke': [
    seg('real axis: graph → SNA → neutral waist → SNA → graph', [-1.6, 0], [1.6, 0]),
    circleOf('unit circle: through both wings', 0, 0, 1),
  ],
  'kepler-mean-focus': [
    seg('e = 0.6: across the resonance lines (q-sheet curves)', [0.6, 0.25], [0.6, 1.25]),
    seg('rotation r3 = 0.5: a 2-sheet resonance band, then neutral', [0.02, 0.5], [0.95, 0.5]),
  ],
  'kepler-mean-c': [
    seg('real axis: the straight cramped border, then the orbit', [-1.7, 0], [2.3, 0]),
    seg('Re c1 = 0.5: across the attracting region', [0.5, -2], [0.5, 2]),
  ],
  harperE: [
    seg('coupling 0.5: spectrum bands neutral (extended states)', [-3.2, 0.5], [3.2, 0.5]),
    seg('coupling 2 (energy ×2): the same gaps, bands SNA (localised); Aubry duality', [-6.4, 2], [6.4, 2]),
  ],
  gopy: [
    seg('r2 = 0: smooth graph → SNA at r1 = 1 (GOPY)', [0, 0], [3, 0]),
    seg('r1 = 2.2: across the SNA wedge', [2.2, -1.5], [2.2, 1.5]),
  ],
  arnold: [
    seg('K = 0.8: across the forced Arnold tongues', [0, 0.8], [TAU, 0.8]),
    seg('Ω = π: up the 1/2 tongue, 2 → 4 sheets, then escape', [Math.PI, 0], [Math.PI, 3.5]),
  ],
  exp: [
    expComponentOf('multiplier |μ| = 0.9 of c·e^z: λ ≈ log 0.9, not exact', 0.9),
    seg('real axis: out of the main component near 1/e', [-1.6, 0], [1.6, 0]),
  ],
};
const PRESETS = [
  { id: 'mandel', name: 'Analytic forcing — f² + c1 + r1·eⁱˣ (solvable by a power series)', expr: 'f^2 + c1 + r1*cis(x)', params: { c1: [-1.05, 0.05], r1: 0.06 }, axes: C, T: '1', view: { cx: -0.62, cy: 0, r: 1.35 } },
  { id: 'twosided', name: 'Two-sided forcing — f² + c1 + r1·eⁱˣ + r2·e⁻ⁱˣ', expr: 'f^2 + c1 + r1*cis(x) + r2*cis(-x)', params: { c1: [-0.2, 0], r1: 0.1, r2: 0.05 }, axes: C, T: '1', view: { cx: -0.62, cy: 0, r: 1.35 } },
  { id: 'sine', name: 'Sine forcing — f² + c1·sin x', expr: 'f^2 + c1*sin(x)', params: { c1: [0.3, 0] }, axes: C, T: '1', view: { cx: 0, cy: 0, r: 1.1 } },
  { id: 'powers', name: 'Powers — c1·f^n1 − sin(x+r1)^n2', expr: 'c1*f^n1 - sin(x+r1)^n2', params: { c1: [0.3, 0], r1: 0, n1: 3, n2: 2 }, axes: C, T: '1', view: { cx: 0, cy: 0, r: 1.2 } },
  { id: 'logplane', name: 'Forced logistic, real plane (r1, r2) — f² + r1 + r2·cos x', expr: 'f^2 + r1 + r2*cos(x)', params: { r1: -0.95, r2: 0.25 }, axes: ['r1', 'r2'], T: GOLDEN, view: { cx: -0.8, cy: 0.55, r: 1.25 } },
  { id: 'warp-rot', name: 'Stretched rotation — f² + c1·cis(mobius(r1, x)): the disc of f² + c1·eⁱˣ loses its symmetry', expr: 'f^2 + c1*cis(mobius(r1, x))', params: { c1: [0.3, 0], r1: 0.8 }, axes: C, T: '1', view: { cx: 0, cy: 0, r: 1.2 } },
  { id: 'linear', name: 'Linear, exactly solvable — f·(r2·eⁱˣ + r3·e⁻ⁱˣ) + 1', expr: 'f*( r2*exp(i*x) + r3*exp(-i*x)) + 1', params: { r2: 0.5, r3: 0.3 }, axes: ['r2', 'r3'], T: '1', view: { cx: 0, cy: 0, r: 1.5 } },
  { id: 'flower', name: 'Your cramped ellipse — 4 curves (multiplicative cocycle)', expr: 'f *( 2*(r2*sin(r1)+sin(x)) + 2*r3*i*(r2*cos(r1)+cos(x)) )/(1+r3)  *cis(x)', params: { r1: 0.3, r2: 0.5, r3: 0.7 }, axes: ['r2', 'r3'], T: '1', start: 'custom', z0: [1, 0], view: { cx: 0, cy: 0.5, r: 1.6 } },
  { id: 'warp-lin-mobius', name: 'Stretched circle, affine, Möbius — f·(c1 + cis(mobius(r1, x))) + 1, λ = log|c1 − r1| or log|1 − r1·c1|', expr: 'f*(c1 + cis(mobius(r1, x))) + 1', params: { c1: [0.9, 0], r1: 0.8 }, axes: C, T: '1', start: 'custom', z0: [0, 0], view: { cx: 0.6, cy: 0, r: 1.8 } },
  { id: 'warp-lin-hooke', name: 'Stretched circle, affine, Hooke — f·(c1 + cis(hooke(r1, x))) + 1 (a butterfly: Möbius in the doubled angle)', expr: 'f*(c1 + cis(hooke(r1, x))) + 1', params: { c1: [0.6, 0], r1: 0.4 }, axes: C, T: '1', start: 'custom', z0: [0, 0], view: { cx: 0, cy: 0, r: 1.6 } },
  { id: 'kepler-mean-focus', name: 'Kepler, focus at 0, in time, unwound — f·cis(r3)·r(t)·cis(−x)/kgmean(r1, r2, 0), plane (e = r2, rotation r3)', expr: 'f*cis(r3)*cis(-x)*(r1*(cos(kepler(r2,x)) - r2) + i*r1*sqrt(1-r2^2)*sin(kepler(r2,x)))/kgmean(r1, r2, 0)', params: { r1: 1, r2: 0.6, r3: 0.5 }, axes: ['r2', 'r3'], T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.5, cy: 0.75, r: 0.5 } },
  { id: 'kepler-mean-c', name: 'Kepler, mean anomaly, not normalised — cramped border in the c1-plane (a straight line inside the orbit)', expr: 'f*(r1*(cos(kepler(r2,x)) - r2) + i*r1*sqrt(1-r2^2)*sin(kepler(r2,x)) + c1)', params: { r1: 1, r2: 0.6, c1: [0.2, 0.1] }, axes: C, T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.3, cy: 0, r: 2 } },
  { id: 'harperE', name: 'Harper, real plane (energy r1, coupling r2) — spectrum, gaps, SNA', expr: '((r1 - 2*r2*cos(x))*(1+f) - 2*i*f)/((r1 - 2*r2*cos(x))*(1+f) + 2*i)', params: { r1: 1.2, r2: 0.5 }, axes: ['r1', 'r2'], T: GOLDEN, start: 'custom', z0: [0, 0], view: { cx: 0, cy: 1.4, r: 3.2 } },
  { id: 'gopy', name: 'GOPY strange nonchaotic — 2r1·cos x·tanh f + r2', expr: '2*r1*cos(x)*tanh(f) + r2', params: { r1: 1.5, r2: 0 }, axes: ['r1', 'r2'], T: GOLDEN, start: 'custom', z0: [1, 0], view: { cx: 1.5, cy: 0, r: 1.5 } },
  { id: 'arnold', name: 'Forced complex Arnold family — f·cis(r1 + r3·cos x)·exp(r2/2·(f − 1/f))', expr: 'f*cis(r1 + r3*cos(x))*exp(r2/2*(f - 1/f))', params: { r1: 3.14, r2: 0.8, r3: 0.2 }, axes: ['r1', 'r2'], T: GOLDEN, view: { cx: 3.1416, cy: 0.75, r: 3.1416 } },
  { id: 'exp', name: 'Forced exponential — c1·e^f + r1·sin x', expr: 'c1*exp(f) + r1*sin(x)', params: { c1: [0.2, 0], r1: 0.2 }, axes: C, T: '1', view: { cx: 0, cy: 0, r: 1.6 } },
  // Retired presets (Oct 2026): still documented in MATH.md §13–14; uncomment to restore.
  // { id: 'sine2', name: 'Your example — f² + c1·sin²x  (c1 = −1)', expr: 'f^2 + c1*sin(x)^2', params: { c1: [-1, 0] }, axes: C, T: '1', view: { cx: -0.5, cy: 0, r: 1.6 } },
  // { id: 'linear2', name: 'Linear + quadratic — c1·f² + f·(r2·eⁱˣ + r3·e⁻ⁱˣ) + 1', expr: 'c1*f^2 + f*(r2*cis(x) + r3*cis(-x)) + 1', params: { c1: [0.1, 0], r2: 0.5, r3: 0.3 }, axes: ['r2', 'r3'], T: '1', view: { cx: 0, cy: 0, r: 1.5 } },
  // { id: 'toy', name: 'Original toy — c1·f² + sin x', expr: 'c1*f^2 + sin(x)', params: { c1: [0.5, 0] }, axes: C, T: '1', view: { cx: 0, cy: 0, r: 1 } },
  // { id: 'golden', name: 'Golden rotation — f² + c1·sin x', expr: 'f^2 + c1*sin(x)', params: { c1: [0.3, 0] }, axes: C, T: GOLDEN, view: { cx: 0, cy: 0, r: 1.1 } },
  // { id: 'logistic', name: 'Forced logistic, complex c1 — f² + c1 + r1·cos x', expr: 'f^2 + c1 + r1*cos(x)', params: { c1: [-0.95, 0], r1: 0.25 }, axes: C, T: GOLDEN, view: { cx: -0.75, cy: 0, r: 1.15 } },
  // { id: 'cramped', name: 'Cramped by construction — f·cis(r1)·(r2 + sin x)/gmean(r2 + sin x)', expr: 'f*cis(r1)*(r2 + sin(x))/gmean(r2 + sin(x))', params: { r1: 2.0944, r2: 1.5 }, axes: ['r1', 'r2'], T: GOLDEN, start: 'custom', z0: [1, 0], view: { cx: 3.1416, cy: 3, r: 3.1416 } },
  // { id: 'kepler-true', name: 'Kepler ellipse, true anomaly — f·cis(r3)·r(x)/tgmean, plane (a = r1, e = r2)', expr: 'f*cis(r3)*(r1*(1-r2^2)/(1+r2*cos(x))*cis(x) + c1)/tgmean(r1, r2, c1)', params: { r1: 0.4, r2: 0.6, r3: 0, c1: [0.6, 0.3] }, axes: ['r1', 'r2'], T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.5, cy: 0.5, r: 0.5 } },
  // { id: 'kepler-mean', name: 'Kepler ellipse, mean anomaly (time) — f·cis(r3)·r(t)/kgmean, plane (a = r1, e = r2)', expr: 'f*cis(r3)*(r1*(cos(kepler(r2,x)) - r2) + i*r1*sqrt(1-r2^2)*sin(kepler(r2,x)) + c1)/kgmean(r1, r2, c1)', params: { r1: 0.4, r2: 0.6, r3: 0, c1: [0.6, 0.3] }, axes: ['r1', 'r2'], T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.5, cy: 0.5, r: 0.5 } },
  // { id: 'kepler-true-focus', name: 'Kepler, focus at 0, true anomaly, unwound — f·cis(r3)·r(x)·cis(−x)/tgmean(r1, r2, 0), plane (e = r2, rotation r3)', expr: 'f*cis(r3)*r1*(1-r2^2)/(1+r2*cos(x))*cis(x)*cis(-x)/tgmean(r1, r2, 0)', params: { r1: 1, r2: 0.6, r3: 0.5 }, axes: ['r2', 'r3'], T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.5, cy: 0.75, r: 0.5 } },
  // { id: 'kepler-inv', name: 'Kepler 1/r, focus at 0, in time, unwound — f·cis(r3)·kgmean/(cis(−x)·r(t)), plane (e = r2, rotation r3)', expr: 'f*cis(r3)*kgmean(r1, r2, 0)/(cis(-x)*(r1*(cos(kepler(r2,x)) - r2) + i*r1*sqrt(1-r2^2)*sin(kepler(r2,x))))', params: { r1: 1, r2: 0.6, r3: 0.5 }, axes: ['r2', 'r3'], T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.5, cy: 0.75, r: 0.5 } },
  // { id: 'kepler-inv2', name: 'Kepler 1/r² (inverse square), focus at 0, in time, unwound — f·cis(r3)·(kgmean/(cis(−x)·r(t)))²', expr: 'f*cis(r3)*(kgmean(r1, r2, 0)/(cis(-x)*(r1*(cos(kepler(r2,x)) - r2) + i*r1*sqrt(1-r2^2)*sin(kepler(r2,x)))))^2', params: { r1: 1, r2: 0.6, r3: 0.5 }, axes: ['r2', 'r3'], T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.5, cy: 0.75, r: 0.5 } },
  // { id: 'kepler-sq', name: 'Kepler (f/r)², quadratic, focus at 0, in time, unwound — cis(r3)·(f·kgmean/(cis(−x)·r(t)))², z0-plane (fibred Julia set)', expr: 'cis(r3)*(f*kgmean(r1, r2, 0)/(cis(-x)*(r1*(cos(kepler(r2,x)) - r2) + i*r1*sqrt(1-r2^2)*sin(kepler(r2,x)))))^2', params: { r1: 1, r2: 0.6, r3: 0 }, axes: ['z0.re', 'z0.im'], T: '1', start: 'custom', z0: [0.2, 0.1], view: { cx: 0, cy: 0, r: 0.8 } },
  // { id: 'kepler-true-c', name: 'Kepler, true anomaly, not normalised — cramped border in the c1-plane (a circular arc inside the orbit)', expr: 'f*(r1*(1-r2^2)/(1+r2*cos(x))*cis(x) + c1)', params: { r1: 1, r2: 0.6, c1: [0.2, 0.1] }, axes: C, T: '1', start: 'custom', z0: [1, 0], view: { cx: 0.3, cy: 0, r: 2 } },
  // { id: 'warp-mandel', name: 'Stretched analytic forcing — f² + c1 + r1·cis(arnold(r2, x)), arnold(e, x) = x + e·sin x', expr: 'f^2 + c1 + r1*cis(arnold(r2, x))', params: { c1: [-0.2, 0], r1: 0.15, r2: 0.8 }, axes: C, T: '1', view: { cx: -0.62, cy: 0, r: 1.35 } },
  // { id: 'warp-lin-arnold', name: 'Stretched circle, affine — f·(c1 + cis(arnold(r1, x))) + 1 (unstretched: no attracting region at all)', expr: 'f*(c1 + cis(arnold(r1, x))) + 1', params: { c1: [0.3, 0], r1: 0.8 }, axes: C, T: '1', start: 'custom', z0: [0, 0], view: { cx: 0.3, cy: 0, r: 1.6 } },
  // { id: 'circle', name: 'Cramped circles — f·(c1 + r1·eⁱˣ), cramped iff max(|c1|, r1) = 1', expr: 'f*(c1 + r1*cis(x))', params: { c1: [0.6, 0.8], r1: 0.6 }, axes: C, T: '1', start: 'custom', z0: [1, 0], view: { cx: 0, cy: 0, r: 1.6 } },
  // { id: 'harper', name: 'Harper / almost Mathieu, complex energy c1 (disk coordinates)', expr: '((c1 - 2*r1*cos(x))*(1+f) - 2*i*f)/((c1 - 2*r1*cos(x))*(1+f) + 2*i)', params: { c1: [0.3, 0.2], r1: 0.5 }, axes: C, T: GOLDEN, start: 'custom', z0: [0, 0], view: { cx: 0, cy: 0, r: 3.5 } },
];


// ---------------------------------------------------------------- state
const DEFAULTS = {
  preset: 'mandel', expr: 'f^2 + c1 + r1*cis(x)', params: { c1: [-1.05, 0.05], r1: 0.06 }, axes: ['c1.re', 'c1.im'], Texpr: '1', start: 'crit', mode: 'classify',
  quality: '1', kmax: 6, nTrans: 500, nLyap: 1500, tau: 0.2, budget: 8000, Ssample: 256,
  M: 512, orbitLen: 60000, rays: 64, rayM: 256, view: { cx: -0.62, cy: 0, r: 1.35 }, comp: 're', tab: 'graph', sliceTheta: 0, sliceSpread: 29, sliceCap: 20, sliceDraw: 'line', summaryOpen: false, plotDots: 5000, secOpen: { plane: true, curves: true, solver: false },
};
const S = load();
S.T = 1;

function load() {
  try {
    const raw = localStorage.getItem('mandelburger.v2');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return structuredClone(DEFAULTS);
}
function save() {
  try {
    const { T, ...rest } = S;
    void T;
    localStorage.setItem('mandelburger.v2', JSON.stringify(rest));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- pools
const hc = Math.max(2, Math.min(16, navigator.hardwareConcurrency || 4));
const pool = new Pool(hc - 1, { name: 'plane' });
const analyst = new Pool(1, { name: 'analysis' });
Promise.all([pool.ready, analyst.ready]).then(() => {
  $('st-workers').textContent = pool.inline ? 'main thread' : `${pool.size} + 1`;
});

// ---------------------------------------------------------------- plane view
const plane = new PlaneView({
  wrap: $('plate'), plane: $('plane'), overlay: $('overlay'), axesEl: $('axes'), progressEl: $('progress'), pool,
  onPick: (P, sn) => { if (sn) setWalk(sn.path.id, sn.t); else walk.on = false; pick(P); },
  onSlice: (sl) => addSlice(sl),
  onBorderPick: (P) => borderAt(P),
  onHover: (h) => hover(h),
  onRendered: ({ ms, W, stats }) => {
    $('st-plane').textContent = `${(ms / 1000).toFixed(2)} s · ${W}² px${exactPlane() ? ' · exact' : ''}`;
    legend(stats);
  },
  onViewChange: (v) => { S.view = v; save(); },
});

// ---------------------------------------------------------------- problem
let info = null; // describe() of the current expression
let coords = []; // plane-able coordinates
let planeOK = false;
function problem() {
  const start = isZ0Axis(S.axes) ? 'custom' : S.start === 'zero' ? 'custom' : S.start;
  return { expr: S.expr, params: structuredClone(S.params), axes: [...S.axes], T: S.T, start, z0: [...(S.params.z0 || [0, 0])] };
}
const currentUV = () => [getCoord(S.params, S.axes[0]), getCoord(S.params, S.axes[1])];
const coordLabel = (id) => (coords.find((c) => c.id === id) || { label: id }).label;
/** "c1 = 0.3 + 0.1i" when the plane is a c-plane, otherwise "r1 = …, r2 = …" */
function paramLabel(P, digits = 8) {
  const [a, b] = S.axes;
  const ca = a.split('.'), cb = b.split('.');
  const nm = (n) => (n === 'z0' ? 'z₀' : n);
  if (ca[0] === cb[0] && ca[1] === 're' && cb[1] === 'im') return `${nm(ca[0])} = ${fmt(P, digits)}`;
  if (ca[0] === cb[0] && ca[1] === 'im' && cb[1] === 're') return `${nm(ca[0])} = ${fmt([P[1], P[0]], digits)}`;
  return `${coordLabel(a)} = ${+P[0].toPrecision(digits)}, ${coordLabel(b)} = ${+P[1].toPrecision(digits)}`;
}
/** Linear cocycle (F = g f or f + L) on a non-z0 plane: the plane is a closed form, not orbits. */
function exactPlane() {
  if (isZ0Axis(S.axes)) return null;
  try { return cocycleKindOf(buildModel(problem())); } catch { return null; }
}
function returns() {
  return chooseReturnPair(S.T, S.kmax, S.budget);
}
function planeCfg() {
  const r = returns();
  const nRec = S.mode === 'classify' ? Math.max(S.nLyap, recordLength(S.Ssample, r.qB, S.kmax)) : S.nLyap;
  return { prob: problem(), nTrans: S.nTrans, nRec, kmax: S.kmax, tau: S.tau, S: S.Ssample, qA: r.qA, qB: r.qB };
}

function validateExpr() {
  const msg = $('expr-msg');
  try {
    const ast = parse(S.expr);
    const D = diff(ast, 'f');
    info = describe(ast);
    for (const name of [...info.c, ...info.r, ...info.n, 'z0']) if (S.params[name] === undefined) S.params[name] = defaultValue(name);
    coords = coordinatesOf(info);
    $('expr').classList.remove('err');
    msg.classList.remove('err');
    const notes = [];
    if (!info.usesF) notes.push('F does not contain f, so the solution is simply f(x+T) = F(x).');
    else if (!D.vars.has('f')) {
      const kind = exactPlane();
      if (kind === 'mult') notes.push('Multiplicative cocycle F = g(x)·f: the plane is exact (λ = mean log|g|, no orbits); closed form in the Cocycle tab.');
      else if (kind === 'add') notes.push('Additive cocycle F = f + L(x): the plane is exact (drift = mean L); closed form in the Cocycle tab.');
      else notes.push('F is affine in f: no critical point, orbits start at z₀.');
    }
    if (!info.usesX) notes.push('F does not depend on x: this is an ordinary (unforced) map.');
    msg.textContent = notes.join(' ');
    renderParams();
    renderAxes();
    return true;
  } catch (e) {
    $('expr').classList.add('err');
    msg.classList.add('err');
    msg.textContent = e instanceof ExprError ? e.message : String(e);
    return false;
  }
}

/** Build the parameter inputs for the parameters that occur in the expression. */
function renderParams() {
  const box = $('params');
  const onAxis = (id) => S.axes.includes(id);
  const STEP = 'Arrow keys step 0.01 (Shift 0.1, Alt 0.001); values update while you step.';
  const lab = (name, id, plane) => `<label for="${id}" class="${plane ? 'on-plane' : ''}" title="${plane ? 'A coordinate of the parameter plane: picking a point sets it' : ''}"><i>${name}</i></label>`;
  const rows = [];
  for (const c of info.c) {
    const v = S.params[c];
    const pl = onAxis(`${c}.re`) || onAxis(`${c}.im`);
    rows.push(`<div class="pg">${lab(c, `par-${c}-re`, pl)}<input type="number" step="0.01" id="par-${c}-re" value="${v[0]}" data-coord="${c}.re" aria-label="Re ${c}" title="Re ${c}. ${STEP}" /><span class="sep">+<i>i</i></span><input type="number" step="0.01" id="par-${c}-im" value="${v[1]}" data-coord="${c}.im" aria-label="Im ${c}" title="Im ${c}. ${STEP}" /></div>`);
  }
  const cells = [
    ...info.r.map((r) => [lab(r, `par-${r}`, onAxis(r)), `<input type="number" step="0.01" id="par-${r}" value="${S.params[r]}" data-coord="${r}" title="${r} (real). ${STEP}" />`]),
    ...info.n.map((n) => [lab(n, `par-${n}`, false), `<input type="number" step="1" id="par-${n}" value="${S.params[n]}" data-int="${n}" title="${n} (integer)" />`]),
  ];
  for (let i = 0; i < cells.length; i += 2) {
    const [l1, f1] = cells[i], [l2, f2] = cells[i + 1] || ['<span></span>', '<span></span>'];
    rows.push(`<div class="pg">${l1}${f1}${l2.replace('<label ', '<label data-sep="1" ')}${f2}</div>`);
  }
  if (!rows.length) rows.push('<p class="hint">No parameters. Add c1, c2 … (complex), r1 … (real) or n1 … (integer) to the expression.</p>');
  box.innerHTML = rows.join('');
  box.querySelectorAll('input[data-coord]').forEach((el) => {
    fineStepper(el);
    const apply = () => {
      const v = parseFloat(el.value);
      if (!Number.isFinite(v)) return;
      if (v === getCoord(S.params, el.dataset.coord)) return;
      setCoord(S.params, el.dataset.coord, v);
      // moving a plane coordinate only moves the marker; anything else changes the plane
      if (S.axes.includes(el.dataset.coord)) { save(); pick(currentUV()); } else onParamsChanged();
    };
    const onAxis = S.axes.includes(el.dataset.coord);
    el.addEventListener('input', debounce(apply, onAxis ? 120 : 350));
    el.addEventListener('change', () => {
      if (!Number.isFinite(parseFloat(el.value))) el.value = getCoord(S.params, el.dataset.coord);
      apply();
    });
  });
  box.querySelectorAll('input[data-int]').forEach((el) =>
    el.addEventListener('change', () => {
      const v = Math.round(parseFloat(el.value));
      if (!Number.isFinite(v)) { el.value = S.params[el.dataset.int]; return; }
      el.value = v;
      S.params[el.dataset.int] = v;
      onParamsChanged();
    }),
  );
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/**
 * Arrow-key stepping for number inputs: base step (0.01), x10 with Shift,
 * /10 with Alt. Rounds to the step's decimals so values stay clean
 * (0.3 + 0.01 = 0.31, not 0.31000000000000005), and fires an input event.
 */
function fineStepper(el, base = 0.01) {
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = e.shiftKey ? base * 10 : e.altKey ? base / 10 : base;
    const dec = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
    const cur = parseFloat(el.value);
    const v = (Number.isFinite(cur) ? cur : 0) + (e.key === 'ArrowUp' ? step : -step);
    el.value = String(+v.toFixed(Math.max(dec, decimals(cur))));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const decimals = (v) => {
  if (!Number.isFinite(v)) return 0;
  const s = String(v);
  const i = s.indexOf('.');
  return i < 0 || s.includes('e') ? 0 : Math.min(10, s.length - i - 1);
};

/** Start-mode controls: a z0 axis forces "start at z0" (each pixel is its own start). */
function syncStart() {
  const z0 = S.params.z0 || [0, 0];
  const onAxis = isZ0Axis(S.axes);
  $('start').value = onAxis || S.start === 'zero' ? 'custom' : S.start;
  $('start').disabled = onAxis;
  if (document.activeElement !== $('z0-re')) $('z0-re').value = z0[0];
  if (document.activeElement !== $('z0-im')) $('z0-im').value = z0[1];
  document.querySelector('label[for="z0-re"]').classList.toggle('on-plane', onAxis);
}

/** Fill the two axis selectors from the available coordinates; repair invalid choices. */
function renderAxes() {
  const ids = coords.map((c) => c.id);
  let [a, b] = S.axes || [];
  if (!ids.includes(a) || !ids.includes(b) || a === b) {
    if (info.c.length) [a, b] = [`${info.c[0]}.re`, `${info.c[0]}.im`];
    else [a, b] = [ids[0], ids[1]];
  }
  planeOK = !!(a && b && a !== b);
  S.axes = planeOK ? [a, b] : [a || '', b || ''];
  for (const [sel, cur] of [[$('axis-x'), a], [$('axis-y'), b]]) {
    sel.innerHTML = coords.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
    sel.value = cur || '';
    sel.disabled = coords.length < 2;
  }
  plane.labels = [coordLabel(a), coordLabel(b)];
  syncStart();
  plane.updateAxes();
  $('axes-msg').textContent = planeOK ? '' : 'A parameter plane needs two real coordinates: add a complex parameter c1, or two real ones r1, r2.';
  $('btn-render').disabled = !planeOK;
}

function evalT() {
  try {
    const a = parse(S.Texpr);
    if (a.vars.size) throw new ExprError('T must be a constant expression');
    const v = evaluate(a, {});
    if (!(v[0] > 0) || v[1] !== 0) throw new ExprError('T must be a positive real number');
    S.T = v[0];
    $('T').classList.remove('err');
    return true;
  } catch (e) {
    $('T').classList.add('err');
    $('cf-box').innerHTML = `<span class="hint err">${escapeHtml(e.message)}</span>`;
    return false;
  }
}

function showCF() {
  const { terms, rational: rat } = convergents(S.T);
  const r = returns();
  $('cf-summary').textContent = `T/2π = ${formatCF(terms)} · returns ${r.qA}, ${r.qB}`;
  $('cf-box').innerHTML = `
    <span>T = ${S.T.toPrecision(12)}</span>
    <span>T/2π = ${formatCF(terms)}</span>
    <span>returns q = ${r.qA} (δ = ${r.dA.toExponential(2)}), ${r.qB} (δ = ${r.dB.toExponential(2)})</span>`;
  $('cf-warn').hidden = !rat;
  $('cf-warn').textContent = rat ? 'T/2π looks rational: the base dynamics is periodic, while the theory assumes an irrational rotation.' : '';
}

// ---------------------------------------------------------------- controls
function syncInputs() {
  const sel = $('preset');
  if (!sel.options.length) {
    for (const p of PRESETS) sel.add(new Option(p.name, p.id));
    sel.add(new Option('Custom', 'custom'));
  }
  if (S.preset !== 'custom' && !PRESETS.some((q) => q.id === S.preset)) S.preset = 'custom';
  sel.value = S.preset;
  $('expr').value = S.expr;
  syncStart();
  $('T').value = S.Texpr;
  $('quality').value = S.quality;
  if (![...$('kmax').options].some((o) => +o.value === +S.kmax)) S.kmax = 6;
  $('kmax').value = String(S.kmax);
  if (![...$('plot-dots').options].some((o) => +o.value === +S.plotDots)) S.plotDots = 5000;
  $('plot-dots').value = String(S.plotDots);
  $('n-trans').value = S.nTrans; $('n-lyap').value = S.nLyap; $('tau').value = S.tau; $('budget').value = S.budget;
  $('grid-M').value = String(S.M); $('orbit-len').value = String(S.orbitLen);
  $('rays').value = String(S.rays); $('ray-M').value = String(S.rayM);
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === S.mode));
  document.querySelectorAll('[data-comp]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.comp === S.comp));
  sliceControls();
  syncDrawMode();
  $('summary').open = !!S.summaryOpen;
  document.querySelectorAll('details[data-sec]').forEach((d) => { const o = (S.secOpen || {})[d.dataset.sec]; if (o !== undefined) d.open = !!o; });
  plane.mode = S.mode;
  plane.quality = S.quality;
}

function applyPreset(id) {
  const p = PRESETS.find((q) => q.id === id);
  if (!p) return;
  Object.assign(S, { preset: id, expr: p.expr, params: { ...S.params, ...structuredClone(p.params), z0: [...(p.z0 || [0, 0])] }, axes: [...p.axes], Texpr: p.T, start: p.start || 'crit' });
  syncInputs();
  clearOverlays();
  if (validateExpr() && evalT()) {
    showCF();
    plane.setView(p.view, { render: false });
    renderPlane();
    pick(currentUV());
  }
  addPresetSlices(id);
}

function num(id, fallback) {
  const v = parseFloat($(id).value);
  return Number.isFinite(v) ? v : fallback;
}

function onParamsChanged({ rerender = true, reanalyze = true } = {}) {
  S.preset = 'custom';
  $('preset').value = 'custom';
  save();
  if (!validateExpr() || !evalT()) return;
  showCF();
  clearBorders();
  refreshSlice(); // slices stay; their results are recomputed if the change affects them
  if (rerender) renderPlane();
  if (reanalyze) pick(currentUV());
}

function bindControls() {
  $('preset').addEventListener('change', (e) => e.target.value !== 'custom' && applyPreset(e.target.value));
  let exprTimer;
  $('expr').addEventListener('input', (e) => {
    // one formula: line breaks (typed or pasted) are just spaces
    if (/[\r\n]/.test(e.target.value)) {
      const at = e.target.selectionStart;
      e.target.value = e.target.value.replace(/[\r\n]+/g, ' ');
      e.target.setSelectionRange(at, at);
    }
    S.expr = e.target.value;
    clearTimeout(exprTimer);
    exprTimer = setTimeout(() => validateExpr(), 200);
  });
  $('expr').addEventListener('change', () => onParamsChanged());
  // Enter applies the formula (as in the old single-line field) instead of a new line
  $('expr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.target.blur(); }
  });
  buildFunctionReference();
  $('T').addEventListener('change', (e) => { S.Texpr = e.target.value; onParamsChanged(); });
  $('T-preset').addEventListener('change', (e) => {
    if (!e.target.value) return;
    S.Texpr = e.target.value; $('T').value = S.Texpr; e.target.value = '';
    onParamsChanged();
  });
  const setAxis = (which, id) => {
    const axes = [...S.axes];
    axes[which] = id;
    if (axes[0] === axes[1]) axes[1 - which] = S.axes[which]; // swap instead of duplicating
    S.axes = axes;
    S.preset = 'custom'; $('preset').value = 'custom';
    renderAxes();
    renderParams();
    save();
    clearOverlays();
    const [u, v] = currentUV();
    plane.setView({ cx: u, cy: v, r: Math.max(0.5, plane.view.r) }, { render: false });
    renderPlane();
    pick(currentUV());
  };
  $('axis-x').addEventListener('change', (e) => setAxis(0, e.target.value));
  $('axis-y').addEventListener('change', (e) => setAxis(1, e.target.value));
  $('start').addEventListener('change', (e) => { S.start = e.target.value; onParamsChanged(); });
  for (const id of ['z0-re', 'z0-im']) {
    fineStepper($(id));
    const apply = () => {
      const z = [parseFloat($('z0-re').value), parseFloat($('z0-im').value)];
      if (!z.every(Number.isFinite)) return;
      const cur = S.params.z0 || [0, 0];
      if (z[0] === cur[0] && z[1] === cur[1]) return;
      S.params.z0 = z;
      // z0 on a plane axis only moves the marker
      if (isZ0Axis(S.axes)) { save(); pick(currentUV()); } else onParamsChanged();
    };
    $(id).addEventListener('input', debounce(apply, isZ0Axis(S.axes) ? 120 : 350));
    $(id).addEventListener('change', apply);
  }
  document.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      const prev = S.mode;
      S.mode = b.dataset.mode;
      syncInputs();
      save();
      // classification needs the long record window; the other two only recolour if data exists
      if (S.mode === 'classify' || prev === 'classify') renderPlane();
      else { plane.recolor(S.mode); legend(plane.stats()); }
    }),
  );
  $('quality').addEventListener('change', (e) => { S.quality = e.target.value; plane.quality = S.quality; save(); renderPlane(); });
  $('kmax').addEventListener('change', (e) => { S.kmax = +e.target.value; save(); showCF(); renderPlane(); pick(currentUV()); });
  for (const [id, key, lo, hi] of [['n-trans', 'nTrans', 10, 1e6], ['n-lyap', 'nLyap', 50, 1e6], ['tau', 'tau', 0.005, 0.95], ['budget', 'budget', 100, 1e6]]) {
    $(id).addEventListener('change', () => {
      S[key] = Math.min(hi, Math.max(lo, num(id, S[key])));
      $(id).value = S[key];
      save(); showCF(); renderPlane();
    });
  }
  $('grid-M').addEventListener('change', (e) => { S.M = +e.target.value; save(); pick(currentUV()); });
  $('orbit-len').addEventListener('change', (e) => { S.orbitLen = +e.target.value; save(); pick(currentUV()); });
  $('plot-dots').addEventListener('change', (e) => { S.plotDots = +e.target.value; save(); pick(currentUV()); });
  $('rays').addEventListener('change', (e) => { S.rays = +e.target.value; save(); });
  $('ray-M').addEventListener('change', (e) => { S.rayM = +e.target.value; save(); });
  $('btn-render').addEventListener('click', () => renderPlane());
  $('btn-reset').addEventListener('click', () => {
    const p = PRESETS.find((q) => q.id === S.preset) || PRESETS[0];
    plane.setView(p.view);
  });
  $('btn-clear').addEventListener('click', () => { clearOverlays(); plane.drawOverlay(); });
  $('btn-slice-real').addEventListener('click', () => {
    const b = plane.bounds;
    addSlice({ kind: 'line', pts: [[b.x0, plane.view.cy], [b.x1, plane.view.cy]] });
  });
  $('btn-slice-vert').addEventListener('click', () => {
    const b = plane.bounds;
    addSlice({ kind: 'line', pts: [[plane.view.cx, b.y0], [plane.view.cx, b.y1]] });
  });
  $('slice-pick').addEventListener('change', (e) => selectSlice(e.target.value));
  $('summary').addEventListener('toggle', () => { S.summaryOpen = $('summary').open; save(); });
  document.querySelectorAll('details[data-sec]').forEach((d) => d.addEventListener('toggle', () => { S.secOpen = { ...S.secOpen, [d.dataset.sec]: d.open }; save(); }));
  $('btn-slice-del').addEventListener('click', () => plane.activeSlice && deleteSlice(plane.activeSlice));
  document.querySelectorAll('[data-draw]').forEach((b) =>
    b.addEventListener('click', () => { S.sliceDraw = b.dataset.draw; save(); syncDrawMode(); }),
  );
  $('slice-theta').addEventListener('input', (e) => { S.sliceTheta = (TWO_PI * +e.target.value) / 1000; sliceControls(); save(); replot(); });
  $('slice-spread').addEventListener('input', (e) => { S.sliceSpread = +e.target.value; sliceControls(); save(); replot(); });
  $('slice-cap').addEventListener('change', (e) => { S.sliceCap = +e.target.value; sliceControls(); save(); replot(); });
  $('slice-n').addEventListener('change', () => { const sl = activeSlice(); if (sl) runSlice(sl); });
  $('walk-path').addEventListener('change', () => setWalk($('walk-path').value, 0, true));
  $('walk-t').addEventListener('input', () => setWalk(walk.id, +$('walk-t').value / 1000, true));
  document.querySelectorAll('[data-walk-dir]').forEach((b) => b.addEventListener('click', () => setWalkDir(+b.dataset.walkDir)));
  document.querySelectorAll('[data-theta-dir]').forEach((b) => b.addEventListener('click', () => setThetaDir(+b.dataset.thetaDir)));
  document.querySelectorAll('[data-comp]').forEach((b) =>
    b.addEventListener('click', () => {
      S.comp = b.dataset.comp; syncInputs(); save();
      replot();
    }),
  );
  document.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  $('theme-btn').addEventListener('click', () => {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('mandelburger.theme', root.getAttribute('data-theme')); } catch { /* ignore */ }
    replot();
  });
  try {
    const th = localStorage.getItem('mandelburger.theme');
    if (th) document.documentElement.setAttribute('data-theme', th);
  } catch { /* ignore */ }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => replot());
}

function selectTab(tab) {
  S.tab = tab;
  if (tab === 'slice' && !sliceData && activeSlice()) { selectSlice(plane.activeSlice); return; }
  document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  resizeAll(document.querySelectorAll('.plot'));
  replot();
}

// ---------------------------------------------------------------- plane
function renderPlane() {
  if (!info || !planeOK || !S.T) return;
  plane.mode = S.mode;
  plane.render(planeCfg());
}

function legend(stats) {
  const el = $('legend');
  const { counts, n } = stats;
  const items = CATS.filter((c) => counts[c.id] || (c.id === 'esc'));
  const shown = S.mode === 'classify' ? items : [];
  let html = shown
    .filter((c) => counts[c.id] && counts[c.id] / n >= 0.0005)
    .map((c) => `<span><i style="background:${swatch(c)}"></i>${c.label} <b>${((100 * counts[c.id]) / n).toFixed(1)}%</b></span>`)
    .join('');
  if (S.mode === 'lyap') html = '<span><i style="background:rgb(30 77 180)"></i>λ ≪ 0</span><span><i style="background:#f4f6fb"></i>λ = 0</span><span><i style="background:rgb(210 65 40)"></i>λ &gt; 0</span><span><i style="background:#0a0c12"></i>escapes</span>';
  if (S.mode === 'escape') html = '<span>Smooth escape time; bounded orbits black.</span>';
  if (S.mode === 'classify') html += '<span>brightness ∝ e<sup>λ</sup></span>';
  el.innerHTML = html;
}

// The readout under the plate is one line, never longer than the idle hint, so hovering
// never changes the plate's size (which would trigger a re-render).
const HOVER_HINT = 'Click to analyse · drag to pan · scroll to zoom · shift-drag for a slice';
function hover(h) {
  const el = $('readout');
  if (!h) { el.innerHTML = `<span>${HOVER_HINT}</span>`; return; }
  let s = `<span><b>${escapeHtml(paramLabel(h.P, 5))}</b></span>`;
  if (h.info && !Number.isNaN(h.info.esc)) {
    const { esc, lam, k } = h.info;
    if (esc >= 0) s += `<span>escapes after <b>${esc.toFixed(0)}</b></span>`;
    else {
      s += `<span>λ <b>${lam.toFixed(3)}</b></span>`;
      if (k >= 0) s += `<span><b>${catShort(category(esc, lam, k))}</b></span>`;
    }
  }
  el.innerHTML = s;
}
const catShort = (id) => (CATS.find((c) => c.id === id) || {}).short || id;

// ---------------------------------------------------------------- analysis
let last = null;
let analysisGen = 0;

async function pick(P) {
  if (!info || !planeOK) return;
  setCoord(S.params, S.axes[0], P[0]);
  setCoord(S.params, S.axes[1], P[1]);
  for (let q = 0; q < 2; q++) {
    const el = document.querySelector(`input[data-coord="${S.axes[q]}"]`);
    if (el) el.value = +P[q].toPrecision(10);
  }
  if (isZ0Axis(S.axes)) syncStart();
  save();
  plane.marker = [P[0], P[1]];
  plane.drawOverlay();
  const gen = ++analysisGen;
  const r = returns();
  const job = {
    prob: problem(), M: S.M, kmax: S.kmax, structK: S.kmax, nTrans: Math.max(2000, S.nTrans * 4), nRec: S.orbitLen, plotPoints: S.plotDots,
    tau: S.tau, S: S.Ssample, qA: r.qA, qB: r.qB,
  };
  $('verdict').textContent = 'Computing…';
  $('verdict-line').textContent = '';
  $('verdict-param').textContent = paramLabel(P);
  analyst.cancel('analyze');
  try {
    const result = await analyst.run('analyze', job, { tag: 'analyze' });
    if (gen !== analysisGen) return;
    last = { result, prob: job.prob, P: [...P] };
    showAnalysis();
  } catch (err) {
    if (err && err.cancelled) return;
    console.error(err);
    $('verdict').textContent = 'Analysis failed';
    $('verdict-line').textContent = '';
    $('summary').open = true;
    $('verdict-note').textContent = String(err.message || err);
  }
}

function showAnalysis() {
  const { result: R } = last;
  const sol = R.sol;
  let title, note = '', cat = null;
  const C = R.cocycle;
  if (C) {
    // linear cocycle: the closed form decides
    const kcat = (k) => (k >= 5 ? 'k5' : `k${k}`);
    if (C.kind === 'add') {
      title = C.sheets ? 'One neutral curve' : 'Drifts to infinity';
      cat = C.sheets ? 'k1' : 'esc';
    } else if (Math.abs(C.lambda) > 1e-7) {
      title = C.lambda < 0 ? 'Spirals into 0 (not cramped)' : 'Spirals out to ∞ (not cramped)';
      cat = C.lambda < 0 ? 'k1' : 'esc';
    } else if (C.winding !== 0) {
      title = `Cramped, fills an annulus (g winds ${C.winding}×)`;
      cat = 'neutral';
    } else if (C.relation) {
      title = `${C.relation.q} invariant curve${C.relation.q > 1 ? 's' : ''} (cramped)`;
      cat = kcat(C.relation.q);
    } else {
      title = 'Cramped, dense in an annulus';
      cat = 'neutral';
    }
    note = `${C.regime} Details in the Cocycle tab.`;
  } else if (!R.escaped && R.lambdaOrbit === -Infinity) {
    // dF/df vanished along the orbit: it fell onto a superattracting graph (e.g. f = 0 of g(x) f^2)
    title = 'Superattracting graph';
    note = 'dF/df vanishes along the orbit (λ = −∞): the orbit falls onto a superattracting invariant graph, such as f ≡ 0 for F = g(x)·f². Convergence is faster than exponential.';
    cat = 'k1';
  } else if (R.escaped) {
    title = 'Orbit escapes';
    note = `|z| exceeded 10⁸ after ${R.escapeStep} steps. No bounded invariant set attracts the critical orbit.`;
    cat = 'esc';
  } else if (R.chosen && sol && sol.ok && sol.lambda < 0) {
    title = R.chosen.k === 1 ? 'Smooth invariant graph' : `${R.chosen.k} sheets`;
    note = `${capital(describeStructure(R.chosen))}. Newton converged to ‖R‖∞ = ${sol.resid.toExponential(1)}; |multiplier| e^λ = ${Math.exp(sol.lambda).toFixed(4)}.`;
    if (sol.spec.tailRatio > 1e-8) note += ` The spectrum is not fully resolved at this grid (tail ${sol.spec.tailRatio.toExponential(1)}); raise the grid to trust the curve.`;
    cat = R.chosen.k >= 5 ? 'k5' : `k${R.chosen.k}`;
  } else if (R.chosen && Math.abs(R.lambdaOrbit) < NEUTRAL_TOL) {
    title = `${R.chosen.k} neutral curve${R.chosen.k > 1 ? 's' : ''} (λ ≈ 0)`;
    note = `The orbit lies on ${describeStructure(R.chosen)}, but λ = ${R.lambdaOrbit.toExponential(1)} ≈ 0: the curves are invariant without attracting (an elliptic, quasi-periodic regime). Nearby starting points stay on nearby curves.`;
    cat = R.chosen.k >= 5 ? 'k5' : `k${R.chosen.k}`;
  } else if (!R.chosen && Math.abs(R.lambdaOrbit) < NEUTRAL_TOL) {
    title = 'Neutral: λ ≈ 0';
    note = `The fibre Lyapunov exponent is ${R.lambdaOrbit.toExponential(1)} and no sheet structure fits: the orbit neither converges to a graph nor separates exponentially. Typical of quasi-periodic motion, e.g. the absolutely continuous spectrum of a Schrödinger operator, or an irrational rotation number of a circle map.`;
    cat = 'neutral';
  } else if (R.lambdaOrbit >= 0) {
    title = 'Chaotic attractor';
    note = `Positive fibre Lyapunov exponent λ = ${R.lambdaOrbit.toFixed(4)} along the orbit: nearby fibres separate.`;
    cat = 'chaos';
  } else if (!R.chosen) {
    title = 'No finite sheet structure';
    note = 'λ < 0 but no k ≤ k_max sheet structure fits the orbit: a candidate strange nonchaotic attractor (or more than k_max sheets, or a slow transient).';
    cat = 'sna';
  } else {
    title = `${R.chosen.k} sheet${R.chosen.k > 1 ? 's' : ''} (Newton did not converge)`;
    note = `The orbit fits ${describeStructure(R.chosen)}, but Newton stopped: ${sol ? sol.reason : 'no solution'}. Near a bifurcation the graph loses smoothness; try a finer grid.`;
    cat = R.chosen.k >= 5 ? 'k5' : `k${R.chosen.k}`;
  }
  const c = CATS.find((q) => q.id === cat);
  // one line on top: verdict (with its legend colour), λ, the structure; details in the Summary below
  $('verdict').innerHTML = `${c ? `<i class="dot" style="background:${swatch(c)}" title="${escapeHtml(c.label)}"></i>` : ''}${escapeHtml(title)}`;
  $('verdict').title = c ? `${title} — ${c.label}` : title;
  const lamTop = C ? C.lambda : R.escaped ? null : sol && sol.ok ? sol.lambda : R.lambdaOrbit;
  const parts = [];
  if (lamTop != null && Number.isFinite(lamTop)) parts.push(`<span class="k">λ</span> ${lamTop.toFixed(5)}`);
  else if (lamTop === -Infinity) parts.push('<span class="k">λ</span> −∞');
  if (R.chosen) parts.push(`<span class="k">(c·d, s)</span> (${R.chosen.c}·${R.chosen.d}, ${R.chosen.s})`);
  $('verdict-line').innerHTML = parts.join('&ensp;');
  $('verdict-param').textContent = paramLabel(last.P);
  $('verdict-note').textContent = note;

  // metrics
  const m = [];
  const cls = (v, good, warn) => (v <= good ? 'good' : v <= warn ? 'warn' : 'bad');
  if (!R.escaped) {
    m.push(['λ orbit', R.lambdaOrbit.toFixed(5), R.lambdaOrbit < 0 ? 'good' : 'bad']);
    if (sol) m.push(['λ Newton', sol.lambda.toFixed(7), sol.lambda < 0 ? 'good' : 'bad']);
    m.push(['sheets (c·d, s)', R.chosen ? `${R.chosen.k}  (${R.chosen.c}·${R.chosen.d}, ${R.chosen.s})` : '—']);
    m.push(['branch counter', R.branches.k ? `k=${R.branches.k} (m ${R.branches.mA}, ${R.branches.mB})` : 'none']);
    if (sol) {
      m.push(['residual ‖R‖∞', sol.resid.toExponential(2), cls(sol.resid, 1e-10, 1e-6)]);
      m.push(['Newton / GMRES', `${sol.newton} / ${sol.gmres}`]);
      m.push(['analyticity ρ', Number.isFinite(sol.spec.rho) ? sol.spec.rho.toFixed(4) : '—']);
      m.push(['spectral tail', sol.spec.tailRatio.toExponential(1), cls(sol.spec.tailRatio, 1e-10, 1e-6)]);
      m.push(['max |f|', sol.maxAbs.toPrecision(5)]);
      m.push(['winding of f', sol.winding.join(', ')]);
      if (sol.tangent && sol.tangent.winding === 0) m.push([`multiplier μ${sol.c > 1 || sol.d > 1 ? ' (return)' : ''}`, `|μ| ${Math.hypot(...sol.tangent.multiplier).toFixed(4)}, β/2π ${sol.tangent.internalAngle.toFixed(4)}`]);
      m.push(['grid', `${sol.c}×${sol.M}`]);
      m.push(['solve', `${sol.ms.toFixed(0)} ms`]);
    }
    m.push(['start z₀', fmt(R.z0, 5)]);
    m.push(['orbit', `${(S.orbitLen / 1000).toFixed(0)}k in ${R.orbitMs.toFixed(0)} ms, ${R.orbit ? R.orbit.re.length : 0} drawn`]);
  } else {
    m.push(['escape step', String(R.escapeStep)]);
  }
  $('metrics').innerHTML = m
    .map(([k, v, c2]) => `<div class="metric"><div class="k">${k}</div><div class="v ${c2 || ''}">${escapeHtml(v)}</div></div>`)
    .join('');

  // cocycle metrics
  if (C) {
    const cm = [];
    if (C.kind === 'mult') {
      cm.push(['λ = mean log|g|', C.lambda.toExponential(3), Math.abs(C.lambda) < 1e-7 ? 'good' : '']);
      cm.push(['β / 2π (mean arg g)', (C.beta / (2 * Math.PI)).toFixed(10)]);
      cm.push(['winding of g', String(C.winding)]);
      cm.push(['relation qβ = 2πn + mT', C.relation ? `q=${C.relation.q}, n=${C.relation.n}, m=${C.relation.m}` : `none (closest q=${C.nearest.q}: ${C.nearest.err.toExponential(1)})`]);
      if (C.ringPredicted) cm.push(['ring, closed form', C.ringPredicted.map((x) => x.toPrecision(6)).join(' … ')]);
      if (C.birkhoffBound !== null) cm.push(['|Σ log|g|| ≤', C.birkhoffBound.toPrecision(4)]);
    } else {
      cm.push(['drift mean L', fmt(C.mu, 6)]);
    }
    if (!R.escaped) cm.push(['ring seen by orbit', C.ring.map((x) => x.toPrecision(6)).join(' … ')]);
    if (C.pred.re.length) cm.push(['closed form vs orbit', C.pred.relErr.toExponential(1), C.pred.relErr < 1e-6 ? 'good' : 'warn']);
    cm.push(['smallest divisors', C.divisors.slice(0, 3).map((d) => `m=${d.m}: ${d.size.toExponential(1)}`).join(', ')]);
    cm.push(['ψ spectral tail', C.psiTail.toExponential(1), C.psiTail < 1e-8 ? 'good' : 'warn']);
    $('cocycle-metrics').innerHTML = cm.map(([k, v, c2]) => `<div class="metric"><div class="k">${k}</div><div class="v ${c2 || ''}">${escapeHtml(v)}</div></div>`).join('');
    $('cocycle-note').textContent = C.regime;
  } else if (sol && sol.tangent) {
    // nonlinear F: the tangent cocycle w = ∂F/∂f along the Newton solution
    const t = sol.tangent, cm = [];
    const ret = t.c > 1 || t.d > 1;
    cm.push(['λ = mean log|w| per step', t.lambdaStep.toFixed(7), t.lambdaStep < 0 ? 'good' : 'bad']);
    if (t.winding === 0) {
      cm.push([`multiplier μ = e^{λ+iβ}${ret ? ' per return' : ''}`, fmt(t.multiplier, 6)]);
      cm.push(['|μ|', Math.hypot(...t.multiplier).toPrecision(6)]);
      cm.push(['internal angle β/2π', t.internalAngle.toFixed(8)]);
      cm.push(['closest p/q (q ≤ 8)', `${t.closestPQ.p}/${t.closestPQ.q} (off ${t.closestPQ.err.toFixed(4)})`]);
    }
    cm.push(['winding of w', String(t.winding), t.winding === 0 ? 'good' : 'warn']);
    if (ret) cm.push(['return', `${t.c} component${t.c > 1 ? 's' : ''} × ${t.d}-fold cover, T′ = ${t.Tret.toFixed(6)}`]);
    cm.push([`smallest divisors (m < ${t.M / 2})`, t.divisors.slice(0, 3).map((d) => `m=${d.m}: ${d.size.toExponential(1)}`).join(', ')]);
    cm.push(['ψ spectral tail', t.psiTail.toExponential(1), t.psiTail < 1e-8 ? 'good' : 'warn']);
    cm.push(['check: mean log|f(θ+T)/f(θ)|', Number.isFinite(t.gCheck) ? t.gCheck.toExponential(1) : '—', Math.abs(t.gCheck) < 1e-10 ? 'good' : 'warn']);
    $('cocycle-metrics').innerHTML = cm.map(([k, v, c2]) => `<div class="metric"><div class="k">${k}</div><div class="v ${c2 || ''}">${escapeHtml(v)}</div></div>`).join('');
    $('cocycle-note').textContent = t.regime;
  } else {
    $('cocycle-metrics').innerHTML = '';
    $('cocycle-note').textContent = R.escaped
      ? 'The orbit escapes: there is no invariant structure to linearise.'
      : 'No Newton solution here (no finite sheet structure, or Newton did not converge), so there is no tangent cocycle to analyse.';
  }

  // structures table
  if (R.candidates) {
    $('cands').innerHTML = `<tr><th>k</th><th>c</th><th>d</th><th>s</th><th>score</th></tr>${R.candidates
      .map((q) => {
        const on = R.chosen && q.c === R.chosen.c && q.d === R.chosen.d && q.s === R.chosen.s;
        return `<tr class="${on ? 'on' : ''}"><td>${q.k}</td><td>${q.c}</td><td>${q.d}</td><td>${q.s}</td><td>${q.score.toExponential(2)}</td></tr>`;
      })
      .join('')}`;
    const wrap = $('cands-wrap'), on = wrap.querySelector('tr.on');
    wrap.scrollTop = on ? Math.max(0, on.offsetTop - 2 * on.offsetHeight) : 0;
    $('struct-count').textContent = `${R.candidates.length} candidate structures with k ≤ ${S.kmax} (Max sheets k); ${R.chosen ? `chosen k = ${R.chosen.k} (c = ${R.chosen.c}, d = ${R.chosen.d}, s = ${R.chosen.s})` : 'none below the threshold'}`;
  } else { $('cands').innerHTML = ''; $('struct-count').textContent = ''; }

  if (!borderBusy) $('border-msg').textContent = borderMessage();
  replot();
}

function replot() {
  const tab = S.tab;
  const R = last && last.result;
  try {
    if (tab === 'graph') {
      if (!R || R.escaped) placeholder($('plot-graph'), R ? 'The orbit escapes — nothing to plot' : 'Click the plane');
      else plotGraph($('plot-graph'), R, S.comp, sliceBand());
    } else if (tab === 'phase') {
      if (!R || R.escaped) placeholder($('plot-phase'), 'No bounded attractor');
      else plotPhase($('plot-phase'), R, sliceBand());
    } else if (tab === 'spec') {
      if (!R || !R.sol) placeholder($('plot-spec'), 'No Newton solution');
      else plotSpectrum($('plot-spec'), R.sol);
    } else if (tab === 'cocycle') {
      if (R && R.cocycle) {
        plotCocycleSpectrum($('plot-cocycle-spec'), R.cocycle);
        plotCocycleOrbit($('plot-cocycle-orbit'), R);
      } else if (R && R.sol && R.sol.tangent) {
        plotCocycleSpectrum($('plot-cocycle-spec'), R.sol.tangent, { forcing: '|log w|ₘ (mean removed)' });
        plotTangent($('plot-cocycle-orbit'), R.sol.tangent);
      } else {
        placeholder($('plot-cocycle-spec'), 'No invariant structure to linearise');
        placeholder($('plot-cocycle-orbit'), '');
      }
    } else if (tab === 'slice') {
      if (!sliceData) placeholder($('plot-slice'), 'Shift-drag on the plane, or use “Horizontal slice” on the left');
      else plotSlice($('plot-slice'), sliceData, S.comp, sliceSelection().idx, sliceCursor());
    }
  } catch (e) {
    console.error(e);
  }
}

// ---------------------------------------------------------------- exact border
let borderGen = 0;

function resample(FR, FI, c, Mfrom, Mto) {
  if (Mfrom === Mto) return { FR: Float64Array.from(FR), FI: Float64Array.from(FI) };
  const OR = new Float64Array(c * Mto), OI = new Float64Array(c * Mto);
  const wr = new Float64Array(Mfrom), wi = new Float64Array(Mfrom);
  const ur = new Float64Array(Mto), ui = new Float64Array(Mto);
  const lim = Math.min(Mfrom, Mto) / 2;
  for (let j = 0; j < c; j++) {
    for (let m = 0; m < Mfrom; m++) { wr[m] = FR[j * Mfrom + m]; wi[m] = FI[j * Mfrom + m]; }
    fft(wr, wi);
    ur.fill(0); ui.fill(0);
    for (let m = 0; m < Mfrom; m++) {
      const f = m < Mfrom / 2 ? m : m - Mfrom;
      if (Math.abs(f) >= lim) continue;
      const t = f >= 0 ? f : Mto + f;
      ur[t] = (wr[m] * Mto) / Mfrom; ui[t] = (wi[m] * Mto) / Mfrom;
    }
    fft(ur, ui, true);
    OR.set(ur, j * Mto); OI.set(ui, j * Mto);
  }
  return { FR: OR, FI: OI };
}

/** Why a border can or cannot be traced from the analysed point. */
function borderReady() {
  const R = last && last.result, sol = R && R.sol;
  if (isZ0Axis(S.axes)) return { ok: false, why: 'In a z₀ plane there is no component border: the invariant graph does not depend on z₀, and the boundaries seen are basin boundaries (the fibre Julia set).' };
  if (!(sol && sol.ok && sol.lambda < 0)) return { ok: false, why: 'No attracting structure here (Newton did not converge, or λ ≥ 0): shift-click inside a component.' };
  return { ok: true, why: `Shift-click to continue this ${R.chosen.k}-sheet structure along ${S.rays} rays.` };
}
const borderMessage = () => borderReady().why;
let borderBusy = false;

/** Border mode: analyse the clicked point, then trace its component's border from it. */
async function borderAt(P) {
  await pick(P);
  if (!last || Math.hypot(last.P[0] - P[0], last.P[1] - P[1]) > 1e-12) return; // superseded
  const r = borderReady();
  if (!r.ok) { $('border-msg').textContent = r.why; return; }
  traceBorder();
}

async function traceBorder() {
  if (!last || !last.result.sol) return;
  const R = last.result;
  const sol = R.sol;
  const gen = ++borderGen;
  pool.cancel('rays');
  const Mr = nextPow2(S.rayM * sol.d);
  const F0 = resample(sol.FR, sol.FI, sol.c, sol.M, Mr);
  const center = [...last.P];
  const st = { c: sol.c, d: sol.d, s: sol.s };
  const rMax = plane.view.r * 1.6 + Math.hypot(center[0] - plane.view.cx, center[1] - plane.view.cy);
  const n = S.rays;
  const border = { center, rays: [], complete: false };
  plane.borders = plane.borders.filter((b) => b.complete);
  plane.borders.push(border);
  const t0 = performance.now();
  const perJob = 2;
  const jobs = [];
  for (let i = 0; i < n; i += perJob) {
    const angles = [];
    for (let q = i; q < Math.min(n, i + perJob); q++) angles.push((TWO_PI * q) / n);
    jobs.push(angles);
  }
  let done = 0;
  borderBusy = true;
  $('border-msg').textContent = `Tracing ${n} rays…`;
  await Promise.all(
    jobs.map((angles) =>
      pool
        .run('rays', { prob: last.prob, st, M: Mr, center, angles, F0R: F0.FR, F0I: F0.FI, rMax }, { tag: 'rays' })
        .then((res) => {
          if (gen !== borderGen) return;
          border.rays.push(...res.rays);
          done += angles.length;
          $('border-msg').textContent = `Tracing rays… ${done}/${n}`;
          plane.drawOverlay();
        })
        .catch((err) => { if (!err || !err.cancelled) console.error(err); }),
    ),
  );
  borderBusy = false;
  if (gen !== borderGen) return;
  border.complete = true;
  // the border is also a slice (closed curve through the ray end points): its diagram, walkable
  const pts = [...border.rays]
    .filter((q) => q.type !== 'none' && Number.isFinite(q.r))
    .sort((p, q) => p.angle - q.angle)
    .map((q) => [center[0] + q.r * Math.cos(q.angle), center[1] + q.r * Math.sin(q.angle)]);
  if (pts.length >= 3) {
    pts.push([...pts[0]]);
    const sl = addSlice({ kind: 'border', pts, name: `border around ${paramLabel(center, 4)}` });
    border.sliceId = sl.id;
  }
  plane.drawOverlay();
  updateWalk();
  const counts = {};
  for (const r of border.rays) counts[r.type] = (counts[r.type] || 0) + 1;
  const parts = [];
  if (counts.lambda) parts.push(`${counts.lambda} reach λ = 0 (solid white)`);
  if (counts.unresolved) parts.push(`${counts.unresolved} stop where the graph is no longer resolved on ${Mr} points (dashed amber; faint dots: ρ → 0 extrapolation)`);
  if (counts.breakdown) parts.push(`${counts.breakdown} where Newton breaks down (dotted red)`);
  if (counts.none) parts.push(`${counts.none} leave the search radius`);
  $('border-msg').textContent = `${((performance.now() - t0) / 1000).toFixed(1)} s. ${parts.join('; ')}.`;
}

/** Traced borders depend on every parameter, so any change drops them. */
function clearBorders() {
  borderGen++;
  pool.cancel('rays');
  plane.borders = [];
  updateWalk();
  plane.drawOverlay();
}

function clearOverlays() {
  borderGen++;
  pool.cancel('rays');
  plane.borders = [];
  plane.finishDraft(true);
  plane.slices = [];
  plane.activeSlice = null;
  sliceResults.clear();
  sliceSeq = 0;
  sliceGen++;
  pool.cancel('slice');
  sliceData = null;
  syncSlicePicker();
  sliceControls();
  updateWalk();
  replot();
}

// ---------------------------------------------------------------- slice
// The worker returns, for every parameter, the last `keep` orbit values; their angles θ_n are
// the same for every parameter. The client cuts at θ* with spread ±w (section.js), so both
// sliders are instant. The spread slider is logarithmic from 1e-3 to π.
const SPREAD_MIN = 1e-3;
let sliceData = null;
let sliceGen = 0;

const spreadW = () => SPREAD_MIN * Math.pow(Math.PI / SPREAD_MIN, S.sliceSpread / 100);

/** Orbit indices in the current window (newest first, ≤ cap) and the full in-window count. */
function sliceSelection() {
  if (!sliceData || !sliceData.theta) return { idx: [], inWindow: 0 };
  return sectionIndices(sliceData.theta, S.sliceTheta, spreadW(), S.sliceCap);
}

function sliceControls() {
  S.sliceTheta = ((+S.sliceTheta || 0) % TWO_PI + TWO_PI) % TWO_PI;
  S.sliceSpread = Math.min(100, Math.max(0, +S.sliceSpread || 0));
  // snap a saved value from an older option list (12/50/200/1000) to the nearest current option
  const caps = [...$('slice-cap').options].map((o) => +o.value);
  if (!caps.includes(+S.sliceCap)) S.sliceCap = caps.reduce((a, b) => (Math.abs(Math.log(b / (+S.sliceCap || 20))) < Math.abs(Math.log(a / (+S.sliceCap || 20))) ? b : a));
  $('slice-theta').value = String(Math.round((S.sliceTheta / TWO_PI) * 1000));
  $('slice-spread').value = String(S.sliceSpread);
  $('slice-cap').value = String(S.sliceCap);
  const x = S.sliceTheta / Math.PI;
  $('slice-theta-val').textContent = S.sliceTheta === 0 ? '0' : `${+x.toFixed(3)}π ≈ ${S.sliceTheta.toFixed(3)}`;
  const w = spreadW();
  $('slice-spread-val').textContent = w >= Math.PI * 0.999 ? '±π (everything)' : `±${w.toPrecision(2)}`;
  const sel = sliceSelection();
  $('slice-count').textContent = sliceData && sliceData.theta
    ? `${sel.inWindow} of the last ${sliceData.keep} orbit points have θₙ within ±${w.toPrecision(2)} of θ* (≈ N·w/π = ${(sliceData.keep * Math.min(w, Math.PI) / Math.PI).toFixed(1)}); drawing the newest ${sel.idx.length} per parameter.`
    : '';
}

/** The section θ* ± w highlighted in the graph and the attractor (newest `cap` orbit points). */
function sliceBand() {
  return { theta: S.sliceTheta, w: spreadW(), cap: S.sliceCap };
}

/** x position of the analysed parameter on the slice diagram, when it lies on the shown slice. */
function sliceCursor() {
  const sl = activeSlice();
  if (!sliceData || !sl || !walk.on || walk.id !== sl.id) return null;
  return sliceData.horizontal ? pointAt(sl, walk.t)[sliceData.axisX] : walk.t;
}

// ---- the list of slices (like traced borders): drawn on the plane, picked in the Slice tab,
// walkable with "Move along". Results are cached per slice (the last SLICE_CACHE computed);
// a cached result is reused only while the problem and slice settings are unchanged.
const SLICE_CACHE = 4;
const sliceResults = new Map(); // id -> {key, data}
let sliceSeq = 0;
const activeSlice = () => plane.slices.find((q) => q.id === plane.activeSlice) || null;

const DRAW_NAMES = { line: 'Line', polyline: 'Polyline', border: 'Border', freehand: 'Freehand' };
const DRAW_HINTS = {
  line: 'Shift-drag on the plane from one end of the slice to the other.',
  polyline: 'Hold Shift and click each corner; release Shift (or double-click, or press Enter) to finish. Backspace removes the last corner, Esc cancels.',
  freehand: 'Hold Shift and drag along any path; the trace is smoothed when you let go.',
  border: 'Shift-click a point inside a component: rays go out from it until λ = 0 or the graph is no longer resolved. The border becomes a slice.',
};
function syncDrawMode() {
  if (!DRAW_HINTS[S.sliceDraw]) S.sliceDraw = 'line';
  plane.drawMode = S.sliceDraw;
  document.querySelectorAll('[data-draw]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.draw === S.sliceDraw));
  document.querySelectorAll('[data-help]').forEach((li) => li.classList.toggle('on', li.dataset.help === S.sliceDraw));
  $('draw-help').querySelector('summary').textContent = `How to draw: ${DRAW_NAMES[S.sliceDraw]}`;
  $('border-msg').hidden = S.sliceDraw !== 'border';
  if (S.sliceDraw === 'border' && !borderBusy) $('border-msg').textContent = last ? borderMessage() : '';
}

function sliceTitle(sl) {
  if (sl.name) return `${sl.label} · ${sl.name}`;
  return sl.kind === 'polyline' ? `${sl.label} · polyline, ${sl.pts.length} corners` : `${sl.label} · ${sl.kind}`;
}
function syncSlicePicker() {
  const sel = $('slice-pick');
  sel.innerHTML = '';
  for (const sl of plane.slices) {
    const o = document.createElement('option');
    o.value = sl.id; o.textContent = sliceTitle(sl);
    sel.append(o);
  }
  if (!plane.slices.length) {
    const o = document.createElement('option');
    o.textContent = 'none yet'; o.disabled = true; o.selected = true;
    sel.append(o);
  }
  sel.disabled = !plane.slices.length;
  $('btn-slice-del').disabled = !plane.slices.length;
  if (plane.activeSlice) sel.value = plane.activeSlice;
}

/** Everything a slice result depends on, apart from the path. The plane coordinates in the
 *  parameters are overwritten per sample, so picking a point does not invalidate it. */
function sliceKey() {
  const prob = problem();
  for (const ax of S.axes) setCoord(prob.params, ax, 0);
  prob.z0 = [...(prob.params.z0 || [0, 0])];
  const r = returns();
  return JSON.stringify({ prob, n: +$('slice-n').value, kmax: S.kmax, tau: S.tau, S: S.Ssample, nTrans: S.nTrans, qA: r.qA, qB: r.qB });
}

/** Add a slice to the list and show it; with run = false it is computed when first shown. */
function addSlice({ kind, pts, name = '' }, { run = true, activate = true } = {}) {
  const id = `slice${++sliceSeq}`;
  const sl = { id, label: `slice ${sliceSeq}`, kind, pts, name };
  plane.slices.push(sl);
  if (activate || !plane.activeSlice) plane.activeSlice = id;
  plane.drawOverlay();
  syncSlicePicker();
  if (run) runSlice(sl);
  return sl;
}

/** The preset's own slices (PRESET_SLICES), added without computing them yet. */
function addPresetSlices(id) {
  const list = PRESET_SLICES[id] || [];
  list.forEach((q, i) => addSlice(structuredClone(q), { run: false, activate: i === 0 }));
  updateWalk();
  if (list.length && S.tab === 'slice') selectSlice(plane.activeSlice);
}

/** After a change of the problem: show the shown slice again (from cache if still valid). */
function refreshSlice() {
  sliceData = null;
  if (S.tab === 'slice' && activeSlice()) selectSlice(plane.activeSlice);
  else replot();
}

function selectSlice(id) {
  const sl = plane.slices.find((q) => q.id === id);
  if (!sl) return;
  plane.activeSlice = id;
  plane.drawOverlay();
  syncSlicePicker();
  const hit = sliceResults.get(id);
  if (hit && hit.key === sliceKey()) {
    sliceGen++;
    pool.cancel('slice');
    sliceResults.delete(id); sliceResults.set(id, hit); // most recently used last
    sliceData = hit.data;
    selectTab('slice');
    updateWalk(id);
    sliceControls();
    replot();
    $('slice-note').textContent = SLICE_DONE_NOTE;
  } else runSlice(sl);
}

function deleteSlice(id) {
  const i = plane.slices.findIndex((q) => q.id === id);
  if (i < 0) return;
  const [gone] = plane.slices.splice(i, 1);
  sliceResults.delete(id);
  if (gone.kind === 'border') plane.borders = plane.borders.filter((b) => b.sliceId !== id);
  if (plane.activeSlice === id) {
    sliceGen++;
    pool.cancel('slice');
    const next = plane.slices[Math.min(i, plane.slices.length - 1)];
    plane.activeSlice = null;
    sliceData = null;
    if (next) selectSlice(next.id);
    else { syncSlicePicker(); sliceControls(); replot(); $('slice-note').textContent = 'No slice yet: draw one on the plane (Curves on the plane, left).'; }
  } else syncSlicePicker();
  plane.drawOverlay();
  updateWalk();
}

const SLICE_DONE_NOTE = ''; // the explanation lives in “What is this diagram?”

async function runSlice(sl) {
  const gen = ++sliceGen;
  pool.cancel('slice');
  if (walk.id === sl.id) { walk.t = 0; walk.on = false; }
  updateWalk(sl.id);
  const count = +$('slice-n').value;
  const r = returns();
  const key = sliceKey();
  const nRec = Math.max(6000, recordLength(S.Ssample, r.qB, S.kmax));
  // orbit tail kept per parameter: ≤ 4e6 values per slice (32 MB for re + im)
  const keep = Math.min(nRec, Math.max(2000, Math.floor(4e6 / count)));
  const prob = problem();
  const per = Math.max(4, Math.round(count / (pool.size * 4)));
  const A = sl.pts[0], B = sl.pts[sl.pts.length - 1];
  const horizontal = sl.kind === 'line' && Math.abs(B[1] - A[1]) < 1e-12 * Math.max(1, Math.abs(B[0] - A[0]));
  const vertical = !horizontal && sl.kind === 'line' && Math.abs(B[0] - A[0]) < 1e-12 * Math.max(1, Math.abs(B[1] - A[1]));
  const axisX = horizontal ? 0 : vertical ? 1 : -1; // which plane coordinate is the diagram's x, if any
  // samples equally spaced in arc length along the path
  const us = new Float64Array(count), vs = new Float64Array(count), ts = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const P = pointAt(sl, t);
    us[i] = P[0]; vs[i] = P[1];
    ts[i] = axisX >= 0 ? P[axisX] : t;
  }
  const lam = new Float32Array(count).fill(NaN);
  const k = new Int16Array(count).fill(-1);
  const data = {
    ts, lam, k, re: null, im: null, theta: null, keep: 0, horizontal: axisX >= 0, axisX,
    vts: sl.kind === 'polyline' ? vertexTs(sl).slice(1, -1) : [],
    xlabel: axisX >= 0
      ? `${coordLabel(S.axes[axisX])}  (${coordLabel(S.axes[1 - axisX])} = ${A[1 - axisX].toPrecision(6)})`
      : `${sl.label}: position along the path (arc length, 0 → 1)`,
  };
  sliceData = data;
  selectTab('slice');
  sliceControls();
  $('slice-note').textContent = 'Computing slice…';
  const jobs = [];
  for (let i0 = 0; i0 < count; i0 += per) jobs.push([i0, Math.min(count, i0 + per)]);
  let lastDraw = 0, failed = false;
  await Promise.all(
    jobs.map(([i0, i1]) =>
      pool
        .run('slice', { prob, us: us.slice(i0, i1), vs: vs.slice(i0, i1), i0, i1, nTrans: Math.max(1000, S.nTrans * 2), nRec, keep, kmax: S.kmax, tau: S.tau, S: S.Ssample, qA: r.qA, qB: r.qB }, { tag: 'slice' })
        .then((res) => {
          if (gen !== sliceGen) return;
          if (!data.keep) {
            data.keep = res.keep; data.theta = res.theta;
            data.re = new Float32Array(count * res.keep).fill(NaN); data.im = new Float32Array(count * res.keep).fill(NaN);
            sliceControls();
          }
          lam.set(res.lam, res.i0);
          k.set(res.k, res.i0);
          data.re.set(res.re, res.i0 * data.keep);
          data.im.set(res.im, res.i0 * data.keep);
          const now = performance.now();
          if (now - lastDraw > 250) { lastDraw = now; replot(); }
        })
        .catch((err) => { failed = true; if (!err || !err.cancelled) console.error(err); }),
    ),
  );
  if (gen !== sliceGen) return;
  if (!failed && plane.slices.includes(sl)) {
    sliceResults.delete(sl.id);
    sliceResults.set(sl.id, { key, data });
    for (const id of [...sliceResults.keys()]) {
      if (sliceResults.size <= SLICE_CACHE) break;
      if (id !== sl.id) sliceResults.delete(id);
    }
  }
  replot();
  $('slice-note').textContent = SLICE_DONE_NOTE;
  bindSliceEvents();
}

let sliceBound = false;
function bindSliceEvents() {
  const el = $('plot-slice');
  if (sliceBound || !el.on) return;
  sliceBound = true;
  el.on('plotly_click', (ev) => {
    const sl = activeSlice();
    if (!sliceData || !sl || !ev.points.length) return;
    const x = ev.points[0].x;
    let t = x;
    if (sliceData.horizontal) { const j = sliceData.axisX, A = sl.pts[0], B = sl.pts[sl.pts.length - 1]; t = (x - A[j]) / (B[j] - A[j] || 1); }
    setWalk(sl.id, Math.min(1, Math.max(0, t)), true);
  });
}

// ---------------------------------------------------------------- walking along a path
// "Move along": a slider that moves the analysed parameter along the slice or a traced border.
// Analyses chain latest-wins, so dragging never queues up stale work.
const walk = { id: null, t: 0, on: false, dir: 0, raf: 0, last: 0, moved: 0, busy: false, next: null };

/** Refill the path menu from the plane's overlays; `prefer` selects that path if present. */
function updateWalk(prefer) {
  const paths = plane.paths();
  const sel = $('walk-path');
  $('walk').hidden = !paths.length;
  if (!paths.length) { setWalkDir(0); walk.id = null; walk.on = false; sel.innerHTML = ''; return; }
  sel.innerHTML = '';
  for (const p of paths) {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.label;
    sel.append(o);
  }
  const keep = paths.find((p) => p.id === prefer) || paths.find((p) => p.id === walk.id) || paths[0];
  if (keep.id !== walk.id) { walk.id = keep.id; walk.t = 0; walk.on = false; }
  sel.value = walk.id;
  $('walk-t').value = String(Math.round(walk.t * 1000));
}

/** Move the walker to fraction t of path `id`; with `analyse`, pick that parameter. */
function setWalk(id, t, analyse = false) {
  const path = plane.paths().find((p) => p.id === id);
  if (!path) return null;
  if (walk.id !== id) updateWalk(id);
  walk.id = id; walk.t = t; walk.on = true;
  $('walk-path').value = id;
  $('walk-t').value = String(Math.round(t * 1000));
  const P = pointAt(path, t);
  if (S.tab === 'slice') replot();
  return analyse ? walkTo(P) : Promise.resolve();
}

async function walkTo(P) {
  walk.next = P;
  if (walk.busy) return;
  walk.busy = true;
  try {
    while (walk.next) {
      const q = walk.next;
      walk.next = null;
      await pick(q);
    }
  } finally {
    walk.busy = false;
  }
}

/** ◀ ❚❚ ▶ for the walker: −1 backwards, 0 pause, +1 forwards; it wraps around the path's ends.
 *  The point moves at a fixed speed, one pass along the path every WALK_PERIOD seconds, whatever
 *  the analysis costs; the analysis follows latest-wins (walkTo), skipping positions it cannot keep up with. */
const WALK_PERIOD = 60;
function setWalkDir(d) {
  walk.dir = d;
  document.querySelectorAll('[data-walk-dir]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.walkDir === d));
  if (d && !walk.raf) { walk.last = performance.now(); walk.moved = 0; walk.raf = requestAnimationFrame(walkStep); }
}
function walkStep(now) {
  if (!walk.dir || !walk.id) { walk.raf = 0; if (!walk.id && walk.dir) setWalkDir(0); return; }
  const dt = Math.min(0.1, (now - walk.last) / 1000);
  walk.last = now;
  let t = walk.t + (walk.dir * dt) / WALK_PERIOD;
  if (t > 1) t -= 1;
  if (t < 0) t += 1;
  walk.t = t;
  // move the slider and the cursor every frame; hand a new position to the analysis at most every 50 ms
  $('walk-t').value = String(Math.round(t * 1000));
  if (now - walk.moved > 50) { walk.moved = now; setWalk(walk.id, t, true); }
  walk.raf = requestAnimationFrame(walkStep);
}

// ---- turning θ*: one full turn every THETA_PERIOD seconds, redrawn at most every 50 ms
const THETA_PERIOD = 24;
const thetaAnim = { dir: 0, raf: 0, last: 0, drawn: 0 };
function setThetaDir(d) {
  thetaAnim.dir = d;
  document.querySelectorAll('[data-theta-dir]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.thetaDir === d));
  if (d && !thetaAnim.raf) { thetaAnim.last = performance.now(); thetaAnim.raf = requestAnimationFrame(thetaStep); }
  if (!d) save();
}
function thetaStep(now) {
  if (!thetaAnim.dir) { thetaAnim.raf = 0; return; }
  const dt = Math.min(0.1, (now - thetaAnim.last) / 1000);
  thetaAnim.last = now;
  S.sliceTheta = (((S.sliceTheta + (thetaAnim.dir * TWO_PI * dt) / THETA_PERIOD) % TWO_PI) + TWO_PI) % TWO_PI;
  sliceControls();
  if (now - thetaAnim.drawn > 50) { thetaAnim.drawn = now; replot(); }
  thetaAnim.raf = requestAnimationFrame(thetaStep);
}

// ---------------------------------------------------------------- function reference
/** The "Functions and names" list under the formula; a click inserts at the cursor. */
function buildFunctionReference() {
  const box = $('fnref-list');
  if (box.childElementCount) return;
  for (const { group, items } of FUNCTION_DOCS) {
    const h = document.createElement('h3');
    h.textContent = group;
    box.append(h);
    for (const [label, desc, insert] of items) {
      const row = document.createElement('div');
      row.className = 'fn';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (insert) {
        b.title = `Insert ${insert}`;
        b.addEventListener('click', () => insertIntoExpr(insert));
      } else b.disabled = true;
      const d = document.createElement('span');
      d.textContent = desc;
      row.append(b, d);
      box.append(row);
    }
  }
}
function insertIntoExpr(text) {
  const el = $('expr');
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, a) + text + el.value.slice(b);
  el.focus();
  el.setSelectionRange(a + text.length, a + text.length);
  el.dispatchEvent(new Event('input'));
  el.dispatchEvent(new Event('change'));
}

// ---------------------------------------------------------------- utils
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- boot
function boot() {
  syncInputs();
  bindControls();
  selectTab(S.tab || 'graph');
  if (!validateExpr() || !evalT()) return;
  showCF();
  plane.setView(S.view, { render: false });
  pool.ready.then(() => {
    renderPlane();
    pick(currentUV());
    const p = PRESETS.find((q) => q.id === S.preset);
    if (p && p.expr === S.expr) addPresetSlices(p.id);
  });
  window.addEventListener('resize', () => resizeAll(document.querySelectorAll('.plot')));
}

if (!window.Plotly) {
  console.warn('Plotly did not load; plots are disabled');
}
boot();
