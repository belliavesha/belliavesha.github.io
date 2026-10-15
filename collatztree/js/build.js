/**
 * Build manager: runs jobs in a Web Worker, falls back to time-sliced
 * main-thread work where workers are unavailable (e.g. opened from file://).
 */
(function () {
    let worker = null;
    let workerBroken = false;
    let current = null;   // { id, resolve, cancelled, onProgress, fallback }
    let nextId = 1;

    function getWorker() {
        if (workerBroken) return null;
        if (worker) return worker;
        try {
            worker = new Worker('js/build_worker.js');
            worker.onmessage = onWorkerMessage;
            worker.onerror = onWorkerError;
            return worker;
        } catch (e) {
            workerBroken = true;
            return null;
        }
    }

    function onWorkerMessage(e) {
        const msg = e.data;
        if (!current || msg.id !== current.id) return;
        current.gotMessage = true;
        if (msg.progress != null) { current.onProgress(msg.progress); return; }
        const job = current; current = null;
        if (msg.error) job.resolve({ error: msg.error });
        else job.resolve({ graph: msg.graph });
    }

    function onWorkerError(e) {
        // Worker could not start (file://, CSP...): switch to fallback for this and later jobs
        e.preventDefault && e.preventDefault();
        if (worker) worker.terminate();
        worker = null;
        if (current && !current.gotMessage) {
            workerBroken = true;
            const job = current;
            runFallback(job);
        } else if (current) {
            const job = current; current = null;
            job.resolve({ error: 'Build failed' });
        }
    }

    function runFallback(job) {
        const it = buildJobSteps(job.job);
        // tree_math works on the global `graph`; swap the graph being built in and out
        // around every slice so the page keeps showing the previous tree meanwhile.
        let building = null;
        const slice = () => {
            if (job.cancelled) return;
            const prev = graph;
            if (building) setGraph(building);
            const t0 = performance.now();
            let r;
            do { r = it.next(); } while (!r.done && performance.now() - t0 < 14);
            building = graph;
            setGraph(prev);
            if (r.done) {
                if (current === job) current = null;
                job.resolve({ graph: r.value });
            } else {
                job.onProgress(r.value);
                setTimeout(slice, 0);
            }
        };
        setTimeout(slice, 0);
    }

    /** Returns a promise resolving to {graph} | {cancelled} | {error}. */
    function run(job, onProgress = () => {}) {
        cancel();
        return new Promise((resolve) => {
            const entry = { id: nextId++, job, resolve, onProgress, cancelled: false, gotMessage: false };
            current = entry;
            const w = getWorker();
            if (w) w.postMessage({ id: entry.id, job });
            else runFallback(entry);
        });
    }

    function cancel() {
        if (!current) return;
        const job = current; current = null;
        job.cancelled = true;
        if (worker && !workerBroken) { worker.terminate(); worker = null; }
        job.resolve({ cancelled: true });
    }

    CT.build = { run, cancel, isRunning: () => !!current };
})();
