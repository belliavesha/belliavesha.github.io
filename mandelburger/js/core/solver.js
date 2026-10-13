// Newton–Krylov solver for invariant sheet structures of
//      Phi(theta, z) = (theta + T, F(z, theta)).
//
// A structure (c, d, s) is c components F_0..F_{c-1}, each a function on the
// d-fold cover circle  phi in R / 2 pi d Z  (so k = c d sheets over theta),
// permuted by the map as
//      F_{j+1}(phi + T)            = F(F_j(phi), phi),   j < c-1
//      F_0   (phi + T + 2 pi s)    = F(F_{c-1}(phi), phi)
// (k = 1: c = d = 1, s = 0 is the plain functional equation f(x+T) = F(f(x), x).)
//
// Unknowns are sampled on M equispaced points per component; the shift by tau
// is the Fourier multiplier e^{i omega tau}, omega = m/d (spectral accuracy).
// The Newton step solves  J delta = -R  with
//      (J delta)_j = S_{tau_j} delta_{j+1} - D_j delta_j,   D_j = dF/df (F_j, phi),
// by GMRES on one of two preconditioned forms (see MATH.md §6):
//      attracting  (lambda < 0):  (I - U^{-1} D) delta = U^{-1}(-R)
//      repelling   (lambda > 0):  (I - D^{-1} U) delta = D^{-1} R
// The transfer operator U^{-1}D is a weighted shift over an irrational rotation;
// its spectrum is the circle |z| = e^{lambda}, so the first form is a
// contraction-perturbed identity exactly when the structure is attracting.

import { fft } from './fft.js';

const TWO_PI = 2 * Math.PI;

export class StructureProblem {
  /**
   * @param {object} o
   * @param {number} o.c,o.d,o.s  structure
   * @param {number} o.M          grid points per component (power of two)
   * @param {number} o.T          rotation
   * @param {Function} o.fill     fill(u, v, zR, zI, off, NR, NI, DR, DI, outOff, M):
   *                              F and dF/df on the cover grid phi_m = 2 pi d m / M
   * @param {number} o.u,o.v      parameter-plane coordinates passed to fill
   */
  constructor({ c, d, s, M, T, fill, u = 0, v = 0 }) {
    Object.assign(this, { c, d, s, M, T, fill, u, v });
    this.n = c * M; // complex unknowns
    const taus = [];
    for (let j = 0; j < c; j++) taus.push(j < c - 1 ? T : T + TWO_PI * s);
    this.taus = taus;
    this.mulF = taus.map((tau) => this.#multiplier(tau));
    this.mulB = taus.map((tau) => this.#multiplier(-tau));
    this.wr = new Float64Array(M);
    this.wi = new Float64Array(M);
    // F(z) and dF/df at the current unknowns
    this.NR = new Float64Array(this.n); this.NI = new Float64Array(this.n);
    this.DR = new Float64Array(this.n); this.DI = new Float64Array(this.n);
  }

  #multiplier(tau) {
    const { M, d } = this;
    const re = new Float64Array(M), im = new Float64Array(M);
    for (let m = 0; m < M; m++) {
      const w = (m < M / 2 ? m : m - M) / d;
      re[m] = Math.cos(w * tau);
      im[m] = Math.sin(w * tau);
    }
    return { re, im };
  }

  /** dst[dOff..] = S_tau src[sOff..] using multiplier table mul. */
  shift(srcR, srcI, sOff, mul, dstR, dstI, dOff) {
    const { M, wr, wi } = this;
    for (let m = 0; m < M; m++) { wr[m] = srcR[sOff + m]; wi[m] = srcI[sOff + m]; }
    fft(wr, wi, false);
    const mr = mul.re, mi = mul.im;
    for (let m = 0; m < M; m++) {
      const r = wr[m] * mr[m] - wi[m] * mi[m];
      wi[m] = wr[m] * mi[m] + wi[m] * mr[m];
      wr[m] = r;
    }
    fft(wr, wi, true);
    for (let m = 0; m < M; m++) { dstR[dOff + m] = wr[m]; dstI[dOff + m] = wi[m]; }
  }

  /** Evaluate F and dF/df at the unknowns into NR/NI, DR/DI. */
  evalRHS(FR, FI) {
    const { c, M } = this;
    for (let j = 0; j < c; j++) this.fill(this.u, this.v, FR, FI, j * M, this.NR, this.NI, this.DR, this.DI, j * M, M);
  }

  residual(FR, FI, RR, RI) {
    const { c, M } = this;
    this.evalRHS(FR, FI);
    for (let j = 0; j < c; j++) {
      const jn = (j + 1) % c;
      this.shift(FR, FI, jn * M, this.mulF[j], RR, RI, j * M);
    }
    for (let k = 0; k < this.n; k++) { RR[k] -= this.NR[k]; RI[k] -= this.NI[k]; }
  }

  /**
   * Fibre Lyapunov exponent: mean of log|dF/df| over all sheets (evaluate at FR, FI).
   * D = dF/df(F(phi), phi) is analytic, but log|D| has logarithmic singularities
   * where a real D crosses zero (the graph passes through a critical point), so a
   * plain grid mean converges only like O(h). We upsample D spectrally (x8), locate
   * its sign changes, and subtract  sum_z log|2 sin((phi - phi_z) / 2d)|,  whose
   * mean over the cover circle is exactly 0. The remainder is smooth, so its grid
   * mean is spectrally accurate.
   */
  lyapunovFine(FR, FI, up = 8) {
    this.evalRHS(FR, FI);
    const { M, c, d, DR, DI } = this;
    const L = M * up;
    const h = (2 * Math.PI * d) / L;
    const wr = new Float64Array(M), wi = new Float64Array(M);
    const ur = new Float64Array(L), ui = new Float64Array(L);
    let acc = 0;
    for (let j = 0; j < c; j++) {
      for (let m = 0; m < M; m++) { wr[m] = DR[j * M + m]; wi[m] = DI[j * M + m]; }
      fft(wr, wi);
      ur.fill(0); ui.fill(0);
      for (let m = 0; m < M; m++) {
        const f = m < M / 2 ? m : m - M;
        if (2 * Math.abs(f) === M) continue;
        const t = f >= 0 ? f : L + f;
        ur[t] = wr[m] * up; ui[t] = wi[m] * up;
      }
      fft(ur, ui, true);
      let maxR = 0, maxI = 0;
      for (let k = 0; k < L; k++) { maxR = Math.max(maxR, Math.abs(ur[k])); maxI = Math.max(maxI, Math.abs(ui[k])); }
      const zeros = [];
      if (maxI <= 1e-6 * maxR) {
        for (let k = 0; k < L; k++) {
          const k1 = (k + 1) % L;
          if (ur[k] === 0 || ur[k] * ur[k1] < 0) {
            // cubic Lagrange through k-1..k+2, then regula falsi on it
            const y = [-1, 0, 1, 2].map((o) => ur[(k + o + L) % L]);
            const P3 = (t) => {
              const [a, b, cc, dd] = y;
              return (-a * t * (t - 1) * (t - 2)) / 6 + (b * (t + 1) * (t - 1) * (t - 2)) / 2
                - (cc * (t + 1) * t * (t - 2)) / 2 + (dd * (t + 1) * t * (t - 1)) / 6;
            };
            let t0 = 0, t1 = 1, f0 = P3(0), f1 = P3(1);
            let t = f0 === 0 ? 0 : f0 / (f0 - f1);
            for (let it = 0; it < 30; it++) {
              const ft = P3(t);
              if (ft === 0) break;
              if (ft * f0 < 0) { t1 = t; f1 = ft; } else { t0 = t; f0 = ft; }
              const tn = t0 + (f0 / (f0 - f1)) * (t1 - t0);
              if (Math.abs(tn - t) < 1e-15) { t = tn; break; }
              t = tn;
            }
            zeros.push((k + t) * h);
          }
        }
      }
      const half = 1 / (2 * d);
      const vals = new Float64Array(L);
      const bad = [];
      for (let k = 0; k < L; k++) {
        let v = 0.5 * Math.log(ur[k] * ur[k] + ui[k] * ui[k] + 1e-300);
        for (const z of zeros) {
          let dz = (k * h - z) % (2 * Math.PI * d);
          if (Math.abs(dz) < 1e-3 * h || Math.abs(Math.abs(dz) - 2 * Math.PI * d) < 1e-3 * h) bad.push(k);
          v -= Math.log(Math.abs(2 * Math.sin(dz * half)) + 1e-300);
        }
        vals[k] = v;
      }
      // a zero sitting (almost) on a grid point makes 0/0 there; the remainder is
      // smooth, so replace that sample by the mean of its neighbours
      for (const k of bad) vals[k] = 0.5 * (vals[(k + L - 1) % L] + vals[(k + 1) % L]);
      for (let k = 0; k < L; k++) acc += vals[k];
    }
    return acc / (c * L);
  }

  /** mean log|dF/df| on the grid (cheap; uses the last evalRHS) */
  lyapunovCoarse() {
    let acc = 0;
    for (let k = 0; k < this.n; k++) acc += Math.log(this.DR[k] * this.DR[k] + this.DI[k] * this.DI[k] + 1e-300);
    return (0.5 * acc) / this.n;
  }

  lyapunov(FR, FI) {
    this.evalRHS(FR, FI);
    return this.lyapunovCoarse();
  }
}

// ---------------------------------------------------------------- GMRES (real-ified)
// x, b are Float64Array(2n): [re(0..n-1), im(0..n-1)]
function dot(u, v) { let s = 0; for (let i = 0; i < u.length; i++) s += u[i] * v[i]; return s; }
function norm(u) { return Math.sqrt(dot(u, u)); }

export function gmres(apply, b, { restart = 40, maxIter = 600, tol = 1e-12, x0 = null } = {}) {
  const N = b.length;
  const x = x0 ? Float64Array.from(x0) : new Float64Array(N);
  const bn = norm(b) || 1;
  const r = new Float64Array(N);
  const tmp = new Float64Array(N);
  let iters = 0;
  let rel = 1;
  const V = [];
  for (let i = 0; i <= restart; i++) V.push(new Float64Array(N));
  const H = [];
  for (let i = 0; i <= restart; i++) H.push(new Float64Array(restart));
  const cs = new Float64Array(restart), sn = new Float64Array(restart), gv = new Float64Array(restart + 1);

  while (iters < maxIter) {
    apply(x, tmp);
    for (let i = 0; i < N; i++) r[i] = b[i] - tmp[i];
    let beta = norm(r);
    rel = beta / bn;
    if (rel < tol) break;
    for (let i = 0; i < N; i++) V[0][i] = r[i] / beta;
    gv.fill(0);
    gv[0] = beta;
    let j = 0;
    for (; j < restart && iters < maxIter; j++, iters++) {
      const w = V[j + 1];
      apply(V[j], w);
      for (let i = 0; i <= j; i++) {
        const h = dot(w, V[i]);
        H[i][j] = h;
        const vi = V[i];
        for (let t = 0; t < N; t++) w[t] -= h * vi[t];
      }
      const hn = norm(w);
      H[j + 1][j] = hn;
      if (hn > 0) for (let t = 0; t < N; t++) w[t] /= hn;
      for (let i = 0; i < j; i++) {
        const t1 = cs[i] * H[i][j] + sn[i] * H[i + 1][j];
        H[i + 1][j] = -sn[i] * H[i][j] + cs[i] * H[i + 1][j];
        H[i][j] = t1;
      }
      const den = Math.hypot(H[j][j], H[j + 1][j]) || 1e-300;
      cs[j] = H[j][j] / den;
      sn[j] = H[j + 1][j] / den;
      H[j][j] = den;
      H[j + 1][j] = 0;
      gv[j + 1] = -sn[j] * gv[j];
      gv[j] = cs[j] * gv[j];
      rel = Math.abs(gv[j + 1]) / bn;
      if (rel < tol || hn === 0) { j++; iters++; break; }
    }
    // back substitution
    const y = new Float64Array(j);
    for (let i = j - 1; i >= 0; i--) {
      let s = gv[i];
      for (let t = i + 1; t < j; t++) s -= H[i][t] * y[t];
      y[i] = s / H[i][i];
    }
    for (let i = 0; i < j; i++) {
      const vi = V[i];
      for (let t = 0; t < N; t++) x[t] += y[i] * vi[t];
    }
    if (rel < tol) break;
  }
  return { x, iters, rel };
}

// ---------------------------------------------------------------- Newton

/**
 * Solve the structure equations by damped Newton from initial guess (FR, FI).
 * Returns {FR, FI, ok, reason, newton, gmres, resid, lambda}.
 */
export function newtonSolve(P, FR0, FI0, opts = {}) {
  const { maxNewton = 30, tol = 1e-11, gmresTol = 1e-10, maxGmres = 800, restart = 40 } = opts;
  const n = P.n, M = P.M, c = P.c;
  let FR = Float64Array.from(FR0), FI = Float64Array.from(FI0);
  const RR = new Float64Array(n), RI = new Float64Array(n);
  const DR = new Float64Array(n), DI = new Float64Array(n);
  const b = new Float64Array(2 * n);
  P.evalRHS(FR, FI);
  const scale = Math.max(1, maxAbs(P.NR, P.NI));
  let totalGmres = 0;
  let resid = Infinity;
  let reason = 'max-iterations';
  const tR = new Float64Array(n), tI = new Float64Array(n);

  const evalRes = (fr, fi) => {
    P.residual(fr, fi, RR, RI);
    return maxAbs(RR, RI);
  };
  resid = evalRes(FR, FI);
  if (!Number.isFinite(resid)) return fail('non-finite initial guess');

  for (let it = 0; it < maxNewton; it++) {
    if (resid < tol * scale) {
      return done(it, 'converged');
    }
    // D = dF/df at the current iterate (evalRes above left it in P.DR/DI)
    let minD = Infinity;
    for (let k = 0; k < n; k++) {
      DR[k] = P.DR[k];
      DI[k] = P.DI[k];
      const m = DR[k] * DR[k] + DI[k] * DI[k];
      if (m < minD) minD = m;
    }
    const lam = P.lyapunovCoarse();
    const repelling = lam > 0 && minD > 1e-12;
    let apply;
    if (!repelling) {
      // b = U^{-1}(-R);  A delta = delta - U^{-1}(D delta)
      for (let j = 0; j < c; j++) {
        const jn = (j + 1) % c;
        for (let m = 0; m < M; m++) { tR[j * M + m] = -RR[j * M + m]; tI[j * M + m] = -RI[j * M + m]; }
        P.shift(tR, tI, j * M, P.mulB[j], bView(b, n, 0), bView(b, n, 1), jn * M);
      }
      apply = (x, y) => {
        const xr = x.subarray(0, n), xi = x.subarray(n);
        for (let k = 0; k < n; k++) {
          tR[k] = DR[k] * xr[k] - DI[k] * xi[k];
          tI[k] = DR[k] * xi[k] + DI[k] * xr[k];
        }
        const yr = y.subarray(0, n), yi = y.subarray(n);
        for (let j = 0; j < c; j++) P.shift(tR, tI, j * M, P.mulB[j], yr, yi, ((j + 1) % c) * M);
        for (let k = 0; k < n; k++) { yr[k] = xr[k] - yr[k]; yi[k] = xi[k] - yi[k]; }
      };
    } else {
      // b = D^{-1} R;  A delta = delta - D^{-1} U delta
      for (let k = 0; k < n; k++) {
        const m = DR[k] * DR[k] + DI[k] * DI[k];
        b[k] = (RR[k] * DR[k] + RI[k] * DI[k]) / m;
        b[n + k] = (RI[k] * DR[k] - RR[k] * DI[k]) / m;
      }
      apply = (x, y) => {
        const xr = x.subarray(0, n), xi = x.subarray(n);
        for (let j = 0; j < c; j++) P.shift(xr, xi, ((j + 1) % c) * M, P.mulF[j], tR, tI, j * M);
        const yr = y.subarray(0, n), yi = y.subarray(n);
        for (let k = 0; k < n; k++) {
          const m = DR[k] * DR[k] + DI[k] * DI[k];
          const qr = (tR[k] * DR[k] + tI[k] * DI[k]) / m;
          const qi = (tI[k] * DR[k] - tR[k] * DI[k]) / m;
          yr[k] = xr[k] - qr;
          yi[k] = xi[k] - qi;
        }
      };
    }
    // inexact Newton (Eisenstat–Walker style forcing term): solve loosely while far away
    const eta = Math.max(gmresTol, Math.min(1e-2, (1e-2 * resid) / scale));
    const g = gmres(apply, b, { tol: eta, maxIter: maxGmres, restart });
    totalGmres += g.iters;
    // damped update
    let alpha = 1;
    let accepted = false;
    const NR = new Float64Array(n), NI = new Float64Array(n);
    for (let ls = 0; ls < 8; ls++) {
      for (let k = 0; k < n; k++) { NR[k] = FR[k] + alpha * g.x[k]; NI[k] = FI[k] + alpha * g.x[n + k]; }
      const r2 = evalRes(NR, NI);
      if (Number.isFinite(r2) && (r2 < resid || r2 < tol * scale)) {
        FR = NR; FI = NI; resid = r2; accepted = true;
        break;
      }
      alpha /= 2;
    }
    if (accepted) evalRes(FR, FI); // keep P.DR/DI in sync with the accepted iterate
    if (!accepted) {
      resid = evalRes(FR, FI);
      if (resid < 1e-8 * scale) return done(it, 'converged (round-off limited)');
      return fail(g.rel > 1e-3 ? 'linear solve failed (Jacobian near singular)' : 'Newton stalled');
    }
    if (maxAbs(FR, FI) > 1e8) return fail('solution blew up');
    if (it === maxNewton - 1) reason = 'max-iterations';
  }
  if (resid < tol * scale * 10) return done(maxNewton, 'converged');
  return fail(reason);

  function done(it, why) {
    return { FR, FI, ok: true, reason: why, newton: it, gmres: totalGmres, resid, lambda: P.lyapunovFine(FR, FI) };
  }
  function fail(why) {
    return { FR, FI, ok: false, reason: why, newton: maxNewton, gmres: totalGmres, resid, lambda: P.lyapunov(FR, FI) };
  }
}

function bView(b, n, part) { return part === 0 ? b.subarray(0, n) : b.subarray(n); }

export function maxAbs(R, I) {
  let m = 0;
  for (let k = 0; k < R.length; k++) {
    const v = R[k] * R[k] + I[k] * I[k];
    if (!(v <= m)) m = v; // NaN propagates
  }
  return Math.sqrt(m);
}

/**
 * Fourier diagnostics of a solution: amplitude per |omega| (max over components),
 * decay rate rho (|F_omega| ~ e^{-rho |omega|} => analytic in a strip of width rho)
 * and the fraction of amplitude in the top quarter of the band (resolution check).
 */
export function spectrum(P, FR, FI) {
  const { M, c, d } = P;
  const half = M / 2;
  const amp = new Float64Array(half);
  const wr = new Float64Array(M), wi = new Float64Array(M);
  for (let j = 0; j < c; j++) {
    for (let m = 0; m < M; m++) { wr[m] = FR[j * M + m]; wi[m] = FI[j * M + m]; }
    fft(wr, wi);
    for (let m = 0; m < M; m++) {
      const f = m < half ? m : M - m;
      if (f >= half) continue;
      const a = Math.hypot(wr[m], wi[m]) / M;
      if (a > amp[f]) amp[f] = a;
    }
  }
  const omega = new Float64Array(half);
  for (let f = 0; f < half; f++) omega[f] = f / d;
  let amax = 0;
  for (let f = 1; f < half; f++) amax = Math.max(amax, amp[f]);
  let tail = 0;
  for (let f = Math.floor((3 * half) / 4); f < half; f++) tail = Math.max(tail, amp[f]);
  // fit log amp vs omega above the round-off floor
  const floor = Math.max(1e-14 * Math.max(amax, amp[0]), 1e-300);
  const xs = [], ys = [];
  for (let f = 1; f < half; f++) if (amp[f] > floor * 10) { xs.push(omega[f]); ys.push(Math.log(amp[f])); }
  let rho = NaN;
  if (xs.length > 6) {
    // fit the upper envelope on the second half of the resolved band
    const lo = Math.floor(xs.length / 3);
    const X = xs.slice(lo), Y = ys.slice(lo);
    const mx = X.reduce((a, b) => a + b, 0) / X.length, my = Y.reduce((a, b) => a + b, 0) / Y.length;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < X.length; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; }
    rho = sxx > 0 ? -sxy / sxx : NaN;
  }
  return { omega, amp, rho, tailRatio: amax > 0 ? tail / amax : 0 };
}

/** Graph-transform iteration F <- S_{-T}(F(F, phi)) for the k = 1 structure. */
export function graphTransform(P, FR, FI, steps) {
  for (let it = 0; it < steps; it++) {
    P.evalRHS(FR, FI);
    P.shift(P.NR, P.NI, 0, P.mulB[0], FR, FI, 0);
    lowpass(FR, FI, 2 / 3);
    if (!(maxAbs(FR, FI) < 1e8)) return false;
  }
  return true;
}

/** Zero all Fourier modes with |m| > frac * M/2 (2/3-rule dealiasing). */
export function lowpass(FR, FI, frac) {
  const M = FR.length;
  const wr = Float64Array.from(FR), wi = Float64Array.from(FI);
  fft(wr, wi);
  const cut = Math.floor((frac * M) / 2);
  for (let m = 0; m < M; m++) {
    const f = m < M / 2 ? m : M - m;
    if (f > cut) { wr[m] = 0; wi[m] = 0; }
  }
  fft(wr, wi, true);
  FR.set(wr); FI.set(wi);
}
