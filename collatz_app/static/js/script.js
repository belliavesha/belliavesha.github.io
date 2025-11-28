// Collatz Conjecture Explorer - Pure JavaScript Frontend

let currentRules = null;
let currentSimulationResults = null;
let currentGridSize = 10; // Default to 10x10 grid

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Create initial grid
    createEmptyGrid();
    
    // Update initial grid info display
    const totalCells = currentGridSize * currentGridSize;
    const showNumbers = currentGridSize <= 19;
    const gridInfo = document.getElementById('grid-info');
    gridInfo.innerHTML = `1-${totalCells}`;
    
    // Load classic Collatz rules by default
    generateRules(2); // Default to M=2
    loadClassic();
    
    // Setup event listeners
    setupEventListeners();
});

function createEmptyGrid() {
    const grid = document.getElementById('simulation-grid');
    grid.innerHTML = '';
    
    // Set grid to fixed 400x400px like in grid_example.html
    grid.style.display = 'grid';
    grid.style.width = '400px';
    grid.style.height = '400px';
    grid.style.margin = '0 auto';
    grid.style.gap = '1px';
    grid.style.backgroundColor = '#fff';
    // grid.style.border = '1px solid #ccc';
    // grid.style.boxSizing = 'border-box';
    
    // Calculate cell size to fit 400px grid
    const cellSize = Math.floor((400 - (currentGridSize - 1)) / currentGridSize);
    
    // Determine if cells should contain numbers
    const showNumbers = currentGridSize <= 19; // Show numbers for grids up to 20x20
    
    // Set up grid layout with calculated cell sizes
    grid.style.gridTemplateColumns = `repeat(${currentGridSize}, ${cellSize}px)`;
    grid.style.gridTemplateRows = `repeat(${currentGridSize}, ${cellSize}px)`;
    
    // Create cells
    for (let i = 1; i <= currentGridSize * currentGridSize; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.number = i;
        
        // Set cell dimensions
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        
        // Set font size based on cell size
        if (cellSize <= 12) {
            cell.style.fontSize = '8px';
        } else if (cellSize <= 18) {
            cell.style.fontSize = '10px';
        } else {
            cell.style.fontSize = '12px';
        }
        
        // Add number and tooltips to all cells
        if (showNumbers) {
            cell.textContent = i;
        } else {
            // Large grids don't show the number but still need advanced tooltips
            cell.title = `Number: ${i}`; // Basic fallback tooltip
        }
        
        // All cells should have advanced tooltips regardless of size
        cell.addEventListener('mouseenter', showTooltip);
        cell.addEventListener('mouseleave', hideTooltip);
        
        // Add click event listener for sequence display
        cell.addEventListener('click', handleCellClick);
        
        grid.appendChild(cell);
    }
}

function clearResults() {
    // Clear cycle panel
    document.getElementById('cycle-list').innerHTML = '';
    // document.getElementById('total-numbers').textContent = '0';
    document.getElementById('cycles-found').textContent = '0';
    // document.getElementById('infinity-count').textContent = '0';
    
    // Clear simulation results
    currentSimulationResults = null;
    
    // Reset grid status
    const totalCells = currentGridSize * currentGridSize;
    const showNumbers = currentGridSize <= 19;
    // const status = document.getElementById('grid-status');
    
    // Update grid info display
    const gridInfo = document.getElementById('grid-info');
    
    gridInfo.innerHTML = `1-${totalCells}`;
    // if (showNumbers) {
    //     status.textContent = `${currentGridSize}x${currentGridSize} grid (1-${totalCells})`;
    // } else {
    //     status.textContent = `${currentGridSize}x${currentGridSize} grid (${totalCells} numbers) - Compact display`;
    // }
    // status.className = 'grid-status';
}

function changeGridSize() {
    const gridSizeSelect = document.getElementById('grid-size');
    const newSize = parseInt(gridSizeSelect.value);
    
    if (newSize === currentGridSize) return; // No change needed
    
    currentGridSize = newSize;
    const totalCells = currentGridSize * currentGridSize;
    const showNumbers = currentGridSize <= 19;
    
    // Update grid title and status
    // document.getElementById('grid-title').textContent = `Simulation Grid (1-${totalCells})`;
    // const status = document.getElementById('grid-status');
    
    // Update grid info display
    const gridInfo = document.getElementById('grid-info');

    gridInfo.innerHTML = `${totalCells} numbers`;
    // gridInfo.innerHTML = `
    //     Grid Size: ${currentGridSize} x ${currentGridSize}<br>
    //     Total Cells: ${totalCells}<br>
    //     Numbers Displayed: ${showNumbers ? 'Yes' : 'No (grid too large)'}
    // `;
    
    // if (showNumbers) {
    //     status.textContent = `${currentGridSize}x${currentGridSize} grid (1-${totalCells})`;
    // } else {
    //     status.textContent = `${currentGridSize}x${currentGridSize} grid (${totalCells} numbers) - Compact display`;
    // }
    // status.className = 'grid-status';
    
    // Recreate grid with new size
    createEmptyGrid();
    clearResults();
    
    showMessage(`Changed to ${currentGridSize}x${currentGridSize} grid (${totalCells} numbers)`, 'info');
}

function setupEventListeners() {
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            simulateGrid();
        } else if (e.ctrlKey && e.key === 'g') {
            generateRules();
        }
    });
}

function generateRules(mValue = null) {
    const m = mValue || parseInt(document.getElementById('rule-count').value);
    if (m < 2 || m > 10) {
        showMessage('Please enter a value between 2 and 10', 'error');
        return;
    }
    
    document.getElementById('rule-count').value = m;
    
    const rulesList = document.getElementById('rules-list');
    rulesList.innerHTML = '';
    
    // Create M rules automatically
    for (let i = 0; i < m; i++) {
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'rule-item';
        ruleDiv.id = `rule-${i}`;
        
        ruleDiv.innerHTML = `
            <div class="rule-header">IF n mod ${m} = ${i}</div>
            <div class="rule-inputs">
                <span> n →</span>
                <input type="text" placeholder="Enter action" class="action-input" data-remainder="${i}">
            </div>
        `;
        
        rulesList.appendChild(ruleDiv);
    }
    
    // Update the rules configuration
    currentRules = new window.CollatzEngine.RulesConfig();
    currentRules.getRulesFromM(m);
    
    showMessage(`Generated ${m} rules (n mod ${m} = 0, 1, ..., ${m-1})`, 'success');
}

function updateRule(index, action) {
    if (currentRules && index >= 0 && index < currentRules.length) {
        currentRules.updateRuleAction(index, action);
    }
}

function clearAllRules() {
    document.getElementById('rules-list').innerHTML = '';
    currentRules = null;
    createEmptyGrid();
    clearResults();
    showMessage('All rules cleared', 'info');
}

function loadClassic() {
    generateRules(2);
    
    const actionInputs = document.querySelectorAll('.action-input');
    actionInputs[0].value = 'n / 2';    // n mod 2 = 0 (even)
    actionInputs[1].value = 'n * 3 + 1'; // n mod 2 = 1 (odd)
    
    // Update the rules configuration
    if (currentRules) {
        currentRules.updateRuleAction(0, 'n / 2');
        currentRules.updateRuleAction(1, 'n * 3 + 1');
    }
    
    showMessage('Loaded classic Collatz rules (M=2)', 'success');
}

function loadAlternative() {
    generateRules(2);
    
    const actionInputs = document.querySelectorAll('.action-input');
    actionInputs[0].value = 'n * 3 + 1'; // n mod 2 = 1 (odd) first in display
    actionInputs[1].value = '(n + 1) / 2 + 1 ';   // n mod 2 = 0 (even)
    
    // Update the rules configuration
    if (currentRules) {
        currentRules.updateRuleAction(0, 'n * 3 + 1');   // n mod 2 = 0
        currentRules.updateRuleAction(1, '(n + 1) / 2 + 1 '); // n mod 2 = 1
    }
    
    showMessage('Loaded alternative rules (M=2)', 'success');
}

function loadMod3() {
    generateRules(3);
    
    const actionInputs = document.querySelectorAll('.action-input');
    actionInputs[0].value = 'n / 3';      // n mod 3 = 0
    actionInputs[1].value = 'n * 2 + 1'; // n mod 3 = 1
    actionInputs[2].value = 'n * 4 + 2'; // n mod 3 = 2
    
    // Update the rules configuration
    if (currentRules) {
        currentRules.updateRuleAction(0, 'n / 3');
        currentRules.updateRuleAction(1, 'n * 2 + 1');
        currentRules.updateRuleAction(2, 'n * 4 + 2');
    }
    
    showMessage('Loaded Mod 3 rules', 'success');
}

function loadMod5() {
    generateRules(5);
    
    const actionInputs = document.querySelectorAll('.action-input');
    actionInputs[0].value = 'n / 5';      // n mod 5 = 0
    actionInputs[1].value = 'n * 4 + 1'; // n mod 5 = 1
    actionInputs[2].value = 'n * 4 + 2 '; // n mod 5 = 2
    actionInputs[3].value = '(n + 2) / 5'; // n mod 5 = 1
    actionInputs[4].value = 'n * 4 - 1'; // n mod 5 = 2
    
    // Update the rules configuration
    if (currentRules) {
        currentRules.updateRuleAction(0, 'n / 5');
        currentRules.updateRuleAction(1, 'n * 4 + 1');
        currentRules.updateRuleAction(2, 'n * 4 + 2');
        currentRules.updateRuleAction(3, '(n + 2) / 5');
        currentRules.updateRuleAction(4, 'n * 4 - 1');
    }
    
    showMessage('Loaded Mod 5 rules', 'success');
}



function collectRules() {
    if (!currentRules) {
        return [];
    }
    
    // Collect action inputs and update the rules configuration
    const actionInputs = document.querySelectorAll('.action-input');
    const actions = [];
    
    for (let i = 0; i < actionInputs.length; i++) {
        const action = actionInputs[i].value.trim();
        actions.push(action);
        
        // Update the rule in the configuration
        currentRules.updateRuleAction(i, action);
    }
    
    return actions;
}

function validateRules() {
    if (!currentRules) {
        showMessage('Please generate rules first', 'error');
        return false;
    }
    
    const actionInputs = document.querySelectorAll('.action-input');
    
    // Check if all actions are filled
    for (let i = 0; i < actionInputs.length; i++) {
        const action = actionInputs[i].value.trim();
        if (!action) {
            showMessage(`Please provide an action for rule ${i + 1}`, 'error');
            return false;
        }
        
        // Try to validate the rule by creating it
        try {
            const condition = `n mod ${currentRules.length} == ${i}`;
            const rule = new window.CollatzEngine.Rule(condition, action);
            // Test the rule with some values
            rule.apply(i);
        } catch (e) {
            showMessage(`Invalid action for rule ${i + 1}: ${e.message}`, 'error');
            return false;
        }
    }
    
    return true;
}

function simulateGrid() {
    if (!validateRules()) {
        return;
    }
    
    // Update rules with latest input values
    collectRules();
    
    // Determine simulation range based on grid size
    const totalCells = currentGridSize * currentGridSize;
    
    // Start simulation
    showLoading(`Simulating numbers 1-${totalCells}...`);
    
    try {
        // Use the pure JavaScript simulator
        const simulator = new window.CollatzEngine.CollatzSimulator(currentRules);
        
        // Progress callback
        function progressCallback(percent, message) {
            const loadingText = document.getElementById('loading-text');
            loadingText.textContent = `Simulating... ${percent}% - ${message}`;
        }
        
        // Run simulation
        setTimeout(() => {
            try {
                // Always use simulateRange for any grid size
                const results = simulator.simulateRange(1, totalCells, progressCallback);
                
                // Add the pure JavaScript simulation results
                console.log('Pure JS simulation completed:', results);
                console.log(`Simulated ${totalCells} numbers in ${currentGridSize}x${currentGridSize} grid`);
                
                currentSimulationResults = results;
                displayResults(results);
                showMessage(`Simulation completed successfully! (${totalCells} numbers)`, 'success');
                
            } catch (error) {
                console.error('Simulation error:', error);
                showMessage('Simulation failed: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        }, 100); // Small delay to allow UI update
        
    } catch (error) {
        console.error('Simulation error:', error);
        showMessage('Simulation failed: ' + error.message, 'error');
        hideLoading();
    }
}

function displayResults(results) {
    // Update grid
    updateGrid(results);
    
    // Update cycle panel
    updateCyclePanel(results);
    
    // Update status
    // const status = document.getElementById('grid-status');
    // const cycleCount = Object.keys(results.cycles).length;
    // const infinityCount = (results.infinity || []).length;
    // const totalCount = Object.values(results.cycles).reduce((sum, cycle) => 
    //     sum + (cycle.startNumbers?.length || cycle.start_numbers?.length || 0), 0
    // ) + infinityCount;
    
    // const totalCells = currentGridSize * currentGridSize;
    // status.textContent = `Found ${cycleCount} cycles, ${infinityCount} go to infinity (${totalCount}/${totalCells} numbers processed)`;
}

function updateGrid(results) {
    const totalCells = currentGridSize * currentGridSize;
    
    // Reset all cells
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = '';
        cell.classList.remove('cell-infinity');
    });
    
    // Color cells based on results
    Object.entries(results.cycles).forEach(([, cycleData], index) => {
        const color = generateColor(index, Object.keys(results.cycles).length);
        const startNumbers = cycleData.startNumbers || cycleData.start_numbers || [];
        startNumbers.forEach(num => {
            if (num <= totalCells) {
                const cell = document.querySelector(`[data-number="${num}"]`);
                if (cell) {
                    cell.style.backgroundColor = color;
                    cell.dataset.cycleInfo = JSON.stringify({
                        cycle: cycleData.info.cycle,
                        length: cycleData.info.length
                    });
                }
            }
        });
    });
    
    // Color infinity cells
    if (results.infinity) {
        results.infinity.forEach(num => {
            if (num <= totalCells) {
                const cell = document.querySelector(`[data-number="${num}"]`);
                if (cell) {
                    cell.classList.add('cell-infinity');
                    cell.dataset.cycleInfo = JSON.stringify({ infinity: true });
                }
            }
        });
    }
}

function generateColor(index, total) {
    const hue = (index * 360 / total) % 360;
    const saturation = 0.7;
    const lightness = 0.85;
    return `hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%)`;
}

function updateCyclePanel(results) {
    const cycles = results.cycles || {};
    const infinity = results.infinity || [];
    const totalNumbers = Object.values(cycles).reduce((sum, cycle) => sum + (cycle.startNumbers?.length || cycle.start_numbers?.length || 0), 0) + infinity.length;
    
    // Update summary
    // document.getElementById('total-numbers').textContent = totalNumbers;
    document.getElementById('cycles-found').textContent = Object.keys(cycles).length;
    // document.getElementById('infinity-count').textContent = infinity.length;
    
    // Update cycle list
    const cycleList = document.getElementById('cycle-list');
    cycleList.innerHTML = '';
    
    // Sort cycles by minimal value for better organization
    const sortedCycles = Object.entries(cycles).sort(([a, aData], [b, bData]) => {
        const aMin = aData.info.minValue;
        const bMin = bData.info.minValue;
        return aMin - bMin;
    });
    
    sortedCycles.forEach(([, cycleData], index) => {
        const cycleDiv = document.createElement('div');
        cycleDiv.className = 'cycle-item';
        
        const color = generateColor(index, sortedCycles.length);
        const cycleStr = cycleData.info.cycle.join(' → ');
        const startNumbers = cycleData.startNumbers || cycleData.start_numbers || [];
        const numbersStr = startNumbers.slice(0, 15).join(', ') + 
                          (startNumbers.length > 15 ? '...' : '');
        
        // Get enhanced cycle information
        const info = cycleData.info;
        const sequenceStats = cycleData.sequenceStats || [];
        
        // Calculate max statistics for this cycle
        const maxLength = Math.max(...sequenceStats.map(s => s.convergenceLength || 0));
        const maxHeight = Math.max(...sequenceStats.map(s => s.sequenceHeight || 0));
        const maxLengthStart = sequenceStats.find(s => s.convergenceLength === maxLength);
        const maxHeightStart = sequenceStats.find(s => s.sequenceHeight === maxHeight);
        
        const totalCells = currentGridSize * currentGridSize;
        const enhancedInfo = `
            Length: ${info.length} <br>
            Frequency: ${startNumbers.length}/${totalCells}
        `;
        
        let maxInfo = '';
        if (maxLengthStart && maxHeightStart) {
            maxInfo = `
                <br><strong>Max Length:</strong> ${maxLength} (start: ${maxLengthStart.startNumber})
                <br><strong>Max Height:</strong> ${maxHeight} (start: ${maxHeightStart.startNumber})
            `;
        }
        
        cycleDiv.innerHTML = `
            <div class="cycle-header">
                <span class="cycle-color" style="background-color: ${color}"></span>
                Cycle → ${info.maxValue > 4e17 ? '∞' : info.minValue}
            </div>
            <div class="cycle-sequence">${cycleStr} <br> ${enhancedInfo} ${maxInfo}</div>
            `;
            // <div class="cycle-details">${maxInfo}</div>
            // <div class="cycle-numbers">Numbers: ${numbersStr}</div>
        
        cycleList.appendChild(cycleDiv);
    });
    
    // Add infinity section if exists (treat as cycle with min value infinity)
    if (infinity.length > 0) {
        const infinityDiv = document.createElement('div');
        infinityDiv.className = 'infinity-item';
        const infinityStr = infinity.slice(0, 20).join(', ');
        const totalCells = currentGridSize * currentGridSize;
        const infinityDetails = infinity.length > 20 ? `${infinityStr}... (${infinity.length} total)` : infinityStr;
        
        infinityDiv.innerHTML = `
            <h4> Diverges → ∞ </h4>
            <div class="infinity-details">
                <strong>Frequency:</strong> ${infinity.length}/${totalCells}<br>
                </div>
                `;
                // <strong>Numbers:</strong> ${infinityDetails}
        cycleList.appendChild(infinityDiv);
    }
    
    // Enhanced statistics section removed as requested
}

function showTooltip(event) {
    const cell = event.target;
    const number = parseInt(cell.dataset.number);
    
    if (!number) return;
    
    try {
        // Find which cycle/mode this number belongs to
        let tooltipText = `Start Number: ${number}<br>`;
        
        let found = false;
        
        // Check infinity first
        if (currentSimulationResults && currentSimulationResults.infinity) {
            if (currentSimulationResults.infinity.includes(number)) {
                tooltipText += 'Goes to infinity';
                found = true;
            }
        }
        
        // Check cycles
        if (!found && currentSimulationResults && currentSimulationResults.cycles) {
            for (const [, cycleData] of Object.entries(currentSimulationResults.cycles)) {
                const startNumbers = cycleData.startNumbers || cycleData.start_numbers || [];
                if (startNumbers.includes(number)) {
                    // Find this number's specific stats
                    const stats = cycleData.sequenceStats?.find(s => s.startNumber === number);
                    const info = cycleData.info;
                    
                    tooltipText += `Cycle → ${info.minValue} (length ${info.length}) <br>`;
                    tooltipText += `Length: ${stats?.convergenceLength || 'N/A'} steps<br>`;
                    tooltipText += `Height: ${stats?.sequenceHeight || 'N/A'}<br>`;
                    // tooltipText += `Cycle → ${info.minValuejoin(' → ')} (length ${info.length})`;
                    
                    found = true;
                    break;
                }
            }
        }
        
        if (!found) {
            tooltipText += 'No data available';
        }
        
        const tooltip = document.getElementById('tooltip');
        tooltip.innerHTML = tooltipText;
        tooltip.style.left = event.pageX + 10 + 'px';
        tooltip.style.top = event.pageY + 10 + 'px';
        tooltip.classList.add('active');
        
    } catch (error) {
        console.error('Tooltip error:', error);
    }
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('active');
}

function handleCellClick(event) {
    const cell = event.target;
    const number = parseInt(cell.dataset.number);
    
    if (!number || !currentRules) return;
    
    // Generate the full sequence for this number
    const sequenceDisplay = document.getElementById('sequence-display');
    
    // Add animation class
    sequenceDisplay.classList.add('active');
    
    // Simulate the sequence to get the full path
    const simulator = new CollatzSimulator(currentRules);
    const [cycleInfo, isInfinity, sequence] = simulator.simulateSingle(number);
    
    if (isInfinity) {
        // For sequences that go to infinity
        let current = number;
        const maxSequenceLength = 50; // Limit display for very long sequences
        const displaySequence = [current];
        
        for (let i = 0; i < maxSequenceLength - 1; i++) {
            try {
                current = currentRules.applyToNumber(current);
                displaySequence.push(current);
                
                if (Math.abs(current) > 1e9) { // Infinity threshold
                    displaySequence.push('→ ∞');
                    break;
                }
            } catch (e) {
                displaySequence.push('→ ERROR');
                break;
            }
        }
        
        displaySequence(displaySequence, number);
    } else if (cycleInfo && sequence) {
        // For sequences that converge to a cycle
        displaySequence(sequence, number, cycleInfo);
    } else {
        // Fallback
        sequenceDisplay.innerHTML = `<span class="sequence-number">${number}</span> → unable to compute`;
    }
    
    // Remove animation class after animation completes
    setTimeout(() => {
        sequenceDisplay.classList.remove('active');
    }, 500);
}

function displaySequence(sequence, startNumber, cycleInfo = null) {
    const sequenceDisplay = document.getElementById('sequence-display');
    
    // Format the sequence with HTML
    let sequenceLineHtml = '';
    let infoHtml = '';
    
    // Find the maximum value in the sequence
    const numericSequence = sequence.filter(n => typeof n === 'number');
    const maxValue = Math.max(...numericSequence);
    
    // Find the last number and its earlier occurrence
    const lastNumber = sequence[sequence.length - 1];
    let lastNumberIndex = sequence.length - 1;
    let matchingIndex = -1;
    
    // Find the earlier occurrence of the last number (if it's a number)
    if (typeof lastNumber === 'number') {
        for (let i = sequence.length - 2; i >= 0; i--) {
            if (sequence[i] === lastNumber) {
                matchingIndex = i;
                break;
            }
        }
    }
    
    // Find the cycle start (minimum value of the cycle)
    let cycleStartIndex = -1;
    if (cycleInfo && cycleInfo.minValue !== undefined) {
        // Find the first occurrence of the cycle's minimum value
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i] === cycleInfo.minValue) {
                cycleStartIndex = i;
                break;
            }
        }
    }
    
    // Add first number
    const firstNumberClass = sequence[0] === maxValue ? 'sequence-number max-value highlight' : 
                            'sequence-number highlight';
    sequenceLineHtml += `<span class="${firstNumberClass}">${sequence[0]}</span>`;
    
    // Add arrow and subsequent numbers
    for (let i = 1; i < sequence.length; i++) {
        sequenceLineHtml += `<span class="sequence-arrow">→</span>`;
        
        if (sequence[i] === '→ ∞' || sequence[i] === '→ ERROR') {
            sequenceLineHtml += `<span style="color: #e74c3c; font-weight: bold;">${sequence[i]}</span>`;
            break;
        } else {
            // Determine the appropriate class for this number
            let numberClass = 'sequence-number';
            
            if (sequence[i] === maxValue) {
                numberClass += ' max-value';
            }
            
            // Highlight last number
            if (i === lastNumberIndex) {
                numberClass += ' last-number';
            }
            
            // Highlight matching occurrence of last number
            if (i === matchingIndex) {
                numberClass += ' cycle-match';
            }
            
            // Highlight cycle start (minimum value)
            if (i === cycleStartIndex) {
                numberClass += ' cycle-start';
            }
            
            sequenceLineHtml += `<span class="${numberClass}">${sequence[i]}</span>`;
        }
    }
    
    // Add cycle information if available
    if (cycleInfo) {
        infoHtml = `<div class="sequence-info">
            Length: ${cycleInfo.convergenceLength} steps | Height: ${cycleInfo.sequenceHeight} | 
            Cycle → ${cycleInfo.minValue} (Last: ${lastNumber})
        </div>`;
    }
    
    // Combine both parts
    sequenceDisplay.innerHTML = `
        <div class="sequence-line">${sequenceLineHtml}</div>
        ${infoHtml}
    `;
}

function showLoading(message) {
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = message;
    loading.classList.add('active');
}

function hideLoading() {
    const loading = document.getElementById('loading');
    loading.classList.remove('active');
}

function showMessage(message, type) {
    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 2000;
        animation: slideInRight 0.3s ease;
    `;
    
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#27ae60';
    } else if (type === 'error') {
        messageDiv.style.backgroundColor = '#e74c3c';
    } else {
        messageDiv.style.backgroundColor = '#3498db';
    }
    
    document.body.appendChild(messageDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        messageDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .message { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
`;
document.head.appendChild(style);

// Error handling
window.addEventListener('error', function(event) {
    console.error('JavaScript error:', event.error);
    showMessage('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showMessage('An unexpected error occurred', 'error');
});
