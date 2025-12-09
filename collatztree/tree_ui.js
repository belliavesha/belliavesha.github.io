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

// Global registry for knob instances
const knobRegistry = new Map();

class RotaryKnob {
    constructor(container, inputId, min, max, initialValue, step = 1, dragSensitivity = 0.5) {
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

    setValue(newValue) {
        this.value = parseFloat(newValue);
        this.updateVisuals();
    }

    updateVisuals() {
        // Normalize value to avoid negative zero or tiny float errors
        let displayVal = this.value;
        if (Math.abs(displayVal) < 0.05) displayVal = 0;
        
        // Rotate indicator
        this.indicatorEl.style.transform = `translateX(-50%) rotate(${displayVal}deg)`;
        
        // Display format depends on step size - whole numbers for step >= 1, decimal for smaller steps
        const decimalPlaces = this.step >= 1 ? 0 : 1;
        this.valueEl.textContent = displayVal.toFixed(decimalPlaces) + '°';
        
        // Update hidden input
        // Fix: Use a small epsilon for comparison to avoid unnecessary updates/flickering
        // and ensuring the input value is set to the rounded display value to match what user sees.
        const currentInputVal = parseFloat(this.input.value);
        const epsilon = this.step >= 1 ? 0.1 : 0.01;
        if (Math.abs(currentInputVal - displayVal) > epsilon) {
            this.input.value = displayVal.toFixed(decimalPlaces);
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
let showLabels = true; // Toggle for showing/hiding captions
let darkBackground = false; // Toggle for dark/light background

function resizeCanvas() {
    canvas.width = document.getElementById('canvas-container').clientWidth;
    canvas.height = document.getElementById('canvas-container').clientHeight;
    if (currentRoot) render(false); // Don't auto-fit on resize
}
window.addEventListener('resize', resizeCanvas);

function render(autoFit = false, highResExport = false) {
    const renderStart = performance.now();
    console.log(`🎬 RENDER START - Nodes: ${graph.nodeList.length}, Tree nodes: ${graph.nodeList.filter(n => graph.root.get(n) === currentRoot).length}`);
    
    // If high-res export, create temporary canvas
    let targetCtx = ctx;
    let targetCanvas = canvas;
    let centerX, centerY;
    
    if (highResExport) {
        const highResStart = performance.now();
        
        // Create off-screen canvas for high-res rendering
        targetCanvas = document.createElement('canvas');
        targetCtx = targetCanvas.getContext('2d');
        
        // We need the tree bounds first to calculate proper dimensions
        if (!currentRoot || !graph.trees[currentRoot]) return;

        const rootVal = currentRoot;
        const angles = getAngles();
        const treeMeta = graph.trees[rootVal];

        // Compute layout to get bounds
        const tempLayout = new Map();
        const baseLen = 50;
        let initialAngleRad = (parseFloat(document.getElementById('initAngle').value) || 0) * (Math.PI / 180) - Math.PI / 2;
        
        tempLayout.set(rootVal, { x: 0, y: 0, angle: initialAngleRad });

        const queue = [rootVal];
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        const mod = parseInt(document.getElementById('modulus').value) || 2;

        // BFS Layout Pass to calculate bounds
        while (queue.length > 0) {
            const p = queue.shift();
            const pos = tempLayout.get(p);
            const children = graph.children.get(p) || [];
            const depth = graph.depth.get(p);

            for (const child of children) {
                const childDepth = depth + 1;
                const len = baseLen / Math.sqrt(childDepth * 0.5 - 0.2); 
                
                const offsetDeg = angles[child % mod] || 0;
                const newAngle = pos.angle + (offsetDeg * Math.PI / 180);
                const newX = pos.x + Math.cos(newAngle) * len;
                const newY = pos.y + Math.sin(newAngle) * len;
                
                tempLayout.set(child, { x: newX, y: newY, angle: newAngle });
                queue.push(child);

                if (newX < minX) minX = newX;
                if (newX > maxX) maxX = newX;
                if (newY < minY) minY = newY;
                if (newY > maxY) maxY = newY;
            }
        }

        // Calculate high-res canvas dimensions (4096px on longest side)
        const MAX_RESOLUTION = 4096;
        const padding = 100;
        const width = maxX - minX;
        const height = maxY - minY;
        const aspectRatio = width / height;
        
        let canvasWidth, canvasHeight, zoom;
        
        if (aspectRatio >= 1) {
            // Width is the longer side
            canvasWidth = MAX_RESOLUTION - 2 * padding;
            canvasHeight = canvasWidth / aspectRatio;
            zoom = canvasWidth / width;
        } else {
            // Height is the longer side
            canvasHeight = MAX_RESOLUTION - 2 * padding;
            canvasWidth = canvasHeight * aspectRatio;
            zoom = canvasHeight / height;
        }
        
        canvasWidth += 2 * padding;
        canvasHeight += 2 * padding;
        
        targetCanvas.width = Math.ceil(canvasWidth);
        targetCanvas.height = Math.ceil(canvasHeight);
        
        centerX = canvasWidth / 2;
        centerY = canvasHeight / 2;
        
        // Fill background
        targetCtx.fillStyle = darkBackground ? '#fff0fa' : '#150010';
        targetCtx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        const highResTime = performance.now() - highResStart;
        console.log(`📐 High-res setup: ${highResTime.toFixed(2)}ms`);
    } else {
        const setupStart = performance.now();
        
        // Regular canvas rendering
        targetCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fill background
        targetCtx.fillStyle = darkBackground ? '#fff0fa' : '#150010';
        targetCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        labelsContainer.innerHTML = '';
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        
        const setupTime = performance.now() - setupStart;
        console.log(`🎨 Canvas setup: ${setupTime.toFixed(2)}ms`);
    } 

    if (!highResExport) {
        if (!currentRoot || !graph.trees[currentRoot]) return;
    }

    const rootVal = currentRoot;
    const angles = getAngles();
    const treeMeta = graph.trees[rootVal];

    // Viewport & Layout Setup
    const layoutStart = performance.now();
    computedLayout.clear();
    const baseLen = 50;
    let initialAngleRad = (parseFloat(document.getElementById('initAngle').value) || 0) * (Math.PI / 180) - Math.PI / 2;
    
    computedLayout.set(rootVal, { x: 0, y: 0, angle: initialAngleRad });

    const queue = [rootVal];
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    let nodesProcessed = 0;
    
    const mod = parseInt(document.getElementById('modulus').value) || 2;

    // 1. BFS Layout Pass (Calculate positions & bounds)
    while (queue.length > 0) {
        const p = queue.shift();
        const pos = computedLayout.get(p);
        const children = graph.children.get(p) || [];
        const depth = graph.depth.get(p);

        for (const child of children) {
            nodesProcessed++;
            const childDepth = depth + 1;
            const len = baseLen / Math.sqrt(childDepth * 0.5  ); 
            
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

    const layoutTime = performance.now() - layoutStart;
    console.log(`📍 Layout calculation: ${layoutTime.toFixed(2)}ms, nodes processed: ${nodesProcessed}, layout size: ${computedLayout.size}`);
    
    // 2. AutoFit Logic (Adjust view if needed)
    const autofitStart = performance.now();
    if (autoFit) {
        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 50;
        
        const scaleX = (targetCanvas.width - 2 * padding) / width;
        const scaleY = (targetCanvas.height - 2 * padding) / height;
        view.zoom = Math.min(scaleX, scaleY, 2);
        
        // Center the tree bounds
        const treeCenterX = (minX + maxX) / 2;
        const treeCenterY = (minY + maxY) / 2;
        
        // We want the logical point (treeCenterX, treeCenterY) to be at the center of the canvas
        view.x = -treeCenterX * view.zoom;
        view.y = -treeCenterY * view.zoom;
    }
    const autofitTime = performance.now() - autofitStart;
    console.log(`🎯 Auto-fit: ${autofitTime.toFixed(2)}ms`);

    // 3. Render Pass
    const renderPassStart = performance.now();
    centerX = targetCanvas.width / 2;
    centerY = targetCanvas.height / 2;
    
    // Note: ViewX acts as an offset from the center, accumulating pan drags.
    const translateX = centerX + view.x;
    const translateY = centerY + view.y;
    
    targetCtx.save();
    targetCtx.translate(translateX, translateY);
    targetCtx.scale(view.zoom, view.zoom);

    // Draw Edges
    const edgesStart = performance.now();
    let edgesDrawn = 0;
    for (let [node, pos] of computedLayout) {
        if (node === currentRoot) continue;
        const parent = graph.parent.get(node);
        const pPos = computedLayout.get(parent);
        if (pPos) {
            drawEdge(node, pPos, pos.x, pos.y, treeMeta, targetCtx);
            edgesDrawn++;
        }
    }
    const edgesTime = performance.now() - edgesStart;
    console.log(`📐 Edge drawing: ${edgesTime.toFixed(2)}ms, edges drawn: ${edgesDrawn}`);

    // Captions
    const captionsStart = performance.now();
    drawCaptions(treeMeta, targetCtx, targetCanvas, highResExport);
    const captionsTime = performance.now() - captionsStart;
    console.log(`🏷️  Captions: ${captionsTime.toFixed(2)}ms`);

    targetCtx.restore();
    
    const renderPassTime = performance.now() - renderPassStart;
    console.log(`🎨 Render pass: ${renderPassTime.toFixed(2)}ms`);
    
    // If high-res export, download the image
    if (highResExport) {
        const exportStart = performance.now();
        targetCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `collatz-tree-${currentRoot}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            const exportTime = performance.now() - exportStart;
            console.log(`💾 Export & save: ${exportTime.toFixed(2)}ms`);
        }, 'image/png');
    }
    
    const totalRenderTime = performance.now() - renderStart;
    console.log(`✅ RENDER COMPLETE - Total: ${totalRenderTime.toFixed(2)}ms`);
}

function drawEdge(node, pPos, x, y, treeMeta, targetCtx = ctx) {
    const weight = graph.weight.get(node);
    const logW = Math.log2(weight);//Math.log(graph.weight.get(treeMeta.rootNode));
    const logWnorm = Math.log2(treeMeta.leafCount);
    const lineWidth = 2 + logW; 
    const alpha = logWnorm == 0 ? 1 : Math.min(1, 0.25 + logW/logWnorm*0.75 );
    const hue = 300 - (Math.log(node) / Math.log(treeMeta.highestNode)) * 320;
    const darkness = darkBackground ? 50 : 0;

    targetCtx.beginPath();
    targetCtx.moveTo(pPos.x, pPos.y);
    targetCtx.lineTo(x, y);
    targetCtx.strokeStyle = `hsla(${hue}, ${75-darkness}%, 50%, ${alpha})`;
    targetCtx.lineWidth = lineWidth;
    targetCtx.lineCap = 'round';
    targetCtx.stroke();
}

function drawCaptions(treeMeta, targetCtx = ctx, targetCanvas = canvas, highResExport = false) {
    if (!showLabels) return;
    
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

    
    // Since we didn't pass translateX/Y to this function, let's recalculate or rely on view
    const centerX = targetCanvas.width / 2;
    const centerY = targetCanvas.height / 2;
    const translateX = centerX + view.x;
    const translateY = centerY + view.y;

    if (highResExport) {
        // Draw captions directly on canvas for high-res export
        const captionColorMap = {
            'root': { bg: 'rgba(155, 89, 182, 0.8)', border: '#9b59b6' },
            'target': { bg: 'rgba(79, 172, 250, 0.8)', border: '#4facfa' },
            'deep': { bg: 'rgba(46, 204, 113, 0.8)', border: '#2ecc71' },
            'max': { bg: 'rgba(209, 88, 88, 0.8)', border: '#d15858' },
            'min': { bg: 'rgba(241, 196, 15, 0.8)', border: '#f1c40f' },
            'start': { bg: 'rgba(255, 165, 0, 0.8)', border: '#ff8c00' }
        };

        // Scale font size proportionally to the zoom level for high resolution
        const baseFontSize = 14;
        const scaledFontSize = Math.max(baseFontSize, baseFontSize * (view.zoom / 10));

        for (const item of captionByNode.values()) {
            const pos = computedLayout.get(item.nodeId);
            const screenX = (pos.x * view.zoom) + translateX;
            const screenY = (pos.y * view.zoom) + translateY;

            if (screenX > -50 && screenX < targetCanvas.width + 50 && screenY > -50 && screenY < targetCanvas.height + 50) {
                const colors = captionColorMap[item.type];
                
                targetCtx.font = `bold ${scaledFontSize}px monospace`;
                const textWidth = targetCtx.measureText(item.text).width;
                const boxWidth = textWidth + 8;
                const boxHeight = scaledFontSize + 6;
                
                // Draw background box
                targetCtx.fillStyle = colors.bg;
                targetCtx.fillRect(screenX - boxWidth / 2, screenY, boxWidth, boxHeight);
                
                // Draw border
                targetCtx.strokeStyle = colors.border;
                targetCtx.lineWidth = 2;
                targetCtx.strokeRect(screenX - boxWidth / 2, screenY, boxWidth, boxHeight);
                
                // Draw text
                targetCtx.fillStyle = '#000000';
                targetCtx.textAlign = 'center';
                targetCtx.textBaseline = 'top';
                targetCtx.fillText(item.text, screenX, screenY + 3);
            }
        }
    } else {
        // Regular DOM rendering for normal display
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

function addStartValueToSamples(startValue, ruleSet) {
    if (!startValue || isNaN(startValue)) return;
    
    const startValueInt = parseInt(startValue);
    
    // Store the start value in graph
    graph.startValue = startValueInt;
    
    // Add the start value to the existing sample set
    addSampleToGraph(startValueInt, ruleSet, true); 
    
    // Update the tree selector with any new trees found
    const select = document.getElementById('treeSelect');
    const rootOfStartValue = graph.root.get(startValueInt);
    
    if (rootOfStartValue) {
        // Store the start value in the tree metadata
        graph.trees[rootOfStartValue].startValue = startValueInt;
        
        // Check if this tree root is already in the dropdown, if not add it
        const optionExists = Array.from(select.options).some(option => option.value === rootOfStartValue.toString());
        if (!optionExists) {
            const newOption = document.createElement('option');
            newOption.value = rootOfStartValue;
            newOption.innerText = `${rootOfStartValue}`;
            select.appendChild(newOption);
        }
        
        // Check if we're in start value mode (toggle checked = start value mode)
        const toggle = document.getElementById('treeModeToggle');
        
        if (toggle.checked) {
            // Start value mode - switch to the tree that contains this start value
            select.value = rootOfStartValue;
            currentRoot = rootOfStartValue;
            // Re-render the tree (without auto-fit to preserve user's view)
        }
        render(false);
        
        // console.log(`Added start value ${startValueInt} to tree with root ${rootOfStartValue}`);
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
    
    // Create RuleSet for performance
    const ruleSet = new RuleSet({ mod: mod, rules: rules });

    const startInput = document.getElementById('startValue').value;
    const startValue = startInput ? parseInt(startInput) : null;
    
    document.getElementById('loading').style.display = 'block';

    setTimeout(() => {
        const t0 = performance.now();
        buildGraph(min, range, count, ruleSet, startValue);
        computeWeights();
        computeHeights();
        const t1 = performance.now();
        console.log(`Graph build took ${(t1-t0).toFixed(2)}ms. Nodes: ${graph.nodeList.length}`);
        
        const select = document.getElementById('treeSelect');
        select.innerHTML = '';
        // const roots = Object.keys(graph.trees).sort((a,b) => parseInt(a)-parseInt(b));

        const roots = Object.keys(graph.trees).sort((a,b) => (graph.trees[b].leafCount-graph.trees[a].leafCount));
        
        if (roots.length === 0) {
            alert("No trees found (check parameters)");
            document.getElementById('loading').style.display = 'none';
            return;
        }
        // console.log(select);
        roots.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            // let rootValue = Number(r); // (size : ${graph.weight.get(rootValue)})
            opt.innerText = r; //`${r}`;
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
            
            // console.log(`Rendering tree for start value ${startValue}, root ${rootOfStartValue}`);
        } else {
            currentRoot = parseInt(roots[0]);
        } 
        
        render(true); // Auto-fit on initial render
        document.getElementById('loading').style.display = 'none';
        
        // Setup start value change handler
        const startValueInput = document.getElementById('startValue');
        startValueInput.onchange = (e) => {
            addStartValueToSamples(e.target.value, ruleSet);
        };
    }, 50);
}

function setupStaticKnobs() {
    // Init Angle Knob
    const initContainer = document.getElementById('initAngleKnob');
    const initInput = document.getElementById('initAngle');
    if (initContainer && initInput) {
        // Keep Initial Angle coarser: Step 1, Sensitivity 0.2
        const initKnob = new RotaryKnob(initContainer, 'initAngle', -180, 180, initInput.value, 1, 0.2);
        knobRegistry.set('initAngle', initKnob);
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
        } else if (mod === 3) {
            console.log("mod=3,i =",i)
            if(i===0) defaultAngle = 30;
            if(i===1) defaultAngle = -45;
            if(i===2) defaultAngle = 0;
        } else if (mod === 4) {
            if(i===0) defaultAngle = 10 ;
            if(i===1) defaultAngle = -20;
            if(i===2) defaultAngle = -10;
            if(i===3) defaultAngle = 20;
        } else {
            defaultAngle = ((i%2)===0) ? 15 : -15;
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
            <input type="range" id="${knobId}" min="-90" max="90" step="0.1" value="${defaultAngle}" class="hidden-slider dynamic-angle">
        `;
        grid.appendChild(angleGroup);

        // Initialize Knob
        // Branch Angles: Finer control. Step 0.1, Sensitivity 0.05 (slower drag)
        const dynamicKnob = new RotaryKnob(document.getElementById(`${knobId}-knob`), knobId, -90, 90, defaultAngle, 0.1, 0.05);
        knobRegistry.set(knobId, dynamicKnob);
        
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
    
    // // Update tree selection mode based on toggle state
    // const toggle = document.getElementById('treeModeToggle');
    // const toggleLabel = document.querySelector('.toggle-label');

    render(true); 
});

document.getElementById('fitBtn').addEventListener('click', () => {
    render(true);
});

document.getElementById('toggleLabelsBtn').addEventListener('click', () => {
    showLabels = !showLabels;
    const btn = document.getElementById('toggleLabelsBtn');
    btn.innerText = showLabels ? 'Hide Labels' : 'Show Labels';
    if (currentRoot) render(false);
});

document.getElementById('toggleBgBtn').addEventListener('click', () => {
    darkBackground = !darkBackground;
    const btn = document.getElementById('toggleBgBtn');
    btn.innerText = darkBackground ? 'Dark Background' : 'Light Background';
    if (currentRoot) render(false);
});

document.getElementById('saveImgBtn').addEventListener('click', () => {
    render(true, true); // autoFit=true and highResExport=true
    // render(true);
});

// Save Tree functionality
document.getElementById('saveTreeBtn').addEventListener('click', () => {
    if (!currentRoot || !graph.trees[currentRoot]) {
        alert('No tree to save. Please build a tree first.');
        return;
    }

    // Get all leaves of the current tree
    const leaves = [];
    for (const node of graph.nodeList) {
        if (graph.root.get(node) === currentRoot) {
            const children = graph.children.get(node) || [];
            if (children.length === 0) {
                leaves.push(node);
            }
        }
    }

    // Get current configuration
    const mod = parseInt(document.getElementById('modulus').value);
    const rules = [];
    const ruleInputs = document.querySelectorAll('.rule-input');
    ruleInputs.forEach(input => rules.push(input.value));

    const angles = [];
    const angleInputs = document.querySelectorAll('.dynamic-angle');
    angleInputs.forEach(input => angles.push(parseFloat(input.value)));

    const initAngle = parseFloat(document.getElementById('initAngle').value);

    // Create tree data object
    const treeData = {
        version: '1.0',
        root: currentRoot,
        leaves: leaves,
        config: {
            modulus: mod,
            rules: rules,
            angles: angles,
            initAngle: initAngle
        }
    };

    // Download as JSON file
    const dataStr = JSON.stringify(treeData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    // Create a descriptive filename with root and rules
    const rulesStr = rules.map(rule => rule.replace(/\*/g, '×').replace(/\//g, '÷').replace(/ /g, '')).join('_');
    link.download = `tree-${currentRoot}-rules-${rulesStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Saved tree ${currentRoot} with ${leaves.length} leaves`);
});

// Load Tree functionality - Dropdown
const loadTreeBtn = document.getElementById('loadTreeBtn');
const loadTreeDropdown = document.getElementById('loadTreeDropdown');
const uploadOption = document.getElementById('uploadOption');

// Toggle dropdown
loadTreeBtn.addEventListener('click', () => {
    loadTreeDropdown.classList.toggle('show');
});

// Handle dropdown item clicks
document.querySelectorAll('.dropdown-item[data-file]').forEach(item => {
    item.addEventListener('click', async () => {
        const filePath = item.dataset.file;
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status}`);
            }
            const treeData = await response.json();
            loadTreeData(treeData);
            loadTreeDropdown.classList.remove('show');
        } catch (error) {
            alert(`Error loading tree file ${filePath}: ${error.message}`);
            console.error('Load tree error:', error);
        }
    });
});

// Handle upload option
uploadOption.addEventListener('click', () => {
    document.getElementById('loadTreeFile').click();
    loadTreeDropdown.classList.remove('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        loadTreeDropdown.classList.remove('show');
    }
});

document.getElementById('loadTreeFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const treeData = JSON.parse(event.target.result);
            loadTreeData(treeData);
        } catch (error) {
            alert('Invalid tree file. Please select a valid JSON tree file.');
            console.error('Error loading tree:', error);
        }
    };
    reader.readAsText(file);
    
    // Reset the file input
    e.target.value = '';
});

function loadTreeData(treeData) {
    try {
        // Set modulus
        document.getElementById('modulus').value = treeData.config.modulus;
        
        // Trigger modulus change to recreate dynamic controls
        setupDynamicControls();
        
        // Wait for controls to be created, then populate them
        setTimeout(() => {
            // Set rules
            const ruleInputs = document.querySelectorAll('.rule-input');
            treeData.config.rules.forEach((rule, index) => {
                if (ruleInputs[index]) {
                    ruleInputs[index].value = rule;
                }
            });

            // Set angles
            const angleInputs = document.querySelectorAll('.dynamic-angle');
            treeData.config.angles.forEach((angle, index) => {
                if (angleInputs[index]) {
                    angleInputs[index].value = angle;
                }
            });
            
            // Set initial angle
            document.getElementById('initAngle').value = treeData.config.initAngle;
            
            // Update knob visuals to match loaded values
            if (knobRegistry.has('initAngle')) {
                knobRegistry.get('initAngle').setValue(treeData.config.initAngle);
            }
            
            // Update dynamic angle knobs
            angleInputs.forEach((input, index) => {
                const knobId = input.id;
                if (knobRegistry.has(knobId) && treeData.config.angles[index] !== undefined) {
                    knobRegistry.get(knobId).setValue(treeData.config.angles[index]);
                }
            });

            // Populate sample fields with illustrative values from the loaded data
            const leaves = treeData.leaves;
            if (leaves.length > 0) {
                const minLeaf = Math.min(...leaves);
                const maxLeaf = Math.max(...leaves);
                const range = maxLeaf - minLeaf + 1;

                // Set sample fields for user reference (illustrative only)
                document.getElementById('sampleSize').value = leaves.length;
                document.getElementById('minValue').value = minLeaf;
                document.getElementById('rangeValue').value = range;
                document.getElementById('startValue').value = maxLeaf;

                // Build the tree DIRECTLY from the saved leaves
                const ruleSet = new RuleSet({ 
                    mod: treeData.config.modulus, 
                    rules: treeData.config.rules 
                });
                
                // Reset and build graph with exact leaf samples
                resetGraph();
                
                // Add each leaf as a sample to build the exact same tree
                for (const sample of treeData.leaves) {
                    addSampleToGraph(sample, ruleSet);
                }
                
                // Compute weights and heights
                computeWeights();
                computeHeights();
                
                // Update the tree selector dropdown
                const select = document.getElementById('treeSelect');
                select.innerHTML = '';
                const roots = Object.keys(graph.trees).sort((a,b) => (graph.trees[b].leafCount-graph.trees[a].leafCount));
                
                roots.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r;  
                    opt.innerText = r ;
                    select.appendChild(opt);
                });
                select.disabled = false;



                
                // Set current root to the loaded tree's root
                currentRoot = treeData.root;
                select.value = treeData.root;
                
                // Store the start value in the tree metadata
                if (graph.trees[treeData.root]) {
                    // console.log("graph trees")
                    // graph.trees[treeData.root].startValue = treeData.root;
                    graph.trees[treeData.root].startValue = maxLeaf;
                    const toggle = document.getElementById('treeModeToggle');
                    const toggleLabel = document.querySelector('.toggle-label');
                    toggle.checked = false; // Root mode by default after loading
                    toggleLabel.textContent = 'By Root';
                }

                // Setup start value change handler 
                const startValueInput = document.getElementById('startValue');
                startValueInput.onchange = (e) => {
                    addStartValueToSamples(e.target.value, ruleSet);
                };

                
                // Render the tree
                render(true); // Auto-fit on initial render
                
                
                console.log(`Loaded tree ${treeData.root} with ${treeData.leaves.length} leaves`);
            }
            
        }, 100); // Small delay to ensure DOM is updated
        
    } catch (error) {
        alert('Error loading tree data: ' + error.message);
        console.error('Load tree error:', error);
    }
}

// Tree selection mode toggle
document.getElementById('treeModeToggle').addEventListener('change', (e) => {
    const toggle = e.target;
    const toggleLabel = document.querySelector('.toggle-label');
    const startValueInput = document.getElementById('startValue');
    const treeSelect = document.getElementById('treeSelect');
    
    if (toggle.checked) {
        // Start value mode (default) - disable tree select, enable start value
        toggleLabel.textContent = 'By Start';
        startValueInput.disabled = false;
        treeSelect.disabled = false;
        
        // When switching to start value mode, update the tree based on current start value
        const currentStartValue = parseInt(startValueInput.value);
        if (currentStartValue && graph.root.has(currentStartValue)) {
            const rootOfStartValue = graph.root.get(currentStartValue);
            currentRoot = rootOfStartValue;
            treeSelect.value = rootOfStartValue;
        }
    } else {
        toggleLabel.textContent = 'By Root';
        
        // When switching to tree select mode, update start value to match current tree root
        if (currentRoot) {
            startValueInput.value = currentRoot;
        }
    }
    
    if (currentRoot) {
        render(false); // Re-render with current tree
    }
});

// Init on load
setupDynamicControls();
setupStaticKnobs();

// Initialize tree selection mode toggle to start value mode (checked = start value mode)
const toggle = document.getElementById('treeModeToggle');
const toggleLabel = document.querySelector('.toggle-label');
toggle.checked = true; // Start value mode by default
toggleLabel.textContent = 'By Start';
// Don't disable start value input initially, keep it enabled

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
             // Create RuleSet to pass to addStartValueToSamples
             const mod = parseInt(document.getElementById('modulus').value);
             const ruleInputs = document.querySelectorAll('.rule-input');
             const rules = [];
             ruleInputs.forEach(input => rules.push(input.value));
             const ruleSet = new RuleSet({ mod: mod, rules: rules });

             document.getElementById('startValue').value = node;
             addStartValueToSamples(node, ruleSet);
             
             // If in tree selection mode, update the tree selector to show the current tree
             const toggle = document.getElementById('treeModeToggle');
             if (!toggle.checked && graph.root.has(node)) {
                 const rootOfNode = graph.root.get(node);
                 document.getElementById('treeSelect').value = rootOfNode;
             }
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
