/**
 * Loading and saving: presets, uploaded tree files, tree data (v1.0 format,
 * unchanged), PNG/SVG images, and share links.
 *
 * Share links carry only settings: rules, angles, and either the sample
 * (count, lower limit, range, seed) or the preset's name. Opening one rebuilds
 * the tree from them; the seed makes the random sample come out the same.
 * Links are offered for samples of up to LINK_MAX_SAMPLES numbers.
 */
(function () {
    const S = CT.state;
    const $ = CT.$;
    const LINK_MAX_SAMPLES = 5000;
    const LINK_MAX_CHARS = 4000;

    function download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ---------- tree data (JSON) ----------

    /** Check rules/angles and return a clean config, or throw with a readable message. */
    function parseConfig(c) {
        const mod = Number(c.modulus);
        if (!Number.isInteger(mod) || mod < 2 || mod > 12) throw new Error('Modulus must be a whole number from 2 to 12.');
        const rules = c.rules;
        if (!Array.isArray(rules) || rules.length < mod) throw new Error(`Expected ${mod} rules.`);
        for (const r of rules.slice(0, mod)) {
            const err = ruleSafetyError(String(r));
            if (err) throw new Error(`Rule "${String(r).slice(0, 40)}" is not allowed. ${err}.`);
        }
        return {
            modulus: mod,
            rules: rules.slice(0, mod).map(String),
            angles: cleanAngles(c.angles, mod),
            initAngle: cleanInit(c.initAngle),
        };
    }
    function cleanAngles(a, mod) {
        const arr = Array.isArray(a) ? a.map(Number) : [];
        return arr.slice(0, mod).map(x => Number.isFinite(x) ? Math.max(-90, Math.min(90, x)) : 0);
    }
    function cleanInit(v) {
        return Number.isFinite(Number(v)) ? Math.max(-180, Math.min(180, Number(v))) : 0;
    }

    /** Check a tree file and return a clean copy, or throw with a readable message. */
    function parseTreeData(d) {
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

    /** The ready-made trees offered in the Load menu (also the only presets a link may name). */
    function presetFiles() {
        return CT.$$('#loadMenu [data-file]').map(el => el.dataset.file);
    }

    /** Load a ready-made tree; a link can override its angles and start value. */
    async function loadPreset(path, { angles = null, initAngle = null, start = null, fromLink = false } = {}) {
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = parseTreeData(await res.json());
            if (angles && angles.length) d.config.angles = cleanAngles(angles, d.config.modulus);
            if (initAngle != null) d.config.initAngle = cleanInit(initAngle);
            if (start != null) d.start = start;
            await CT.app.loadTree(d, { source: { type: 'preset', file: path }, fromLink });
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
                await CT.app.loadTree(d, { source: { type: 'file' } });
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

    /** Link for the current tree, or {error} when a link can't rebuild it. */
    function shareLink() {
        const src = S.source;
        if (!src || S.currentRoot == null || !graph.trees[S.currentRoot] || !S.builtConfig) {
            return { error: 'There is no tree to share yet.' };
        }
        if (src.type === 'file') {
            return { error: 'This tree was opened from a file, so a link can\'t rebuild it. Save the tree data and share the file instead.' };
        }
        const p = new URLSearchParams();
        if (src.type === 'preset') {
            p.set('p', src.file.replace(/^data\//, ''));
        } else {
            const n = Math.min(src.count, src.range);
            if (n > LINK_MAX_SAMPLES) {
                return { error: `This tree is built from ${CT.fmt(n)} samples, too many for a link (up to ${CT.fmt(LINK_MAX_SAMPLES)}). Save the tree data instead.` };
            }
            p.set('m', S.builtConfig.mod);
            p.set('r', S.builtConfig.rules.join(';'));
            p.set('n', src.count);
            p.set('lo', src.min);
            p.set('rg', src.range);
            p.set('sd', src.seed.toString(36));
        }
        p.set('a', CT.controls.getAngles().map(a => +a.toFixed(1)).join(','));
        p.set('i', +CT.controls.getInitAngle().toFixed(1));
        p.set('t', S.currentRoot);
        const t = graph.trees[S.currentRoot];
        if (t.startValue != null) p.set('s', t.startValue);
        const url = location.origin + location.pathname + '#' + p.toString();
        if (url.length > LINK_MAX_CHARS) return { error: 'The rules are too long for a link. Save the tree data instead.' };
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
        CT.ui.toast(ok ? 'Link copied. Opening it rebuilds this tree from its settings.' : 'Link is in the address bar; copy it from there.');
    }

    /** Settings from the page's #hash, or null. Throws for a malformed link. */
    function readLink() {
        const h = location.hash.slice(1);
        if (!h) return null;
        if (h.length > LINK_MAX_CHARS) throw new Error('the link is too long');
        const p = new URLSearchParams(h);
        const int = (k) => {
            if (!p.has(k)) return null;
            const v = Number(p.get(k));
            if (!Number.isSafeInteger(v)) throw new Error(`"${k}" is not a whole number`);
            return v;
        };
        const angles = (p.get('a') || '').split(',').filter(x => x !== '').map(Number);
        const initAngle = p.has('i') ? Number(p.get('i')) : 0;
        const root = int('t'), start = int('s');

        if (p.has('p')) {
            const file = 'data/' + p.get('p');
            if (!presetFiles().includes(file)) throw new Error('it names an unknown ready-made tree');
            return { kind: 'preset', file, angles, initAngle, root, start };
        }
        if (!p.has('m') || !p.has('r') || !p.has('n')) return null;
        const config = parseConfig({ modulus: p.get('m'), rules: p.get('r').split(';'), angles, initAngle });
        const sample = { count: int('n'), min: int('lo') ?? 1, range: int('rg') ?? 1000, seed: parseInt(p.get('sd') || '0', 36) >>> 0 };
        if (sample.count < 1 || sample.range < 1) throw new Error('the sample settings are not valid');
        if (Math.min(sample.count, sample.range) > LINK_MAX_SAMPLES) throw new Error(`it asks for more than ${CT.fmt(LINK_MAX_SAMPLES)} samples`);
        return { kind: 'sample', config, sample, root, start };
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

    CT.io = { init, readLink, clearLink, updateShareButton, savePNG, saveSVG, saveTreeData, parseTreeData, shareLink, loadPreset };
})();
