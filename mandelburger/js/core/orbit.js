// Critical-orbit kernel and branch classification.
//
// The skew product  Phi(theta, z) = (theta + T, F(z, theta))  is iterated from a
// critical point z_0 of F(., theta_0) (dF/df = 0, found by Newton on the symbolic
// derivatives) at theta_0 = 0. For F = c z^2 + ... that is z_0 = 0. The orbit is
// attracted to the attracting invariant set if there is one, so its statistics
// classify the parameter:
//
//   * escape         |z| -> infinity
//   * fibre Lyapunov lambda = <log |dF/df (z_n, theta_n)|>
//   * branch count   k = number of sheets of the attractor over theta
//
// Kernels are generated per (problem, N) with expr.compileSampled, so the inner
// loop is straight-line arithmetic; the derivative is only evaluated in the
// recorded window.

import { compileSampled, newHoist, newShared, bindHoisted } from './expr.js';

const TWO_PI = 2 * Math.PI;
export const BAILOUT2 = 1e16; // |z|^2 escape threshold

/** Base angles theta_n = nT mod 2pi, computed without accumulation error. */
export function orbitAngles(T, N) {
  const xs = new Float64Array(N);
  for (let n = 0; n < N; n++) xs[n] = (n * T) % TWO_PI;
  return xs;
}

/**
 * Build orbit(u, v, nTrans, nRec, bufR, bufI, out) for a model (see model.js).
 *   out[0] = escape step (-1 if bounded), out[1] = |z|^2 at escape,
 *   out[2] = lambda (mean log|dF/df| over the recorded window),
 *   out[3], out[4] = starting point z_0.
 * When bufR is non-null, z_{nTrans+1+k} is stored at k (k < nRec).
 */
export function makeOrbitKernel(model, { T, N, start = 'crit', z0 = [0, 0], axes = [] }) {
  const xs = orbitAngles(T, N);
  const hoist = newHoist();
  const shared = newShared(); // averages over x are computed once per call
  const sF = compileSampled([model.ast], xs, model.dyn, model.env, hoist, 'ta', shared);
  const sFD = compileSampled([model.ast, model.D], xs, model.dyn, model.env, hoist, 'tb', shared);
  // 'custom' starts at z0; 'crit' starts at a critical point and falls back to z0
  // when there is none (F affine in f, or a Möbius-type F such as E - V(x) - 1/f)
  // z0 may itself be a plane coordinate (u or v): then every pixel starts at its own z0,
  // and the plane is the fibre Julia set over theta_0 = 0
  const ax = (id) => (axes[0] === id ? 'u' : axes[1] === id ? 'v' : null);
  let z0n = [Number(z0[0]) || 0, Number(z0[1]) || 0];
  // for F = g(x) f the zero graph is invariant: starting there shows nothing
  if (model.homogeneous && z0n[0] === 0 && z0n[1] === 0) z0n = [1, 0];
  const z0r = ax('z0.re') || `(${z0n[0]})`, z0i = ax('z0.im') || `(${z0n[1]})`;
  const z0OnAxis = !!(ax('z0.re') || ax('z0.im'));
  let startCode = `zr = ${z0r}; zi = ${z0i};`;
  let preC = '';
  if (start === 'crit' && !model.affine && !z0OnAxis) {
    const sC = compileSampled([model.D, model.D2], xs, model.dyn, model.env, hoist, 'tc', shared);
    preC = sC.pre;
    const [D, D2] = sC.res;
    startCode = `
    const seeds = [0, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0.7, 0.7, -0.7, -0.7];
    let found = false;
    for (let s = 0; s < seeds.length && !found; s += 2) {
      zr = seeds[s]; zi = seeds[s + 1];
      for (let it = 0; it < 60; it++) {
${sC.code}
        const ar = ${D.r}, ai = ${D.i}, br = ${D2.r}, bi = ${D2.i};
        if (ar === 0 && ai === 0) { found = true; break; }
        // accept only on a vanishing Newton step: |dF/df| alone can be tiny far from a
        // critical point (e.g. near an essential singularity such as exp(-1/f))
        const mb = br * br + bi * bi;
        if (!(mb > 0)) break;
        const sr = (ar * br + ai * bi) / mb, si = (ai * br - ar * bi) / mb;
        zr -= sr; zi -= si;
        if (sr * sr + si * si < 1e-26 * (1 + zr * zr + zi * zi)) { found = true; break; }
        if (!(zr * zr + zi * zi < 1e12)) break;
      }
    }
    if (!found) { zr = ${z0r}; zi = ${z0i}; }`;
  }
  const [F1] = sF.res;
  const [F2, D2] = sFD.res;
  const body = `return function orbit(u, v, nTrans, nRec, bufR, bufI, out) {
${shared.pre.join('\n')}
${sF.pre}
${sFD.pre}
${preC}
    let zr = 0, zi = 0, m2 = 0;
    let n = 0;
    {${startCode}}
    out[3] = zr; out[4] = zi;
    for (; n < nTrans; n++) {
${sF.code}
      zr = ${F1.r}; zi = ${F1.i};
      m2 = zr * zr + zi * zi;
      if (!(m2 <= ${BAILOUT2})) { out[0] = n; out[1] = m2; out[2] = NaN; return; }
    }
    let logAcc = 0, prod = 1;
    const end = nTrans + nRec;
    const store = bufR !== null;
    for (; n < end; n++) {
${sFD.code}
      const dr = ${D2.r}, di = ${D2.i};
      zr = ${F2.r}; zi = ${F2.i};
      m2 = zr * zr + zi * zi;
      if (!(m2 <= ${BAILOUT2})) { out[0] = n; out[1] = m2; out[2] = NaN; return; }
      if (store) { const k = n - nTrans; bufR[k] = zr; bufI[k] = zi; }
      prod *= dr * dr + di * di;
      if (prod > 1e150 || prod < 1e-150) { logAcc += Math.log(prod); prod = 1; }
    }
    logAcc += Math.log(prod);
    out[0] = -1; out[1] = m2;
    out[2] = 0.5 * logAcc / nRec;
  };`;
  const fn = bindHoisted(hoist, body);
  fn.hoisted = hoist.arrays.length;
  fn.N = N;
  return fn;
}

/** Smooth escape time for quadratic growth. */
export function smoothEscape(n, m2) {
  const lz = 0.5 * Math.log(m2);
  return n + 1 - Math.log2(Math.max(1e-300, lz / Math.log(Math.sqrt(BAILOUT2))));
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;

/**
 * Branch counter. z is the recorded orbit (length >= S + kmax*qB).
 * For each return time q in {qA, qB} find the least m <= kmax with
 *   mean_n |z_{n+mq} - z_n|^2  <  tau^2 * 2 Var(z),
 * i.e. after m near-returns the orbit is back on its own sheet. Since
 * (qA, pA), (qB, pB) form a lattice basis, k = lcm(mA, mB) is the number of
 * sheets. Returns {k, mA, mB, ratio}; k = 0 means "no finite sheet structure"
 * (strange nonchaotic or chaotic attractor).
 */
export function countBranches(zr, zi, S, qA, qB, kmax, tau) {
  let mr = 0, mi = 0;
  for (let n = 0; n < S; n++) { mr += zr[n]; mi += zi[n]; }
  mr /= S; mi /= S;
  let v = 0;
  for (let n = 0; n < S; n++) {
    const dr = zr[n] - mr, di = zi[n] - mi;
    v += dr * dr + di * di;
  }
  v /= S;
  if (v < 1e-26) return { k: 1, mA: 1, mB: 1, ratio: 0 };
  const thr = tau * tau * 2 * v;
  let best = Infinity;
  const find = (q) => {
    for (let m = 1; m <= kmax; m++) {
      const off = m * q;
      let d = 0, dmax = 0;
      for (let n = 0; n < S; n++) {
        const dr = zr[n + off] - zr[n], di = zi[n + off] - zi[n];
        const e = dr * dr + di * di;
        d += e;
        if (e > dmax) dmax = e;
      }
      d /= S;
      const r = d / (2 * v);
      if (r < best) best = r;
      // mean test plus a max test: a strange nonchaotic attractor can be close to a
      // graph almost everywhere and differ only in rare spikes, which the mean misses
      if (d < thr && dmax < 16 * thr) return m;
    }
    return 0;
  };
  const mA = find(qA);
  const mB = mA ? find(qB) : 0;
  const k = mA && mB ? lcm(mA, mB) : 0;
  return { k, mA, mB, ratio: Math.sqrt(best) };
}

/** Recorded-window length required by the branch counter. */
export const recordLength = (S, qB, kmax) => S + kmax * qB + 1;
