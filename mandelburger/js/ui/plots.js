// Plotly figures for the analysis bench. Colours come from the CSS tokens so the
// plots follow the light/dark theme.

import { SHEET_COLORS, CATS, swatch, category } from './colors.js';
import { cdist } from '../core/section.js';

const TWO_PI = 2 * Math.PI;
const P = () => window.Plotly;

function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return { ink: v('--ink'), muted: v('--muted'), line: v('--line'), surface: v('--surface'), accent: v('--accent') };
}

function layout(extra = {}) {
  const t = tokens();
  const axis = { gridcolor: t.line, zerolinecolor: t.line, linecolor: t.line, tickcolor: t.line, automargin: true, titlefont: { size: 12 } };
  return {
    paper_bgcolor: t.surface,
    plot_bgcolor: t.surface,
    font: { family: 'IBM Plex Sans, system-ui, sans-serif', color: t.ink, size: 11 },
    margin: { l: 54, r: 14, t: 18, b: 42 },
    showlegend: false,
    hovermode: 'closest',
    ...extra,
    xaxis: { ...axis, ...(extra.xaxis || {}) },
    yaxis: { ...axis, ...(extra.yaxis || {}) },
    ...(extra.yaxis2 ? { yaxis2: { ...axis, ...extra.yaxis2 } } : {}),
  };
}
const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

export function placeholder(el, text) {
  if (!P()) { el.textContent = text; return; }
  const t = tokens();
  P().react(el, [], layout({
    xaxis: { visible: false }, yaxis: { visible: false },
    annotations: [{ text, showarrow: false, font: { color: t.muted, size: 13 }, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }],
  }), config);
}

/** Colour of the slice section θ = θ* wherever it is shown (graph band, phase points). */
const SECTION = '#d98e04';
/** Orbit indices whose angle lies within ±w of θ*. */
function sectionIdx(theta, band) {
  const out = [];
  for (let i = 0; i < theta.length; i++) if (cdist(theta[i], band.theta) <= band.w) out.push(i);
  return out;
}

const comp = (re, im, which) => (which === 're' ? re : which === 'im' ? im : Math.hypot(re, im));

/** Split a structure solution into per-sheet polylines over theta in [0, 2pi]. */
export function sheetsOf(sol) {
  const { c, d, M, FR, FI } = sol;
  const L = TWO_PI * d;
  const sheets = [];
  for (let j = 0; j < c; j++) {
    let cur = null;
    let curSheet = -1;
    for (let m = 0; m <= M; m++) {
      const mm = m % M;
      const phi = (L * m) / M;
      const sheet = Math.min(d - 1, Math.floor(phi / TWO_PI + 1e-12));
      const theta = phi - sheet * TWO_PI;
      const re = FR[j * M + mm], im = FI[j * M + mm];
      if (sheet !== curSheet || m === M) {
        if (cur) {
          // close the previous sheet at theta = 2pi with this point
          cur.theta.push(m === M ? TWO_PI : TWO_PI);
          cur.re.push(re); cur.im.push(im);
        }
        if (m === M) break;
        cur = { j, t: sheet, theta: [], re: [], im: [] };
        sheets.push(cur);
        curSheet = sheet;
      }
      cur.theta.push(theta); cur.re.push(re); cur.im.push(im);
    }
  }
  return sheets;
}

/** band: {theta, w} — the slice section θ* (shaded, with the orbit points it catches), or null. */
export function plotGraph(el, res, which, band = null) {
  const t = tokens();
  const traces = [];
  const o = res.orbit;
  if (o) {
    const y = new Float32Array(o.re.length);
    for (let i = 0; i < y.length; i++) y[i] = comp(o.re[i], o.im[i], which);
    traces.push({
      type: 'scattergl', mode: 'markers', x: o.theta, y,
      marker: { size: 2.5, color: t.muted, opacity: 0.45 }, hoverinfo: 'skip', name: 'orbit',
    });
  }
  const shapes = [];
  if (res.sol) {
    const sheets = sheetsOf(res.sol);
    sheets.forEach((s, i) => {
      const color = SHEET_COLORS[i % SHEET_COLORS.length];
      traces.push({
        type: 'scattergl', mode: 'lines', x: s.theta, y: s.re.map((r, q) => comp(r, s.im[q], which)),
        line: { color, width: 1.8 }, name: `sheet ${i + 1}`,
        hovertemplate: `θ=%{x:.4f}<br>%{y:.6g}<extra>sheet ${i + 1}</extra>`,
      });
    });
    if (which !== 'abs') {
      const { c, M, FR, FI } = res.sol;
      for (let j = 0; j < c; j++) {
        let m = 0;
        for (let q = 0; q < M; q++) m += which === 're' ? FR[j * M + q] : FI[j * M + q];
        m /= M;
        shapes.push({ type: 'line', xref: 'x', yref: 'y', x0: 0, x1: TWO_PI, y0: m, y1: m, line: { color: SHEET_COLORS[(j * res.sol.d) % SHEET_COLORS.length], width: 1, dash: 'dash' } });
      }
    }
  }
  const annotations = [];
  if (band) {
    const half = Math.max(band.w, 0.012);
    for (const [a, b] of wrapInterval(band.theta - half, band.theta + half)) {
      shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: a, x1: b, y0: 0, y1: 1, fillcolor: SECTION, opacity: 0.18, line: { width: 0 }, layer: 'below' });
    }
    shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: band.theta, x1: band.theta, y0: 0, y1: 1, line: { color: SECTION, width: 1, dash: 'dot' } });
    annotations.push({ xref: 'x', yref: 'paper', x: band.theta, y: 1, yanchor: 'bottom', showarrow: false, text: 'θ* (slice)', font: { color: SECTION, size: 11 } });
    if (o) {
      const idx = sectionIdx(o.theta, band);
      traces.push({
        type: 'scattergl', mode: 'markers', x: idx.map((i) => o.theta[i]), y: idx.map((i) => comp(o.re[i], o.im[i], which)),
        marker: { size: 6, color: SECTION, line: { width: 0 } }, name: 'section θ*',
        hovertemplate: `θ=%{x:.4f}<br>%{y:.6g}<extra>at θ*</extra>`,
      });
    }
  }
  const label = which === 're' ? 'Re f' : which === 'im' ? 'Im f' : '|f|';
  P().react(el, traces, layout({
    shapes,
    annotations,
    xaxis: { title: { text: 'θ' }, range: [0, TWO_PI], tickvals: [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, TWO_PI], ticktext: ['0', 'π/2', 'π', '3π/2', '2π'] },
    yaxis: { title: { text: label } },
  }), config);
}

function wrapInterval(a, b) {
  if (a < 0) return [[a + TWO_PI, TWO_PI], [0, b]];
  if (b > TWO_PI) return [[a, TWO_PI], [0, b - TWO_PI]];
  return [[a, b]];
}

export function plotPhase(el, res, band = null) {
  const t = tokens();
  const traces = [];
  if (res.orbit) {
    traces.push({ type: 'scattergl', mode: 'markers', x: res.orbit.re, y: res.orbit.im, marker: { size: 2.5, color: t.muted, opacity: 0.5 }, hoverinfo: 'skip' });
  }
  if (res.sol) {
    const { c, M, FR, FI } = res.sol;
    for (let j = 0; j < c; j++) {
      const x = [], y = [];
      for (let m = 0; m <= M; m++) { x.push(FR[j * M + (m % M)]); y.push(FI[j * M + (m % M)]); }
      traces.push({ type: 'scattergl', mode: 'lines', x, y, line: { color: SHEET_COLORS[(j * res.sol.d) % SHEET_COLORS.length], width: 1.6 }, hovertemplate: `%{x:.6g} %{y:+.6g}i<extra>component ${j + 1}</extra>` });
    }
  }
  if (band && res.orbit) {
    const o = res.orbit, idx = sectionIdx(o.theta, band);
    traces.push({
      type: 'scattergl', mode: 'markers', x: idx.map((i) => o.re[i]), y: idx.map((i) => o.im[i]),
      marker: { size: 7, color: SECTION }, name: 'section θ*', hovertemplate: `%{x:.6g} %{y:+.6g}i<extra>θ ≈ θ*</extra>`,
    });
  }
  P().react(el, traces, layout({
    xaxis: { title: { text: 'Re z' } },
    yaxis: { title: { text: 'Im z' }, scaleanchor: 'x', scaleratio: 1 },
  }), config);
}

export function plotSpectrum(el, sol) {
  const t = tokens();
  const { omega, amp, rho } = sol.spec;
  const x = [], y = [];
  for (let i = 0; i < omega.length; i++) if (amp[i] > 0) { x.push(omega[i]); y.push(amp[i]); }
  const traces = [{ type: 'scatter', mode: 'lines+markers', x, y, marker: { size: 3, color: t.accent }, line: { color: t.accent, width: 1 }, hovertemplate: 'ω=%{x}<br>|f̂|=%{y:.3e}<extra></extra>' }];
  const annotations = [];
  if (Number.isFinite(rho)) {
    annotations.push({ xref: 'paper', yref: 'paper', x: 0.98, y: 0.96, xanchor: 'right', showarrow: false, text: `decay fit ρ ≈ ${rho.toFixed(4)}`, font: { color: t.ink, size: 12 } });
  }
  P().react(el, traces, layout({
    annotations,
    xaxis: { title: { text: 'frequency ω (per radian of θ)' } },
    yaxis: { title: { text: '|f̂(ω)|' }, type: 'log', exponentformat: 'power' },
  }), config);
}

/**
 * The slice diagram: for every parameter along the segment, the orbit values at the recorded
 * indices `idx` (those with θ_n near θ*, see core/section.js), component `which`, coloured by
 * category, with λ underneath. cursorX marks the parameter currently analysed (or null).
 */
export function plotSlice(el, sl, which, idx, cursorX = null) {
  const t = tokens();
  const { ts, lam, k, re, im, keep, xlabel } = sl;
  const xs = [], ys = [], cs = [];
  const catColor = Object.fromEntries(CATS.map((c) => [c.id, swatch(c)]));
  const col = (kk, l) => (Number.isNaN(l) ? null : catColor[category(-1, l, kk)] || t.muted);
  if (keep && idx.length) {
    for (let i = 0; i < ts.length; i++) {
      const c = col(k[i], lam[i]);
      if (!c) continue;
      const base = i * keep;
      for (const q of idx) {
        const r = re[base + q];
        if (Number.isFinite(r)) { xs.push(ts[i]); ys.push(comp(r, im[base + q], which)); cs.push(c); }
      }
    }
  }
  const size = idx.length > 200 ? 1.6 : idx.length > 50 ? 2.2 : 3;
  const traces = [
    { type: 'scattergl', mode: 'markers', x: xs, y: ys, marker: { size, color: cs }, hoverinfo: 'none', yaxis: 'y' },
    { type: 'scatter', mode: 'lines', x: ts, y: Array.from(lam, (v) => (Number.isFinite(v) ? Math.max(-3, v) : null)), line: { color: t.accent, width: 1.4 }, yaxis: 'y2', hovertemplate: 'λ=%{y:.4f}<extra></extra>', connectgaps: false },
  ];
  const shapes = [{ type: 'line', xref: 'paper', yref: 'y2', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: t.muted, width: 1, dash: 'dot' } }];
  if (cursorX != null && Number.isFinite(cursorX)) {
    shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: cursorX, x1: cursorX, y0: 0, y1: 1, line: { color: SECTION, width: 1.5 } });
  }
  const label = which === 're' ? 'Re f(θ*)' : which === 'im' ? 'Im f(θ*)' : '|f(θ*)|';
  P().react(el, traces, layout({
    xaxis: { title: { text: xlabel }, anchor: 'y2' },
    yaxis: { title: { text: label }, domain: [0.34, 1] },
    yaxis2: { title: { text: 'λ' }, domain: [0, 0.28], anchor: 'x', zeroline: true, zerolinecolor: t.muted },
    shapes,
    hovermode: 'x',
  }), config);
}

export function resizeAll(els) {
  if (!P()) return;
  for (const el of els) if (el && el.data) P().Plots.resize(el);
}

export function plotCocycleSpectrum(el, c) {
  const t = tokens();
  const { Lamp, Pamp, Damp } = c.spectrum;
  const m = Array.from({ length: Lamp.length }, (_, k) => k + 1);
  const clean = (a) => Array.from(a, (v) => (v > 1e-17 ? v : null));
  P().react(el, [
    { type: 'scatter', mode: 'lines', x: m, y: Array.from(Damp), name: '1/|e^{imT} − 1|', line: { color: t.muted, width: 1, dash: 'dot' }, hovertemplate: 'm=%{x}<br>1/|e^{imT}−1|=%{y:.3e}<extra></extra>' },
    { type: 'scatter', mode: 'lines', x: m, y: clean(Lamp), name: '|L̃ₘ|', line: { color: SHEET_COLORS[0], width: 1.4 }, hovertemplate: 'm=%{x}<br>|L̃ₘ|=%{y:.3e}<extra></extra>' },
    { type: 'scatter', mode: 'lines', x: m, y: clean(Pamp), name: '|ψₘ|', line: { color: SHEET_COLORS[1], width: 1.4 }, hovertemplate: 'm=%{x}<br>|ψₘ|=%{y:.3e}<extra></extra>' },
  ], layout({
    showlegend: true,
    legend: { orientation: 'h', y: 1.12, x: 0 },
    xaxis: { title: { text: 'frequency m' }, type: 'log' },
    yaxis: { title: { text: 'amplitude' }, type: 'log', exponentformat: 'power' },
  }), config);
}

export function plotCocycleOrbit(el, res) {
  const t = tokens();
  const c = res.cocycle;
  const traces = [];
  if (res.orbit) traces.push({ type: 'scattergl', mode: 'markers', x: res.orbit.re, y: res.orbit.im, marker: { size: 4, color: t.muted, opacity: 0.55 }, name: 'orbit', hoverinfo: 'skip' });
  if (c && c.pred.re.length) traces.push({ type: 'scattergl', mode: 'markers', x: c.pred.re, y: c.pred.im, marker: { size: 1.8, color: SHEET_COLORS[1] }, name: 'closed form', hoverinfo: 'skip' });
  P().react(el, traces, layout({
    showlegend: true,
    legend: { orientation: 'h', y: 1.08, x: 0 },
    xaxis: { title: { text: 'Re z' } },
    yaxis: { title: { text: 'Im z' }, scaleanchor: 'x', scaleratio: 1 },
  }), config);
}
