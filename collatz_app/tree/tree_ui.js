/**
 * UI, Rendering and Interaction
 */

// --- Constants & Config ---
// const CONFIG = {
//     colors: {
//         root: '#2ecc71',
//         max: '#d15858',
//         min: '#f1c40f',
//         target: '#4facfa',
//         deep: '#9b59b6'
//     }
// };

class RotaryKnob {
    constructor(container, inputId, min, max, initialValue, step = 1, dragSensitivity = 0.2) {
        this.container = container;
        this.input = document.getElementById(inputId);
        this.min = min;
        this.max = max;
        this.value = parseFloat(initialValue);
        this.step = step;
        this.sensitivity = dragSensitivity; // Degrees per pixel (Lower = finer)
        
        this.render();
        this.attachEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="knob-wrapper">
                <div class="knob" title="Drag up/down or scroll to adjust">
                    <div class="knob-indicator"></div>
                </div>
                <div class="knob-value">${this.value.toFixed(1)}°</div>
            </div>
        `;
        this.knobEl = this.container.querySelector('.knob');
        this.indicatorEl = this.container.querySelector('.knob-indicator');
        this.valueEl = this.container.querySelector('.knob-value');
        this.updateVisuals();
    }

    updateVisuals() {
        // Normalize value to avoid negative zero or tiny float errors
        let displayVal = this.value;
        if (Math.abs(displayVal) < 0.05) displayVal = 0;
        
        // Rotate indicator
        this.indicatorEl.style.transform = `translateX(-50%) rotate(${displayVal}deg)`;
        this.valueEl.textContent = displayVal.toFixed(1) + '°';
        
        // Update hidden input
        // Fix: Use a small epsilon for comparison to avoid unnecessary updates/flickering
        // and ensuring the input value is set to the rounded display value to match what user sees.
        const currentInputVal = parseFloat(this.input.value);
        if (Math.abs(currentInputVal - displayVal) > 0.01) {
            this.input.value = displayVal.toFixed(1);
            // Trigger event for rendering
            const event = new Event('input', { bubbles: true });
            this.input.dispatchEvent(event);
        }
    }
    
    attachEvents() {
        let startY = 0;
        let startVal = 0;

        const onMouseMove = (e) => {
            const dy = startY - e.clientY; // Drag up = positive
            let newVal = startVal + dy * this.sensitivity;
            
            // Wrap around behavior for angles often feels better, but let's clamp to match min/max
            if (newVal > this.max) newVal = this.max;
            if (newVal < this.min) newVal = this.min;
            
            // Fix: Round to nearest step to avoid floating point noise accumulating
            // But keep high precision internally for smooth movement if needed, 
            // though snapping to step usually feels cleaner.
            // Actually, for "fine" control, raw float is better, but we should handle the "near zero" case.
            
            this.value = newVal;
            this.updateVisuals();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            this.knobEl.classList.remove('active');
        };

        this.knobEl.addEventListener('mousedown', (e) => {
            startY = e.clientY;
            startVal = this.value;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'ns-resize';
            this.knobEl.classList.add('active');
            e.preventDefault(); 
        });
        
        // Wheel support
        this.knobEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -this.step : this.step;
            let newVal = this.value + delta;
            if (newVal > this.max) newVal = this.max;
            if (newVal < this.min) newVal = this.min;
            
            // Fix: Snap to step precision to prevent 0.1 + 0.2 = 0.300000000004
            // Use a multiplier based on step size (assuming step is like 0.1 or 1)
            const precision = this.step < 1 ? 1 : 0;
            newVal = parseFloat(newVal.toFixed(precision));

            this.value = newVal;
            this.updateVisuals();
        }, { passive: false });
    }
}

// --- Rendering ---

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const labelsContainer = document.getElementById('labels-container');

// Viewport state
let view = { x: 0, y: 0, zoom: 1, isDragging: false, lastX: 0, lastY: 0 };
let currentRoot = null;
let computedLayout = new Map(); // node -> {x, y, angle}

function resizeCanvas() {
    canvas.width = document.getElementById('canvas-container').clientWidth;
    canvas.height = document.getElementById('canvas-container').clientHeight;
    if (currentRoot) render(false); // Don't auto-fit on resize
}
window.addEventListener('resize', resizeCanvas);

function render(autoFit = false) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    labelsContainer.innerHTML = ''; 

    if (!currentRoot || !graph.trees[currentRoot]) return;

    const rootVal = currentRoot;
    const angles = getAngles();
    const treeMeta = graph.trees[rootVal];

    // Viewport & Layout Setup
    computedLayout.clear();
    const baseLen = 50;
    let initialAngleRad = (parseFloat(document.getElementById('initAngle').value) || 0) * (Math.PI / 180) - Math.PI / 2;
    
    computedLayout.set(rootVal, { x: 0, y: 0, angle: initialAngleRad });

    const queue = [rootVal];
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    const mod = parseInt(document.getElementById('modulus').value) || 2;

    // 1. BFS Layout Pass (Calculate positions & bounds)
    while (queue.length > 0) {
        const p = queue.shift();
        const pos = computedLayout.get(p);
        const children = graph.children.get(p) || [];
        const depth = graph.depth.get(p);

        for (const child of children) {
            const childDepth = depth + 1;
            const len = baseLen / Math.sqrt(childDepth * 0.5 -0.2 ); 
            
            // Use modulo of child value to determine angle index
            const offsetDeg = angles[child % mod] || 0;
            const newAngle = pos.angle + (offsetDeg * Math.PI / 180);
            const newX = pos.x + Math.cos(newAngle) * len;
            const newY = pos.y + Math.sin(newAngle) * len;
            
            computedLayout.set(child, { x: newX, y: newY, angle: newAngle });
            queue.push(child);

            // Update bounds
            if (newX < minX) minX = newX;
            if (newX > maxX) maxX = newX;
            if (newY < minY) minY = newY;
            if (newY > maxY) maxY = newY;
        }
    }

    // 2. AutoFit Logic (Adjust view if needed)
    if (autoFit) {
        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 50;
        
        const scaleX = (canvas.width - 2 * padding) / width;
        const scaleY = (canvas.height - 2 * padding) / height;
        view.zoom = Math.min(scaleX, scaleY, 2);
        
        // Center the tree bounds
        const treeCenterX = (minX + maxX) / 2;
        const treeCenterY = (minY + maxY) / 2;
        
        // We want the logical point (treeCenterX, treeCenterY) to be at the center of the canvas
        view.x = -treeCenterX * view.zoom;
        view.y = -treeCenterY * view.zoom;
    }

    // 3. Render Pass
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Note: ViewX acts as an offset from the center, accumulating pan drags.
    const translateX = centerX + view.x;
    const translateY = centerY + view.y;
    
    ctx.save();
    ctx.translate(translateX, translateY);
    ctx.scale(view.zoom, view.zoom);

    // Draw Edges
    for (let [node, pos] of computedLayout) {
        if (node === currentRoot) continue;
        const parent = graph.parent.get(node);
        const pPos = computedLayout.get(parent);
        if (pPos) drawEdge(node, pPos, pos.x, pos.y, treeMeta);
    }


    // Captions
    drawCaptions(treeMeta);

    ctx.restore();
}

function drawEdge(node, pPos, x, y, treeMeta) {
    const weight = graph.weight.get(node);
    const logW = Math.log(weight)/Math.log(graph.weight.get(treeMeta.rootNode));
    const lineWidth = Math.max(1, logW * 9); 
    const alpha = Math.min(1, 0.3 + logW*0.7 );
    const hue = 300 - (Math.log(node + 1) / Math.log(treeMeta.highestNode + 1)) * 320;

    ctx.beginPath();
    ctx.moveTo(pPos.x, pPos.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = `hsla(${hue}, 75%, 50%, ${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
}

function drawCaptions(treeMeta) {
    // Build potential captions with priority
    const captionOptions = [
        { nodeId: currentRoot, type: 'root', text: currentRoot, priority: 1 },
        { nodeId: graph.parent.get(currentRoot), type: 'target', text: graph.parent.get(currentRoot), priority: 2 },
        { nodeId: treeMeta.deepestNode, type: 'deep', text: treeMeta.deepestNode, priority: 3 },
        // Highest Node of Deepest Leaf
        { nodeId: graph.height.get(treeMeta.deepestNode), type: 'deep', text: graph.height.get(treeMeta.deepestNode), priority: 4.1 },
        
        { nodeId: treeMeta.highestNode, type: 'max', text: treeMeta.highestNode, priority: 4 },
        // Highest Leaf
        { nodeId: treeMeta.highestLeaf, type: 'max', text: treeMeta.highestLeaf, priority: 4.5 },
        
        { nodeId: treeMeta.lowestNode, type: 'min', text: treeMeta.lowestNode, priority: 5 },
        { nodeId: treeMeta.startValue, type: 'start', text: treeMeta.startValue, priority: 6 },
        // Height of Start Value
        { nodeId: treeMeta.startValue ? graph.height.get(treeMeta.startValue) : null, type: 'start', text: treeMeta.startValue ? graph.height.get(treeMeta.startValue) : null, priority: 6.1 }
    ];

    // Filter and Dedup
    const captionByNode = new Map();
    for (const cap of captionOptions) {
        if (cap.nodeId != null && computedLayout.has(cap.nodeId)) {
            if (!captionByNode.has(cap.nodeId) || captionByNode.get(cap.nodeId).priority > cap.priority) {
                captionByNode.set(cap.nodeId, cap);
            }
        }
    }

    // Get current transform for screen projection
    // Note: Context is currently transformed. 
    // To draw DOM elements we need Screen Coordinates.
    // ScreenX = (NodeX * zoom) + translateX
    // We need to reconstruct translateX/Y from the view state used in the transform.
    
    // Since we didn't pass translateX/Y to this function, let's recalculate or rely on view
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const translateX = centerX + view.x;
    const translateY = centerY + view.y;

    for (const item of captionByNode.values()) {
        const pos = computedLayout.get(item.nodeId);
        const screenX = (pos.x * view.zoom) + translateX;
        const screenY = (pos.y * view.zoom) + translateY;

        if (screenX > -50 && screenX < canvas.width + 50 && screenY > -50 && screenY < canvas.height + 50) {
            const el = document.createElement('div');
            el.className = `node-label label-${item.type}`;
            el.innerText = item.text;
            el.style.left = screenX + 'px';
            el.style.top = screenY + 'px';
            labelsContainer.appendChild(el);
        }
    }
}


// --- Interaction ---

function getAngles() {
    const inputs = document.querySelectorAll('.dynamic-angle');
    const angles = [];
    inputs.forEach(input => {
        angles.push(parseFloat(input.value));
    });
    return angles;
}

function addStartValueToSamples(startValue, rule) {
    if (!startValue || isNaN(startValue)) return;
    
    const startValueInt = parseInt(startValue);
    
    // Store the start value in graph
    graph.startValue = startValueInt;
    
    // Add the start value to the existing sample set
    addSampleToGraph(startValueInt, rule, true); 
    
    // Update the tree selector with any new trees found
    const select = document.getElementById('treeSelect');
    const rootOfStartValue = graph.root.get(startValueInt);
    
    if (rootOfStartValue) {
        // Store the start value in the tree metadata
        graph.trees[rootOfStartValue].startValue = startValueInt;
        
        // Switch to the tree that contains this start value
        select.value = rootOfStartValue;
        currentRoot = rootOfStartValue;
        
        // Re-render the tree (without auto-fit to preserve user's view)
        render(false);
        
        console.log(`Added start value ${startValueInt} to tree with root ${rootOfStartValue}`);
    }
}

function processAndRender() {
    const min = parseInt(document.getElementById('minValue').value);
    const range = parseInt(document.getElementById('rangeValue').value);
    const count = parseInt(document.getElementById('sampleSize').value);
    
    const mod = parseInt(document.getElementById('modulus').value);
    const ruleInputs = document.querySelectorAll('.rule-input');
    const rules = [];
    ruleInputs.forEach(input => rules.push(input.value));
    
    const ruleObj = { mod: mod, rules: rules };

    const startInput = document.getElementById('startValue').value;
    const startValue = startInput ? parseInt(startInput) : null;
    
    document.getElementById('loading').style.display = 'block';

    setTimeout(() => {
        const t0 = performance.now();
        buildGraph(min, range, count, ruleObj, startValue);
        computeWeights();
        computeHeights();
        const t1 = performance.now();
        console.log(`Graph build took ${(t1-t0).toFixed(2)}ms. Nodes: ${graph.nodeList.length}`);
        
        const select = document.getElementById('treeSelect');
        select.innerHTML = '';
        const roots = Object.keys(graph.trees).sort((a,b) => parseInt(a)-parseInt(b));
        
        if (roots.length === 0) {
            alert("No trees found (check parameters)");
            document.getElementById('loading').style.display = 'none';
            return;
        }

        roots.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            let rootValue = Number(r);
            opt.innerText = `Root: ${r} (size : ${graph.weight.get(rootValue)})`;
            select.appendChild(opt);
        });
        select.disabled = false;
        
        // Set default tree based on start value hierarchy
        if (startValue != null && graph.root.has(startValue)) {
            const rootOfStartValue = graph.root.get(startValue);
            currentRoot = rootOfStartValue;
            select.value = rootOfStartValue;
            
            // Store the start value in the tree metadata
            if (graph.trees[rootOfStartValue]) {
                graph.trees[rootOfStartValue].startValue = startValue;
            }
            
            console.log(`Rendering tree for start value ${startValue}, root ${rootOfStartValue}`);
        } else {
            currentRoot = parseInt(roots[0]);
        } 
        
        render(true); // Auto-fit on initial render
        document.getElementById('loading').style.display = 'none';
        
        // Setup start value change handler
        const startValueInput = document.getElementById('startValue');
        startValueInput.onchange = (e) => {
            addStartValueToSamples(e.target.value, ruleObj);
        };
    }, 50);
}

function setupStaticKnobs() {
    // Init Angle Knob
    const initContainer = document.getElementById('initAngleKnob');
    const initInput = document.getElementById('initAngle');
    if (initContainer && initInput) {
        // Keep Initial Angle coarser: Step 1, Sensitivity 0.2
        new RotaryKnob(initContainer, 'initAngle', -180, 180, initInput.value, 1, 0.2);
        // Listen for input events on the hidden input
        initInput.addEventListener('input', () => {
             if (currentRoot) render(false);
        });
    }
}

function setupDynamicControls() {
    const modInput = document.getElementById('modulus');
    const mod = parseInt(modInput.value) || 2;
    
    const grid = document.getElementById('dynamic-grid');
    grid.innerHTML = '';
    
    for(let i=0; i<mod; i++) {
        // Default rules for M=2 (Classic)
        let defaultRule = "n";
        if (mod === 2) {
             defaultRule = (i===0) ? "n/2" : "3*n+1";
        } else if (mod === 3) {
             // Triple defaults
             if(i===0) defaultRule = "n/3";
             if(i===1) defaultRule = "2*n+1";
             if(i===2) defaultRule = "(4*n+2)/3";
        } else if (mod === 4) {
            // Triple defaults
             if(i===0) defaultRule = "(n/2) + 1";
             if(i===1) defaultRule = "(3*n) + 1";
             if(i===2) defaultRule = "(n/2) - 1";
             if(i===3) defaultRule = "(3*n) + 1";
       }
        
        // Default angles
        let defaultAngle = 15;
        if (mod === 2) {
            if(i===0) defaultAngle = 7.5;
            if(i===1) defaultAngle = -15;
        }
        if (mod === 3) {
            if(i===0) defaultAngle = 30;
            if(i===1) defaultAngle = -45;
            if(i===2) defaultAngle = 0;
        } 
        if (mod === 4) {
            if(i===0) defaultAngle = 10 ;
            if(i===1) defaultAngle = -20;
            if(i===2) defaultAngle = -10;
            if(i===3) defaultAngle = 20;
        } 


        // Rule (Left)
        const ruleGroup = document.createElement('div');
        ruleGroup.className = 'control-group';
        ruleGroup.innerHTML = `
            <label>n % ${mod} = ${i}; n &rarr;</label>
            <input type="text" class="rule-input" data-index="${i}" value="${defaultRule}">
        `;
        grid.appendChild(ruleGroup);
        
        // Angle (Right)
        const angleGroup = document.createElement('div');
        angleGroup.className = 'control-group knob-control';
        const knobId = `angle${i}`;
        
        // <label for="${knobId}">Angle ${i}</label>
        angleGroup.innerHTML = `
            <div id="${knobId}-knob" class="knob-container"></div>
            <input type="range" id="${knobId}" min="-180" max="180" step="0.1" value="${defaultAngle}" class="hidden-slider dynamic-angle">
        `;
        grid.appendChild(angleGroup);

        // Initialize Knob
        // Branch Angles: Finer control. Step 0.1, Sensitivity 0.05 (slower drag)
        new RotaryKnob(document.getElementById(`${knobId}-knob`), knobId, -180, 180, defaultAngle, 0.1, 0.05);
        
        // Attach listener to the newly created hidden input
        const hiddenInput = document.getElementById(knobId);
        hiddenInput.addEventListener('input', () => {
             if (currentRoot) render(false);
        });
    }
}

document.getElementById('modulus').addEventListener('change', setupDynamicControls);

document.getElementById('renderBtn').addEventListener('click', processAndRender);

document.getElementById('treeSelect').addEventListener('change', (e) => {
    currentRoot = parseInt(e.target.value);
    document.getElementById('startValue').value = currentRoot;
    render(true); 
});

document.getElementById('fitBtn').addEventListener('click', () => {
    render(true);
});

// Init on load
setupDynamicControls();
setupStaticKnobs();

// ... existing code ...

const tooltip = document.getElementById('tooltip');
let hasDragged = false;

function getMouseWorldPos(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const translateX = centerX + view.x;
    const translateY = centerY + view.y;
    
    const wx = (mx - translateX) / view.zoom;
    const wy = (my - translateY) / view.zoom;
    
    return { x: wx, y: wy, mx, my }; 
}

function hitTest(wx, wy) {
    let closestNode = null;
    let minDistSq = Infinity;
    const threshold = 10; 
    const thresholdSq = threshold * threshold;

    for (const [node, pos] of computedLayout) {
        const dx = pos.x - wx;
        const dy = pos.y - wy;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < thresholdSq && distSq < minDistSq) {
            minDistSq = distSq;
            closestNode = node;
        }
    }
    return closestNode;
}

canvas.addEventListener('mousedown', e => {
    view.isDragging = true;
    view.lastX = e.clientX;
    view.lastY = e.clientY;
    hasDragged = false;
});

window.addEventListener('mouseup', e => {
    if (!view.isDragging) return;
    view.isDragging = false;
    
    if (!hasDragged) {
        // It was a click!
        const { x, y } = getMouseWorldPos(e);
        const node = hitTest(x, y);
        if (node !== null) {
             // Get current rule object to pass to addStartValueToSamples
             const mod = parseInt(document.getElementById('modulus').value);
             const ruleInputs = document.querySelectorAll('.rule-input');
             const rules = [];
             ruleInputs.forEach(input => rules.push(input.value));
             const ruleObj = { mod: mod, rules: rules };

             document.getElementById('startValue').value = node;
             addStartValueToSamples(node, ruleObj);
             
             // Highlight logic could be added here if we want persistent highlight, 
             // but addStartValueToSamples already triggers re-render.
             // The caption logic should handle highlighting if we treat startValue as the highlighted one.
        }
    }
});

window.addEventListener('mousemove', e => {
    if (view.isDragging) {
        const dx = e.clientX - view.lastX;
        const dy = e.clientY - view.lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDragged = true; 
        
        view.x += dx;
        view.y += dy;
        view.lastX = e.clientX;
        view.lastY = e.clientY;
        render(false); 
    }
});

canvas.addEventListener('mousemove', e => {
    if (!view.isDragging) {
        const { x, y, mx, my } = getMouseWorldPos(e);
        const node = hitTest(x, y);
        
        if (node !== null) {
            tooltip.style.display = 'block';
            tooltip.style.left = (mx + 15) + 'px';
            tooltip.style.top = (my + 15) + 'px';
            
            const weight = graph.weight.get(node);
            const depth = graph.depth.get(node);
            const height = graph.height.get(node);
            
            tooltip.innerHTML = `
                <div><strong>Value:</strong> ${node}</div>
                <div><strong>Weight:</strong> ${weight}</div>
                <div><strong>Depth:</strong> ${depth}</div>
                <div><strong>Height:</strong> ${height}</div>
            `;
            canvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            canvas.style.cursor = ''; // Revert to CSS (grab)
        }
    }
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const oldZoom = view.zoom;
    
    if (e.deltaY < 0) view.zoom *= scaleFactor;
    else view.zoom /= scaleFactor;

    // Pivot around the center of the canvas
    // We want to keep the world point under the center of the screen stationary (relative to the center)
    // ScreenCenter = Center + View + (World * Zoom)
    // We want the World point at the center to remain the same.
    // WorldAtCenter = (0 - View_old) / Zoom_old  (Assuming Center is origin (0,0) for calculation simplification)
    // Actually, simplified:
    // The view offset (view.x, view.y) needs to be adjusted so that the center of the screen 
    // still points to the same logical coordinate.
    // view.x represents the translation of the logical origin relative to the screen center.
    // When we zoom in, the logical origin moves further away from the center point (if it wasn't at center).
    
    // Formula: newView = newZoom/oldZoom * oldView
    view.x = view.x * (view.zoom / oldZoom);
    view.y = view.y * (view.zoom / oldZoom);

    render(false); 
});

resizeCanvas();
