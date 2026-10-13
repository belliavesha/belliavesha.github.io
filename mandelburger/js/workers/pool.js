// A small worker pool with tagged jobs and cancellation of queued work.
// Falls back to running handlers on the main thread when module workers are
// unavailable (e.g. the page was opened from file://).

export class Pool {
  constructor(size, { name = 'pool' } = {}) {
    this.size = Math.max(1, size);
    this.name = name;
    this.queue = [];
    this.workers = [];
    this.nextId = 1;
    this.pending = new Map();
    this.inline = false;
    this.ready = this.#start();
  }

  async #start() {
    const url = new URL('./compute.worker.js', import.meta.url);
    const boot = (w) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('worker start timeout')), 8000);
        w.onmessage = (e) => { if (e.data && e.data.ready) { clearTimeout(t); resolve(); } };
        w.onerror = (e) => { clearTimeout(t); reject(e); };
      });
    try {
      const ws = [];
      for (let i = 0; i < this.size; i++) ws.push(new Worker(url, { type: 'module' }));
      await Promise.all(ws.map(boot));
      for (const w of ws) {
        const slot = { w, busy: false, job: null };
        w.onmessage = (e) => this.#onMessage(slot, e.data);
        w.onerror = (e) => this.#onError(slot, e);
        this.workers.push(slot);
      }
    } catch (err) {
      console.warn(`[${this.name}] module workers unavailable, computing on the main thread`, err);
      for (const s of this.workers) s.w.terminate();
      this.workers = [];
      this.inline = true;
      this.size = 1;
      this.handlers = (await import('../core/tasks.js')).handlers;
    }
    this.#pump();
  }

  /** Queue a job. Returns a promise of the result; rejects with {cancelled:true} if cancelled. */
  run(type, job, { tag = type, transfer = [] } = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.queue.push({ id, type, job, tag, transfer, resolve, reject });
      this.#pump();
    });
  }

  /** Drop queued jobs with this tag (running ones finish; callers ignore stale results). */
  cancel(tag) {
    const keep = [];
    for (const q of this.queue) {
      if (q.tag === tag) q.reject({ cancelled: true });
      else keep.push(q);
    }
    this.queue = keep;
  }

  #pump() {
    if (this.inline) {
      if (this.inlineBusy || !this.queue.length || !this.handlers) return;
      this.inlineBusy = true;
      const q = this.queue.shift();
      setTimeout(() => {
        try {
          const { result } = this.handlers[q.type](q.job);
          q.resolve(result);
        } catch (err) {
          q.reject(err);
        }
        this.inlineBusy = false;
        this.#pump();
      }, 0);
      return;
    }
    for (const slot of this.workers) {
      if (slot.busy || !this.queue.length) continue;
      const q = this.queue.shift();
      slot.busy = true;
      slot.job = q;
      slot.w.postMessage({ id: q.id, type: q.type, job: q.job }, q.transfer);
    }
  }

  #onMessage(slot, msg) {
    const q = slot.job;
    slot.busy = false;
    slot.job = null;
    if (q) {
      if (msg.ok) q.resolve(msg.result);
      else q.reject(new Error(msg.error));
    }
    this.#pump();
  }

  #onError(slot, e) {
    const q = slot.job;
    slot.busy = false;
    slot.job = null;
    if (q) q.reject(e instanceof Error ? e : new Error(e.message || 'worker error'));
    this.#pump();
  }

  get busy() {
    return this.queue.length > 0 || this.workers.some((s) => s.busy) || !!this.inlineBusy;
  }
}
