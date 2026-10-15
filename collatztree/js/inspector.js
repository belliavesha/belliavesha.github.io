/**
 * Hover tooltip (mouse only) and the details card for a clicked/tapped number.
 *
 * The card's three rows are buttons:
 *   next / mod         → pick the next number (the parent)
 *   depth / height     → table of the path to the root
 *   weight / children  → table of the children (numbers that lead here)
 * Clicking a table row picks that number. Path rows use the legend colours:
 * the picked n (longest) green, largest n red, the smallest n in yellow when
 * it is below the root,
 * root purple, and the cycle start in blue under the root.
 */
(function () {
    const S = CT.state;
    const $ = CT.$;
    const PATH_LIMIT = 20000;    // table rows at most
    let mode = null;             // null | 'path' | 'children' — kept while the page is open

    function modOf() { return S.builtConfig ? S.builtConfig.mod : 2; }
    function residue(n, mod) { return ((n % mod) + mod) % mod; }

    function nodeInfo(node) {
        const mod = modOf();
        return {
            weight: graph.weight.get(node),
            depth: graph.depth.get(node),
            height: graph.height.get(node),
            next: graph.parent.get(node),
            kids: (graph.children.get(node) || []).length,
            res: residue(node, mod), mod,
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

    // ---------- tables ----------

    /** Numbers from `node` down to its root, inclusive. */
    function pathNodes(node) {
        const out = [];
        const root = graph.root.get(node);
        let cur = node;
        while (cur !== undefined && out.length < PATH_LIMIT) {
            out.push(cur);
            if (cur === root) break;
            cur = graph.parent.get(cur);
        }
        return out;
    }

    function row(n, type, mod) {
        const cls = type ? ` class="t-${type}"` : '';
        const t = type ? ` title="${CT.LABEL_TYPES.find(x => x.type === type).name}"` : '';
        return `<tr data-n="${n}" tabindex="0"${cls}${t || ` title="Pick ${CT.fmt(n)}"`}><td>${graph.depth.get(n)}</td><td>${CT.fmt(n)}</td><td>${residue(n, mod)}</td><td>${CT.fmt(graph.weight.get(n))}</td></tr>`;
    }

    function renderPath(node) {
        const mod = modOf();
        const nodes = pathNodes(node);
        const root = nodes[nodes.length - 1];
        const isRoot = root === graph.root.get(node);
        // which rows get legend colours (same priorities as the labels)
        // yellow only when the path dips below its root
        let maxN = nodes[0], minN = nodes[0];
        for (const n of nodes) {
            if (n > maxN) maxN = n;
            if (n < minN) minN = n;
        }
        if (!(minN < root)) minN = null;
        const typeOf = (n) => {
            if (isRoot && n === root) return 'root';
            if (n === node) return 'deep';
            if (n === maxN) return 'max';
            if (n === minN) return 'min';
            return '';
        };
        const rows = nodes.map(n => row(n, typeOf(n), mod));
        // the cycle start, under the root
        const target = isRoot ? graph.parent.get(root) : undefined;
        if (target !== undefined && graph.root.has(target)) rows.push(row(target, 'target', mod));
        $('#inspTbody').innerHTML = rows.join('');
        $('#inspCap').textContent = `Path to the root · ${nodes.length - 1} steps`;
    }

    function renderChildren(node) {
        const mod = modOf();
        const kids = (graph.children.get(node) || []).slice().sort((a, b) => a - b);
        $('#inspTbody').innerHTML = kids.length
            ? kids.map(n => row(n, '', mod)).join('')
            : '<tr><td colspan="4" class="empty">No children: nothing in the sample leads here.</td></tr>';
        $('#inspCap').textContent = `Children of ${CT.fmt(node)} · ${kids.length}`;
    }

    function showTable(m) {
        mode = m;
        const card = $('#inspector');
        $('#inspTableWrap').hidden = !m;
        card.classList.toggle('has-table', !!m);
        $('#rowDepth').setAttribute('aria-expanded', String(m === 'path'));
        $('#rowWeight').setAttribute('aria-expanded', String(m === 'children'));
        if (!m) { setHover(null); return; }
        if (S.selected == null) return;
        if (m === 'path') renderPath(S.selected); else renderChildren(S.selected);
        $('#inspTableWrap').scrollTop = 0;
    }

    function setHover(n) {
        if (S.hoverNode === n) return;
        S.hoverNode = n;
        CT.render.request();
    }

    // ---------- details card ----------
    function open(node) {
        S.selected = node;
        S.hoverNode = null;
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
        $('#inspModHead').title = `n mod ${i.mod}`;
        const nextOk = i.next != null && graph.root.has(i.next);
        $('#rowNext').disabled = !nextOk;
        $('#rowNext').title = nextOk ? `Go to ${CT.fmt(i.next)}` : '';
        $('#inspPathBtn').setAttribute('aria-pressed', String(S.showPath));
        card.hidden = false;
        showTable(mode);
        CT.render.request();
    }

    /** Pick another number from the card (keeps the open table type). */
    function pick(n) {
        if (n == null || !graph.root.has(n)) return;
        if (graph.root.get(n) !== S.currentRoot) return;
        open(n);
    }

    function close() {
        S.selected = null;
        S.hoverNode = null;
        $('#inspector').hidden = true;
        CT.render.request();
    }

    function init() {
        $('#inspClose').addEventListener('click', () => { close(); $('#mainCanvas').focus(); });
        $('#inspCollapse').addEventListener('click', () => {
            const was = mode;
            showTable(null);
            (was === 'children' ? $('#rowWeight') : $('#rowDepth')).focus({ preventScroll: true });
        });
        $('#rowNext').addEventListener('click', () => { if (S.selected != null) pick(graph.parent.get(S.selected)); });
        $('#rowDepth').addEventListener('click', () => showTable(mode === 'path' ? null : 'path'));
        $('#rowWeight').addEventListener('click', () => showTable(mode === 'children' ? null : 'children'));

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
        $('#inspector').addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            if (mode) showTable(null);
            else { close(); $('#mainCanvas').focus(); }
        });

        // table rows: click / Enter picks; hover rings the number on the tree
        const body = $('#inspTbody');
        body.addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-n]');
            if (tr) pick(Number(tr.dataset.n));
        });
        body.addEventListener('keydown', (e) => {
            const tr = e.target.closest('tr[data-n]');
            if (!tr) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(Number(tr.dataset.n)); }
            if (e.key === 'ArrowDown' && tr.nextElementSibling) { e.preventDefault(); tr.nextElementSibling.focus(); }
            if (e.key === 'ArrowUp' && tr.previousElementSibling) { e.preventDefault(); tr.previousElementSibling.focus(); }
        });
        body.addEventListener('focusin', (e) => {
            const tr = e.target.closest('tr[data-n]');
            if (tr) setHover(Number(tr.dataset.n));
        });
        const wrap = $('#inspTableWrap');
        wrap.addEventListener('pointerover', (e) => {
            const tr = e.target.closest('tr[data-n]');
            setHover(tr ? Number(tr.dataset.n) : null);
        });
        wrap.addEventListener('pointerleave', () => setHover(null));
    }

    CT.inspector = {
        init, open, close, showTooltip,
        refresh() {
            if (S.selected != null && graph.root.has(S.selected) && graph.root.get(S.selected) === S.currentRoot) open(S.selected);
            else if (S.selected != null) close();
        },
    };
})();
