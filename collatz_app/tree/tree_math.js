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

const ruleFunctionCache = new Map();

function getNext(n, ruleObj) {
    if (typeof ruleObj === 'string') {
        // Legacy support
        if (ruleObj === 'classic') {
            if (n % 2 === 0) return n / 2;
            return 3 * n + 1;
        } else if (ruleObj === 'alternative') {
            if (n % 2 === 0) return (n / 2) + 1;
            return 3 * n + 1;
        } else if (ruleObj === 'triple') {
            const r = n % 3;
            if (r === 0) return n / 3;
            if (r === 1) return 2 * n + 1;
            return 4 * n + 2;
        }
        return 1;
    }

    // General Rule Object: { mod: number, rules: string[] }
    const mod = ruleObj.mod;
    const r = n % mod;
    
    // Handle negative remainders if n < 0 (though usually n > 0 here)
    // const rIndex = ((r % mod) + mod) % mod; 
    const rIndex = r; 

    const ruleStr = ruleObj.rules[rIndex];
    
    if (!ruleStr) return 1;

    let func = ruleFunctionCache.get(ruleStr);
    if (!func) {
        try {
            // Create a function that takes 'n' and returns the result
            func = new Function('n', 'return ' + ruleStr);
            ruleFunctionCache.set(ruleStr, func);
        } catch (e) {
            console.error("Invalid rule syntax:", ruleStr, e);
            return n; // Fail safe
        }
    }
    
    try {
        const result = func(n);
        return Math.floor(result);
    } catch (e) {
        console.error("Error executing rule:", ruleStr, e);
        return n;
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
        trees: {}
    };
}

/**
 * Add a sample to the graph
 */
function addSampleToGraph(sample, rule, updateStats = false) { 
    if (graph.root.has(sample)) return; // Already part of a tree
    
    let sequence = [];
    let curr = sample;
    let foundRoot = null;
    let cycleStartIndex = -1;
    let rootIndexInSeq = -1;
    const MAX_VALUE = 1e18; // Maximum value before considering sequence divergent

    // Trace forward
    const pathMap = new Map(); // val -> index in sequence
    while (true) {
        sequence.push(curr);
        
        // Check if sequence diverged (got too large)
        if (curr > MAX_VALUE) {
            console.log(`Sample ${sample} diverged to ${curr}, skipping`);
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
                    highestLeaf: foundRoot, // Initialize highest leaf
                    startValue: null,
                    rootNode: foundRoot
                };
                graph.root.set(foundRoot, foundRoot);
                graph.parent.set(foundRoot, sequence[rootIndexInSeq+1]);
                graph.depth.set(foundRoot, 0);
                graph.height.set(foundRoot, foundRoot); // Root height is its value
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
        curr = getNext(curr, rule);
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
        const root = graph.root.get(sample);
        while (curr !== undefined) {
            const w = graph.weight.get(curr) || 0;
            graph.weight.set(curr, w + 1);
            if (curr === root) break;
            curr = graph.parent.get(curr);
        }

        // Update Highest Leaf
        const tree = graph.trees[foundRoot];
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
        }

    }
}
