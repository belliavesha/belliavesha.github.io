/**
 * Rendering: screen canvas (DPR-aware, culled, rAF-throttled, with a bitmap
 * fast-path while panning big trees), DOM labels, and PNG/SVG export.
 */
(function () {
    const S = CT.state;
    let canvas, ctx, labelsEl, dpr = 1, cssW = 0, cssH = 0;
    let styles = null;           // { key, widths: Float32Array, colors: string[], maxWidth }
    let rafPending = false, wantFast = false;
    let lastFullMs = 0, idleTimer = null;
    const snap = { canvas: document.createElement('canvas'), view: null, valid: false };
    const labelPool = new Map(); // key -> element

    function init(canvasEl, labelsContainer) {
        canvas = canvasEl; ctx = canvas.getContext('2d');
        labelsEl = labelsContainer;
        resize();
    }

    function resize() {
        const box = canvas.parentElement.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 3);
        cssW = Math.max(1, Math.round(box.width));
        cssH = Math.max(1, Math.round(box.height));
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        snap.valid = false;
        request();
    }

    // ---------- edge styles (same formulas as the original drawEdge) ----------

    function edgeStyles(L, theme) {
        const treeMeta = graph.trees[L.root];
        const key = (S.graphVersion || 0) + '|' + L.root + '|' + theme + '|' + L.nodes.length + '|' + (treeMeta && treeMeta.leafCount) + '|' + (treeMeta && treeMeta.highestNode);
        if (styles && styles.key === key) return styles;
        const n = L.nodes.length;
        const widths = new Float32Array(n);
        const colors = new Array(n);
        const hsl = new Array(n);    // [h, s, l, a] for SVG
        const darkness = theme === 'light' ? 50 : 0;
        const logWnorm = Math.log2(treeMeta.leafCount);
        const logHigh = Math.log(treeMeta.highestNode);
        let prevColor = '#000000', prevHsl = [0, 0, 0, 1];
        let maxWidth = 1;
        for (let i = 1; i < n; i++) {
            const node = L.nodes[i];
            const weight = graph.weight.get(node);
            const logW = Math.log2(weight);
            const lineWidth = 2 + logW;
            const alpha = logWnorm == 0 ? 1 : Math.min(1, 0.25 + logW / logWnorm * 0.75);
            const hue = 300 - (Math.log(node) / logHigh) * 320;
            widths[i] = lineWidth;
            if (lineWidth > maxWidth) maxWidth = lineWidth;
            if (Number.isFinite(hue) && Number.isFinite(alpha)) {
                prevColor = `hsla(${hue}, ${75 - darkness}%, 50%, ${alpha})`;
                prevHsl = [hue, 75 - darkness, 50, alpha];
            } // else: the canvas ignored invalid colours, so the previous colour was reused
            colors[i] = prevColor;
            hsl[i] = prevHsl;
        }
        styles = { key, widths, colors, hsl, maxWidth };
        return styles;
    }

    // ---------- captions (same choice and priorities as before) ----------

    function captions(L) {
        const root = L.root;
        const treeMeta = graph.trees[root];
        if (!treeMeta) return [];
        const opts = [
            { nodeId: root, type: 'root', text: root, priority: 1 },
            { nodeId: graph.parent.get(root), type: 'target', text: graph.parent.get(root), priority: 2 },
            { nodeId: treeMeta.deepestNode, type: 'deep', text: treeMeta.deepestNode, priority: 3 },
            { nodeId: graph.height.get(treeMeta.deepestNode), type: 'deep', text: graph.height.get(treeMeta.deepestNode), priority: 4.1 },
            { nodeId: treeMeta.highestNode, type: 'max', text: treeMeta.highestNode, priority: 4 },
            { nodeId: treeMeta.highestLeaf, type: 'max', text: treeMeta.highestLeaf, priority: 4.5 },
            { nodeId: treeMeta.lowestNode, type: 'min', text: treeMeta.lowestNode, priority: 5 },
            { nodeId: treeMeta.startValue, type: 'start', text: treeMeta.startValue, priority: 6 },
            { nodeId: treeMeta.startValue ? graph.height.get(treeMeta.startValue) : null, type: 'start', text: treeMeta.startValue ? graph.height.get(treeMeta.startValue) : null, priority: 6.1 },
        ];
        const byNode = new Map();
        for (const c of opts) {
            if (c.nodeId != null && L.index.has(c.nodeId)) {
                if (!byNode.has(c.nodeId) || byNode.get(c.nodeId).priority > c.priority) byNode.set(c.nodeId, c);
            }
        }
        return Array.from(byNode.values()).filter(c => S.labels[c.type]);
    }

    // ---------- screen drawing ----------

    function request(fast = false) {
        wantFast = wantFast || fast;
        if (!fast) wantFast = false;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(frame);
    }

    function frame() {
        rafPending = false;
        ensureLayout();
        const fast = wantFast;
        wantFast = false;
        if (fast && lastFullMs > 24 && snap.valid) {
            drawSnapshot();
            positionLabels();
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => request(false), 140);
        } else {
            drawFull();
        }
    }

    function ensureLayout() {
        if (!S.layoutDirty) return;
        S.layoutDirty = false;
        if (S.currentRoot == null || !graph.trees[S.currentRoot]) { S.layout = null; return; }
        const c = CT.controls.getViewConfig();
        S.layout = CT.layout.compute(S.currentRoot, c.angles, c.initAngle, c.mod);
        if (S.pendingFit) { S.pendingFit = false; fitView(); }
    }

    function bg() { return CT.TREE_BG[S.theme]; }

    function drawFull() {
        const t0 = performance.now();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = bg();
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const L = S.layout;
        if (L) {
            const z = S.view.zoom;
            const tx = cssW / 2 + S.view.x, ty = cssH / 2 + S.view.y;
            ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * tx, dpr * ty);
            drawEdges(ctx, L, { x0: -tx / z, y0: -ty / z, x1: (cssW - tx) / z, y1: (cssH - ty) / z });
            drawSelection(ctx, L, z);
        }
        lastFullMs = performance.now() - t0;
        if (lastFullMs > 24) {
            snap.canvas.width = canvas.width; snap.canvas.height = canvas.height;
            snap.canvas.getContext('2d').drawImage(canvas, 0, 0);
            snap.view = { ...S.view };
            snap.valid = true;
        } else {
            snap.valid = false;
        }
        positionLabels();
    }

    function drawSnapshot() {
        const v0 = snap.view, v1 = S.view;
        const k = v1.zoom / v0.zoom;
        const cx = cssW / 2, cy = cssH / 2;
        const ox = cx + v1.x - k * (cx + v0.x);
        const oy = cy + v1.y - k * (cy + v0.y);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = bg();
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(k, 0, 0, k, ox * dpr, oy * dpr);
        ctx.drawImage(snap.canvas, 0, 0);
    }

    function drawEdges(c, L, rect) {
        const st = edgeStyles(L, S.theme);
        const xs = L.xs, ys = L.ys, par = L.parent, n = L.nodes.length;
        const pad = st.maxWidth;
        const x0 = rect ? rect.x0 - pad : -Infinity, x1 = rect ? rect.x1 + pad : Infinity;
        const y0 = rect ? rect.y0 - pad : -Infinity, y1 = rect ? rect.y1 + pad : Infinity;
        c.lineCap = 'round';
        for (let i = 1; i < n; i++) {
            const p = par[i];
            const ax = xs[p], ay = ys[p], bx = xs[i], by = ys[i];
            if ((ax < x0 && bx < x0) || (ax > x1 && bx > x1) || (ay < y0 && by < y0) || (ay > y1 && by > y1)) continue;
            c.beginPath();
            c.moveTo(ax, ay);
            c.lineTo(bx, by);
            c.strokeStyle = st.colors[i];
            c.lineWidth = st.widths[i];
            c.stroke();
        }
    }

    const halo = document.createElement('canvas');

    /**
     * Selected path: a soft semi-transparent glow (light on dark, dark on light)
     * under the path's own edges, which are redrawn on top in their colours.
     */
    function drawSelection(c, L, z) {
        const sel = S.selected;
        if (sel == null || !L.index.has(sel)) return;
        const i = L.index.get(sel);
        const light = S.theme === 'light';
        const st = edgeStyles(L, S.theme);
        const path = [];
        if (S.showPath) for (let j = i; L.parent[j] >= 0; j = L.parent[j]) path.push(j);
        const m = c.getTransform();

        if (path.length) {
            // 1. glow: stroke the path opaque into a layer, then composite it once
            //    with transparency, so overlapping segments don't build up darker spots
            if (halo.width !== canvas.width || halo.height !== canvas.height) {
                halo.width = canvas.width; halo.height = canvas.height;
            }
            const h = halo.getContext('2d');
            h.setTransform(1, 0, 0, 1, 0, 0);
            h.clearRect(0, 0, halo.width, halo.height);
            h.setTransform(m);
            h.lineCap = 'round'; h.lineJoin = 'round';
            h.strokeStyle = light ? '#2b1027' : '#ffffff';
            for (const j of path) {
                const p = L.parent[j];
                h.beginPath();
                h.moveTo(L.xs[p], L.ys[p]);
                h.lineTo(L.xs[j], L.ys[j]);
                h.lineWidth = st.widths[j] + 7 / z;
                h.stroke();
            }
            c.save();
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.globalAlpha = light ? 0.22 : 0.3;
            c.shadowColor = light ? 'rgba(43, 16, 39, 0.6)' : 'rgba(255, 255, 255, 0.6)';
            c.shadowBlur = 8 * dpr;
            c.drawImage(halo, 0, 0);
            c.restore();

            // 2. the path's own edges on top, in their colours at full strength
            c.lineCap = 'round';
            for (const j of path) {
                const p = L.parent[j];
                const [hh, ss, ll] = st.hsl[j];
                c.beginPath();
                c.moveTo(L.xs[p], L.ys[p]);
                c.lineTo(L.xs[j], L.ys[j]);
                c.strokeStyle = `hsl(${hh}, ${ss}%, ${ll}%)`;
                c.lineWidth = Math.max(st.widths[j], 1.5 / z);
                c.stroke();
            }
        }

        // 3. the selected number: a small dot in its own colour, ringed by the glow colour
        const [hh, ss, ll] = i > 0 ? st.hsl[i] : [300, light ? 25 : 75, 50];
        c.beginPath();
        c.arc(L.xs[i], L.ys[i], 5 / z, 0, Math.PI * 2);
        c.fillStyle = `hsl(${hh}, ${ss}%, ${ll}%)`;
        c.fill();
        c.lineWidth = 2 / z;
        c.strokeStyle = light ? 'rgba(43, 16, 39, 0.55)' : 'rgba(255, 255, 255, 0.7)';
        c.stroke();
    }

    function positionLabels() {
        const L = S.layout;
        const want = (L && S.showLabels) ? captions(L) : [];
        const z = S.view.zoom, tx = cssW / 2 + S.view.x, ty = cssH / 2 + S.view.y;
        const seen = new Set();
        for (const c of want) {
            const i = L.index.get(c.nodeId);
            const x = L.xs[i] * z + tx, y = L.ys[i] * z + ty;
            const key = c.type + ':' + c.nodeId;
            seen.add(key);
            let el = labelPool.get(key);
            if (!el) {
                el = document.createElement('div');
                el.className = `node-label label-${c.type}`;
                el.textContent = c.text;
                labelsEl.appendChild(el);
                labelPool.set(key, el);
            }
            const on = x > -60 && x < cssW + 60 && y > -40 && y < cssH + 40;
            el.style.display = on ? '' : 'none';
            if (on) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, 4px)`;
        }
        for (const [key, el] of labelPool) {
            if (!seen.has(key)) { el.remove(); labelPool.delete(key); }
        }
    }

    // ---------- view helpers ----------

    /** Insets (CSS px) of overlay UI that the fitted tree should avoid. */
    function fitInsets() {
        const ins = { top: 28, right: 28, bottom: 44, left: 28 }; // labels hang below their node
        const tb = document.getElementById('toolbar');
        if (tb) ins.top = Math.max(ins.top, tb.getBoundingClientRect().height + 20);
        const sheet = document.getElementById('panel');
        if (sheet && getComputedStyle(sheet).position === 'fixed') {
            const r = sheet.getBoundingClientRect();
            ins.bottom = Math.max(ins.bottom, window.innerHeight - r.top + 44);
        }
        return ins;
    }

    function fitView() {
        const L = S.layout;
        if (!L) return;
        const b = L.bounds;
        const ins = fitInsets();
        const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
        const availW = Math.max(40, cssW - ins.left - ins.right);
        const availH = Math.max(40, cssH - ins.top - ins.bottom);
        const zoom = Math.min(availW / w, availH / h, 2);
        const cxScreen = ins.left + availW / 2, cyScreen = ins.top + availH / 2;
        S.view.zoom = zoom;
        S.view.x = cxScreen - cssW / 2 - ((b.minX + b.maxX) / 2) * zoom;
        S.view.y = cyScreen - cssH / 2 - ((b.minY + b.maxY) / 2) * zoom;
    }

    function fit() { fitView(); request(); }

    /** Zoom by factor k about a screen point (CSS px, relative to canvas). */
    function zoomAt(k, sx, sy) {
        const v = S.view;
        const nz = Math.min(Math.max(v.zoom * k, 1e-5), 500);
        k = nz / v.zoom;
        const cx = cssW / 2, cy = cssH / 2;
        v.x = sx - cx - (sx - cx - v.x) * k;
        v.y = sy - cy - (sy - cy - v.y) * k;
        v.zoom = nz;
    }

    function screenToWorld(sx, sy) {
        const v = S.view;
        return { x: (sx - cssW / 2 - v.x) / v.zoom, y: (sy - cssH / 2 - v.y) / v.zoom };
    }

    function worldToScreen(wx, wy) {
        const v = S.view;
        return { x: wx * v.zoom + cssW / 2 + v.x, y: wy * v.zoom + cssH / 2 + v.y };
    }

    // ---------- export ----------

    function exportCanvas({ size = 4096, transparent = false, labels = true } = {}) {
        ensureLayout();
        const L = S.layout;
        if (!L) return null;
        const b = L.bounds;
        const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
        const pad = Math.round(size * 0.04);
        const scale = (size - 2 * pad) / Math.max(w, h);
        const W = Math.ceil(w * scale + 2 * pad), H = Math.ceil(h * scale + 2 * pad);
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        if (!transparent) { g.fillStyle = bg(); g.fillRect(0, 0, W, H); }
        g.setTransform(scale, 0, 0, scale, pad - b.minX * scale, pad - b.minY * scale);
        drawEdges(g, L, null);
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (labels && S.showLabels) {
            const fontSize = Math.max(14, Math.round(Math.max(W, H) / 110));
            for (const cap of captions(L)) {
                const i = L.index.get(cap.nodeId);
                const x = pad + (L.xs[i] - b.minX) * scale, y = pad + (L.ys[i] - b.minY) * scale + fontSize * 0.3;
                drawLabel(g, cap, x, y, fontSize);
            }
        }
        return c;
    }

    function labelColor(type) { return CT.LABEL_TYPES.find(t => t.type === type).color; }

    function hexA(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    function drawLabel(g, cap, x, y, fs) {
        const col = labelColor(cap.type);
        g.font = `bold ${fs}px ui-monospace, Menlo, monospace`;
        const tw = g.measureText(String(cap.text)).width;
        const bw = tw + fs * 0.7, bh = fs * 1.45;
        g.fillStyle = hexA(col, 0.8);
        g.fillRect(x - bw / 2, y, bw, bh);
        g.strokeStyle = col; g.lineWidth = Math.max(2, fs / 8);
        g.strokeRect(x - bw / 2, y, bw, bh);
        g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(cap.text), x, y + bh / 2 + 1);
    }

    function exportSVG({ transparent = false, labels = true } = {}) {
        ensureLayout();
        const L = S.layout;
        if (!L) return null;
        const st = edgeStyles(L, S.theme);
        const b = L.bounds;
        const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
        const pad = Math.max(w, h) * 0.04;
        const vb = [b.minX - pad, b.minY - pad, w + 2 * pad, h + 2 * pad].map(v => +v.toFixed(2));
        const r = (v) => Math.round(v * 100) / 100;
        const out = [];
        out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${Math.round(vb[2] * 4)}" height="${Math.round(vb[3] * 4)}">`);
        if (!transparent) out.push(`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${bg()}"/>`);
        out.push('<g fill="none" stroke-linecap="round">');
        for (let i = 1; i < L.nodes.length; i++) {
            const p = L.parent[i];
            const [hh, ss, ll, aa] = st.hsl[i];
            out.push(`<line x1="${r(L.xs[p])}" y1="${r(L.ys[p])}" x2="${r(L.xs[i])}" y2="${r(L.ys[i])}" stroke="hsl(${r(hh)} ${ss}% ${ll}%)" stroke-opacity="${r(aa)}" stroke-width="${r(st.widths[i])}"/>`);
        }
        out.push('</g>');
        if (labels && S.showLabels) {
            const fs = Math.max(w, h) / 90;
            out.push(`<g font-family="ui-monospace, Menlo, monospace" font-weight="bold" font-size="${r(fs)}" text-anchor="middle">`);
            for (const cap of captions(L)) {
                const i = L.index.get(cap.nodeId);
                const col = labelColor(cap.type);
                const text = String(cap.text);
                const bw = fs * (0.62 * text.length + 0.7), bh = fs * 1.45;
                const x = L.xs[i], y = L.ys[i] + fs * 0.3;
                out.push(`<rect x="${r(x - bw / 2)}" y="${r(y)}" width="${r(bw)}" height="${r(bh)}" fill="${col}" fill-opacity="0.8" stroke="${col}" stroke-width="${r(fs / 8)}"/>`);
                out.push(`<text x="${r(x)}" y="${r(y + bh * 0.72)}">${text}</text>`);
            }
            out.push('</g>');
        }
        out.push('</svg>');
        return out.join('\n');
    }

    CT.render = {
        init, resize, request, fit, zoomAt, screenToWorld, worldToScreen, ensureLayout,
        exportCanvas, exportSVG, size: () => ({ w: cssW, h: cssH }),
        invalidateLayout(fitAfter = false) {
            S.layoutDirty = true;
            if (fitAfter) S.pendingFit = true;
            request();
        },
    };
})();
