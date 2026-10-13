// Parameter-plane view: progressive rendering through the worker pool,
// zoom / pan / pick / slice interaction, and vector overlays (marker, borders, slice).
// Clicks within SNAP_PX of the slice or a traced border snap onto it (hold Alt to opt out).

import { COLORERS, category } from './colors.js';
import { overlayPaths, nearestOnPath } from './paths.js';

const SNAP_PX = 10;

export class PlaneView {
  constructor({ wrap, plane, overlay, axesEl, progressEl, pool, onPick, onSlice, onHover, onRendered, onViewChange }) {
    Object.assign(this, { wrap, plane, overlay, axesEl, progressEl, pool, onPick, onSlice, onHover, onRendered, onViewChange });
    this.ctx = plane.getContext('2d');
    this.octx = overlay.getContext('2d');
    this.view = { cx: 0, cy: 0, r: 2 }; // centre and half-width (square view)
    this.mode = 'classify';
    this.quality = '1';
    this.gen = 0;
    this.W = 0; this.H = 0;
    this.marker = null;
    this.borders = [];
    this.slice = null;
    this.snapshot = null; // {canvas, view}
    this.renderTimer = null;
    this.cfg = null;
    this.#bind();
    new ResizeObserver(() => this.#onResize()).observe(wrap);
  }

  // ------------------------------------------------------------ geometry
  get bounds() {
    const { cx, cy, r } = this.view;
    return { x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r };
  }
  clientToParam(clientX, clientY) {
    const rect = this.overlay.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width, v = (clientY - rect.top) / rect.height;
    const b = this.bounds;
    return [b.x0 + u * (b.x1 - b.x0), b.y1 - v * (b.y1 - b.y0)];
  }
  paramToCss([re, im]) {
    const rect = this.overlay.getBoundingClientRect();
    const b = this.bounds;
    return [((re - b.x0) / (b.x1 - b.x0)) * rect.width, ((b.y1 - im) / (b.y1 - b.y0)) * rect.height];
  }

  setView(v, { render = true } = {}) {
    this.view = { ...v };
    this.updateAxes();
    this.#drawPreview();
    this.drawOverlay();
    if (this.onViewChange) this.onViewChange(this.view);
    if (render) this.scheduleRender(200);
  }

  updateAxes() {
    const b = this.bounds;
    const f = (x) => {
      const d = Math.max(2, Math.ceil(-Math.log10(this.view.r)) + 3);
      return x.toFixed(Math.min(12, d));
    };
    const [lx, ly] = this.labels || ['Re', 'Im'];
    this.axesEl.textContent = `${lx} [${f(b.x0)}, ${f(b.x1)}]   ${ly} [${f(b.y0)}, ${f(b.y1)}]`;
  }

  #pixelSize() {
    const rect = this.wrap.getBoundingClientRect();
    const css = Math.max(64, Math.floor(Math.min(rect.width, rect.height || rect.width)));
    const f = this.quality === 'dpr' ? Math.min(2, window.devicePixelRatio || 1) : parseFloat(this.quality);
    return Math.max(64, Math.round(css * f));
  }

  #onResize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.wrap.getBoundingClientRect();
    this.overlay.width = Math.round(rect.width * dpr);
    this.overlay.height = Math.round(rect.height * dpr);
    this.drawOverlay();
    const n = this.#pixelSize();
    if (n !== this.W && this.cfg) this.scheduleRender(250);
  }

  // ------------------------------------------------------------ rendering
  scheduleRender(ms = 0) {
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.cfg && this.render(this.cfg), ms);
  }

  async render(cfg) {
    this.cfg = cfg;
    const gen = ++this.gen;
    this.pool.cancel('plane');
    const n = this.#pixelSize();
    if (n !== this.W) {
      this.W = this.H = n;
      this.plane.width = this.plane.height = n;
      this.image = this.ctx.createImageData(n, n);
    }
    const W = this.W, H = this.H;
    this.esc = new Float32Array(W * H).fill(NaN);
    this.lam = new Float32Array(W * H).fill(NaN);
    this.k = new Int8Array(W * H).fill(-1);
    this.renderView = { ...this.view };
    const view = this.bounds;
    const t0 = performance.now();
    const base = { prob: cfg.prob, view, W, H, mode: this.mode, nTrans: cfg.nTrans, nRec: cfg.nRec, kmax: cfg.kmax, tau: cfg.tau, S: cfg.S, qA: cfg.qA, qB: cfg.qB };
    const passes = W * H > 40000 ? [8, 1] : [1];
    let done = 0, total = 0;
    const jobs = [];
    for (const stride of passes) {
      const rowsPer = stride > 1 ? 64 : Math.max(2, Math.round(24000 / W));
      for (let r0 = 0; r0 < H; r0 += rowsPer) jobs.push({ ...base, row0: r0, row1: Math.min(H, r0 + rowsPer), stride });
    }
    total = jobs.length;
    this.#progress(0.02);
    const promises = jobs.map((job) =>
      this.pool.run('plane', job, { tag: 'plane' }).then(
        (res) => {
          if (gen !== this.gen) return;
          this.#ingest(res);
          done++;
          this.#progress(done / total);
          this.#scheduleDraw(res.row0, Math.min(H, res.row0 + res.rows * res.stride));
        },
        (err) => { if (!err || !err.cancelled) console.error(err); },
      ),
    );
    await Promise.all(promises);
    if (gen !== this.gen) return;
    this.#progress(1);
    setTimeout(() => this.#progress(0), 300);
    this.#flushDraw();
    this.snapshot = this.#takeSnapshot();
    if (this.onRendered) this.onRendered({ ms: performance.now() - t0, W, H, stats: this.stats() });
  }

  #progress(f) { this.progressEl.style.width = `${(f * 100).toFixed(1)}%`; }

  #ingest({ data, rows, cols, row0, stride }) {
    const W = this.W, H = this.H;
    let o = 0;
    for (let r = 0; r < rows; r++) {
      const py = row0 + r * stride;
      for (let c = 0; c < cols; c++) {
        const px = c * stride;
        const e = data[o], l = data[o + 1], k = data[o + 2];
        o += 3;
        const ymax = Math.min(H, py + stride), xmax = Math.min(W, px + stride);
        for (let y = py; y < ymax; y++) {
          let idx = y * W + px;
          for (let x = px; x < xmax; x++, idx++) { this.esc[idx] = e; this.lam[idx] = l; this.k[idx] = k; }
        }
      }
    }
  }

  #scheduleDraw(r0, r1) {
    this.dirty = this.dirty ? [Math.min(this.dirty[0], r0), Math.max(this.dirty[1], r1)] : [r0, r1];
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = null; this.#flushDraw(); });
  }

  #flushDraw() {
    if (!this.dirty || !this.image) return;
    const [r0, r1] = this.dirty;
    this.dirty = null;
    this.#colorRows(r0, r1);
    this.ctx.putImageData(this.image, 0, 0, 0, r0, this.W, r1 - r0);
  }

  #colorRows(r0, r1) {
    const fn = COLORERS[this.mode] || COLORERS.classify;
    const px = this.image.data;
    const W = this.W;
    for (let i = r0 * W; i < r1 * W; i++) {
      if (Number.isNaN(this.esc[i])) { px[4 * i] = 7; px[4 * i + 1] = 9; px[4 * i + 2] = 13; px[4 * i + 3] = 255; continue; }
      fn(this.esc[i], this.lam[i], this.k[i], px, 4 * i);
    }
  }

  recolor(mode) {
    this.mode = mode;
    if (!this.image) return;
    this.#colorRows(0, this.H);
    this.ctx.putImageData(this.image, 0, 0);
    this.snapshot = this.#takeSnapshot();
  }

  stats() {
    const counts = {};
    let n = 0;
    for (let i = 0; i < this.esc.length; i++) {
      if (Number.isNaN(this.esc[i])) continue;
      const c = category(this.esc[i], this.lam[i], this.mode === 'classify' ? this.k[i] : -1);
      counts[c] = (counts[c] || 0) + 1;
      n++;
    }
    return { counts, n };
  }

  #takeSnapshot() {
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    c.getContext('2d').drawImage(this.plane, 0, 0);
    return { canvas: c, view: { ...this.renderView } };
  }

  /** Draw the last finished image re-mapped to the current view (instant zoom/pan feedback). */
  #drawPreview() {
    if (!this.snapshot || !this.W) return;
    const s = this.snapshot.view, v = this.view;
    const scale = s.r / v.r;
    const W = this.W;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, W, W);
    // snapshot pixel (0,0) is at param (s.cx - s.r, s.cy + s.r)
    const x = ((s.cx - s.r - (v.cx - v.r)) / (2 * v.r)) * W;
    const y = ((v.cy + v.r - (s.cy + s.r)) / (2 * v.r)) * W;
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(this.snapshot.canvas, x, y, W * scale, W * scale);
    ctx.restore();
  }

  // ------------------------------------------------------------ paths and snapping
  /** The slice and traced borders as walkable paths (see paths.js). */
  paths() { return overlayPaths(this.slice, this.borders); }

  /** Snap a client point to the nearest path within SNAP_PX: {P, path, t} or null. */
  snap(clientX, clientY) {
    const P = this.clientToParam(clientX, clientY);
    let best = null;
    for (const path of this.paths()) {
      const n = nearestOnPath(path, P, (Q) => this.paramToCss(Q));
      if (n && n.dist <= SNAP_PX && (!best || n.dist < best.dist)) best = { ...n, path };
    }
    return best;
  }

  // ------------------------------------------------------------ overlay
  drawOverlay(extra) {
    const ctx = this.octx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rect = this.overlay.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    // borders
    for (const b of this.borders) this.#drawBorder(ctx, b);
    // slice
    const sl = extra && extra.slice ? extra.slice : this.slice;
    if (sl) {
      const [x1, y1] = this.paramToCss(sl.P1), [x2, y2] = this.paramToCss(sl.P2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill(); }
      if (sl.cursor != null) {
        const t = sl.cursor;
        const [xc, yc] = this.paramToCss([sl.P1[0] + t * (sl.P2[0] - sl.P1[0]), sl.P1[1] + t * (sl.P2[1] - sl.P1[1])]);
        ctx.beginPath(); ctx.arc(xc, yc, 4, 0, 2 * Math.PI); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    // where a click would snap to
    if (this.snapHint) {
      const [x, y] = this.paramToCss(this.snapHint);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,209,102,0.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // marker
    if (this.marker) {
      const [x, y] = this.paramToCss(this.marker);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 11, y); ctx.lineTo(x - 4, y); ctx.moveTo(x + 4, y); ctx.lineTo(x + 11, y);
      ctx.moveTo(x, y - 11); ctx.lineTo(x, y - 4); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 11);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  #drawBorder(ctx, b) {
    const rays = [...b.rays].sort((u, v) => u.angle - v.angle);
    const pt = (ry, r) => this.paramToCss([b.center[0] + r * Math.cos(ry.angle), b.center[1] + r * Math.sin(ry.angle)]);
    const styles = {
      lambda: { color: 'rgba(255,255,255,0.95)', dash: [] },
      unresolved: { color: 'rgba(255,190,90,0.95)', dash: [5, 3] },
      breakdown: { color: 'rgba(255,110,110,0.95)', dash: [2, 3] },
    };
    ctx.lineWidth = 1.6;
    const full = b.complete;
    for (let i = 0; i < rays.length; i++) {
      const a = rays[i], c = rays[(i + 1) % rays.length];
      if (!full && i === rays.length - 1) break;
      if (a.type === 'none' || c.type === 'none') continue;
      const st = styles[a.type === c.type ? a.type : 'unresolved'] || styles.unresolved;
      const [x1, y1] = pt(a, a.r), [x2, y2] = pt(c, c.r);
      ctx.strokeStyle = st.color;
      ctx.setLineDash(st.dash);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const ry of rays) {
      if (ry.type === 'none') continue;
      const [x, y] = pt(ry, ry.r);
      ctx.fillStyle = (styles[ry.type] || styles.unresolved).color;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      if (ry.rExtrap && ry.type !== 'lambda') {
        const [ex, ey] = pt(ry, ry.rExtrap);
        ctx.fillStyle = 'rgba(255,190,90,0.45)';
        ctx.fillRect(ex - 1, ey - 1, 2, 2);
      }
    }
  }

  // ------------------------------------------------------------ interaction
  #bind() {
    const ov = this.overlay;
    let drag = null;
    const touches = new Map(); // pointerId -> {x, y}, for pinch zoom
    let pinch = null;
    const pinchState = () => {
      const [a, b] = [...touches.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    ov.addEventListener('pointerdown', (e) => {
      ov.setPointerCapture(e.pointerId);
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        drag = null;
        const st = pinchState();
        pinch = { ...st, view: { ...this.view }, P: this.clientToParam(st.mx, st.my) };
        return;
      }
      drag = { x: e.clientX, y: e.clientY, view: { ...this.view }, shift: e.shiftKey, moved: false, P1: this.clientToParam(e.clientX, e.clientY) };
    });
    const endTouch = (e) => {
      touches.delete(e.pointerId);
      if (pinch && touches.size < 2) { pinch = null; this.setView(this.view); }
    };
    ov.addEventListener('pointercancel', (e) => { endTouch(e); drag = null; });
    ov.addEventListener('pointermove', (e) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        const st = pinchState();
        const f = pinch.d / Math.max(1, st.d);
        const v = pinch.view, P0 = pinch.P;
        const r = v.r * f;
        // keep the parameter under the fingers' midpoint fixed
        const rect = ov.getBoundingClientRect();
        const u = (st.mx - rect.left) / rect.width, w = (st.my - rect.top) / rect.height;
        this.view = { r, cx: P0[0] - (2 * u - 1) * r, cy: P0[1] + (2 * w - 1) * r };
        this.updateAxes();
        this.#drawPreview();
        this.drawOverlay();
        return;
      }
      const P = this.clientToParam(e.clientX, e.clientY);
      this.#hover(P);
      if (!drag) {
        const sn = e.altKey ? null : this.snap(e.clientX, e.clientY);
        const hint = sn ? sn.P : null;
        if (hint !== this.snapHint && (hint || this.snapHint)) { this.snapHint = hint; this.drawOverlay(); }
        return;
      }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      if (drag.shift) {
        this.drawOverlay({ slice: { P1: drag.P1, P2: P } });
      } else {
        const rect = ov.getBoundingClientRect();
        const k = (2 * drag.view.r) / rect.width;
        this.view = { ...drag.view, cx: drag.view.cx - dx * k, cy: drag.view.cy + dy * k };
        this.updateAxes();
        this.#drawPreview();
        this.drawOverlay();
      }
    });
    ov.addEventListener('pointerup', (e) => {
      const wasPinch = !!pinch;
      endTouch(e);
      if (wasPinch || !drag) return;
      const P = this.clientToParam(e.clientX, e.clientY);
      if (!drag.moved) {
        const sn = e.altKey ? null : this.snap(e.clientX, e.clientY);
        this.onPick && this.onPick(sn ? sn.P : P, sn);
      }
      else if (drag.shift) { this.slice = { P1: drag.P1, P2: P }; this.drawOverlay(); this.onSlice && this.onSlice(this.slice); }
      else this.setView(this.view);
      drag = null;
    });
    ov.addEventListener('pointerleave', () => {
      this.onHover && this.onHover(null);
      if (this.snapHint) { this.snapHint = null; this.drawOverlay(); }
    });
    ov.addEventListener('wheel', (e) => {
      e.preventDefault();
      const P = this.clientToParam(e.clientX, e.clientY);
      const f = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0015)));
      const v = this.view;
      this.setView({ cx: P[0] + (v.cx - P[0]) * f, cy: P[1] + (v.cy - P[1]) * f, r: v.r * f });
    }, { passive: false });
    ov.addEventListener('keydown', (e) => {
      const v = this.view;
      const step = v.r * 0.15;
      const map = { ArrowLeft: [-step, 0, 1], ArrowRight: [step, 0, 1], ArrowUp: [0, step, 1], ArrowDown: [0, -step, 1], '+': [0, 0, 0.8], '=': [0, 0, 0.8], '-': [0, 0, 1.25] };
      const m = map[e.key];
      if (!m) return;
      e.preventDefault();
      this.setView({ cx: v.cx + m[0], cy: v.cy + m[1], r: v.r * m[2] });
    });
  }

  #hover(P) {
    if (!this.onHover) return;
    let info = null;
    if (this.esc && this.renderView) {
      const s = this.renderView;
      const u = (P[0] - (s.cx - s.r)) / (2 * s.r), v = (s.cy + s.r - P[1]) / (2 * s.r);
      const px = Math.floor(u * this.W), py = Math.floor(v * this.H);
      if (px >= 0 && py >= 0 && px < this.W && py < this.H) {
        const i = py * this.W + px;
        info = { esc: this.esc[i], lam: this.lam[i], k: this.k[i] };
      }
    }
    this.onHover({ P, info });
  }
}
