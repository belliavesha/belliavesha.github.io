/**
 * Rotary knob + numeric field. The knob shows the angle it sets
 * (indicator and filled arc); the field takes exact values.
 *
 * Knob: drag up/right to increase (Shift = fine), wheel, arrow keys
 * (Shift ×10, Alt ×0.1), PageUp/PageDown ±15°, Home or double-click = default.
 */
class Knob {
    constructor(slot, { min, max, value, defaultValue = 0, step = 0.1, dragRate = 0.15, fineRate = 0.02, label = 'Angle', onInput = () => {} }) {
        this.min = min; this.max = max; this.step = step;
        this.dragRate = dragRate; this.fineRate = fineRate;
        this.defaultValue = defaultValue;
        this.onInput = onInput;
        this.value = this.clamp(Number(value) || 0);

        slot.classList.add('knob-wrap');
        slot.innerHTML = `
            <div class="knob" role="slider" tabindex="0" aria-label="${label}"
                 aria-valuemin="${min}" aria-valuemax="${max}" title="${label}">
                <span class="knob-arc"></span><span class="knob-tick"></span>
            </div>
            <span class="knob-num"><input type="text" spellcheck="false" autocomplete="off" aria-label="${label}, degrees"></span>`;
        this.knob = slot.querySelector('.knob');
        this.field = slot.querySelector('input');
        this.attach();
        this.update(false);
    }

    clamp(v) { return Math.min(this.max, Math.max(this.min, v)); }
    round(v) { return Math.round(v / this.step) * this.step; }

    format(v) {
        const r = Math.round(v * 10) / 10;
        return (Object.is(r, -0) ? 0 : r).toString();
    }

    setValue(v, emit = false) {
        this.value = this.clamp(Number(v) || 0);
        this.update(emit);
    }

    update(emit = true, skipField = false) {
        const v = this.value;
        this.knob.style.setProperty('--a', v + 'deg');
        this.knob.style.setProperty('--from', (v < 0 ? v : 0) + 'deg');
        this.knob.style.setProperty('--sweep', Math.abs(v) + 'deg');
        this.knob.setAttribute('aria-valuenow', this.format(v));
        this.knob.setAttribute('aria-valuetext', this.format(v) + ' degrees');
        if (!skipField) this.field.value = this.format(v);
        if (emit) this.onInput(v);
    }

    attach() {
        const k = this.knob;
        let startX = 0, startY = 0, startVal = 0, pid = null, lastShift = false;

        k.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            pid = e.pointerId;
            k.setPointerCapture(pid);
            startX = e.clientX; startY = e.clientY; startVal = this.value; lastShift = e.shiftKey;
            k.classList.add('is-active');
            k.focus({ preventScroll: true });
            e.preventDefault();
        });
        k.addEventListener('pointermove', (e) => {
            if (e.pointerId !== pid) return;
            if (e.shiftKey !== lastShift) { // re-anchor so the value doesn't jump
                lastShift = e.shiftKey; startX = e.clientX; startY = e.clientY; startVal = this.value;
            }
            const d = (startY - e.clientY) + (e.clientX - startX);
            const rate = e.shiftKey ? this.fineRate : this.dragRate;
            this.value = this.clamp(startVal + d * rate);
            this.update();
        });
        const end = (e) => {
            if (e.pointerId !== pid) return;
            pid = null;
            k.classList.remove('is-active');
            this.value = this.clamp(Math.round(this.value * 10) / 10);
            this.update();
        };
        k.addEventListener('pointerup', end);
        k.addEventListener('pointercancel', end);
        k.addEventListener('dblclick', () => this.setValue(this.defaultValue, true));

        k.addEventListener('wheel', (e) => {
            e.preventDefault();
            const dir = e.deltaY > 0 ? -1 : 1;
            const s = e.shiftKey ? 1 : this.step;
            this.value = this.clamp(this.round(this.value + dir * s));
            this.update();
        }, { passive: false });

        k.addEventListener('keydown', (e) => {
            let d = 0;
            const unit = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            switch (e.key) {
                case 'ArrowUp': case 'ArrowRight': d = unit; break;
                case 'ArrowDown': case 'ArrowLeft': d = -unit; break;
                case 'PageUp': d = 15; break;
                case 'PageDown': d = -15; break;
                case 'Home': this.setValue(this.defaultValue, true); e.preventDefault(); return;
                default: return;
            }
            e.preventDefault();
            this.value = this.clamp(Math.round((this.value + d) * 10) / 10);
            this.update();
        });

        // numeric field
        const f = this.field;
        const commit = () => {
            const v = parseFloat(f.value.replace(',', '.').replace('−', '-'));
            if (Number.isFinite(v)) this.setValue(v, true);
            else this.update(false);
            f.classList.remove('invalid');
        };
        f.addEventListener('input', () => {
            const v = parseFloat(f.value.replace(',', '.').replace('−', '-'));
            const ok = Number.isFinite(v) && v >= this.min && v <= this.max;
            f.classList.toggle('invalid', !ok && f.value.trim() !== '' && f.value !== '-');
            if (ok) { this.value = v; this.update(true, true); }
        });
        f.addEventListener('change', commit);
        f.addEventListener('blur', commit);
        f.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { commit(); f.select(); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const unit = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
                this.value = this.clamp(Math.round((this.value + (e.key === 'ArrowUp' ? unit : -unit)) * 10) / 10);
                this.update();
                f.select();
            } else if (e.key === 'Escape') { this.update(false); f.blur(); }
        });
    }
}

CT.Knob = Knob;
