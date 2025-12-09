# Collatz Conjecture Explorer - Pure JavaScript Web Application

## 🎯 Overview

A modern, **pure JavaScript** web application for exploring Collatz conjecture and its variations. Runs entirely in the browser with **no backend required**, featuring enhanced mathematical analysis and an intuitive user interface.

## ✨ Key Features

### 🔬 Mathematical Engine (Pure JavaScript)
- **M-based automatic rule generation** - user selects M (2-10), conditions auto-generated
- **Cycle equivalence detection** - groups cycles by minimal value (4→2→1 = 2→1→4)
- **Enhanced cycle analysis** - steps to min, max before cycle, detailed statistics
- **Infinity detection** - configurable threshold (10 quadrillion default)
- **Multi-scale simulation** - single numbers, ranges, or 10x10 grids

### 🎨 Interactive Web Interface
- **visualization** - color-coded grid display with multiple coloring modes
- **Dynamic Grid Coloring** - Toggle between color by cycle, by sequence length, or by logarithmic height
- **Live tooltips** - hover information for cycle details
- **Interactive sequence display** - click any grid cell to see full sequence
- **Enhanced statistics** - research-grade mathematical insights with General Statistics panel

### 🚀 Pure JavaScript Architecture
- **Zero dependencies** - runs in any modern browser
- **No server required** - perfect for GitHub Pages

## 📊 Mathematical Capabilities

### Core Definitions
- **Cycle**: A repeating sequence of numbers (e.g., 4→2→1→4)
- **Rule M**: M-numbered rules based on n mod M = 0,1,...,M-1
- **Start Number**: Initial value that generates the sequence
- **Convergence**: When a sequence enters a known cycle

### Sequence Length and Height
- **Length**: Number of steps before the first number repeats
  - Example: 1→4→2→1→4... has length 3 (steps to first repeat of 1)
  - Example: 3→10→5→16→8→4→2→1→4... has length 8 (steps to first repeat of 4)
- **Height**: Maximum value reached before the first number repeats
  - Example: 1→4→2→1→4... has height 4 (maximum before first repeat)
  - Example: 3→10→5→16→8→4→2→1→4... has height 16 (maximum before first repeat)

### Cycle Analysis
- **Equivalence Detection**: Rotated cycles correctly grouped
- **Enhanced Information**: Min value, steps to min, max before cycle
- **Statistical Analysis**: Convergence rates, cycle distributions
- **Visual Mapping**: Color-coded grid by cycle characteristics

### Example Results
```
Number 1 Analysis (Classic Collatz):
✓ Sequence: 1→4→2→1→4...
✓ Length: 3 (steps before first repeat)
✓ Height: 4 (maximum before first repeat)
✓ Cycle: 4→2→1→4 (length 3 unique numbers)

Number 3 Analysis (Classic Collatz):
✓ Sequence: 3→10→5→16→8→4→2→1→4...
✓ Length: 8 (steps before first repeat of 4)
✓ Height: 16 (maximum before first repeat)
✓ Cycle: 4→2→1→4 (length 3 unique numbers)

Number 27 Analysis:
✓ Total Length: 112 (steps before first repeat)
✓ Height: 9232 (maximum before first repeat)
✓ Cycle: 4→2→1→4 (length 3 unique numbers)
✓ Convergence: 100% (100/100 reach same cycle in 1-100 range)
```

### 🖱️ Interactive Sequence Display
- **Click-to-Explore**: Click any grid cell to instantly view the complete sequence
- **Full Sequence Visualization**: Shows entire path until first number repeats
- **Live Length & Height**: Displays calculated length and height below sequence
- **Visual Highlighting**: Start number highlighted with special styling
- **Smart Formatting**: Long sequences wrapped and scrolled for optimal viewing
- **Animation Feedback**: Pulse animation when sequence updates
- **Convergence Information**: Shows cycle details for convergent sequences

```
Interactive Example:
Click on cell "170" → Display: 
170→85→256→128→64→32→16→8→4→2→1→4
Length: 112 steps | Height: 9232 | Cycle: 4→2→1→4
```X

## 🏗️ Technical Architecture

### Core Components
```
collatz_engine.js     # Pure JavaScript mathematical engine
├── Rule class         # Individual rule parsing and execution
├── RulesConfig class  # M-based rule generation system
├── CycleInfo class    # Enhanced cycle data structure  
├── CycleDetector class # Efficient O(1) cycle detection
└── CollatzSimulator class # Main simulation orchestrator
```

### Frontend Structure
```
index.html            # Main application page
├── static/
│   ├── css/style.css    # Modern responsive styling
│   └── js/
│       ├── collatz_engine.js  # Mathematical engine
│       └── script.js         # User interface logic
├── test_pure_js.html   # Self-testing page
└── demo_pure_js.js     # Demonstration script
```

### Key Algorithms
- **Cycle Detection**: Hash map O(1) detection with enhanced grouping
- **M-Based Rules**: Automatic condition generation for any M value
- **Equivalence Analysis**: Minimal value cycle classification
- **Performance Optimized**: Native JavaScript execution

## 🚀 Getting Started

### Instant Operation
```bash
# Just open in any web browser!
# No installation, no setup, no dependencies!
open index.html
```

### Local Development
```bash
# Clone or download files
# Open index.html in browser
# Ready to explore!
```

### Web Deployment
```bash
# GitHub Pages: Enable Pages on repository
# Netlify/Vercel: Just upload files
# Any static hosting: Copy directory
# NO build process required!
```

## 📱 User Interface

### Rule Configuration Panel
- **M Selector**: Choose number of rules (2-10)
- **Auto-Generated Rules**: Conditions created automatically  
- **Action Inputs**: Mathematical operations for each condition
- **Preset Buttons**: Classic, Alternative, Mod-3 examples

### Visualization Grid
- **N by N Display**: Numbers  color-coded by cycles
- **Hover Information**: Detailed cycle tooltips
- **Color Legend**: Equivalent cycles share colors
- **Infinity Highlighting**: Red for divergent sequences
- **Interactive Cells**: Click any cell to view full sequence
- **Sequence Display**: Shows complete path with length and height
- **Visual Feedback**: Highlighted start number and animations

### Analysis Panel
- **Summary Statistics**: Total numbers, cycles, infinity cases
- **Cycle Details**: Equivalence groups, heights, lengths
- **Enhanced Statistics**: Convergence rates, cycle patterns
- **Research Information**: Steps to min, maxima, entry points





## 📁 Project Structure

```
collatz/                    # No backend required!
├── index.html              # Main application page
├── test_pure_js.html      # Self-testing interface
├── demo_pure_js.js        # Demonstration script
├── static/
│   ├── css/
│   │   └── style.css      # Modern responsive styling
│   └── js/
│       ├── collatz_engine.js  # Complete mathematical engine
│       └── script.js           # User interface logic
├── PROJECT_DESCRIPTION.md  # This file
└── README.md               # Basic usage instructions
```



## 📞 Support & Usage

### Getting Help
- **Self-Testing**: Open `test_pure_js.html` for functionality verification
- **Demo Mode**: Run `demo_pure_js.js` to see capabilities
- **Documentation**: Comprehensive tooltips and help text included
- **Browser Console**: Enable for development debugging

