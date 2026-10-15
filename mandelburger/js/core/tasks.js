// Task handlers. Pure functions of plain-data jobs, so the same code runs in a
// Web Worker (js/workers/compute.worker.js) or, as a fallback, on the main thread.
//
//   plane    — strip of the parameter plane: escape / lambda / branch count per pixel
//   analyze  — one parameter: long orbit, structure detection, Newton solution, spectrum
//   rays     — exact boundary of the hyperbolic component along rays (continuation + root finding)
//   slice    — bifurcation diagram along a segment in the parameter plane

import { recordAngles } from './section.js';
import { makeOrbitKernel, countBranches, smoothEscape } from './orbit.js';
import { detectStructure, seedFromOrbit } from './structure.js';
import { StructureProblem, newtonSolve, spectrum, graphTransform, maxAbs } from './solver.js';
import { buildModel, makeGridFill, setCoord, uvOf, isZ0Axis, cocycleKindOf } from './model.js';
import { nextPow2 } from './fft.js';
import { analyzeCocycle, cocyclePixel, latticeOrder, tangentCocycle } from './cocycle.js';

const TWO_PI = 2 * Math.PI;

// ---------------------------------------------------------------- caches
// Compiled code depends on everything except the two plane coordinates (u, v).
function staticKey(prob) {
  const params = structuredClone(prob.params);
  for (const id of prob.axes) setCoord(params, id, 0);
  if (!params.z0) params.z0 = prob.z0 || [0, 0];
  return JSON.stringify([prob.expr, prob.T, prob.start, prob.axes, params]);
}
function lru(map, key, make, size) {
  let v = map.get(key);
  if (!v) {
    v = make();
    map.set(key, v);
    if (map.size > size) map.delete(map.keys().next().value);
  }
  return v;
}
const modelCache = new Map();
const getModel = (prob) => lru(modelCache, staticKey(prob), () => buildModel(prob), 8);

const kernelCache = new Map();
function getKernel(prob, N) {
  return lru(kernelCache, `${staticKey(prob)}#${N}`, () => makeOrbitKernel(getModel(prob), { T: prob.T, N, start: prob.start, z0: prob.params.z0 || prob.z0 || [0, 0], axes: prob.axes }), 4);
}

const fillCache = new Map();
function getCoverFill(prob, d, M) {
  return lru(fillCache, `${staticKey(prob)}#${d}#${M}`, () => {
    const xs = new Float64Array(M);
    for (let m = 0; m < M; m++) xs[m] = ((TWO_PI * d * m) / M) % TWO_PI;
    return makeGridFill(getModel(prob), xs);
  }, 8);
}

// ---------------------------------------------------------------- plane
/** Exact plane for a linear cocycle: quadrature on the base circle, no orbit. */
function cocyclePlane(job, kind) {
  const { prob, view, W, H, row0, row1, stride, kmax } = job;
  const fills = [64, 256, 1024, 4096].map((M) => ({ M, fill: getCoverFill(prob, 1, M) }));
  const buf = [];
  const cols = Math.ceil(W / stride);
  const rows = [];
  for (let y = row0; y < row1; y += stride) rows.push(y);
  const data = new Float32Array(rows.length * cols * 3);
  const dx = (view.x1 - view.x0) / W, dy = (view.y1 - view.y0) / H;
  // beta of exactly cramped pixels (NaN elsewhere), for the resonance lines below
  const B = new Float64Array(rows.length * cols).fill(NaN);
  let o = 0;
  for (const py of rows) {
    const im = view.y1 - (py + 0.5) * dy;
    for (let px = 0; px < W; px += stride) {
      const re = view.x0 + (px + 0.5) * dx;
      const r = cocyclePixel(fills, re, im, kind, prob.T, kmax, buf);
      data[o] = r.esc; data[o + 1] = r.esc >= 0 ? NaN : r.lam; data[o + 2] = r.k;
      if (r.exact) B[o / 3] = r.beta;
      o += 3;
    }
  }
  // Where lambda = 0 holds on an open set, the relations q beta = 2 pi n + m T are
  // curves in the plane (a resonance web). A pixel gets q sheets when such a curve
  // passes through it: the relation holds within half the spread of beta over the pixel.
  // Only the simplest relations, q + |m| <= kmax, are drawn, or the web would fill the plane.
  const wrap = (a) => a - TWO_PI * Math.round(a / TWO_PI);
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < cols; i++) {
      const p = j * cols + i, b = B[p];
      if (Number.isNaN(b) || data[3 * p + 2] > 0) continue;
      let spread = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= cols || jj >= rows.length) continue;
        const nb = B[jj * cols + ii];
        if (!Number.isNaN(nb)) spread = Math.max(spread, Math.abs(wrap(nb - b)));
      }
      if (spread > 0 && spread < 0.5) data[3 * p + 2] = latticeOrder(b, prob.T, kmax, kmax, spread / 2, kmax);
    }
  }
  return { result: { data, rows: rows.length, cols, row0, stride, exact: true }, transfer: [data.buffer] };
}

export function planeTask(job) {
  const { prob, view, W, H, row0, row1, stride, mode, nTrans, nRec, kmax, tau, S, qA, qB } = job;
  // linear cocycles: the answer is a closed form (a z0 plane is trivial there: z0 only scales)
  const kind = isZ0Axis(prob.axes) ? null : cocycleKindOf(getModel(prob));
  if (kind) return cocyclePlane(job, kind);
  const kernel = getKernel(prob, nTrans + nRec + 2);
  const classify = mode === 'classify';
  const bufR = classify ? new Float64Array(nRec) : null;
  const bufI = classify ? new Float64Array(nRec) : null;
  const out3 = new Float64Array(5);
  const cols = Math.ceil(W / stride);
  const rows = [];
  for (let y = row0; y < row1; y += stride) rows.push(y);
  const data = new Float32Array(rows.length * cols * 3);
  const dx = (view.x1 - view.x0) / W, dy = (view.y1 - view.y0) / H;
  let o = 0;
  for (const py of rows) {
    const im = view.y1 - (py + 0.5) * dy;
    for (let px = 0; px < W; px += stride) {
      const re = view.x0 + (px + 0.5) * dx;
      kernel(re, im, nTrans, nRec, bufR, bufI, out3);
      if (out3[0] >= 0) {
        data[o] = smoothEscape(out3[0], out3[1]);
        data[o + 1] = NaN;
        data[o + 2] = -1;
      } else {
        data[o] = -1;
        data[o + 1] = out3[2];
        data[o + 2] = classify ? countBranches(bufR, bufI, S, qA, qB, kmax, tau).k : -1;
      }
      o += 3;
    }
  }
  return { result: { data, rows: rows.length, cols, row0, stride }, transfer: [data.buffer] };
}

// ---------------------------------------------------------------- analyze
export function analyzeTask(job) {
  const { prob, M: Mbase, kmax, nTrans, nRec, tau, S, qA, qB, plotPoints = 6000, structThr = 1e-3 } = job;
  // structures are searched up to structK sheets (the Structures tab), independent of the
  // branch counter's kmax, which matches the plane colouring
  const structK = job.structK || kmax;
  const T = prob.T;
  const kernel = getKernel(prob, nTrans + nRec + 2);
  const bufR = new Float64Array(nRec), bufI = new Float64Array(nRec);
  const out3 = new Float64Array(5);
  const [vr, vi] = uvOf(prob);
  const t0 = performance.now();
  kernel(vr, vi, nTrans, nRec, bufR, bufI, out3);
  const z0 = [out3[3], out3[4]];
  const orbitMs = performance.now() - t0;
  const model = getModel(prob);
  const cocycleKind = cocycleKindOf(model);
  const cocycle = (orbitLen, plot) => (cocycleKind
    ? analyzeCocycle({ fill: getCoverFill(prob, 1, 2048), u: vr, v: vi, T, kind: cocycleKind, orbit: { zr: bufR, zi: bufI, n0: nTrans + 1, len: orbitLen }, z0, plot })
    : null);
  if (out3[0] >= 0) {
    return { result: { escaped: true, escapeStep: out3[0], orbitMs, z0, cocycle: cocycle(0, { start: 0, count: 0 }) } };
  }
  const lambdaOrbit = out3[2];
  const branches = countBranches(bufR, bufI, S, qA, qB, kmax, tau);
  const n0 = nTrans + 1; // absolute time of bufR[0]
  const det = detectStructure(bufR, bufI, n0, nRec, T, { kmax: structK, B: Math.max(32, Math.min(512, Math.floor(nRec / (24 * structK * structK)))), thr: structThr });

  // orbit sample for plotting (last plotPoints points)
  const np = Math.min(plotPoints, nRec);
  const oth = new Float32Array(np), ore = new Float32Array(np), oim = new Float32Array(np);
  for (let k = 0; k < np; k++) {
    const idx = nRec - np + k;
    oth[k] = ((n0 + idx) * T) % TWO_PI;
    ore[k] = bufR[idx];
    oim[k] = bufI[idx];
  }

  let sol = null;
  const transfer = [oth.buffer, ore.buffer, oim.buffer];
  const st = det.chosen;
  // linear cocycles are solved in closed form (cocycle.js); Newton would only find f = 0
  if (st && !cocycleKind) {
    const t1 = performance.now();
    const M = nextPow2(Mbase * st.d);
    const fill = getCoverFill(prob, st.d, M);
    const P = new StructureProblem({ c: st.c, d: st.d, s: st.s, M, T, fill, u: vr, v: vi });
    const seed = seedFromOrbit(bufR, bufI, n0, nRec, T, st, M);
    let res = newtonSolve(P, seed.FR, seed.FI);
    if (!res.ok && st.k === 1) {
      // fallback seed: graph transform (forward push of the graph)
      const FR = Float64Array.from(seed.FR), FI = Float64Array.from(seed.FI);
      if (graphTransform(P, FR, FI, 200)) {
        const r2 = newtonSolve(P, FR, FI);
        if (r2.ok || r2.resid < res.resid) res = r2;
      }
    }
    const spec = spectrum(P, res.FR, res.FI);
    // winding number of each component around 0 (over its whole cover circle)
    const winding = [];
    for (let j = 0; j < st.c; j++) {
      let acc = 0;
      for (let m = 0; m < M; m++) {
        const a = j * M + m, b = j * M + ((m + 1) % M);
        acc += Math.atan2(res.FR[a] * res.FI[b] - res.FI[a] * res.FR[b], res.FR[a] * res.FR[b] + res.FI[a] * res.FI[b]);
      }
      winding.push(Math.round(acc / (2 * Math.PI)));
    }
    // the tangent cocycle along the solution (the linearisation; MATH.md §14.9)
    let tangent = null;
    if (res.ok) {
      P.evalRHS(res.FR, res.FI);
      tangent = tangentCocycle({ DR: P.DR, DI: P.DI, NR: P.NR, NI: P.NI, FR: res.FR, FI: res.FI, c: st.c, d: st.d, s: st.s, M, T, lambdaStep: res.lambda });
    }
    sol = {
      winding, tangent,
      c: st.c, d: st.d, s: st.s, k: st.k, M,
      FR: res.FR, FI: res.FI, ok: res.ok, reason: res.reason, newton: res.newton, gmres: res.gmres,
      resid: res.resid, lambda: res.lambda, maxAbs: maxAbs(res.FR, res.FI),
      spec: { omega: spec.omega, amp: spec.amp, rho: spec.rho, tailRatio: spec.tailRatio },
      ms: performance.now() - t1,
    };
    transfer.push(res.FR.buffer, res.FI.buffer, spec.omega.buffer, spec.amp.buffer);
  }
  return {
    result: {
      escaped: false, lambdaOrbit, branches, orbitMs, z0,
      cocycle: cocycle(nRec, { start: nRec - np, count: np }),
      candidates: det.candidates.map(({ c, d, s, k, score }) => ({ c, d, s, k, score })),
      chosen: st ? { c: st.c, d: st.d, s: st.s, k: st.k, score: st.score } : null,
      orbit: { theta: oth, re: ore, im: oim },
      sol,
    },
    transfer,
  };
}

// ---------------------------------------------------------------- rays (exact boundary)
export function raysTask(job) {
  const { prob, st, M, center, angles, F0R, F0I, rMax, tailTol = 1e-6 } = job;
  const fill = getCoverFill(prob, st.d, M);
  const P = new StructureProblem({ c: st.c, d: st.d, s: st.s, M, T: prob.T, fill });
  const hMin = rMax * 2e-4;
  const tolR = rMax * 1e-7;

  const solveAt = (re, im, GR, GI) => {
    P.u = re; P.v = im;
    const r = newtonSolve(P, GR, GI, { maxNewton: 10, maxGmres: 300 });
    if (!r.ok) return { ...r, kind: 'breakdown' };
    const sp = spectrum(P, r.FR, r.FI);
    if (sp.tailRatio > tailTol) return { ...r, ok: false, kind: 'unresolved', reason: 'under-resolved: analyticity strip below grid scale' };
    return { ...r, rho: sp.rho, kind: r.lambda < 0 ? 'good' : 'lambda' };
  };

  const results = [];
  for (const ang of angles) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    let r = 0, FR = F0R, FI = F0I, lamG = null;
    const rhoHist = [];
    let rPrev = null, PR = null, PI = null;
    let h = rMax / 48;
    let bad = null; // {r, sol}
    let steps = 0;
    while (r < rMax && steps < 400) {
      steps++;
      const r1 = Math.min(rMax, r + h);
      let GR = FR, GI = FI;
      if (PR && rPrev !== null && r > rPrev) {
        const w = (r1 - r) / (r - rPrev);
        GR = new Float64Array(FR.length); GI = new Float64Array(FI.length);
        for (let k = 0; k < FR.length; k++) { GR[k] = FR[k] + w * (FR[k] - PR[k]); GI[k] = FI[k] + w * (FI[k] - PI[k]); }
      }
      const s = solveAt(center[0] + r1 * ux, center[1] + r1 * uy, GR, GI);
      if (s.kind === 'good') {
        rPrev = r; PR = FR; PI = FI;
        r = r1; FR = s.FR; FI = s.FI; lamG = s.lambda;
        if (Number.isFinite(s.rho)) rhoHist.push([r, s.rho]);
        h = Math.min(h * 1.5, rMax / 10);
        continue;
      }
      if (s.kind !== 'lambda' && h > hMin) { h /= 4; continue; }
      bad = { r: r1, sol: s };
      break;
    }
    if (!bad) { results.push({ angle: ang, r, type: 'none', steps }); continue; }
    // refine between r (good) and bad.r
    let type = bad.sol.kind;
    let lamB = bad.sol.kind === 'lambda' ? bad.sol.lambda : null;
    let rb = bad.r;
    let wG = lamG, wB = lamB, last = 0; // Illinois-modified regula falsi on lambda(r) = 0
    for (let it = 0; it < 40 && rb - r > (wB !== null ? tolR : hMin / 4); it++) {
      let rm;
      if (wB !== null && wG !== null && wB > 0 && wG < 0) {
        rm = r + ((rb - r) * -wG) / (wB - wG);
        const lo = r + 0.01 * (rb - r), hi = rb - 0.01 * (rb - r);
        rm = Math.min(hi, Math.max(lo, rm));
      } else rm = 0.5 * (r + rb);
      const s = solveAt(center[0] + rm * ux, center[1] + rm * uy, FR, FI);
      steps++;
      if (s.kind === 'good') {
        r = rm; FR = s.FR; FI = s.FI; lamG = s.lambda; wG = lamG;
        if (Number.isFinite(s.rho)) rhoHist.push([r, s.rho]);
        if (last === 1 && wB !== null) wB /= 2;
        last = 1;
      } else {
        rb = rm; type = s.kind;
        lamB = s.kind === 'lambda' ? s.lambda : null; wB = lamB;
        if (last === -1 && wG !== null) wG /= 2;
        last = -1;
      }
    }
    // where the analyticity width rho(r) extrapolates to zero (linear fit of the last points)
    let rExtrap = null;
    if (type !== 'lambda' && rhoHist.length >= 3) {
      const pts = rhoHist.slice(-4);
      const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      let sxy = 0, sxx = 0;
      for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
      const slope = sxx > 0 ? sxy / sxx : 0;
      if (slope < 0) rExtrap = Math.min(rMax, mx - my / slope);
    }
    results.push({ angle: ang, r: 0.5 * (r + rb), type, steps, lambda: lamG, rExtrap });
  }
  return { result: { rays: results } };
}

// ---------------------------------------------------------------- slice
export function sliceTask(job) {
  // For every parameter on the segment: λ, the branch count, and the last `keep` recorded orbit
  // values. Their base angles are the same for every parameter (returned once as `theta`), so the
  // client cuts the attractor at any θ* with any window without recomputing (see section.js).
  // The parameters are the points (us[i], vs[i]), i in [i0, i1): any path, sampled by the client.
  const { prob, us, vs, i0, i1, nTrans, nRec, keep, kmax, tau, S, qA, qB } = job;
  const kernel = getKernel(prob, nTrans + nRec + 2);
  const bufR = new Float64Array(nRec), bufI = new Float64Array(nRec);
  const out3 = new Float64Array(5);
  const K = Math.min(keep, nRec), off = nRec - K;
  const theta = recordAngles(nTrans + 1 + off, K, prob.T);
  const nOut = i1 - i0;
  const lam = new Float32Array(nOut), kk = new Int16Array(nOut), esc = new Float32Array(nOut);
  const re = new Float32Array(nOut * K).fill(NaN), im = new Float32Array(nOut * K).fill(NaN);
  for (let i = i0; i < i1; i++) {
    kernel(us[i - i0], vs[i - i0], nTrans, nRec, bufR, bufI, out3);
    const o = i - i0;
    if (out3[0] >= 0) { esc[o] = out3[0]; lam[o] = NaN; kk[o] = -1; continue; }
    esc[o] = -1;
    lam[o] = out3[2];
    kk[o] = countBranches(bufR, bufI, S, qA, qB, kmax, tau).k;
    for (let k = 0; k < K; k++) { re[o * K + k] = bufR[off + k]; im[o * K + k] = bufI[off + k]; }
  }
  return {
    result: { i0, i1, lam, k: kk, esc, re, im, keep: K, theta },
    transfer: [lam.buffer, kk.buffer, esc.buffer, re.buffer, im.buffer, theta.buffer],
  };
}

export const handlers = { plane: planeTask, analyze: analyzeTask, rays: raysTask, slice: sliceTask };
