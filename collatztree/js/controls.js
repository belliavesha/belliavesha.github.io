/**
 * Control panel: sample fields, tree picking, modulus, rule rows with
 * angle knobs. Validation marks fields in place (border + tooltip),
 * so it never adds lines to the panel.
 */
(function () {
    const $ = CT.$;
    const knobs = { init: null, branch: [] };

    // Same defaults as before, per modulus
    function defaultRule(mod, i) {
        if (mod === 2) return i === 0 ? 'n/2' : '3*n+1';
        if (mod === 3) return ['n/3', '2*n+1', '(4*n+2)/3'][i];
        if (mod === 4) return ['(n/2) + 1', '(3*n) + 1', '(n/2) - 1', '(3*n) + 1'][i];
        return 'n';
    }
    function defaultAngle(mod, i) {
        if (mod === 2) return [7.5, -15][i];
        if (mod === 3) return [30, -45, 0][i];
        if (mod === 4) return [10, -20, -10, 20][i];
        return (i % 2) === 0 ? 15 : -15;
    }

    function readMod() {
        const v = parseInt($('#modulus').value, 10);
        return Number.isInteger(v) && v >= 2 && v <= 12 ? v : null;
    }

    function rowsMod() { return knobs.branch.length; }

    /** Rebuild the rule rows for `mod`; rules/angles default unless given. */
    function setupRules(mod, rules = null, angles = null) {
        const grid = $('#dynamic-grid');
        grid.innerHTML = '';
        knobs.branch = [];
        for (let i = 0; i < mod; i++) {
            const row = document.createElement('div');
            row.className = 'rule-row';
            row.innerHTML = `
                <label class="res" for="rule${i}" title="n % ${mod} = ${i}"><span aria-hidden="true">≡${i}</span><span class="sr-only">Rule for n mod ${mod} equal to ${i}</span></label>
                <input type="text" class="rule-input" id="rule${i}" data-index="${i}" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">
                <div class="knob-slot"></div>`;
            grid.appendChild(row);
            const input = row.querySelector('input');
            input.value = rules && rules[i] != null ? rules[i] : defaultRule(mod, i);
            input.addEventListener('input', () => { if (validateRuleInput(input)) CT.app.scheduleRebuild(); else CT.app.markStale(); });
            validateRuleInput(input);

            const a = angles && angles[i] != null ? angles[i] : defaultAngle(mod, i);
            const knob = new CT.Knob(row.querySelector('.knob-slot'), {
                min: -90, max: 90, value: a, defaultValue: defaultAngle(mod, i),
                step: 0.1, dragRate: 0.15, fineRate: 0.02,
                label: `Branch angle for n ≡ ${i}`,
                onInput: () => CT.render.invalidateLayout(),
            });
            knobs.branch.push(knob);
        }
    }

    function validateRuleInput(input) {
        const mod = rowsMod() || readMod() || 2;
        const i = parseInt(input.dataset.index, 10);
        const r = validateRule(input.value, mod, i);
        input.classList.toggle('invalid', !!r.error);
        input.setAttribute('aria-invalid', String(!!r.error));
        input.title = r.error ? r.error : `n % ${mod} = ${i}:  ${r.example}`;
        return !r.error;
    }

    function rulesValid() {
        return CT.$$('.rule-input').every(validateRuleInput);
    }

    function intField(id, { min = -Infinity } = {}) {
        const el = $('#' + id);
        const v = Number(el.value);
        const ok = el.value.trim() !== '' && Number.isInteger(v) && v >= min;
        el.classList.toggle('invalid', !ok);
        el.setAttribute('aria-invalid', String(!ok));
        el.title = ok ? '' : (min > -Infinity ? `Whole number, at least ${min}` : 'Whole number');
        return ok ? v : null;
    }

    function readSample() {
        const count = intField('sampleSize', { min: 1 });
        const min = intField('minValue');
        const range = intField('rangeValue', { min: 1 });
        if (count == null || min == null || range == null) return null;
        return { count, min, range };
    }

    function readStart() {
        const raw = $('#startValue').value.trim();
        if (raw === '') return null;
        const v = Number(raw);
        return Number.isInteger(v) ? v : null;
    }

    function getRules() { return CT.$$('.rule-input').map(x => x.value); }
    function getAngles() { return knobs.branch.map(k => k.value); }
    function getInitAngle() { return knobs.init ? knobs.init.value : 0; }

    /** What the layout needs: uses the modulus the current graph was built with. */
    function getViewConfig() {
        const built = CT.state.builtConfig;
        return { mod: built ? built.mod : rowsMod(), angles: getAngles(), initAngle: getInitAngle() };
    }

    function setConfig({ modulus, rules, angles, initAngle }) {
        $('#modulus').value = modulus;
        $('#modulus').classList.remove('invalid');
        setupRules(modulus, rules, angles);
        knobs.init.setValue(initAngle || 0);
    }

    function setSampleFields({ count, min, range, start }) {
        if (count != null) $('#sampleSize').value = count;
        if (min != null) $('#minValue').value = min;
        if (range != null) $('#rangeValue').value = range;
        if (start !== undefined) $('#startValue').value = start == null ? '' : start;
        ['sampleSize', 'minValue', 'rangeValue', 'startValue'].forEach(id => $('#' + id).classList.remove('invalid'));
    }

    // ---------- tree picking ----------

    function byStart() { return $('#modeStart').getAttribute('aria-checked') === 'true'; }

    function setMode(start, apply = true) {
        $('#modeStart').setAttribute('aria-checked', String(start));
        $('#modeRoot').setAttribute('aria-checked', String(!start));
        $('#modeStart').tabIndex = start ? 0 : -1;
        $('#modeRoot').tabIndex = start ? -1 : 0;
        if (apply) CT.app.onModeChange(start);
    }

    function fillTreeSelect() {
        const select = $('#treeSelect');
        select.innerHTML = '';
        const roots = Object.keys(graph.trees).sort((a, b) => graph.trees[b].leafCount - graph.trees[a].leafCount);
        for (const r of roots) {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = `${r} (${CT.fmtShort(graph.trees[r].leafCount)})`;
            select.appendChild(opt);
        }
        select.disabled = roots.length === 0;
        if (CT.state.currentRoot != null) select.value = String(CT.state.currentRoot);
        select.title = 'Trees, largest first (leaf count in brackets)';
        return roots;
    }

    function addTreeOption(root) {
        const select = $('#treeSelect');
        if (Array.from(select.options).some(o => o.value === String(root))) return;
        const opt = document.createElement('option');
        opt.value = root;
        opt.textContent = `${root} (${CT.fmtShort(graph.trees[root].leafCount)})`;
        select.appendChild(opt);
        select.disabled = false;
    }

    // ---------- init ----------

    function init() {
        knobs.init = new CT.Knob($('#initAngleKnob'), {
            min: -180, max: 180, value: 0, defaultValue: 0,
            step: 1, dragRate: 0.5, fineRate: 0.05,
            label: 'Initial angle',
            onInput: () => CT.render.invalidateLayout(),
        });
        setupRules(2);

        let modTimer = null;
        $('#modulus').addEventListener('input', () => {
            clearTimeout(modTimer);
            const mod = readMod();
            $('#modulus').classList.toggle('invalid', mod == null);
            $('#modulus').title = mod == null ? 'Whole number from 2 to 12' : '';
            if (mod == null || mod === rowsMod()) return;
            modTimer = setTimeout(() => { setupRules(mod); CT.app.scheduleRebuild(0); }, 350);
        });

        for (const id of ['sampleSize', 'minValue', 'rangeValue']) {
            $('#' + id).addEventListener('input', () => { if (readSample()) CT.app.scheduleRebuild(); else CT.app.markStale(); });
        }

        $('#startValue').addEventListener('change', () => {
            const v = readStart();
            $('#startValue').classList.toggle('invalid', $('#startValue').value.trim() !== '' && v == null);
            if (v != null) CT.app.setStart(v);
        });
        $('#startValue').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

        $('#treeSelect').addEventListener('change', (e) => CT.app.selectRoot(parseInt(e.target.value, 10)));

        $('#modeStart').addEventListener('click', () => setMode(true));
        $('#modeRoot').addEventListener('click', () => setMode(false));
        CT.$('.segmented').addEventListener('keydown', (e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                setMode(!byStart());
                (byStart() ? $('#modeStart') : $('#modeRoot')).focus();
            }
        });
        setMode(true, false);
    }

    CT.controls = {
        init, setupRules, rulesValid, readSample, readStart, readMod, getRules, getAngles, getInitAngle,
        getViewConfig, setConfig, setSampleFields, byStart, setMode, fillTreeSelect, addTreeOption,
    };
})();
