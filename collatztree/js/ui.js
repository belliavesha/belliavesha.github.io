/**
 * Small UI pieces: toasts, popovers/menus, progress, theme, legend, bottom sheet.
 */
(function () {
    const S = CT.state;
    const $ = CT.$;

    // ---------- toasts ----------
    function toast(message, kind = 'info', ms = 3600) {
        const box = $('#toasts');
        const el = document.createElement('div');
        el.className = 'toast' + (kind === 'error' ? ' error' : '');
        el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        el.textContent = message;
        box.appendChild(el);
        while (box.children.length > 3) box.firstChild.remove();
        setTimeout(() => {
            el.classList.add('leaving');
            setTimeout(() => el.remove(), 300);
        }, ms);
    }

    // ---------- popovers ----------
    const popovers = [];

    /** button[aria-controls] toggles a [hidden] popover; menus get arrow-key navigation. */
    function popover(button, { onOpen } = {}) {
        const pop = document.getElementById(button.getAttribute('aria-controls'));
        const isMenu = pop.getAttribute('role') === 'menu';
        const items = () => CT.$$('button, input, select', pop).filter(x => !x.disabled);
        const open = (focusFirst = false) => {
            closeAll(pop);
            pop.hidden = false;
            button.setAttribute('aria-expanded', 'true');
            if (onOpen) onOpen();
            if (focusFirst || isMenu) { const f = items()[0]; if (f) f.focus(); }
        };
        const close = (returnFocus = false) => {
            if (pop.hidden) return;
            pop.hidden = true;
            button.setAttribute('aria-expanded', 'false');
            if (returnFocus) button.focus();
        };
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            pop.hidden ? open(e.detail === 0) : close();
        });
        button.addEventListener('keydown', (e) => {
            if (isMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); open(true); }
        });
        pop.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(true); return; }
            if (!isMenu) return;
            const list = items();
            const i = list.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
            if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
            if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
            if (e.key === 'Tab') close();
        });
        const entry = { pop, button, close };
        popovers.push(entry);
        return entry;
    }

    function closeAll(except) {
        for (const p of popovers) if (p.pop !== except) p.close();
    }

    document.addEventListener('pointerdown', (e) => {
        for (const p of popovers) {
            if (!p.pop.hidden && !p.pop.contains(e.target) && !p.button.contains(e.target)) p.close();
        }
    });

    // ---------- progress ----------
    let progressTimer = null;
    function progressStart() {
        clearTimeout(progressTimer);
        $('#progressBar').style.width = '0%';
        $('#progressPct').textContent = '0%';
        // only show for builds that take a noticeable time
        progressTimer = setTimeout(() => { $('#progress').hidden = false; }, 250);
    }
    function progressSet(f) {
        const pct = Math.round(f * 100) + '%';
        $('#progressBar').style.width = pct;
        $('#progressPct').textContent = pct;
    }
    function progressEnd() {
        clearTimeout(progressTimer);
        $('#progress').hidden = true;
    }

    // ---------- theme ----------
    function setTheme(theme, save = true) {
        S.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        const btn = $('#toggleBgBtn');
        const light = theme === 'light';
        btn.setAttribute('aria-pressed', String(light));
        if (save) CT.storage.set('ct-theme', theme);
        CT.render.request();
    }
    function toggleTheme() { setTheme(S.theme === 'dark' ? 'light' : 'dark'); }

    // ---------- labels / legend ----------
    function buildLegend() {
        const ul = CT.$('.legend-items');
        ul.innerHTML = '';
        for (const t of CT.LABEL_TYPES) {
            const li = document.createElement('li');
            li.innerHTML = `<button type="button" class="legend-item" data-type="${t.type}" aria-pressed="true">
                <span class="swatch" style="--c:${t.color}"></span><span class="name">${t.name}</span></button>`;
            ul.appendChild(li);
        }
        ul.addEventListener('click', (e) => {
            const b = e.target.closest('.legend-item');
            if (!b) return;
            const type = b.dataset.type;
            if (!S.showLabels) { S.labels[type] = true; setShowLabels(true); return; }
            S.labels[type] = !S.labels[type];
            b.setAttribute('aria-pressed', String(S.labels[type]));
            CT.render.request();
        });
        const toggle = $('#legendToggle');
        toggle.addEventListener('click', () => setLegendOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    }

    function setLegendOpen(open) {
        $('#legendToggle').setAttribute('aria-expanded', String(open));
        $('#legendBody').hidden = !open;
        CT.storage.set('ct-legend', open ? '1' : '0');
    }

    function setShowLabels(on) {
        S.showLabels = on;
        const b = $('#toggleLabelsBtn');
        b.setAttribute('aria-pressed', String(on));
        CT.$$('.legend-item').forEach(x => x.setAttribute('aria-pressed', String(on && S.labels[x.dataset.type])));
        CT.render.request();
    }

    function updateRamp() {
        const t = graph.trees[S.currentRoot];
        $('#rampLo').textContent = '1';
        $('#rampHi').textContent = t ? CT.fmtShort(t.highestNode) : '—';
        $('#rampHi').title = t ? CT.fmt(t.highestNode) : '';
    }

    // ---------- bottom sheet (narrow screens) ----------
    const narrowMQ = window.matchMedia('(max-width: 860px)');
    function isNarrow() { return narrowMQ.matches; }
    function setSheetOpen(open) {
        $('#panel').classList.toggle('is-open', open);
        const t = $('#sheetToggle');
        t.setAttribute('aria-expanded', String(open));
        t.setAttribute('aria-label', open ? 'Hide controls' : 'Show controls');
    }
    function initSheet() {
        $('#sheetToggle').addEventListener('click', () => setSheetOpen(!$('#panel').classList.contains('is-open')));
        // swipe the sheet header up/down
        let y0 = null;
        const head = CT.$('.panel-head');
        head.addEventListener('pointerdown', (e) => { if (isNarrow() && e.pointerType !== 'mouse') y0 = e.clientY; });
        head.addEventListener('pointerup', (e) => {
            if (y0 == null) return;
            const dy = e.clientY - y0; y0 = null;
            if (dy < -30) setSheetOpen(true);
            if (dy > 30) setSheetOpen(false);
        });
        const legendDefault = CT.storage.get('ct-legend');
        setLegendOpen(legendDefault ? legendDefault === '1' : !isNarrow());
    }

    CT.ui = {
        toast, popover, closeAll, progressStart, progressSet, progressEnd,
        setTheme, toggleTheme, buildLegend, setShowLabels, updateRamp,
        initSheet, setSheetOpen, isNarrow,
    };
})();
