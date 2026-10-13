// Arithmetic of the rotation number alpha = T / 2pi.
//
// Continued fraction alpha = [a0; a1, a2, ...] and convergents p_j / q_j.
// q_j are the best return times of the rotation: theta_{n+q} - theta_n = q T
// is within delta_j = q_j T - 2 pi p_j of a full turn, with
// |delta_j| ~ 2 pi / q_{j+1}. Consecutive convergents satisfy
// p_{j+1} q_j - p_j q_{j+1} = ±1, i.e. (q_j, p_j), (q_{j+1}, p_{j+1}) is a basis
// of the lattice Z^2. That fact is what makes the branch counter in orbit.js
// exact (see MATH.md §5).

const TWO_PI = 2 * Math.PI;

export function continuedFraction(x, maxTerms = 24) {
  const terms = [];
  let v = x;
  for (let i = 0; i < maxTerms; i++) {
    const a = Math.floor(v);
    terms.push(a);
    const frac = v - a;
    if (frac < 1e-11) break;
    v = 1 / frac;
    if (!Number.isFinite(v) || v > 1e12) break;
  }
  return terms;
}

/** Convergents of T/2pi with their return defects delta = qT - 2 pi p. */
export function convergents(T, maxTerms = 24) {
  const alpha = T / TWO_PI;
  const a = continuedFraction(alpha, maxTerms);
  const out = [];
  let pPrev = 1, qPrev = 0, p = a[0], q = 1;
  out.push({ a: a[0], p, q, delta: q * T - TWO_PI * p });
  for (let i = 1; i < a.length; i++) {
    const pn = a[i] * p + pPrev, qn = a[i] * q + qPrev;
    pPrev = p; qPrev = q; p = pn; q = qn;
    if (q > 1e9) break;
    out.push({ a: a[i], p, q, delta: q * T - TWO_PI * p });
  }
  // a terminating expansion with a small last denominator means T/2pi is (numerically) rational
  const lastQ = out[out.length - 1].q;
  const rational = a.length < maxTerms && Math.abs(out[out.length - 1].delta) < 1e-9 && lastQ < 1e5;
  return { terms: a, list: out, rational };
}

/**
 * Pick two consecutive convergent denominators (qA, qB) used as near-return
 * times by the branch counter. Wants kmax*|delta_A| <= target (so that
 * z_{n + m qA} is a close neighbour of z_n in theta for every m <= kmax)
 * subject to the memory budget kmax*qB <= budget.
 */
export function chooseReturnPair(T, kmax, budget, target = 0.05) {
  const { list, rational } = convergents(T);
  let best = null;
  for (let j = 0; j + 1 < list.length; j++) {
    const A = list[j], B = list[j + 1];
    if (A.q < 1) continue;
    if (kmax * B.q > budget) break;
    best = { qA: A.q, qB: B.q, dA: A.delta, dB: B.delta, pA: A.p, pB: B.p };
    if (kmax * Math.abs(A.delta) <= target) break;
  }
  if (!best) {
    // rotation is (nearly) rational with a tiny denominator, or budget tiny
    const A = list[0], B = list[1] || { q: 1, p: 0, delta: 0 };
    best = { qA: A.q, qB: B.q, dA: A.delta, dB: B.delta, pA: A.p, pB: B.p };
  }
  best.rational = rational;
  return best;
}

export function formatCF(terms, max = 12) {
  if (!terms.length) return '';
  const rest = terms.slice(1, max);
  return `[${terms[0]}; ${rest.join(', ')}${terms.length > max ? ', …' : ''}]`;
}
