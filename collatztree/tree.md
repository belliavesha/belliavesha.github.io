# Collatz Tree Visualizer - Architecture & Implementation Guide

## 1. Problem Overview

The Collatz Tree Visualizer generates and renders interactive trees of numerical sequences. For any starting number, a deterministic sequence is computed using mathematical rules (Collatz conjecture, alternatives, or generalizations). When the sequence enters a cycle, a tree is constructed with the minimum cycle value as the root. The visualization renders these trees with branches colored and sized by their properties.

## 2. Sequence Generation & Graph Construction

### 2.1 Rule System

Rules define how to compute the next number in a sequence. The system supports flexible, modular rules:

**Rule Object Structure:**
```javascript
{
  mod: number,           // Modulus (M) - number of rules (2 for classic Collatz, 3 for triple)
  rules: string[]        // Array of M rule expressions (one per remainder class)
}
```

**Examples:**

Classic Collatz (M=2):
```javascript
{ mod: 2, rules: ["n/2", "3*n+1"] }
// if n % 2 == 0 → n/2
// if n % 2 == 1 → 3*n+1
```

Alternative Collatz (M=2):
```javascript
{ mod: 2, rules: ["n/2+1", "3*n+1"] }
// if n % 2 == 0 → n/2+1 (diverges!)
// if n % 2 == 1 → 3*n+1
```

Triple Sequence (M=3):
```javascript
{ mod: 3, rules: ["n/3", "2*n+1", "4*n+2"] }
// if n % 3 == 0 → n/3
// if n % 3 == 1 → 2*n+1
// if n % 3 == 2 → 4*n+2
```

### 2.2 Sequence Computation

**Function:** `getNext(n, ruleObj) → number`

For a number n, compute the next value:
1. Calculate remainder: `r = n % ruleObj.mod`
2. Get rule string: `ruleStr = ruleObj.rules[r]`
3. Execute rule: Parse and evaluate the rule as a function of n
4. Return result (floored to integer)

Rules are cached in `ruleFunctionCache` for performance. Invalid rules default to returning n.

**Example trace (Alternative Collatz, start=9):**
```
9 → 28 → 15 → 46 → 24 → 13 → 40 → 21 → 64 → 33 → 100 → 51 → 154 → 78 → 40
           cycle detected: 40 repeats
root = 21 (minimum in cycle)
```

### 2.3 Graph Data Structures

All tree data is stored in the global `graph` object:

```javascript
graph = {
  parent: Map,        // node → parent (the node it points to in the sequence)
  root: Map,          // node → root (which tree's root this node belongs to)
  children: Map,      // node → array of nodes that point to it
  weight: Map,        // node → visit count (how often this node appears)
  depth: Map,         // node → distance from root (root has depth=0)
  height: Map,        // node → max value on path to root
  nodeList: [],       // Topologically sorted (parents before children)
  trees: {},          // rootValue → {highestNode, lowestNode, deepestNode, highestLeaf, startValue}
  startValue: null,   // Current highlighted starting point
  divergentNodes: []  // Samples that exceeded MAX_VALUE (1e18)
}
```

### 2.4 Tree Construction Algorithm

**Function:** `buildGraph(minVal, range, maxSamples, rule, startVal)`

**Step 1: Generate Sample Set**

- If `maxSamples >= range`: Use all values in [minVal, minVal+range)
- Else: Random sample without replacement of size maxSamples

**Step 2: Trace Each Sample**

For each sample s, compute the sequence until finding a **known root** or **detecting a cycle**:

1. Trace forward, recording path in sequence array
2. Stop when:
   - `sequence[i]` exceeds MAX_VALUE (1e18) → divergent, skip sample
   - `sequence[i]` already has `graph.root` set → found existing tree
   - `sequence[i]` repeats in current path → found new cycle

3. If new cycle detected:
   - Find cycle start index
   - Identify **root** = minimum value in cycle portion
   - Create new tree entry: `graph.trees[root] = {highestNode: root, lowestNode: root, ...}`

**Step 3: Backfill Graph**

From sequence end (or found root), traverse backwards adding nodes:

```
for i = sequence.length - 2 downto 0:
  node = sequence[i]
  parent = sequence[i+1]
  
  if node not in graph:
    graph.root[node] = root
    graph.parent[node] = parent
    graph.depth[node] = graph.depth[parent] + 1
    graph.children[parent].append(node)
    graph.nodeList.append(node)
    update tree stats (highestNode, lowestNode, deepestNode)
```

### 2.5 Weight Computation

**Function:** `computeWeights()`

After graph is built, compute how many paths pass through each node:

```
for i = nodeList.length - 1 downto 0:
  node = nodeList[i]
  children = graph.children[node]
  
  if children is empty (leaf):
    weight[node] = 1
  else:
    weight[node] = sum(weight[child] for child in children)
```

This is computed **backwards** through nodeList, ensuring children's weights are known before parents.

### 2.6 Height Computation

**Function:** `computeHeights()`

For each node, compute the maximum value encountered on the path from that node to the root:

```
for i = 0 to nodeList.length - 1:
  node = nodeList[i]
  
  if node is root:
    height[node] = node
  else:
    parent = graph.parent[node]
    height[node] = max(node, height[parent])
  
  if node is leaf:
    update tree.highestLeaf if needed
```

This is computed **forwards** through nodeList, ensuring parents' heights are known before children.

---

## 3. Visualization Algorithm

### 3.1 Tree Layout (BFS Position Calculation)

**Function:** `render(autoFit)` → Layout Phase

Starting from root at (0, 0), compute each node's 2D position:

1. **Queue root:** `computedLayout.set(root, {x: 0, y: 0, angle: initialAngleRad})`

2. **BFS traversal:**
```
for each parent in queue:
  for each child of parent:
    depth = graph.depth[child]
    branchLen = baseLen / sqrt(depth * 0.5 - 0.2)
    
    angleOffset = angles[child % mod]  // Pick angle based on child value's remainder
    childAngle = parent.angle + (angleOffset * π/180)
    
    childX = parent.x + cos(childAngle) * branchLen
    childY = parent.y + sin(childAngle) * branchLen
    
    computedLayout.set(child, {x: childX, y: childY, angle: childAngle})
    queue.push(child)
    updateBounds(childX, childY)
```

**Key Parameters:**
- `baseLen = 50` pixels
- Branch length scales as `1/sqrt(depth)` to fit large trees
- Angle offset chosen by `child % mod`, creating fan-like patterns
- Each level rotates branches around the parent

### 3.2 Viewport & Auto-Fit

If `autoFit = true`:

```
width = maxX - minX
height = maxY - minY
padding = 50

scaleX = (canvas.width - 2*padding) / width
scaleY = (canvas.height - 2*padding) / height
zoom = min(scaleX, scaleY, maxZoom=2)

treeCenterX = (minX + maxX) / 2
treeCenterY = (minY + maxY) / 2

view.x = -(treeCenterX * zoom)
view.y = -(treeCenterY * zoom)
```

Result: Entire tree fits in canvas, centered.

### 3.3 Edge Rendering

**Function:** `drawEdge(node, parentPos, nodeX, nodeY, treeMeta)`

For each edge, encode properties as color and line width:

```
weight = graph.weight[node]
logW = log(weight) / log(graph.weight[root])
lineWidth = max(1, logW * 9)
alpha = min(1, 0.3 + logW * 0.7)

hue = 300 - (log(node + 1) / log(highestNode + 1)) * 320

strokeStyle = hsla(hue, 75%, 50%, alpha)
```

**Encoding:**
- **Hue** (color): Lower node values = more red (hue ~300°). Higher values = more blue (hue ~-20°)
- **Thickness**: Heavy nodes (high weight) get thicker lines
- **Transparency**: Low-weight nodes fade, high-weight emphasized

### 3.4 Node Captions (Special Boxes)

**Function:** `drawCaptions(treeMeta)`

Certain nodes are highlighted with colored boxes and numeric labels. A priority system prevents overlaps:

**Priority (highest to lowest):**
1. Root (Green, #2ecc71)
2. Cycle Target - `parent[root]` (Blue, #4facfa)
3. Deepest Node (Green, #2ecc71)
4. Highest Node of Deepest Leaf (Green)
5. Highest Node (Red, #d15858)
6. Highest Leaf (Red)
7. Lowest Node (Yellow, #f1c40f) - omitted if equals root
8. Start Value (Orange, #ff8c00)
9. Height of Start Value (Orange)

**Implementation:** For each node, track only the highest-priority caption. Filter duplicates. Render as DOM elements positioned at (screenX, screenY).

**Special Nodes Explained:**

- **Root**: The minimum cycle value. Foundation of the tree. ALWAYS shown.
- **Cycle Target**: `parent[root]` – the node the root points to (completing the cycle).
- **Deepest Node**: Node with maximum distance from root (longest path downward).
- **Highest Node**: Node with maximum numerical value across all nodes.
- **Highest Leaf**: Leaf node with maximum HEIGHT (max value on path to root). Distinct from Highest Node.
- **Lowest Node**: Minimum numerical value (excluding root if equal).
- **Start Value**: The user's selected starting sample (orange highlight).
- **Height of Start Value**: Max value on path from start value to root (orange).

---

## 4. Visualization Parameters & Appearance

### 4.1 Branch Rendering

**Branch Length:**
```
len = 50 / sqrt(depth * 0.5 - 0.2)
```
- Depth 1: ~54.8px
- Depth 2: ~29.9px
- Depth 3: ~20.4px
- Depth 10: ~7.7px

Logarithmic falloff ensures deep trees still show structure without sprawling off-canvas.

**Branch Angle:**
```
childAngle = parentAngle + angleOffset[child % mod]
```
- angleOffset is user-adjustable per remainder class (range: -180° to +180°)
- Default (M=2): [7.5°, -15°]
- Each child of the same parent spreads at different angles based on its value's remainder

**Branch Color (Hue):**
```
hue = 300 - (log(nodeValue + 1) / log(maxNodeValue + 1)) * 320
```
- Maps node values linearly to hue spectrum
- Value = 1 → hue ≈ 300° (purple - magenta)
- Value = maxNode → hue ≈ -20° (red-orange)
- Intermediate values interpolate through blue/cyan/green/yellow

**Branch Thickness & Opacity:**
```
lineWidth = max(1, log(weight) / log(rootWeight) * 9)
alpha = min(1, 0.3 + log(weight) / log(rootWeight) * 0.7)
```
- Thicker, more opaque lines = frequently visited paths
- Thin, transparent = rare branches

### 4.2 Node Captions

Labels are positioned directly below nodes, rendered as DOM elements with colored backgrounds:

- **Root** (Purple): Background: `rgba(155, 89, 182, 0.4)` `rgba(46, 204, 113, 0.6)`, border `#9b59b6`
- **Cycle Start** (Blue): `rgba(79, 172, 250, 0.6)`, border `#4facfa`, - node that root points to in the cycle (e.g., "1->4" gives start = 4)
- **Deepest Node** (Green): `rgba(46, 204, 113, 0.6)`, border `#2ecc71`
- **Highest Node** (Red): `rgba(209, 88, 88, 0.6)`, border `#d15858`
- **Smallest Node** (Yellow): `rgba(241, 196, 15, 0.6)`, border `#f1c40f`
- **Start Value** (Orange): `rgba(255, 165, 0, 0.6)`, border `#ff8c00`

Captions use monospace font, black text, centered horizontally below node.

---

## 5. User Interface & Controls

### 5.1 Control Panel Layout

**Top Section:**
- **Build Trees** button: Triggers `processAndRender()` – reads all parameters and constructs graph
- **Fit to Screen** button: Calls `render(autoFit=true)` – adjusts view to show entire tree

**Middle Section (Two columns):**

**Left: Sample Generation**
- **Number of samples** (input): How many starting values to process [1, ∞)
- **Lower limit** (input): Minimum value for sample range [1, ∞)
- **Range** (input): Size of sample interval (upper = lower + range) [1, ∞)

Sampling logic:
```
if numSamples >= range:
  use all integers in [lower, lower+range)
else:
  random sample of size numSamples
```

**Right: Root/Start Selection**
- **Select Tree** (dropdown): Choose which tree to render (enabled after Build Trees)
- **Start Value** (input): Manually specify a starting node; added to sample set and highlighted

**Lower Section (Dynamic, expands with modulus M):**

**Left: Rule Definitions**
- **Modulus** (input): Number M of rule classes [2, ∞)
- For each remainder class i in [0, M-1):
  - Label: `n % M = i; n →`
  - Input field: Rule expression (e.g., "n/2", "3*n+1")

**Right: Angle Configuration**
- **Initial Angle** (rotary knob): Starting angle for root branches (range: -180° to +180°)
- For each remainder class i in [0, M-1):
  - Rotary knob: Angle offset for child branches (range: -90° to +90°)

### 5.2 Knob Component

**Class:** `RotaryKnob(container, inputId, min, max, initialValue, step, dragSensitivity)`

Visual control for precise angle input:
- **Visual:** Circular dial with indicator line, numeric display
- **Interaction:**
  - **Drag** (up/down): Smooth continuous adjustment
  - **Scroll** (wheel): Step-based adjustment
  - **Sensitivity:** 0.5 for initial angle (coarse), 0.05 for branch angles (fine)
  - **Step:** 1° for initial, 0.1° for branch angles

Updates hidden `<input type="range">` which triggers `render(false)` on change.

### 5.3 Canvas Interaction

**Zoom (Mouse Wheel):**
```
scaleFactor = 1.1
if scroll up:
  zoom *= scaleFactor
else:
  zoom /= scaleFactor

// Maintain center point under cursor
view.x *= (newZoom / oldZoom)
view.y *= (newZoom / oldZoom)
```

**Pan (Click + Drag):**
```
on mousedown:
  isDragging = true
  lastX, lastY = current mouse position

on mousemove (while dragging):
  dx = currentX - lastX
  dy = currentY - lastY
  view.x += dx
  view.y += dy
  render(false)
```

**Click Node (Select as Start Value):**
```
on mouseup (after minimal drag):
  if clicked on node:
    set startValue to node
    call addStartValueToSamples(node, currentRule)
    (automatically re-renders tree)
```

**Hover Tooltip:**
```
on mousemove (not dragging):
  node = hitTest(mouseWorldPos)
  if node:
    show tooltip with: Value, Weight, Depth, Height
  else:
    hide tooltip
```

---

## 6. Project Structure & Dependencies

### 6.1 File Organization

```
tree/
├── tree.html           # HTML skeleton & control panel
├── style.css           # Styling (sidebar, canvas, knobs, labels)
├── tree_math.js        # Graph algorithms & data structures
├── tree_ui.js          # Rendering, interaction, RotaryKnob class
└── ARCHITECTURE.md     # This document, project description
```

### 6.2 Execution Flow

1. **Page Load** (`tree.html`):
   - Import `tree_math.js`, `tree_ui.js`
   - Create canvas, sidebar controls
   - Initialize static knobs: `setupStaticKnobs()`
   - Initialize dynamic controls: `setupDynamicControls()`
   - Attach event listeners to buttons, inputs, canvas

2. **Build Trees** (Click):
   - Call `processAndRender()`
   - Extract UI parameters (min, range, count, rules, angles, start value)
   - Call `buildGraph(min, range, count, ruleObj, startVal)`
   - Call `computeWeights()`
   - Call `computeHeights()`
   - Populate tree selector dropdown
   - Call `render(true)` with auto-fit

3. **Change Modulus** (Input Change):
   - Call `setupDynamicControls()`
   - Dynamically create/remove rule inputs and angle knobs
   - Update default values based on M

4. **Adjust Angle** (Knob Change):
   - Knob updates hidden input
   - Input fires `input` event
   - Event listener calls `render(false)` if tree exists

5. **Select Tree** (Dropdown Change):
   - Update `currentRoot`
   - Set start value to root
   - Call `render(true)` with auto-fit

6. **Change Start Value** (Input Change):
   - Call `addStartValueToSamples(value, ruleObj)`
   - Adds value to sample set if not already present
   - Updates tree metadata with start value
   - Switches to appropriate tree
   - Calls `render(false)` to highlight start value

7. **Canvas Interaction**:
   - Zoom: Adjusts `view.zoom`, maintains center
   - Pan: Adjusts `view.x`, `view.y`
   - Click: Sets start value and re-renders
   - Hover: Shows tooltip
   - All trigger `render(false)` for immediate update

### 6.3 Key Functions Cross-Reference

| Function | File | Called By | Purpose |
|----------|------|-----------|---------|
| `getNext()` | tree_math.js | addSampleToGraph | Compute next sequence value |
| `buildGraph()` | tree_math.js | processAndRender | Construct tree from samples |
| `addSampleToGraph()` | tree_math.js | buildGraph, addStartValueToSamples | Trace & add one sample |
| `computeWeights()` | tree_math.js | processAndRender | Calculate edge weights |
| `computeHeights()` | tree_math.js | processAndRender | Calculate max-on-path values |
| `render()` | tree_ui.js | processAndRender, event listeners | Main render loop |
| `drawEdge()` | tree_ui.js | render (edge phase) | Draw single edge |
| `drawCaptions()` | tree_ui.js | render (caption phase) | Draw node labels |
| `processAndRender()` | tree_ui.js | renderBtn click | UI→graph pipeline |
| `addStartValueToSamples()` | tree_ui.js | startValue input, canvas click | Add node as start value |
| `setupDynamicControls()` | tree_ui.js | modulus change, init | Create rule/angle inputs |
| `RotaryKnob` (constructor) | tree_ui.js | setupStaticKnobs, setupDynamicControls | Create angle control |

### 6.4 Global Variables

```javascript
// tree_math.js
let graph = {...}              // Master data structure
let ruleFunctionCache = Map()  // Cached rule functions

// tree_ui.js
let view = {...}              // Viewport state (x, y, zoom, isDragging)
let currentRoot = null        // Currently displayed tree
let computedLayout = Map()    // node → {x, y, angle}
```

---

## 7. Performance Considerations

### 7.1 Optimization Strategies

**Weight Computation (O(n) linear time):**
- Traverse nodeList backwards (children before parents)
- Accumulate weights bottom-up
- Avoids recursion and redundant calculation

**Height Computation (O(n) linear time):**
- Traverse nodeList forwards (parents before children)
- Calculate max incrementally
- Single pass sufficient

**Rule Caching:**
- Compile rule strings to functions once
- Reuse across millions of samples
- Avoids repeated `new Function()` calls

**Sampling Optimization:**
- If samples >= range: Use full range (no randomness overhead)
- If samples < range: Random sample (efficient for sparse sampling)
- No duplicates in sample set

**Rendering Optimization:**
- BFS layout: Single pass over nodeList
- Canvas scaling: Viewport math applied once per render
- DOM labels: Created only for visible captions (screen-space culling)

### 7.2 Limits

- **MAX_VALUE = 1e18**: Sequences exceeding this are considered divergent and discarded
- **Max Canvas Size**: Browser-dependent (typically 8000-16000px per dimension)
- **Max Nodes**: ~100K nodes renderable with reasonable performance

---

## 8. Testing & Validation

### 8.1 Test Cases

**Classic Collatz (n%2==0 → n/2, n%2==1 → 3n+1):**
- Sample 7: 7→22→11→34→17→52→26→13→40→20→10→5→16→8→4→2→1→4 (cycle at 4, root=1)
- Expected: Single large tree rooted at 1

**Alternative Collatz (n%2==0 → n/2+1, n%2==1 → 3n+1):**
- Sample 2: 2→2→2 (immediate self-loop)
- Sample 9: 9→28→15→46→24→13→40→21→64→33→100→51→154→78→40 (cycle at 40, root=21)
- Expected: Multiple trees (at least 5), including single-node tree at 2

**Triple Sequence (n%3==0 → n/3, n%3==1 → 2n+1, n%3==2 → 4n+2):**
- Multiple independent trees
- Validates generalized rule system

---

## 9. Advanced Features

### 9.1 Multiple Trees

The visualizer can construct hundreds of independent trees. User selects which to display via dropdown.

### 9.2 Dynamic Rule Definition

Users define rules as arbitrary JavaScript expressions (e.g., "n/2", "3*n+1", "n*n+5"). Flexible but requires user to ensure convergence for meaningful results.

### 9.3 Configurable Angles

Each remainder class can have its own branch angle offset, creating unique tree topologies. Angles update in real-time without rebuilding the graph.

### 9.4 Height Metric

Beyond depth (distance from root), height captures the "tallest wall" encountered on the path to root. Useful for identifying nodes with large values deep in the tree.

---

## 10. Code Example: Adding a Sample

```javascript
// User inputs min=20000, range=10000, count=100 samples
// Clicks "Build Trees" with classic Collatz rules

// Internally:
const ruleObj = { mod: 2, rules: ["n/2", "3*n+1"] };
buildGraph(20000, 10000, 100, ruleObj, null);

// For sample 70368:
addSampleToGraph(70368, ruleObj);
  // Trace forward until cycle detected
  sequence = [70368, 35184, 17592, ..., 4, 2, 1, 4]  // cycle at 4
  // Root = 1 (minimum in cycle [4, 2, 1, 4])
  // If graph.root[1] not set, create new tree
  // Backfill: 70368→parent, depth=37; 35184→parent, depth=36; ... 1→cycle target, depth=0
  // graph.nodeList = [1, 4, 2, 8, 16, 5, 10, 20, ..., 35184, 70368]

// Later:
computeWeights();  // Root=1 has weight=count_of_samples_reaching_it
computeHeights();  // For each node, max(nodeValue, height[parent])

// Render:
render(true);
  // Position 1 at (0,0), angle=initialAngle
  // Position children by branchLen and angleOffsets
  // Draw edges with color based on value, width based on weight
  // Add captions for special nodes (root=1, max, min, etc.)
```

---

## 11. Extending the System

### 11.1 Adding a New Sequence Type

1. Define rule object: `{mod: M, rules: [...]}`
2. Populate dropdown or accept as parameter
3. No code changes needed – algorithm is generic

### 11.2 Adding Node Metrics

1. Create new `graph.metricName = Map()` in resetGraph()
2. Populate in addToGraph() or post-processing function
3. Use in rendering (color, size, captions)

### 11.3 Exporting/Analyzing Trees

1. Access `graph.nodeList`, `graph.trees[root]` for all data
2. Serialize to JSON for storage or analysis
3. Generate statistics (tree size, max depth, weight distribution)

---

## Summary

The Collatz Tree Visualizer integrates three core systems:

1. **Graph Construction** (tree_math.js): Traces sequences, detects cycles, builds hierarchical tree structure with weights and heights
2. **Rendering Engine** (tree_ui.js, canvas): Positions nodes via BFS, colors by value, sizes by weight, adds interactive features
3. **User Controls** (tree.html, tree_ui.js): Flexible rule definition, angle adjustment, sample generation, tree selection, canvas interaction

All components work together to efficiently explore and visualize complex sequence behavior across many concurrent trees.
