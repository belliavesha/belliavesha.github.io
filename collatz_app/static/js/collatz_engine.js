/**
 * Collatz Conjecture Explorer - Pure JavaScript Engine
 * Complete rewrite of Python backend functionality in JavaScript
 */

class Rule {
    constructor(condition, action) {
        this.condition = condition;
        this.action = action;
        this.parsedCondition = this._parseCondition(condition);
        this.parsedAction = this._parseAction(action);
    }

    _parseCondition(condStr) {
        const condition = condStr.trim();
        
        // Handle "n mod M == r" pattern
        const match = condition.match(/n\s+mod\s+(\d+)\s*==\s*(\d+)/);
        if (match) {
            const modVal = parseInt(match[1]);
            const remainder = parseInt(match[2]);
            return (n) => n % modVal === remainder;
        }
        
        // Handle "n is even/odd"
        if (condition === "n is even") {
            return (n) => n % 2 === 0;
        } else if (condition === "n is odd") {
            return (n) => n % 2 === 1;
        }
        
        throw new Error(`Unsupported condition: ${condition}`);
    }

    _parseAction(actionStr) {
        const action = actionStr.trim();
        
        // Handle simple arithmetic expressions
        if (action.includes('/') && !action.includes('+' && !action.includes('*'))) {
            const parts = action.split('/');
            if (parts[0].trim() === 'n' && parts.length === 2) {
                const divisor = parseInt(parts[1].trim());
                return (n) => Math.floor(n / divisor); // Use floor division like Python
            }
        }
        
        if (action.includes('+') && action.includes('*')) {
            const parts = action.split('+');
            if (parts[0].includes('*')) {
                const multParts = parts[0].split('*');
                if (multParts[0].trim() === 'n') {
                    const multiplier = parseInt(multParts[1].trim());
                    const addend = parseInt(parts[1].trim());
                    return (n) => n * multiplier + addend;
                }
            }
        }
        
        if (action === 'n - 1') {
            return (n) => n - 1;
        }
        
        if (action === '(n - 1) / 2') {
            return (n) => Math.floor((n - 1) / 2);
        }
        
        // Generic expression evaluation (simplified)
        try {
            return (n) => {
                const expr = action.replace(/n/g, n);
                // Use Function constructor for safer evaluation than eval
                return new Function('return ' + expr)();
            };
        } catch (e) {
            throw new Error(`Unsupported action: ${action}`);
        }
    }

    appliesTo(n) {
        try {
            return this.parsedCondition(n);
        } catch (e) {
            return false;
        }
    }

    apply(n) {
        try {
            return this.parsedAction(n);
        } catch (e) {
            return n;
        }
    }
}

class RulesConfig {
    constructor() {
        this.rules = [];
    }

    addRule(rule) {
        this.rules.push(rule);
    }

    addRuleFromStrings(condition, action) {
        const rule = new Rule(condition, action);
        this.addRule(rule);
    }

    getRulesFromM(m) {
        // Generate M rules automatically: n mod M == 0, 1, ..., M-1
        this.clear();
        for (let i = 0; i < m; i++) {
            const condition = `n mod ${m} == ${i}`;
            // Action will be provided by user - default to n for now
            const action = 'n'; // User will fill this in
            this.addRuleFromStrings(condition, action);
        }
        return this.rules;
    }

    updateRuleAction(index, action) {
        if (index >= 0 && index < this.rules.length) {
            const condition = this.rules[index].condition;
            this.rules[index] = new Rule(condition, action);
        }
    }

    getApplicableRule(n) {
        for (const rule of this.rules) {
            if (rule.appliesTo(n)) {
                return rule;
            }
        }
        throw new Error(`No rule applies to number ${n}`);
    }

    applyToNumber(n) {
        const rule = this.getApplicableRule(n);
        return rule.apply(n);
    }

    clear() {
        this.rules = [];
    }

    get length() {
        return this.rules.length;
    }
}

class CycleInfo {
    constructor(cycle, startStep, stepsToMin, maxBeforeCycle, minValue, convergenceLength, sequenceHeight) {
        this.cycle = cycle;
        this.startStep = startStep;
        this.length = this._calculateUniqueLength(cycle);
        this.minValue = Math.min(...cycle);
        this.maxValue = Math.max(...cycle);
        this.stepsToMin = stepsToMin;
        this.maxBeforeCycle = maxBeforeCycle;
        this.convergenceLength = convergenceLength || stepsToMin;
        this.sequenceHeight = sequenceHeight || maxBeforeCycle;
        this.toString = () => `Cycle(${this.length}): ${this.cycle.join(' → ')} (min: ${this.minValue}, steps to min: ${this.stepsToMin}, max before: ${this.maxBeforeCycle})`;
    }
    
    _calculateUniqueLength(cycle) {
        // Calculate the number of unique values in the cycle
        // For [4, 2, 1, 4], this should return 3 (4, 2, 1)
        const uniqueValues = new Set(cycle);
        return uniqueValues.size;
    }
}

class CycleDetector {
    constructor(maxSteps = 10000, infinityThreshold = 4e15) {
        this.maxSteps = maxSteps;
        this.infinityThreshold = infinityThreshold;
    }

    detectCycle(initialValue, stepFunction) {
        const visited = new Map(); // value -> step number
        const sequence = [initialValue];
        let current = initialValue;

        for (let step = 0; step < this.maxSteps; step++) {
            // Check infinity threshold
            if (Math.abs(current) > this.infinityThreshold) {
                return [null, true, sequence];
            }

            // Check if we've seen this value before
            if (visited.has(current)) {
                const firstOccurrenceStep = visited.get(current);
                const repeatStep = step;
                
                // Length is the number of steps before the number repeats (from start to first repeat)
                const sequenceLength = repeatStep;
                
                // Height is the maximum value reached before the first repeat
                const maxBeforeRepeat = Math.max(...sequence);
                
                // Create cycle info (still want to know the cycle for identification)
                const cycle = sequence.slice(firstOccurrenceStep);
                const cycleInfo = new CycleInfo(
                    cycle, 
                    firstOccurrenceStep, 
                    firstOccurrenceStep, 
                    maxBeforeRepeat, 
                    Math.min(...cycle),
                    sequenceLength,
                    maxBeforeRepeat
                );
                
                // Store the correct length and height in the cycle info
                cycleInfo.convergenceLength = sequenceLength;
                cycleInfo.sequenceHeight = maxBeforeRepeat;
                
                return [cycleInfo, false, sequence];
            }

            // Record this value
            visited.set(current, step);

            // Calculate next value
            try {
                const next = stepFunction(current);
                sequence.push(next);
                current = next;
            } catch (e) {
                // Error in calculation - treat as infinity
                return [null, true, sequence];
            }
        }

        // Max steps reached without cycle detection
        return [null, true, sequence];
    }

    analyzeSequences(startNumbers, stepFunction) {
        const results = {
            cycles: new Map(),
            infinity: [],
            errors: []
        };

        for (const start of startNumbers) {
            try {
                const [cycleInfo, isInfinity, sequence] = this.detectCycle(start, stepFunction);
                
                if (isInfinity) {
                    results.infinity.push(start);
                } else if (cycleInfo) {
                    // Use minimal value as key to detect equivalent cycles
                    const cycleKey = cycleInfo.minValue;
                    
                    if (!results.cycles.has(cycleKey)) {
                        results.cycles.set(cycleKey, {
                            info: cycleInfo,
                            startNumbers: [],
                            sequenceStats: [] // Track individual sequence stats
                        });
                    }
                    
                    const cycleGroup = results.cycles.get(cycleKey);
                    cycleGroup.startNumbers.push(start);
                    
                    // For each start number, we need to compute its own length and height
                    // The length is steps to first repeat, height is max before repeat
                    const visited = new Map();
                    let current = start;
                    let sequenceLength = 0;
                    let maxHeight = start;
                    
                    // Simulate the sequence again to get individual stats
                    for (let step = 0; step < this.maxSteps; step++) {
                        if (visited.has(current)) {
                            sequenceLength = step; // Length is steps before repeat
                            break;
                        }
                        visited.set(current, step);
                        if (Math.abs(current) > maxHeight) {
                            maxHeight = current;
                        }
                        current = stepFunction(current);
                    }
                    
                    // Store individual sequence stats for this start number
                    cycleGroup.sequenceStats.push({
                        startNumber: start,
                        convergenceLength: sequenceLength,
                        sequenceHeight: maxHeight,
                        startStep: cycleInfo.startStep
                    });
                    
                }
                
            } catch (e) {
                results.errors.push([start, e.message]);
            }
        }

        return results;
    }
}

class CollatzSimulator {
    constructor(rulesConfig = null, infinityThreshold = 4e15, maxSteps = 10000) {
        this.rulesConfig = rulesConfig || new RulesConfig();
        this.cycleDetector = new CycleDetector(maxSteps, infinityThreshold);
        this.infinityThreshold = infinityThreshold;
        this.maxSteps = maxSteps;
    }

    setRules(rulesConfig) {
        this.rulesConfig = rulesConfig;
    }

    simulateSingle(startValue) {
        if (this.rulesConfig.length === 0) {
            throw new Error('No rules configured');
        }

        const stepFunction = (n) => this.rulesConfig.applyToNumber(n);
        return this.cycleDetector.detectCycle(startValue, stepFunction);
    }

    simulateBatch(startNumbers, progressCallback = null) {
        if (this.rulesConfig.length === 0) {
            throw new Error('No rules configured');
        }

        const stepFunction = (n) => this.rulesConfig.applyToNumber(n);
        const results = this.cycleDetector.analyzeSequences(startNumbers, stepFunction);

        // Convert Map to plain object for JSON serialization
        const jsonResults = {
            cycles: {},
            infinity: results.infinity,
            errors: results.errors
        };

        results.cycles.forEach((cycleData, cycleKey) => {
            jsonResults.cycles[cycleKey] = {
                info: {
                    cycle: cycleData.info.cycle,
                    length: cycleData.info.length,
                    minValue: cycleData.info.minValue,
                    maxValue: cycleData.info.maxValue,
                    stepsToMin: cycleData.info.stepsToMin,
                    maxBeforeCycle: cycleData.info.maxBeforeCycle,
                    startStep: cycleData.info.startStep,
                    convergenceLength: cycleData.info.convergenceLength,
                    sequenceHeight: cycleData.info.sequenceHeight
                },
                startNumbers: cycleData.startNumbers,
                sequenceStats: cycleData.sequenceStats || []
            };
        });

        if (progressCallback) {
            progressCallback(100, `Completed simulation of ${startNumbers.length} numbers`);
        }

        return jsonResults;
    }

    simulateRange(start = 1, end = 100, progressCallback = null) {
        const startNumbers = [];
        for (let i = start; i <= end; i++) {
            startNumbers.push(i);
        }
        return this.simulateBatch(startNumbers, progressCallback);
    }

    simulateGrid10x10(progressCallback = null) {
        return this.simulateRange(1, 100, progressCallback);
    }

    getSequenceDetails(startValue, maxLength = 50) {
        const [cycleInfo, isInfinity, fullSequence] = this.simulateSingle(startValue);

        // Truncate sequence for display
        const displaySequence = fullSequence.slice(0, maxLength);
        if (fullSequence.length > maxLength) {
            displaySequence.push('...');
        }

        return {
            startValue,
            cycleInfo,
            isInfinity,
            sequenceLength: fullSequence.length,
            sequencePreview: displaySequence,
            minValue: fullSequence.length > 0 ? Math.min(...fullSequence) : startValue,
            maxValue: fullSequence.length > 0 ? Math.max(...fullSequence) : startValue
        };
    }
}

// Preset rule configurations
function createClassicCollatzRules() {
    const config = new RulesConfig();
    config.addRuleFromStrings('n is even', 'n / 2');
    config.addRuleFromStrings('n is odd', 'n * 3 + 1');
    return config;
}

function createAlternativeRules() {
    const config = new RulesConfig();
    config.addRuleFromStrings('n is odd', '(n - 1) / 2');
    config.addRuleFromStrings('n is even', 'n * 5 + 3');
    return config;
}

function createMod3Rules() {
    const config = new RulesConfig();
    config.addRuleFromStrings('n mod 3 == 0', 'n / 3');
    config.addRuleFromStrings('n mod 3 == 1', 'n * 2 + 1');
    config.addRuleFromStrings('n mod 3 == 2', 'n * 4 + 2');
    return config;
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.CollatzEngine = {
        Rule,
        RulesConfig,
        CycleInfo,
        CycleDetector,
        CollatzSimulator,
        createClassicCollatzRules,
        createAlternativeRules,
        createMod3Rules
    };
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Rule,
        RulesConfig,
        CycleInfo,
        CycleDetector,
        CollatzSimulator,
        createClassicCollatzRules,
        createAlternativeRules,
        createMod3Rules
    };
}
