/**
 * Tree layout: the same BFS turtle walk as before, computed once per
 * (tree, angles) change and cached in flat arrays, plus a spatial hash
 * for fast hit-testing.
 */
(function () {
    const BASE_LEN = 50;
    const CELL = 24; // world units per hash cell

    /**
     * @param root     root value of the tree
     * @param angles   branch angle per residue, degrees
     * @param initDeg  initial angle, degrees
     * @param mod      modulus
     */
    function compute(root, angles, initDeg, mod) {
        const nodes = [root];
        const index = new Map([[root, 0]]);
        const xs = [0], ys = [0], ang = [(initDeg || 0) * Math.PI / 180 - Math.PI / 2];
        const parentIdx = [-1];
        let minX = 0, maxX = 0, minY = 0, maxY = 0;

        // BFS (parents before children); identical geometry to the original renderer
        for (let qi = 0; qi < nodes.length; qi++) {
            const p = nodes[qi];
            const children = graph.children.get(p) || [];
            const depth = graph.depth.get(p);
            const px = xs[qi], py = ys[qi], pa = ang[qi];
            for (const child of children) {
                const childDepth = depth + 1;
                const len = BASE_LEN / Math.sqrt(childDepth * 0.5);
                const offsetDeg = angles[child % mod] || 0;
                const a = pa + offsetDeg * Math.PI / 180;
                const x = px + Math.cos(a) * len;
                const y = py + Math.sin(a) * len;
                index.set(child, nodes.length);
                nodes.push(child); xs.push(x); ys.push(y); ang.push(a); parentIdx.push(qi);
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }

        const layout = {
            root, nodes, index,
            xs: Float64Array.from(xs), ys: Float64Array.from(ys),
            parent: Int32Array.from(parentIdx),
            bounds: { minX, maxX, minY, maxY },
        };
        buildGrid(layout);
        return layout;
    }

    function buildGrid(L) {
        const grid = new Map();
        for (let i = 0; i < L.nodes.length; i++) {
            const key = Math.floor(L.xs[i] / CELL) + ',' + Math.floor(L.ys[i] / CELL);
            let cell = grid.get(key);
            if (!cell) grid.set(key, cell = []);
            cell.push(i);
        }
        L.grid = grid;
    }

    /** Nearest node within radius r (world units) of (wx, wy), or null. */
    function hitTest(L, wx, wy, r) {
        if (!L) return null;
        let best = null, bestD = r * r;
        const cells = Math.pow(2 * Math.ceil(r / CELL) + 1, 2);
        const test = (i) => {
            const dx = L.xs[i] - wx, dy = L.ys[i] - wy, d = dx * dx + dy * dy;
            if (d <= bestD) { bestD = d; best = i; }
        };
        if (cells > L.nodes.length) {
            for (let i = 0; i < L.nodes.length; i++) test(i);
        } else {
            const cx0 = Math.floor((wx - r) / CELL), cx1 = Math.floor((wx + r) / CELL);
            const cy0 = Math.floor((wy - r) / CELL), cy1 = Math.floor((wy + r) / CELL);
            for (let cx = cx0; cx <= cx1; cx++) {
                for (let cy = cy0; cy <= cy1; cy++) {
                    const cell = L.grid.get(cx + ',' + cy);
                    if (cell) for (const i of cell) test(i);
                }
            }
        }
        return best === null ? null : L.nodes[best];
    }

    /** Leaves (nodes without children) of the tree rooted at `root`. */
    function leavesOf(root) {
        const leaves = [];
        for (const node of graph.nodeList) {
            if (graph.root.get(node) === root) {
                const children = graph.children.get(node) || [];
                if (children.length === 0) leaves.push(node);
            }
        }
        return leaves;
    }

    CT.layout = { compute, hitTest, leavesOf };
})();
