// Module worker: dispatches plain-data jobs to the task handlers in core/tasks.js.
import { handlers } from '../core/tasks.js';

self.onmessage = (e) => {
  const { id, type, job } = e.data;
  try {
    const h = handlers[type];
    if (!h) throw new Error(`unknown task ${type}`);
    const { result, transfer = [] } = h(job);
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
self.postMessage({ ready: true });
