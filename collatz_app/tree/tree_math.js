/**
 * Data Structures and Algorithms
 */

// --- Data Structures ---
let graph = {
    parent: new Map(),   // n -> m (n points to m)
    root: new Map(),     // n -> root of n
    children: new Map(), // n -> [array of nodes pointing to n]
    weight: new Map(),   // visit count
    depth: new Map(),    // distance from root
    height: new Map(),   // max value on path to root
    nodeList: [],        // Topologically sorted list (Parent before Children)
    trees: {},          // rootValue -> { highest, lowest, deepest, startValue, nodes: [] }
    startValue: null,   // Store the current start value
    divergentNodes: []  // Store samples that diverged to infinity
};

// --- Logic ---

class RuleSet {
    constructor(config) {
        this.mod = config.mod;
        this.compiledRules = this.compileRules(config.rules);
    }

    compileRules(ruleStrings) {
        const compiled = [];
        for (const ruleStr of ruleStrings) {
            if (!ruleStr) {
                compiled.push((n) => 1); // fallback
                continue;
            }

            try {
                // Create a function that takes 'n' and returns the result
                const func = new Function('n', 'return ' + ruleStr);
                compiled.push((n) => {
                    try {
                        return Math.floor(func(n));
                    } catch (e) {
                        console.error("Error executing rule:", ruleStr, e);
                        return n; // fail safe
                    }
                });
            } catch (e) {
                console.error("Invalid rule syntax:", ruleStr, e);
                compiled.push((n) => n); // fail safe
            }
        }
        return compiled;
    }

    getNext(n) {
        const r = n % this.mod;
        const ruleFunc = this.compiledRules[r];
        if (!ruleFunc) return 1; // fallback
        return ruleFunc(n);
    }
}

function resetGraph() {
    graph = {
        parent: new Map(),
        root: new Map(),
        children: new Map(),
        weight: new Map(),
        depth: new Map(),
        height: new Map(),
        nodeList: [],
        trees: {},
        startValue: null,
        divergentNodes: []
    };
}

/**
 * Add a sample to the graph
 */
function addSampleToGraph(sample, ruleSet, updateStats = false) { 
    if (graph.root.has(sample)) return; // Already part of a tree
    
    let sequence = [];
    let curr = sample;
    let foundRoot = null;
    let cycleStartIndex = -1;
    let rootIndexInSeq = -1;
    const MAX_VALUE = 1e19; // Maximum value before considering sequence divergent
    const MAX_DEPTH = 1e4; // Maximum depth before considering sequence divergent

    // Trace forward
    const pathMap = new Map(); // val -> index in sequence
    while (true) {
        sequence.push(curr);
        
        // Check if sequence diverged (got too large)
        if (Math.abs(curr) > MAX_VALUE ) {
            console.log(`Sample ${sample} diverged to ${curr}, skipping`);
            graph.divergentNodes.push(sample);
            return;
        }
        if (sequence.length > MAX_DEPTH) {
            console.log(`Sample ${sample} did not converge in ${MAX_DEPTH} steps, skipping`);
            graph.divergentNodes.push(sample);
            return;
        }
        
        // Check cycle in current path
        if (pathMap.has(curr)) {
            cycleStartIndex = pathMap.get(curr);
            
            // Find Root (Min value in cycle part)
            let rootValue = curr;
            let rootIndex = cycleStartIndex;
            
            for (let k = cycleStartIndex; k < sequence.length; k++) {
                if (sequence[k] < rootValue) {
                    rootValue = sequence[k];
                    rootIndex = k;
                }
            }
            
            foundRoot = rootValue;
            rootIndexInSeq = rootIndex;

            // Init Tree
            if (!graph.trees[foundRoot]) {
                graph.trees[foundRoot] = {
                    highestNode: foundRoot,
                    lowestNode: foundRoot,
                    deepestNode: foundRoot,
                    highestLeaf: foundRoot, 
                    startValue: null,
                    rootNode: foundRoot,
                    leafCount: 1
                };
                graph.root.set(foundRoot, foundRoot);
                graph.parent.set(foundRoot, sequence[rootIndexInSeq+1]);
                graph.depth.set(foundRoot, 0);
                graph.height.set(foundRoot, foundRoot); 
                graph.children.set(foundRoot, []);
                graph.nodeList.push(foundRoot);
            }
        }

        // Check existing graph
        if (graph.root.has(curr)) {
            foundRoot = graph.root.get(curr);
            break;
        }

        pathMap.set(curr, sequence.length - 1);
        curr = ruleSet.getNext(curr); 
    }

    for (let i = sequence.length - 2; i >= 0; i--) {
        const node = sequence[i];
        if (graph.root.has(node)) continue;
        const p = sequence[i+1];
        addToGraph(node, foundRoot, p);
        
        if (updateStats) {
            const parentHeight = graph.height.get(p);
            const nodeHeight = Math.max(node, parentHeight);
            graph.height.set(node, nodeHeight);
        }
    }

    if (updateStats) {
        // Update weights from sample to root
        let curr = sample;
        const tree = graph.trees[foundRoot];
        while (curr !== undefined) {
            let w = graph.weight.get(curr) || 0;
            let children = graph.children.get(curr);
            if (children.length === 0) {
                w = 1;
            } else {
                let sum = 0;
                for (let child of children) {
                    sum += graph.weight.get(child) || 0;
                }
                // console.log("cur", curr, w, sum, children)
                if (w === sum){
                    break;
                }
                w = sum;
            }
            graph.weight.set(curr, w);
            if (curr === foundRoot) {
                tree.leafCount = w;
                break;
            }
            curr = graph.parent.get(curr);
        }

        // Update Highest Leaf
        if (tree) {
             const sampleHeight = graph.height.get(sample);
             const currentHigh = tree.highestNode;
             
             if (sampleHeight >= currentHigh) {
                 tree.highestLeaf = sample;
             }
        }
    } 

}

/**
 * Main Tree Construction Algorithm
 */
function buildGraph(minVal, range, maxSamples, rule, startVal) {
    resetGraph();
    
    const maxVal = minVal + range;
    let sampleSet = [];

    // Generate sample set
    if (maxSamples >= range) {
        // Sample size larger than range - use full range
        for (let s = minVal; s < maxVal; s++) {
            sampleSet.push(s);
        }
    } else {
        // Sample size smaller than range - take random samples
        const usedNumbers = new Set();
        while (sampleSet.length < maxSamples) {
            const randomSample = Math.floor(Math.random() * range) + minVal;
            if (!usedNumbers.has(randomSample)) {
                usedNumbers.add(randomSample);
                sampleSet.push(randomSample);
            }
        }
    }

    // Add start value if provided and not already in the sample set
    if (startVal != null && !isNaN(startVal)) {
        const startInt = parseInt(startVal);
        if (!sampleSet.includes(startInt)) {
            sampleSet.push(startInt);
        }
        graph.startValue = startInt;
    }

    // Add each sample to the graph
    for (let sample of sampleSet) {
        addSampleToGraph(sample, rule);
    }
}

function addToGraph(node, root, parent) {
    graph.root.set(node, root);
    graph.parent.set(node, parent);
    let depth = (graph.depth.get(parent)||0) + 1;
    graph.depth.set(node, depth);    

    if (node !== root) {
        if (!graph.children.has(parent)) graph.children.set(parent, []);
        graph.children.get(parent).push(node);
    } else {
        console.log("WTF, why would I add root to Graph, it must be already there")
    }
    
    if (!graph.children.has(node)) graph.children.set(node, []);
    
    graph.nodeList.push(node);

    // Stats
    const tree = graph.trees[root];
    if (node > tree.highestNode) tree.highestNode = node;
    if (node < tree.lowestNode) tree.lowestNode = node;
    if (depth > graph.depth.get(tree.deepestNode)) tree.deepestNode = node;
    

}

function computeHeights() {
    // Forward iteration (Parents -> Children)
    // Calculate max value on the path to root
    for (let i = 0; i < graph.nodeList.length; i++) {
        const node = graph.nodeList[i];
        const parent = graph.parent.get(node);
        let nodeHeight = -1; 

        if (node === graph.root.get(node)) { // Is root
            graph.height.set(node, node);
        } else {
            const parentHeight = graph.height.get(parent);
            nodeHeight = Math.max(node, parentHeight)
            graph.height.set(node, nodeHeight);
        }
        
        // Check if node is a leaf and has the highest height
        const children = graph.children.get(node) || [];
        if (children.length === 0 ) { // Is Leaf
            const root = graph.root.get(node);
            const tree = graph.trees[root];
                  
            if (tree) {
                if (tree.highestNode == nodeHeight) {
                     tree.highestLeaf = node;
                } 
            }
        }
    }
}

function computeWeights() {

    // Iterating backwards ensures we process children before parents.
    
    for (let i = graph.nodeList.length - 1; i >= 0; i--) {
        const node = graph.nodeList[i];
        const children = graph.children.get(node) || [];
        
        if (children.length === 0) {
            graph.weight.set(node, 1);
        } else {
            let sum = 0;
            for (let child of children) {
                sum += graph.weight.get(child) || 0;
            }
            graph.weight.set(node, sum);

            if (node === graph.root.get(node)){
                const tree = graph.trees[node];
                tree.leafCount = sum;
            }
        }

    }
}
