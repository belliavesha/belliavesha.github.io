// Paths drawn on the parameter plane — the slice segment and traced borders — that a click
// snaps to and that the "Move along" slider walks. Points are parameter coordinates [u, v];
// a path is parametrised by arc length, t in [0, 1].

/** The slice and every border with at least two resolved rays. */
export function overlayPaths(slice, borders) {
  const out = [];
  if (slice) out.push({ id: 'slice', label: 'slice', pts: [slice.P1, slice.P2], closed: false });
  borders.forEach((b, i) => {
    const pts = [...b.rays]
      .filter((r) => r.type !== 'none' && Number.isFinite(r.r))
      .sort((p, q) => p.angle - q.angle)
      .map((r) => [b.center[0] + r.r * Math.cos(r.angle), b.center[1] + r.r * Math.sin(r.angle)]);
    if (pts.length >= 2) out.push({ id: `border${i}`, label: borders.length > 1 ? `border ${i + 1}` : 'border', pts, closed: !!b.complete });
  });
  return out;
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
