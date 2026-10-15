/* Web Worker: builds the graph off the main thread so the page never freezes. */
importScripts('../tree_math.js', 'build_core.js');

self.onmessage = (e) => {
    const { id, job } = e.data;
    try {
        const it = buildJobSteps(job);
        let lastPost = 0;
        let r = it.next();
        while (!r.done) {
            const now = Date.now();
            if (now - lastPost > 50) {
                self.postMessage({ id, progress: r.value });
                lastPost = now;
            }
            r = it.next();
        }
        self.postMessage({ id, graph: r.value });
    } catch (err) {
        self.postMessage({ id, error: String(err && err.message || err) });
    }
};
