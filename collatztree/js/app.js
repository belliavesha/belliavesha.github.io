/**
 * App wiring: building and loading trees, tree picking, pointer/touch/wheel/
 * keyboard interaction on the canvas, toolbar, startup.
 */
(function () {
    const S = CT.state;
    const $ = CT.$;
    const AUTO_REBUILD_LIMIT = 20000;   // live rebuild only for samples up to this size
    let rebuildTimer = null;
    let jobToken = 0;

    // ---------- building ----------

    function markStale(on = true) { $('#renderBtn').classList.toggle('is-stale', on); }

    /** Called when rules or sample settings change: rebuild live if it is cheap. */
    function scheduleRebuild(delay = 500) {
        clearTimeout(rebuildTimer);
        const sample = CT.controls.readSample();
        if (!sample || !CT.controls.rulesValid()) { markStale(); return; }
        if (Math.min(sample.count, sample.range) > AUTO_REBUILD_LIMIT) { markStale(); return; }
        rebuildTimer = setTimeout(buildTrees, delay);
    }

    async function runJob(job) {
        const token = ++jobToken;
        CT.ui.progressStart();
        $('#renderBtn').setAttribute('aria-busy', 'true');
        const res = await CT.build.run(job, (f) => { if (token === jobToken) CT.ui.progressSet(f); });
        if (token !== jobToken) return null;             // superseded by a newer build
        CT.ui.progressEnd();
        $('#renderBtn').removeAttribute('aria-busy');
        if (res.cancelled) return null;
        if (res.error) { CT.ui.toast('The build failed: ' + res.error, 'error', 6000); return null; }
        setGraph(res.graph);
        S.graphVersion = (S.graphVersion || 0) + 1;
        return res;
    }

    /** "Build trees": sample numbers and build all trees. */
    async function buildTrees() {
        clearTimeout(rebuildTimer);
        const sample = CT.controls.readSample();
        if (!sample) { CT.ui.toast('Fix the highlighted sample field first.', 'error'); return; }
        if (!CT.controls.rulesValid()) { CT.ui.toast('Fix the highlighted rule first.', 'error'); return; }
        const rules = CT.controls.getRules();
        const mod = rules.length;
        const start = CT.controls.readStart();
        CT.io.clearLink();
        const ok = await runJob({ mode: 'sample', min: sample.min, range: sample.range, count: sample.count, start, mod, rules });
        if (!ok) return;
        afterBuild({ mod, rules }, { start });
    }

    /** Load a tree file / preset / link: rebuild exactly that tree from its leaves. */
    async function loadTree(d, { fromLink = false } = {}) {
        clearTimeout(rebuildTimer);
        CT.controls.setConfig(d.config);
        const minLeaf = Math.min(...d.leaves), maxLeaf = Math.max(...d.leaves);
        const start = d.start != null ? d.start : maxLeaf;
        // illustrative sample settings, so "Build trees" gives a similar picture
        CT.controls.setSampleFields({ count: d.leaves.length, min: minLeaf, range: maxLeaf - minLeaf + 1, start });
        CT.controls.setMode(false, false);
        if (!fromLink) CT.io.clearLink();
        const config = { mod: d.config.modulus, rules: d.config.rules };
        const ok = await runJob({ mode: 'leaves', leaves: d.leaves, mod: config.mod, rules: config.rules });
        if (!ok) return;
        afterBuild(config, { root: d.root });
        if (S.currentRoot != null && graph.root.get(start) === S.currentRoot) {
            graph.trees[S.currentRoot].startValue = start;
            CT.render.request();
        }
    }

    function afterBuild(config, { start = null, root = null } = {}) {
        S.builtConfig = config;
        S.ruleSet = new RuleSet({ mod: config.mod, rules: config.rules });
        markStale(false);
        const roots = Object.keys(graph.trees).sort((a, b) => graph.trees[b].leafCount - graph.trees[a].leafCount);
        if (roots.length === 0) {
            S.currentRoot = null;
            CT.controls.fillTreeSelect();
            CT.ui.toast('No trees found: every sample grew past the limits. Check the rules.', 'error', 6000);
            treeChanged(false);
            return;
        }
        if (root != null && graph.trees[root]) S.currentRoot = root;
        else if (start != null && graph.root.has(start)) S.currentRoot = graph.root.get(start);
        else S.currentRoot = parseInt(roots[0], 10);
        if (start != null && graph.root.has(start)) graph.trees[graph.root.get(start)].startValue = start;
        CT.controls.fillTreeSelect();
        const lost = graph.divergentNodes.length;
        if (lost) CT.ui.toast(`${CT.fmt(lost)} sample${lost > 1 ? 's' : ''} never reached a cycle and ${lost > 1 ? 'were' : 'was'} left out.`);
        treeChanged(true);
    }

    function treeChanged(fit) {
        $('#empty').hidden = S.currentRoot != null;
        CT.render.invalidateLayout(fit);
        CT.ui.updateRamp();
        CT.io.updateShareButton();
        CT.inspector.refresh();
        const t = graph.trees[S.currentRoot];
        $('#srStatus').textContent = t
            ? `Showing the tree with root ${S.currentRoot}: ${t.leafCount} leaves, highest number ${t.highestNode}.`
            : 'No tree to show.';
    }

    // ---------- picking trees ----------

    function selectRoot(root) {
        if (!graph.trees[root]) return;
        S.currentRoot = root;
        $('#startValue').value = root;
        treeChanged(true);
    }

    /** Add a start value's trajectory to the graph (same as before). */
    function setStart(v, fromCard = false) {
        if (!S.ruleSet) return;
        $('#startValue').value = v;
        graph.startValue = v;
        addSampleToGraph(v, S.ruleSet, true);
        S.graphVersion = (S.graphVersion || 0) + 1;
        const root = graph.root.get(v);
        if (root == null) {
            CT.ui.toast(`${CT.fmt(v)} never reaches a cycle within the limits.`, 'error');
            return;
        }
        graph.trees[root].startValue = v;
        CT.controls.addTreeOption(root);
        const switching = CT.controls.byStart() && root !== S.currentRoot;
        if (CT.controls.byStart()) {
            S.currentRoot = root;
            $('#treeSelect').value = String(root);
        }
        treeChanged(switching);
        if (fromCard) CT.ui.toast(`Start value set to ${CT.fmt(v)}.`);
    }

    function onModeChange(byStart) {
        const prev = S.currentRoot;
        if (byStart) {
            const v = CT.controls.readStart();
            if (v != null && graph.root.has(v)) {
                S.currentRoot = graph.root.get(v);
                $('#treeSelect').value = String(S.currentRoot);
            }
        } else if (S.currentRoot != null) {
            $('#startValue').value = S.currentRoot;
        }
        treeChanged(prev !== S.currentRoot);
    }

    // ---------- canvas interaction ----------

    function initCanvas() {
        const canvas = $('#mainCanvas');
        const pointers = new Map();
        let g = null; // gesture

        const local = (e) => {
            const r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        const pick = (p, touch) => {
            if (!S.layout) return null;
            const w = CT.render.screenToWorld(p.x, p.y);
            return CT.layout.hitTest(S.layout, w.x, w.y, (touch ? 22 : 10) / S.view.zoom);
        };
        const pinchState = () => {
            const [a, b] = Array.from(pointers.values());
            return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        };

        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            canvas.setPointerCapture(e.pointerId);
            const p = local(e);
            pointers.set(e.pointerId, p);
            CT.inspector.showTooltip(null);
            if (pointers.size === 1) {
                g = { type: 'pan', id: e.pointerId, x0: p.x, y0: p.y, last: p, moved: false, touch: e.pointerType !== 'mouse' };
            } else if (pointers.size === 2) {
                g = { type: 'pinch', ...pinchState(), moved: true };
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            const p = local(e);
            if (!pointers.has(e.pointerId)) {
                // hover (mouse only)
                if (e.pointerType === 'mouse' && !g) {
                    const node = pick(p, false);
                    canvas.classList.toggle('is-over-node', node != null);
                    CT.inspector.showTooltip(node, p.x, p.y);
                }
                return;
            }
            pointers.set(e.pointerId, p);
            if (!g) return;
            if (g.type === 'pan' && e.pointerId === g.id) {
                if (!g.moved && Math.hypot(p.x - g.x0, p.y - g.y0) > (g.touch ? 8 : 4)) {
                    g.moved = true;
                    canvas.classList.add('is-panning');
                }
                if (g.moved) {
                    S.view.x += p.x - g.last.x;
                    S.view.y += p.y - g.last.y;
                    CT.render.request(true);
                }
                g.last = p;
            } else if (g.type === 'pinch' && pointers.size >= 2) {
                const s = pinchState();
                CT.render.zoomAt(s.d / g.d, g.mx, g.my);
                S.view.x += s.mx - g.mx;
                S.view.y += s.my - g.my;
                g.d = s.d; g.mx = s.mx; g.my = s.my;
                CT.render.request(true);
            }
        });

        const end = (e) => {
            if (!pointers.has(e.pointerId)) return;
            const p = local(e);
            pointers.delete(e.pointerId);
            if (g && g.type === 'pan' && !g.moved && e.type === 'pointerup') {
                const node = pick(p, g.touch);
                if (node != null) CT.inspector.open(node);
                else CT.inspector.close();
            }
            if (pointers.size === 1) {
                const [id, q] = Array.from(pointers.entries())[0];
                g = { type: 'pan', id, x0: q.x, y0: q.y, last: q, moved: true, touch: true };
            } else if (pointers.size === 0) {
                g = null;
                canvas.classList.remove('is-panning');
                CT.render.request(false);
            }
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !g) CT.inspector.showTooltip(null); });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            let dy = e.deltaY;
            if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
            const k = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015));   // ctrlKey = trackpad pinch
            const p = local(e);
            CT.render.zoomAt(k, p.x, p.y);
            CT.inspector.showTooltip(null);
            CT.render.request(true);
            clearTimeout(initCanvas.wheelEnd);
            initCanvas.wheelEnd = setTimeout(() => CT.render.request(false), 160);
        }, { passive: false });

        canvas.addEventListener('dblclick', (e) => {
            const p = local(e);
            CT.render.zoomAt(e.shiftKey ? 0.5 : 2, p.x, p.y);
            CT.render.request();
        });

        canvas.addEventListener('keydown', (e) => {
            const step = e.shiftKey ? 200 : 60;
            const keys = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            if (keys[e.key]) {
                e.preventDefault();
                S.view.x += keys[e.key][0]; S.view.y += keys[e.key][1];
                CT.render.request();
            }
        });
    }

    function zoomCentre(k) {
        const { w, h } = CT.render.size();
        CT.render.zoomAt(k, w / 2, h / 2);
        CT.render.request();
    }

    // ---------- toolbar, shortcuts ----------

    function initToolbar() {
        $('#renderBtn').addEventListener('click', buildTrees);
        $('#cancelBtn').addEventListener('click', () => {
            jobToken++;
            CT.build.cancel();
            CT.ui.progressEnd();
            $('#renderBtn').removeAttribute('aria-busy');
            markStale();
            CT.ui.toast('Build cancelled. The previous tree is still shown.');
        });
        $('#fitBtn').addEventListener('click', () => CT.render.fit());
        $('#zoomInBtn').addEventListener('click', () => zoomCentre(1.4));
        $('#zoomOutBtn').addEventListener('click', () => zoomCentre(1 / 1.4));
        $('#toggleLabelsBtn').addEventListener('click', () => CT.ui.setShowLabels(!S.showLabels));
        $('#toggleBgBtn').addEventListener('click', () => CT.ui.toggleTheme());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                CT.ui.closeAll();
                if (S.selected != null) CT.inspector.close();
                else if (CT.ui.isNarrow()) CT.ui.setSheetOpen(false);
                return;
            }
            const t = e.target;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (t.closest && t.closest('input, select, textarea, [role="slider"], .popover')) return;
            switch (e.key) {
                case 'f': case 'F': CT.render.fit(); break;
                case 'l': case 'L': CT.ui.setShowLabels(!S.showLabels); break;
                case 't': case 'T': CT.ui.toggleTheme(); break;
                case 'b': case 'B': buildTrees(); break;
                case '+': case '=': zoomCentre(1.4); break;
                case '-': case '_': zoomCentre(1 / 1.4); break;
                default: return;
            }
            e.preventDefault();
        });
    }

    // ---------- startup ----------

    function start() {
        CT.ui.setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);
        CT.ui.buildLegend();
        CT.ui.initSheet();
        CT.controls.init();
        CT.io.init();
        CT.inspector.init();
        CT.render.init($('#mainCanvas'), $('#labels-container'));
        initCanvas();
        initToolbar();

        const stage = $('#stage');
        if (window.ResizeObserver) new ResizeObserver(() => CT.render.resize()).observe(stage);
        else window.addEventListener('resize', () => CT.render.resize());

        let link = null;
        try { link = CT.io.readLink(); }
        catch (e) { CT.ui.toast(`This link could not be opened: ${e.message}`, 'error', 6000); CT.io.clearLink(); }
        // A shared link redraws only the shared tree; it never samples numbers.
        if (link) loadTree(link, { fromLink: true });
        else buildTrees();
    }

    CT.app = { buildTrees, scheduleRebuild, markStale, loadTree, selectRoot, setStart, onModeChange };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
