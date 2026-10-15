/**
 * Build job shared by the Web Worker and the main-thread fallback.
 * Uses the unchanged algorithms from tree_math.js; only splits the loop
 * into steps so progress can be reported and the job can be cancelled.
 *
 * job = { mode: 'sample', min, range, count, start, seed, mod, rules }
 *     | { mode: 'leaves', leaves, mod, rules }
 */
function* buildJobSteps(job) {
    const ruleSet = new RuleSet({ mod: job.mod, rules: job.rules });
    resetGraph();

    let samples;
    if (job.mode === 'leaves') {
        samples = job.leaves;
    } else {
        samples = makeSampleSet(job.min, job.range, job.count, job.start, job.seed);
        if (job.start != null && !isNaN(job.start)) graph.startValue = parseInt(job.start);
    }

    const N = samples.length;
    for (let i = 0; i < N; i++) {
        addSampleToGraph(samples[i], ruleSet);
        if ((i & 63) === 63) yield (i + 1) / N;
    }
    yield 1;
    computeWeights();
    computeHeights();
    return graph;
}
