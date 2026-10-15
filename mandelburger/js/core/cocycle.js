// Exact analysis of linear cocycles (MATH.md §14).
//
//   multiplicative   F = g(x) f       z_n = z_0 * prod_{k<n} g(theta_k)
//   additive         F = f + L(x)     z_n = z_0 + sum_{k<n} L(theta_k)
//
// Write log g = mu + Lt(theta) + i w theta  (w = winding number of g, Lt periodic
// with mean zero, mu = lambda + i beta). The cohomological equation
//     psi(theta + T) - psi(theta) = Lt(theta),   psi_m = Lt_m / (e^{imT} - 1)
// turns the product into a closed form,
//     z_n = z_0 exp(mu n + psi(theta_n) - psi(theta_0) + i w sum_{k<n} theta_k),
// whenever psi converges (small divisors e^{imT} - 1: the Diophantine type of T/2pi).
// For |lambda| = 0, w = 0 the orbit lies on finitely many curves iff
//     q beta = 2 pi n + m T   for some integers q >= 1, n, m,
// and is dense in an annulus otherwise.

import { fft } from './fft.js';

const TWO_PI = 2 * Math.PI;

/**
 * @param o.fill      grid fill for the problem on the base circle (d = 1), M points
 * @param o.kind      'mult' | 'add'
 * @param o.orbit     {zr, zi, n0, len}: recorded orbit, bufR[k] at absolute time n0 + k
 * @param o.z0        [re, im] starting point (time 0, theta = 0)
 * @param o.plot      {start, count}: orbit indices to predict for plotting
 */
export function analyzeCocycle({ fill, u, v, T, M = 2048, kind, orbit, z0, plot }) {
  const zR = new Float64Array(M), zI = new Float64Array(M);
  const NR = new Float64Array(M), NI = new Float64Array(M), DR = new Float64Array(M), DI = new Float64Array(M);
  fill(u, v, zR, zI, 0, NR, NI, DR, DI, 0, M);
  // the generator: g = dF/df for F = g f; L = F(0, x) for F = f + L
  const gr = kind === 'mult' ? DR : NR, gi = kind === 'mult' ? DI : NI;
  const core = cocycleCore(gr, gi, M, T, kind);
  const { muR, muI, winding, divisors, Lamp, Pamp, Damp, pmax, ptail, sr, psiAt, psi0, relation, nearest } = core;
  let reMin = Infinity, reMax = -Infinity;
  for (let m = 0; m < M; m++) { reMin = Math.min(reMin, sr[m]); reMax = Math.max(reMax, sr[m]); }

  // predicted orbit at the plotted indices, and its error against the true orbit
  const { start, count } = plot;
  const predR = new Float32Array(count), predI = new Float32Array(count);
  let err = 0, scale = 0;
  // phase from the winding term: i w sum_{k<n} theta_k, accumulated exactly
  const nFirst = orbit.n0 + start;
  let windPhase = 0;
  if (kind === 'mult' && winding !== 0) for (let k = 0; k < nFirst; k++) windPhase += winding * ((k * T) % TWO_PI);
  for (let j = 0; j < count; j++) {
    const n = nFirst + j;
    const th = (n * T) % TWO_PI;
    const ps = psiAt(th);
    let zr, zi;
    if (kind === 'mult') {
      const lr = muR * n + ps[0] - psi0[0];
      const li = muI * n + ps[1] - psi0[1] + windPhase;
      const e = Math.exp(lr);
      const cr = e * Math.cos(li), ci = e * Math.sin(li);
      zr = z0[0] * cr - z0[1] * ci; zi = z0[0] * ci + z0[1] * cr;
      if (winding !== 0) windPhase += winding * th;
    } else {
      zr = z0[0] + muR * n + ps[0] - psi0[0];
      zi = z0[1] + muI * n + ps[1] - psi0[1];
    }
    predR[j] = zr; predI[j] = zi;
    const k = start + j;
    if (k < orbit.len) {
      const ar = orbit.zr[k], ai = orbit.zi[k];
      err = Math.max(err, Math.hypot(ar - zr, ai - zi));
      scale = Math.max(scale, Math.hypot(ar, ai));
    }
  }
  // ring radii seen by the orbit
  let rMin = Infinity, rMax = 0;
  for (let k = 0; k < orbit.len; k++) {
    const r = Math.hypot(orbit.zr[k], orbit.zi[k]);
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
  }

  const beta = muI;

  // verdict
  const lambda = kind === 'mult' ? muR : 0;
  let regime, sheets = null;
  const tolL = 1e-7;
  if (kind === 'add') {
    const drift = Math.hypot(muR, muI);
    regime = drift > 1e-9
      ? `The mean of L is ${fmtC(muR, muI)} ≠ 0: the orbit drifts linearly to infinity, z_n ≈ z_0 + ${fmtC(muR, muI)}·n.`
      : 'mean L = 0: the Birkhoff sums are bounded and the orbit lies on one curve z = z_0 + ψ(θ) − ψ(0) (one neutral graph for every z_0).';
    if (drift <= 1e-9) sheets = 1;
  } else if (Math.abs(lambda) > tolL) {
    regime = `Not cramped: mean log|g| = λ = ${lambda.toFixed(6)} ≠ 0, so |z_n| ≈ e^{λn}: the orbit spirals ${lambda < 0 ? 'into 0' : 'out to ∞'}.`;
  } else if (winding !== 0) {
    regime = `Cramped (λ = 0), but g winds ${winding} time${Math.abs(winding) > 1 ? 's' : ''} around 0, so log g is not periodic and no invariant curve exists. The phase picks up a term quadratic in n (an Anzai skew product), and the orbit fills the annulus ${rMin.toPrecision(4)} ≤ |z| ≤ ${rMax.toPrecision(4)}.`;
  } else if (relation) {
    sheets = relation.q;
    regime = `Cramped and a coboundary: ${relation.q}·β = 2π·${relation.n} + ${relation.m}·T. The orbit lies on ${relation.q} curve${relation.q > 1 ? 's' : ''} z = C·e^{iβj}·e^{ψ(θ)}${relation.m ? ` (each winding ${relation.m}/${relation.q} times around 0)` : ''}, j = 0…${relation.q - 1}.`;
  } else {
    regime = `Cramped and a coboundary, but e^{iβ} (β/2π = ${(beta / TWO_PI).toFixed(8)}) satisfies no relation q·β = 2πn + mT with q ≤ 12, |m| ≤ 300: the orbit is dense in the annulus ${rMin.toPrecision(4)} ≤ |z| ≤ ${rMax.toPrecision(4)} (dimension 2).`
      + (nearest && nearest.err < 1e-3
        ? ` It is close to the relation ${nearest.q}·β ≈ 2π·${nearest.n}${nearest.m ? ` ${nearest.m < 0 ? '−' : '+'} ${Math.abs(nearest.m)}·T` : ''} (off by ${(nearest.err * nearest.q).toExponential(1)}), so for about ${Math.round(1 / (nearest.err * nearest.q)).toLocaleString('en-US')} steps the orbit looks like ${nearest.q} curve${nearest.q > 1 ? 's' : ''} that slowly rotate.`
        : '');
  }

  return {
    kind, lambda, beta, mu: [muR, muI], winding, relation, nearest, sheets, regime,
    divisors: divisors.slice(0, 6),
    spectrum: { Lamp, Pamp, Damp },
    psiTail: pmax > 0 ? ptail / pmax : 0,
    birkhoffBound: kind === 'mult' ? 2 * Math.max(Math.abs(reMax), Math.abs(reMin)) : null,
    ringPredicted: kind === 'mult' && winding === 0 ? [Math.hypot(...z0) * Math.exp(reMin - psi0[0]), Math.hypot(...z0) * Math.exp(reMax - psi0[0])] : null,
    ring: [rMin, rMax],
    pred: { re: predR, im: predI, relErr: scale > 0 ? err / scale : err },
  };
}

/**
 * The spectral part of a cocycle analysis, from samples of its generator on a uniform grid
 * θ_m = 2πm/M with rotation T: for kind 'mult' the multiplicative generator g (λ = mean log|g|,
 * β = mean arg g, winding of g, ψ solving ψ(θ+T) − ψ(θ) = log g − λ − iβ − iwθ), for 'add' the
 * additive generator L (ψ(θ+T) − ψ(θ) = L − mean L). Also the lattice relation qβ = 2πn + mT.
 */
export function cocycleCore(gr, gi, M, T, kind) {
  // ell = log g (continuous branch, linear trend removed) or L itself
  const er = new Float64Array(M), ei = new Float64Array(M);
  let winding = 0;
  if (kind === 'mult') {
    let prev = 0, uw = 0;
    for (let m = 0; m <= M; m++) {
      const k = m % M;
      const a = Math.atan2(gi[k], gr[k]);
      if (m === 0) uw = a;
      else { let d = a - prev; d -= TWO_PI * Math.round(d / TWO_PI); uw += d; }
      prev = a;
      if (m < M) { er[m] = 0.5 * Math.log(gr[k] * gr[k] + gi[k] * gi[k]); ei[m] = uw; }
      else winding = Math.round((uw - Math.atan2(gi[0], gr[0])) / TWO_PI);
    }
    for (let m = 0; m < M; m++) ei[m] -= (winding * TWO_PI * m) / M;
  } else {
    er.set(gr); ei.set(gi);
  }
  let muR = 0, muI = 0;
  for (let m = 0; m < M; m++) { muR += er[m]; muI += ei[m]; }
  muR /= M; muI /= M;
  // Fourier coefficients of the mean-zero part
  const wr = new Float64Array(M), wi = new Float64Array(M);
  for (let m = 0; m < M; m++) { wr[m] = (er[m] - muR) / M; wi[m] = (ei[m] - muI) / M; }
  fft(wr, wi);
  // psi_m = L_m / (e^{imT} - 1)
  const pr = new Float64Array(M), pi = new Float64Array(M);
  const divisors = [];
  for (let k = 1; k < M; k++) {
    const m = k < M / 2 ? k : k - M;
    if (2 * Math.abs(m) === M) continue;
    const dr = Math.cos(m * T) - 1, di = Math.sin(m * T);
    const d2 = dr * dr + di * di;
    pr[k] = (wr[k] * dr + wi[k] * di) / d2;
    pi[k] = (wi[k] * dr - wr[k] * di) / d2;
    if (m > 0) divisors.push({ m, size: Math.sqrt(d2) });
  }
  divisors.sort((a, b) => a.size - b.size);
  // spectra for plotting, |m| = 1 .. Kp
  const Kp = Math.min(M / 2 - 1, 400);
  const Lamp = new Float32Array(Kp), Pamp = new Float32Array(Kp), Damp = new Float32Array(Kp);
  for (let m = 1; m <= Kp; m++) {
    const a = m, b = M - m;
    Lamp[m - 1] = Math.max(Math.hypot(wr[a], wi[a]), Math.hypot(wr[b], wi[b]));
    Pamp[m - 1] = Math.max(Math.hypot(pr[a], pi[a]), Math.hypot(pr[b], pi[b]));
    Damp[m - 1] = 1 / Math.hypot(Math.cos(m * T) - 1, Math.sin(m * T));
  }
  // resolution of psi: tail relative to max
  let pmax = 0, ptail = 0;
  for (let k = 1; k < M; k++) {
    const m = k < M / 2 ? k : M - k;
    const a = Math.hypot(pr[k], pi[k]);
    pmax = Math.max(pmax, a);
    if (m > (3 * M) / 8) ptail = Math.max(ptail, a);
  }
  // psi on the grid
  const sr = Float64Array.from(pr), si = Float64Array.from(pi);
  fft(sr, si, true);
  for (let m = 0; m < M; m++) { sr[m] *= M; si[m] *= M; }
  const psiAt = (theta) => {
    // spectral interpolation through the significant modes
    let re = 0, im = 0;
    for (const md of modes) {
      const c = Math.cos(md.m * theta), s = Math.sin(md.m * theta);
      re += md.r * c - md.i * s;
      im += md.r * s + md.i * c;
    }
    return [re, im];
  };
  const modes = [];
  for (let k = 1; k < M; k++) {
    const a = Math.hypot(pr[k], pi[k]);
    if (a > 1e-15 * Math.max(pmax, 1e-300)) modes.push({ m: k < M / 2 ? k : k - M, r: pr[k], i: pi[k] });
  }
  const psi0 = psiAt(0);

  // lattice relation q beta = 2 pi n + m T (multiplicative, w = 0)
  let relation = null, nearest = null;
  const beta = muI;
  if (kind === 'mult') {
    for (let q = 1; q <= 12 && !relation; q++) {
      for (let m = 0; m <= 300 && !relation; m++) {
        for (const sm of m === 0 ? [0] : [m, -m]) {
          const x = q * beta - sm * T;
          const n = Math.round(x / TWO_PI);
          const e = Math.abs(x - TWO_PI * n);
          if (!nearest || e / q < nearest.err) nearest = { q, n, m: sm, err: e / q };
          if (e < 1e-7) { relation = { q, n, m: sm, err: e }; break; }
        }
      }
    }
  }

  return { muR, muI, winding, wr, wi, pr, pi, divisors, Lamp, Pamp, Damp, pmax, ptail, sr, si, psiAt, psi0, modes, relation, nearest };
}

function fmtC(r, i) {
  const a = +r.toPrecision(5), b = +Math.abs(i).toPrecision(5);
  return i === 0 || Math.abs(i) < 1e-15 ? `${a}` : `${a} ${i < 0 ? '−' : '+'} ${b}i`;
}

// ---------------------------------------------------------------- exact plane pixels
// For a linear cocycle the plane classification needs no orbit at all:
// lambda = mean log|g|, beta = mean arg g (detrended), w = winding, all by the
// trapezoid rule on the base circle (spectrally accurate for analytic g).

/** mean of log g on the grid with stride s: {lam, beta, w} (or null if g vanishes on the grid) */
function logMean(gr, gi, M, s) {
  const n = M / s;
  let lam = 0, uw = 0, prev = 0, sum = 0, a0 = 0, jump = 0;
  const lg = (k) => 0.5 * Math.log(gr[k] * gr[k] + gi[k] * gi[k]);
  for (let j = 0; j <= n; j++) {
    const k = (j % n) * s;
    let m2 = gr[k] * gr[k] + gi[k] * gi[k];
    if (!Number.isFinite(m2)) return null;
    if (m2 === 0) {
      // a zero of g on a node: log|g| is integrable there; use the neighbours' mean,
      // and keep the phase (the error estimate flags the pixel as unresolved)
      const l = 0.5 * (lg(((j + 1) % n) * s) + lg(((j + n - 1) % n) * s));
      if (j < n) { lam += l; sum += uw; }
      continue;
    }
    const a = Math.atan2(gi[k], gr[k]);
    if (j === 0) { uw = a; a0 = a; } else { let d = a - prev; d -= TWO_PI * Math.round(d / TWO_PI); uw += d; jump = Math.max(jump, Math.abs(d)); }
    prev = a;
    if (j < n) { lam += 0.5 * Math.log(m2); sum += uw; }
  }
  const w = Math.round((uw - a0) / TWO_PI);
  // detrend: arg g - w theta has mean beta
  const beta = sum / n - (w * Math.PI * (n - 1)) / n;
  // a phase jump of order 1 between nodes means a zero of g within a node spacing of the
  // circle: log|g| is then nearly singular and the trapezoid rule only O(1/n) accurate
  return { lam: lam / n, beta, w, jump };
}

/**
 * Smallest q <= kmax with q (beta + e) = 2 pi n + m T for some |e| < tol, |m| <= mMax; 0 if none.
 * tol = 1e-7 asks for an exact relation; tol = half a pixel's spread of beta asks
 * whether the relation line passes through the pixel. cmax bounds q + |m|.
 */
export function latticeOrder(beta, T, kmax, mMax = 60, tol = 1e-7, cmax = Infinity) {
  for (let q = 1; q <= kmax; q++) {
    const mm = Math.min(mMax, cmax - q);
    for (let m = -mm; m <= mm; m++) {
      const x = q * beta - m * T;
      if (Math.abs(x - TWO_PI * Math.round(x / TWO_PI)) < q * tol) return q;
    }
  }
  return 0;
}

/**
 * Classify one plane pixel of a linear cocycle exactly.
 * fills: [{fill, M}] coarse to fine grid fills on the base circle.
 * Returns {esc, lam, k} in the format of planeTask:
 *   esc >= 0  orbit leaves every bounded set (value ~ log-time to escape),
 *   lam       Lyapunov exponent (exact),
 *   k         number of invariant curves for a neutral cocycle (0 = dense annulus).
 */
export function cocyclePixel(fills, u, v, kind, T, kmax, buf) {
  let r = null;
  for (let level = 0; level < fills.length; level++) {
    const { fill, M } = fills[level];
    if (!buf[level]) buf[level] = { zR: new Float64Array(M), zI: new Float64Array(M), NR: new Float64Array(M), NI: new Float64Array(M), DR: new Float64Array(M), DI: new Float64Array(M) };
    const b = buf[level];
    fill(u, v, b.zR, b.zI, 0, b.NR, b.NI, b.DR, b.DI, 0, M);
    if (kind === 'add') {
      let mr = 0, mi = 0, hr = 0, hi = 0;
      for (let m = 0; m < M; m++) { mr += b.NR[m]; mi += b.NI[m]; if (m % 2 === 0) { hr += b.NR[m]; hi += b.NI[m]; } }
      mr /= M; mi /= M; hr /= M / 2; hi /= M / 2;
      r = { drift: Math.hypot(mr, mi), err: Math.hypot(mr - hr, mi - hi) };
      if (!(r.err > 1e-11) || level === fills.length - 1) break;
      continue;
    }
    const full = logMean(b.DR, b.DI, M, 1), half = logMean(b.DR, b.DI, M, 2);
    if (!full || !half) { r = null; break; }
    const errL = Math.max(Math.abs(full.lam - half.lam), full.jump > 1 ? TWO_PI / M : 0);
    // beta only matters without winding (with winding there are no invariant curves)
    const err = half.w !== full.w ? Infinity : full.w !== 0 ? errL : Math.max(errL, Math.abs(full.beta - half.beta));
    r = { ...full, err, errL };
    // far from the cramped band a rough lambda decides the pixel already
    if (err < 1e-10 || Math.abs(full.lam) > 0.01 + 3 * errL) break;
    // with winding there are no curves to resolve: lambda to 1e-7 decides the pixel
    if (full.w !== 0 && half.w === full.w && errL < 1e-7) break;
  }
  if (kind === 'add') {
    // F = f + L: lambda = 0; mean L != 0 means linear drift to infinity
    // a singularity of L on the grid (e.g. log 0): measure zero, the mean drift is generically nonzero
    if (!Number.isFinite(r.drift)) return { esc: 1, lam: 0, k: -1 };
    if (r.drift > 1e-9 + 10 * r.err) return { esc: Math.min(1e4, 1 / r.drift), lam: 0, k: -1 };
    return { esc: -1, lam: 0, k: 1 };
  }
  if (!r) return { esc: 1, lam: NaN, k: -1 }; // g is not finite on the circle (a pole)
  const { lam, beta, w, err, errL } = r;
  if (lam > 0.005 + 3 * errL) return { esc: Math.log(1e8) / lam, lam, k: -1 }; // |z_n| ~ e^{lam n}
  if (lam < -0.005 - 3 * errL) return { esc: -1, lam, k: 1 }; // the zero graph attracts
  // unresolved (g vanishes on or near the circle): lambda is zero within the error,
  // and log g has no continuous periodic branch, so no invariant curves
  if (!(errL < 1e-6)) return { esc: -1, lam: 0, k: 0 };
  // cramped band: invariant curves need lambda = 0 exactly, w = 0 and a lattice relation
  const exact = Math.abs(lam) < Math.max(1e-9, 10 * err) && w === 0 && err < 1e-8;
  const k = exact ? latticeOrder(beta, T, kmax) : 0;
  return { esc: -1, lam, k, beta, exact };
}

// ---------------------------------------------------------------- the tangent cocycle
/**
 * The tangent (linearised) cocycle of an invariant structure found by Newton. A perturbation
 * evolves by δ_{j+1}(φ + τ_j) = D_j(φ)·δ_j(φ) with D_j = ∂F/∂f(f_j(φ), φ), τ_j = T (τ_{c−1} =
 * T + 2πs). Over one return through the c components it is the multiplicative cocycle
 * W(φ) = Π_j D_j(φ + jT) on the cover circle φ ∈ [0, 2πd), rotated by cT + 2πs; in ϑ = φ/d
 * that is a cocycle over the rotation T' = (cT + 2πs)/d, analysed by cocycleCore.
 * When W reduces to a constant (winding 0, ψ resolved), e^{λ+iβ} is the fibred multiplier:
 * |·| = e^λ per return, and its angle β is the forced analogue of a fixed point's internal
 * angle. For F = g(x)·f the tangent cocycle is g itself (the linear case of the Cocycle tab).
 *
 * Inputs: D (DR, DI) and the solution F (FR, FI) and F(f) (NR, NI) on the solver grid,
 * c·M values, M points per component over [0, 2πd).
 */
export function tangentCocycle({ DR, DI, NR, NI, FR, FI, c, d, s, M, T, lambdaStep = null }) {
  // spectral shift on the cover: frequency k/d per unit φ
  const shift = (srcR, srcI, off, tau) => {
    const wr = new Float64Array(M), wi = new Float64Array(M);
    for (let m = 0; m < M; m++) { wr[m] = srcR[off + m]; wi[m] = srcI[off + m]; }
    if (tau !== 0) {
      fft(wr, wi);
      for (let m = 0; m < M; m++) {
        const f = (m < M / 2 ? m : m - M) / d;
        const cr = Math.cos(f * tau), ci = Math.sin(f * tau);
        const r = wr[m] * cr - wi[m] * ci;
        wi[m] = wr[m] * ci + wi[m] * cr;
        wr[m] = r;
      }
      fft(wr, wi, true);
    }
    return [wr, wi];
  };
  const Wr = new Float64Array(M).fill(1), Wi = new Float64Array(M);
  for (let j = 0; j < c; j++) {
    const [ar, ai] = shift(DR, DI, j * M, j * T);
    for (let m = 0; m < M; m++) {
      const r = Wr[m] * ar[m] - Wi[m] * ai[m];
      Wi[m] = Wr[m] * ai[m] + Wi[m] * ar[m];
      Wr[m] = r;
    }
  }
  const Tret = (c * T + TWO_PI * s) / d;
  const core = cocycleCore(Wr, Wi, M, Tret, 'mult');
  const { muR, muI, winding, relation, nearest, pmax, ptail } = core;
  const lam = lambdaStep != null && Number.isFinite(lambdaStep) ? lambdaStep * c : muR; // the solver's λ is singularity-corrected
  const beta = muI - TWO_PI * Math.round(muI / TWO_PI); // in (−π, π]
  const mult = [Math.exp(lam) * Math.cos(beta), Math.exp(lam) * Math.sin(beta)];
  // the coboundary check: g = f(φ+τ)/f(φ) = F(f)/f along the cycle has mean log|g| = 0 exactly
  let gsum = 0, gn = 0;
  for (let k = 0; k < c * M; k++) {
    const a = Math.hypot(NR[k], NI[k]), b = Math.hypot(FR[k], FI[k]);
    if (a > 0 && b > 0) { gsum += Math.log(a / b); gn++; }
  }
  const gCheck = gn ? gsum / M : NaN; // summed over the c components = per return
  // the curve W(ϑ), at most 512 points, for plotting
  const step = Math.max(1, Math.floor(M / 512));
  const cr = [], ci = [];
  for (let m = 0; m <= M; m += step) { cr.push(Wr[m % M]); ci.push(Wi[m % M]); }
  // what the multiplier says
  const per = c > 1 || d > 1 ? ' per return (one pass through all sheets)' : '';
  const a2 = (((beta / TWO_PI) % 1) + 1) % 1; // internal angle in [0, 1), as for the Mandelbrot set
  // the closest simple internal angle p/q (q ≤ 8): where on the circle the multiplier points
  let pq = null;
  for (let q = 1; q <= 8; q++) {
    const p = Math.round(a2 * q);
    const e = Math.abs(a2 - p / q);
    if (!pq || e < pq.err - 1e-12) pq = { p, q, err: e };
  }
  let regime;
  if (winding !== 0) {
    regime = `The tangent cocycle winds ${winding} time${Math.abs(winding) > 1 ? 's' : ''} around 0, so it does not reduce to a constant: perturbations are stretched by e^λ = ${Math.exp(lam).toPrecision(5)}${per} but have no mean rotation. (For analytic forcing this happens when the graph's power series has zeros inside the disc, as in Jensen's formula.)`;
  } else {
    const angle = pq.err < 0.02 ? ` The angle is close to ${pq.p}/${pq.q}.` : '';
    regime = `The linearisation reduces to the constant multiplier μ = e^{λ+iβ} = ${fmtC(mult[0], mult[1])}${per}: perturbations shrink by |μ| = ${Math.exp(lam).toPrecision(5)} and turn by the internal angle β/2π = ${a2.toFixed(6)} each time.${angle} At the edge of the component |μ| → 1, and the angle says what happens there: β ≈ 0 a fold, β ≈ π a doubling, β/2π ≈ p/q (shifted by multiples of the rotation) a q-sheet bulb.`;
  }
  return {
    kind: 'tangent', c, d, s, Tret, lambda: lam, lambdaStep: lam / c, beta, winding, multiplier: mult, internalAngle: a2, closestPQ: pq, M,
    relation, nearest, regime, gCheck,
    divisors: core.divisors.slice(0, 6),
    spectrum: { Lamp: core.Lamp, Pamp: core.Pamp, Damp: core.Damp },
    psiTail: pmax > 0 ? ptail / pmax : 0,
    curve: { re: Float32Array.from(cr), im: Float32Array.from(ci) },
  };
}
