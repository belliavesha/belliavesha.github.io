// Paths drawn on the parameter plane — slices (lines, polylines, freehand traces) and traced borders — that a click
// snaps to and that the "Move along" slider walks. Points are parameter coordinates [u, v];
// a path is parametrised by arc length, t in [0, 1].

/** Every slice and every border with at least two resolved rays. */
export function overlayPaths(slices, borders) {
  const out = [];
  for (const sl of slices) out.push({ id: sl.id, label: sl.label, pts: sl.pts, closed: false, kind: sl.kind });
  borders.forEach((b, i) => {
    if (b.sliceId) return; // already listed as its slice
    const pts = [...b.rays]
      .filter((r) => r.type !== 'none' && Number.isFinite(r.r))
      .sort((p, q) => p.angle - q.angle)
      .map((r) => [b.center[0] + r.r * Math.cos(r.angle), b.center[1] + r.r * Math.sin(r.angle)]);
    if (pts.length >= 2) out.push({ id: `border${i}`, label: borders.length > 1 ? `border ${i + 1}` : 'border', pts, closed: !!b.complete });
  });
  return out;
}

/** Arc-length fractions t of the path's vertices (for marking polyline corners). */
export function vertexTs(path) {
  const { len, total } = lengths(path);
  const ts = [0];
  let acc = 0;
  for (const l of len) { acc += l; ts.push(acc / total); }
  return ts;
}

/**
 * A freehand cursor trail (screen points [x, y]) turned into a smooth polyline: resampled
 * every `step` px, smoothed by a Gaussian of width `sigma` px (endpoints kept), then
 * simplified (Ramer–Douglas–Peucker, tolerance `tol` px). Returns screen points.
 */
export function smoothTrail(trail, { step = 3, sigma = 6, tol = 0.6 } = {}) {
  if (trail.length < 2) return trail.slice();
  // resample by arc length
  const res = [trail[0]];
  let carry = 0;
  for (let i = 1; i < trail.length; i++) {
    const [ax, ay] = trail[i - 1], [bx, by] = trail[i];
    const d = Math.hypot(bx - ax, by - ay);
    let s = step - carry;
    while (s <= d) { const u = s / d; res.push([ax + u * (bx - ax), ay + u * (by - ay)]); s += step; }
    carry = d - (s - step);
  }
  const last = trail[trail.length - 1];
  if (Math.hypot(last[0] - res[res.length - 1][0], last[1] - res[res.length - 1][1]) > 1e-9) res.push(last);
  // Gaussian smoothing, window shrinking towards the ends so the endpoints stay put
  const n = res.length, h = Math.max(1, Math.round((2.5 * sigma) / step));
  const sm = res.map((p, i) => {
    const r = Math.min(h, i, n - 1 - i);
    if (r === 0) return p;
    let wx = 0, wy = 0, ws = 0;
    for (let j = -r; j <= r; j++) {
      const w = Math.exp(-0.5 * ((j * step) / sigma) ** 2);
      wx += w * res[i + j][0]; wy += w * res[i + j][1]; ws += w;
    }
    return [wx / ws, wy / ws];
  });
  return rdp(sm, tol);
}

function rdp(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let worst = -1, wd = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst >= 0 && wd > tol) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function segments(path) {
  const { pts, closed } = path;
  const s = [];
  for (let i = 0; i + 1 < pts.length; i++) s.push([pts[i], pts[i + 1]]);
  if (closed && pts.length > 2) s.push([pts[pts.length - 1], pts[0]]);
  return s;
}

function lengths(path) {
  const segs = segments(path);
  const len = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = len.reduce((x, y) => x + y, 0) || 1;
  return { segs, len, total };
}

/** Point at arc-length fraction t in [0, 1]. */
export function pointAt(path, t) {
  const { segs, len, total } = lengths(path);
  let s = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (s <= len[i] || i === segs.length - 1) {
      const u = len[i] > 0 ? Math.min(1, s / len[i]) : 0;
      const [a, b] = segs[i];
      return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])];
    }
    s -= len[i];
  }
  return [...path.pts[0]];
}

/**
 * Nearest point of the path to P, measured in screen pixels (toCss maps parameters to CSS px).
 * Returns {P, t, dist}.
 */
export function nearestOnPath(path, P, toCss) {
  const { segs, len, total } = lengths(path);
  const [px, py] = toCss(P);
  let best = null, acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i];
    const [ax, ay] = toCss(a), [bx, by] = toCss(b);
    const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
    const u = d2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / d2)) : 0;
    const dist = Math.hypot(ax + u * dx - px, ay + u * dy - py);
    if (!best || dist < best.dist) {
      best = { dist, t: (acc + u * len[i]) / total, P: [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])] };
    }
    acc += len[i];
  }
  return best;
}
