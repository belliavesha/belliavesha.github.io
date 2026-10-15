/**
 * Shared application state. Every module hangs off the global CT namespace
 * (classic scripts, so the page also works when opened straight from disk).
 */
window.CT = window.CT || {};

CT.LABEL_TYPES = [
    // type      legend name     colour
    { type: 'root',   name: 'Root',        color: '#9b59b6' },
    { type: 'target', name: 'Cycle start', color: '#4facfa' },
    { type: 'deep',   name: 'Longest',     color: '#2ecc71' },
    { type: 'max',    name: 'Highest',     color: '#d15858' },
    { type: 'min',    name: 'Smallest',    color: '#f1c40f' },
    { type: 'start',  name: 'Highlighted', color: '#ff8c00' },
];

CT.TREE_BG = { dark: '#150010', light: '#fff0fa' };

CT.state = {
    // viewport: screen = canvasCentre + (x, y) + world * zoom   (CSS pixels)
    view: { x: 0, y: 0, zoom: 1 },
    currentRoot: null,
    ruleSet: null,          // RuleSet the current graph was built with
    builtConfig: null,      // { mod, rules } of the current graph
    showLabels: true,
    labels: { root: true, target: true, deep: true, max: true, min: true, start: true },
    theme: 'dark',
    selected: null,         // inspected node
    showPath: true,         // highlight the selected node's path to the root
    layout: null,           // cached layout (see layout.js)
    layoutDirty: true,
};

/** Small helpers used everywhere */
CT.$ = (sel, root = document) => root.querySelector(sel);
CT.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
CT.fmt = (n) => (typeof n === 'number' && Math.abs(n) >= 1e4) ? n.toLocaleString('en-US') : String(n);
/** Short form for tight spots: 2,364 -> 2.4k, 11006526576 -> 1.1e10 */
CT.fmtShort = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
    const a = Math.abs(n);
    if (a < 1e4) return String(n);
    if (a < 1e6) return (n / 1e3).toFixed(a < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'k';
    if (a < 1e9) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    return n.toExponential(1).replace('e+', 'e');
};
CT.storage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};
