// Sheet-structure detection from an orbit, and Newton seeds.
//
// Given orbit points z_n at absolute times n (base angle nT), a candidate
// structure (c, d, s) assigns each point a component j = n mod c and a cover
// coordinate  phi_n = nT + 2 pi s floor(n / c)  (mod 2 pi d).  If the attractor
// really is that structure, z is a continuous function of (j, phi), so binning
// phi finely leaves almost no variance inside bins. The score is
//      within-bin variance / total variance.
// Finer structures always fit at least as well, so we take the smallest k = c d
// whose score is below the threshold.

const TWO_PI = 2 * Math.PI;

export function candidateStructures(kmax) {
  const out = [];
  for (let k = 1; k <= kmax; k++) {
    for (let c = 1; c <= k; c++) {
      if (k % c) continue;
      const d = k / c;
      for (let s = 0; s < d; s++) {
        // for d > 1 the cover must be connected under the dynamics:
        // gcd(s, d) = 1 is required when c = 1; allow all s otherwise
        out.push({ c, d, s, k });
      }
    }
  }
  return out;
}

function coverCoord(nAbs, T, c, d, s) {
  const L = TWO_PI * d;
  let phi = (nAbs * T + TWO_PI * s * Math.floor(nAbs / c)) % L;
  if (phi < 0) phi += L;
  return phi;
}

/**
 * Score one structure; bins per base circle = B. Inside each bin z is fitted by
 * a straight line in phi (local linear regression), so a smooth sheet leaves a
 * residual of order (f'' h^2)^2 instead of (f' h)^2 — this keeps steep but smooth
 * graphs from being mistaken for multi-sheet ones.
 */
export function scoreStructure(zr, zi, n0, len, T, st, B) {
  const { c, d, s } = st;
  const nb = B * d;
  const nbin = c * nb;
  const L = TWO_PI * d;
  const w = L / nb;
  // per bin: n, St, Stt, Sz (re,im), Szt (re,im), Szz
  const A = new Float64Array(nbin * 8);
  let mr = 0, mi = 0;
  for (let k = 0; k < len; k++) { mr += zr[k]; mi += zi[k]; }
  mr /= len; mi /= len;
  let tot = 0;
  for (let k = 0; k < len; k++) {
    const n = n0 + k;
    const j = n % c;
    const phi = coverCoord(n, T, c, d, s);
    const bi = Math.min(nb - 1, Math.floor(phi / w));
    const t = phi / w - bi - 0.5; // in [-1/2, 1/2)
    const o = (j * nb + bi) * 8;
    const xr = zr[k] - mr, xi = zi[k] - mi;
    A[o] += 1; A[o + 1] += t; A[o + 2] += t * t;
    A[o + 3] += xr; A[o + 4] += xi; A[o + 5] += xr * t; A[o + 6] += xi * t;
    A[o + 7] += xr * xr + xi * xi;
    tot += xr * xr + xi * xi;
  }
  let within = 0;
  for (let b = 0; b < nbin; b++) {
    const o = b * 8;
    const n = A[o];
    if (n === 0) continue;
    if (n < 3) { within += A[o + 7] - (A[o + 3] ** 2 + A[o + 4] ** 2) / n; continue; }
    const St = A[o + 1], Stt = A[o + 2];
    const det = n * Stt - St * St;
    if (det <= 1e-12 * n * n) { within += A[o + 7] - (A[o + 3] ** 2 + A[o + 4] ** 2) / n; continue; }
    // explained SS = [Sz Szt] inv([[n St][St Stt]]) [Sz Szt]^T, per real component
    const expl = (Sz, Szt) => (Stt * Sz * Sz - 2 * St * Sz * Szt + n * Szt * Szt) / det;
    within += A[o + 7] - expl(A[o + 3], A[o + 5]) - expl(A[o + 4], A[o + 6]);
  }
  return tot > 1e-24 ? Math.max(0, within) / tot : 0;
}

export function detectStructure(zr, zi, n0, len, T, { kmax = 4, B = 256, thr = 1e-3 } = {}) {
  const cands = candidateStructures(kmax).map((st) => ({ ...st, score: scoreStructure(zr, zi, n0, len, T, st, B) }));
  let chosen = null;
  for (const cd of cands) {
    if (cd.score < thr && (!chosen || cd.k < chosen.k || (cd.k === chosen.k && cd.score < chosen.score))) chosen = cd;
  }
  return { candidates: cands, chosen };
}

/**
 * Newton seed for structure st on an M-point grid per component: nearest-grid
 * binning of the orbit, empty bins filled by circular linear interpolation.
 */
export function seedFromOrbit(zr, zi, n0, len, T, st, M) {
  const { c, d, s } = st;
  const L = TWO_PI * d;
  const n = c * M;
  const sr = new Float64Array(n), si = new Float64Array(n), cnt = new Float64Array(n);
  for (let k = 0; k < len; k++) {
    const t = n0 + k;
    const j = t % c;
    const phi = coverCoord(t, T, c, d, s);
    const m = Math.round((phi / L) * M) % M;
    const b = j * M + m;
    sr[b] += zr[k]; si[b] += zi[k]; cnt[b]++;
  }
  const FR = new Float64Array(n), FI = new Float64Array(n);
  for (let j = 0; j < c; j++) {
    const off = j * M;
    const filled = [];
    for (let m = 0; m < M; m++) {
      if (cnt[off + m] > 0) {
        FR[off + m] = sr[off + m] / cnt[off + m];
        FI[off + m] = si[off + m] / cnt[off + m];
        filled.push(m);
      }
    }
    if (!filled.length) continue;
    for (let q = 0; q < filled.length; q++) {
      const m0 = filled[q], m1 = filled[(q + 1) % filled.length];
      const gap = (m1 - m0 + M) % M || M;
      for (let t = 1; t < gap; t++) {
        const w = t / gap;
        const m = (m0 + t) % M;
        FR[off + m] = (1 - w) * FR[off + m0] + w * FR[off + m1];
        FI[off + m] = (1 - w) * FI[off + m0] + w * FI[off + m1];
      }
    }
  }
  return { FR, FI };
}

export function describeStructure({ c, d, s }) {
  const k = c * d;
  if (k === 1) return 'one smooth invariant graph';
  if (d === 1) return `${c} graphs, cyclically permuted by the map`;
  if (c === 1) return `one curve winding ${d}× around θ (connected ${d}-fold cover, shift s=${s})`;
  return `${c} curves, each winding ${d}× around θ (s=${s})`;
}
