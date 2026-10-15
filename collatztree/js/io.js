/**
 * Loading and saving: presets, uploaded tree files, tree data (v1.0 format,
 * unchanged), PNG/SVG images, and share links for small trees.
 *
 * Share links carry the tree's leaves, so opening one rebuilds exactly that
 * tree from its leaves; it never samples or runs "Build trees".
 */
(function () {
    const S = CT.state;
    const $ = CT.$;
    const LINK_MAX_LEAVES = 400;
    const LINK_MAX_CHARS = 4000;

    function download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ---------- tree data (JSON) ----------

    /** Check a tree file and return a clean copy, or throw with a readable message. */
    function parseTreeData(d, { maxLeaves = Infinity } = {}) {
        if (!d || typeof d !== 'object' || !d.config) throw new Error('This is not a tree file.');
        const mod = Number(d.config.modulus);
        if (!Number.isInteger(mod) || mod < 2 || mod > 12) throw new Error('Modulus must be a whole number from 2 to 12.');
        const rules = d.config.rules;
        if (!Array.isArray(rules) || rules.length < mod) throw new Error(`Expected ${mod} rules.`);
        for (const r of rules.slice(0, mod)) {
            const err = ruleSafetyError(String(r));
            if (err) throw new Error(`Rule "${String(r).slice(0, 40)}" is not allowed. ${err}.`);
        }
        const leaves = d.leaves;
        if (!Array.isArray(leaves) || leaves.length === 0 || !leaves.every(Number.isInteger)) throw new Error('The file has no valid leaves.');
        if (leaves.length > maxLeaves) throw new Error(`Too many leaves for a link (${leaves.length}).`);
        const angles = Array.isArray(d.config.angles) ? d.config.angles.map(Number) : [];
        return {
            root: Number(d.root),
            leaves: leaves.slice(),
            start: d.start != null && Number.isSafeInteger(Number(d.start)) ? Number(d.start) : null,
            config: {
                modulus: mod,
                rules: rules.slice(0, mod).map(String),
                angles: angles.slice(0, mod).map(a => Number.isFinite(a) ? Math.max(-90, Math.min(90, a)) : 0),
                initAngle: Number.isFinite(Number(d.config.initAngle)) ? Math.max(-180, Math.min(180, Number(d.config.initAngle))) : 0,
            },
        };
    }

    function currentTreeData() {
        if (S.currentRoot == null || !graph.trees[S.currentRoot] || !S.builtConfig) return null;
        return {
            version: '1.0',
            root: S.currentRoot,
            leaves: CT.layout.leavesOf(S.currentRoot),
            config: {
                modulus: S.builtConfig.mod,
                rules: S.builtConfig.rules.slice(),
                angles: CT.controls.getAngles(),
                initAngle: CT.controls.getInitAngle(),
            },
        };
    }

    function saveTreeData() {
        const data = currentTreeData();
        if (!data) { CT.ui.toast('There is no tree to save yet.', 'error'); return; }
        const rulesStr = data.config.rules.map(r => r.replace(/\*/g, '×').replace(/\//g, '÷').replace(/ /g, '')).join('_');
        download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `tree-${data.root}-rules-${rulesStr}.json`);
        CT.ui.toast(`Saved tree ${data.root} (${CT.fmt(data.leaves.length)} leaves).`);
    }

    async function loadPreset(path) {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = parseTreeData(await res.json());
            await CT.app.loadTree(d);
        } catch (e) {
            const hint = location.protocol === 'file:' ? ' Presets need the page to be served over http(s).' : '';
            CT.ui.toast(`Could not load the preset: ${e.message}.${hint}`, 'error', 6000);
        }
    }

    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const d = parseTreeData(JSON.parse(reader.result));
                await CT.app.loadTree(d);
            } catch (e) {
                CT.ui.toast(`Could not open ${file.name}: ${e.message}`, 'error', 6000);
            }
        };
        reader.readAsText(file);
    }

    // ---------- images ----------

    function exportOptions() {
        return {
            size: parseInt($('#expSize').value, 10),
            labels: $('#expLabels').checked,
            transparent: $('#expTransparent').checked,
        };
    }

    function savePNG() {
        if (!S.layout) { CT.ui.toast('There is no tree to save yet.', 'error'); return; }
        const c = CT.render.exportCanvas(exportOptions());
        c.toBlob((blob) => {
            if (!blob) { CT.ui.toast('The image is too large for this browser. Try a smaller size.', 'error'); return; }
            download(blob, `collatz-tree-${S.currentRoot}.png`);
            CT.ui.toast(`Saved a ${c.width} × ${c.height} px image.`);
        }, 'image/png');
    }

    function saveSVG() {
        if (!S.layout) { CT.ui.toast('There is no tree to save yet.', 'error'); return; }
        const svg = CT.render.exportSVG(exportOptions());
        download(new Blob([svg], { type: 'image/svg+xml' }), `collatz-tree-${S.currentRoot}.svg`);
        CT.ui.toast('Saved an SVG image.');
    }

    // ---------- share links ----------

    function encodeLeaves(leaves) {
        const sorted = leaves.slice().sort((a, b) => a - b);
        let prev = 0;
        return sorted.map((v, i) => { const d = i === 0 ? v : v - prev; prev = v; return d.toString(36); }).join('.');
    }

    function decodeLeaves(str) {
        let acc = 0;
        return str.split('.').map((t, i) => { const d = parseInt(t, 36); acc = i === 0 ? d : acc + d; return acc; });
    }

    /** Link for the current tree, or {error} when it is too large to share this way. */
    function shareLink() {
        const d = currentTreeData();
        if (!d) return { error: 'There is no tree to share yet.' };
        if (d.leaves.length > LINK_MAX_LEAVES) {
            return { error: `This tree has ${CT.fmt(d.leaves.length)} leaves, too many for a link (up to ${LINK_MAX_LEAVES}). Save it as tree data instead.` };
        }
        const p = new URLSearchParams();
        p.set('m', d.config.modulus);
        p.set('r', d.config.rules.join(';'));
        p.set('a', d.config.angles.map(a => +a.toFixed(1)).join(','));
        p.set('i', +d.config.initAngle.toFixed(1));
        p.set('root', d.root);
        const t = graph.trees[d.root];
        if (t && t.startValue != null) p.set('s', t.startValue);
        p.set('l', encodeLeaves(d.leaves));
        const url = location.origin + location.pathname + '#' + p.toString();
        if (url.length > LINK_MAX_CHARS) return { error: 'This tree is too large for a link. Save it as tree data instead.' };
        return { url };
    }

    function updateShareButton() {
        const b = $('#shareBtn');
        const r = shareLink();
        b.setAttribute('aria-disabled', String(!!r.error));
        b.title = r.error ? r.error : 'Copy link to this tree';
    }

    async function copyShareLink() {
        const r = shareLink();
        if (r.error) { CT.ui.toast(r.error, 'error', 5000); return; }
        let ok = false;
        try { await navigator.clipboard.writeText(r.url); ok = true; } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = r.url; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
            ta.remove();
        }
        history.replaceState(null, '', r.url);
        CT.ui.toast(ok ? 'Link copied. Opening it redraws this tree without sampling.' : 'Link is in the address bar; copy it from there.');
    }

    /** Tree data from the page's #hash, or null. Throws for a malformed link. */
    function readLink() {
        const h = location.hash.slice(1);
        if (!h) return null;
        const p = new URLSearchParams(h);
        if (!p.has('l') || !p.has('m') || !p.has('r')) return null;
        const mod = parseInt(p.get('m'), 10);
        const raw = p.get('l');
        if (raw.length > LINK_MAX_CHARS) throw new Error('the link is too long');
        return parseTreeData({
            root: parseInt(p.get('root'), 10),
            start: p.has('s') ? parseInt(p.get('s'), 10) : null,
            leaves: decodeLeaves(raw),
            config: {
                modulus: mod,
                rules: p.get('r').split(';'),
                angles: (p.get('a') || '').split(',').map(Number),
                initAngle: Number(p.get('i') || 0),
            },
        }, { maxLeaves: LINK_MAX_LEAVES });
    }

    function clearLink() {
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }

    // ---------- wiring ----------

    function init() {
        CT.ui.popover($('#loadTreeBtn'));
        CT.ui.popover($('#exportBtn'));
        CT.$$('#loadMenu [data-file]').forEach(item => item.addEventListener('click', () => {
            CT.ui.closeAll();
            loadPreset(item.dataset.file);
        }));
        $('#uploadOption').addEventListener('click', () => { CT.ui.closeAll(); $('#loadTreeFile').click(); });
        $('#loadTreeFile').addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (f) loadFile(f);
            e.target.value = '';
        });
        $('#saveImgBtn').addEventListener('click', savePNG);
        $('#saveSvgBtn').addEventListener('click', saveSVG);
        $('#saveTreeBtn').addEventListener('click', saveTreeData);
        $('#shareBtn').addEventListener('click', copyShareLink);

        // dropping a tree file anywhere on the page loads it
        document.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
        document.addEventListener('drop', (e) => {
            const f = e.dataTransfer && e.dataTransfer.files[0];
            if (!f) return;
            e.preventDefault();
            loadFile(f);
        });
    }

    CT.io = { init, readLink, clearLink, updateShareButton, savePNG, saveSVG, saveTreeData, parseTreeData, shareLink };
})();
