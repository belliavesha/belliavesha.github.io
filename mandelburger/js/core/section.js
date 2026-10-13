// Sections of the attractor by the fibre θ = θ*: which recorded orbit points have their base
// angle θ_n = nT mod 2π within ±w of θ*. The angles are the same for every parameter, so the
// selection is computed once and applied to every column of a slice.

const TWO_PI = 2 * Math.PI;

/** Circular distance on [0, 2π). */
export function cdist(a, b) {
  const d = Math.abs(a - b) % TWO_PI;
  return Math.min(d, TWO_PI - d);
}

/**
 * Indices into `theta` (oldest first) within ±w of thetaStar, newest first.
 * Returns {idx, inWindow}: idx holds at most `cap` indices; inWindow counts all of them.
 */
export function sectionIndices(theta, thetaStar, w, cap = Infinity) {
  const idx = [];
  let inWindow = 0;
  for (let k = theta.length - 1; k >= 0; k--) {
    if (cdist(theta[k], thetaStar) <= w) {
      inWindow++;
      if (idx.length < cap) idx.push(k);
    }
  }
  return { idx, inWindow };
}

/** Base angles of recorded points n0, n0+1, … (n0 + len − 1) for rotation number T. */
export function recordAngles(n0, len, T) {
  const th = new Float64Array(len);
  for (let k = 0; k < len; k++) th[k] = ((n0 + k) * T) % TWO_PI;
  return th;
}
