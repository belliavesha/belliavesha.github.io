/**
 * Hover tooltip (mouse only) and the details card for a clicked/tapped number.
 */
(function () {
    const S = CT.state;
    const $ = CT.$;

    function nodeInfo(node) {
        const mod = S.builtConfig ? S.builtConfig.mod : 2;
        const res = ((node % mod) + mod) % mod;
        return {
            weight: graph.weight.get(node),
            depth: graph.depth.get(node),
            height: graph.height.get(node),
            next: graph.parent.get(node),
            kids: (graph.children.get(node) || []).length,
            res, mod,
        };
    }

    // ---------- tooltip ----------
    function showTooltip(node, sx, sy) {
        const tip = $('#tooltip');
        if (node == null) { tip.hidden = true; return; }
        const i = nodeInfo(node);
        tip.innerHTML = `<b>${CT.fmt(node)}</b><br><span>weight</span> ${CT.fmt(i.weight)} <span>depth</span> ${i.depth}<br><span>height</span> ${CT.fmt(i.height)}`;
        tip.hidden = false;
        const { w, h } = CT.render.size();
        const r = tip.getBoundingClientRect();
        let x = sx + 14, y = sy + 14;
        if (x + r.width > w - 8) x = sx - r.width - 14;
        if (y + r.height > h - 8) y = sy - r.height - 14;
        tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }

    // ---------- details card ----------
    function pathText(node) {
        const parts = [];
        let cur = node, steps = 0;
        const root = graph.root.get(node);
        while (cur !== undefined && steps < 400) {
            parts.push(CT.fmt(cur));
            if (cur === root) break;
            cur = graph.parent.get(cur);
            steps++;
        }
        const shown = parts.length > 9 ? parts.slice(0, 5).concat('…', parts.slice(-2)) : parts;
        return { text: shown.join(' → '), steps };
    }

    function open(node) {
        S.selected = node;
        const card = $('#inspector');
        const i = nodeInfo(node);
        $('#inspValue').textContent = CT.fmt(node);
        $('#inspNext').textContent = i.next != null ? CT.fmt(i.next) : '—';
        $('#inspResLabel').textContent = `mod ${i.mod}`;
        $('#inspRes').textContent = i.res;
        $('#inspDepth').textContent = i.depth;
        $('#inspHeight').textContent = CT.fmt(i.height);
        $('#inspWeight').textContent = CT.fmt(i.weight);
        $('#inspKids').textContent = i.kids;
        const p = pathText(node);
        $('#inspPath').textContent = p.text;
        $('#inspPath').title = `${p.steps} steps to the root`;
        $('#inspPathBtn').setAttribute('aria-pressed', String(S.showPath));
        card.hidden = false;
        CT.render.request();
    }

    function close() {
        S.selected = null;
        $('#inspector').hidden = true;
        CT.render.request();
    }

    function init() {
        $('#inspClose').addEventListener('click', () => { close(); $('#mainCanvas').focus(); });
        $('#inspStart').addEventListener('click', () => { if (S.selected != null) CT.app.setStart(S.selected, true); });
        $('#inspPathBtn').addEventListener('click', () => {
            S.showPath = !S.showPath;
            $('#inspPathBtn').setAttribute('aria-pressed', String(S.showPath));
            CT.render.request();
        });
        $('#inspCopy').addEventListener('click', async () => {
            if (S.selected == null) return;
            try { await navigator.clipboard.writeText(String(S.selected)); CT.ui.toast(`Copied ${S.selected}.`); }
            catch (e) { CT.ui.toast('Copying is not allowed here.', 'error'); }
        });
        $('#inspector').addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); $('#mainCanvas').focus(); } });
    }

    CT.inspector = { init, open, close, showTooltip, refresh() { if (S.selected != null && graph.root.has(S.selected)) open(S.selected); else if (S.selected != null) close(); } };
})();
