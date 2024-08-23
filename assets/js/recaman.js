function findMinMissingInteger(lst) {
    for (let i = 1; i <= lst.length + 1; i++) {
        if (lst.indexOf(i) < 0) {
            return i;
        }
    }
}

function recaman(n) {
    let arr = [0];
    let s = new Set(arr);
    for (let i = 1; i < n; i++) {
    let back = arr[i - 1] - i;
    if (back > 0 && !s.has(back)) {
        arr.push(back);
    } else {
        arr.push(arr[i - 1] + i);
    }
    s.add(arr[i]);
    }
    return arr;
}



function drawPlot(N, exc) {
    let Narc = 29;
    let angleStep = (Math.PI) / Narc;
    let msx = [];
    let msy = [];

    // Generate the coordinates
    for (let i = 0; i < Narc + 1; i++) {
        let angle = i * angleStep;
        let x = ( 1 - Math.cos(angle) ) /2;
        let y = Math.sin(angle);
        msx.push(x);
        msy.push(y);
    };

    let sequence = recaman(N);

    // Plotly traces
    let data = [];

    var mm = findMinMissingInteger(sequence.concat(exc));

    for (let i = 1; i < sequence.length; i++) {
    let x0 = sequence[i - 1];
    let x1 = sequence[i];
    if ( x0 < mm || x1 < mm){
        let r = Math.abs(x1 - x0)/2;
        let y0 = i % 2 === 0 ? r : -r;

        let trace = {
        y: msx.map(x => x0 + x*(x1-x0)),
        x: msy.map(x => x*y0),
        mode: 'lines',
        line: {
            shape: 'spline',
            smoothing: 5.0,
            color: 'black'
        }
        };
        data.push(trace);
    }
    }


    let layout = {
        autosize: false,
        width: 724,
        height: 724,
        title: 'Recamán Sequence, next terms connected with semicircles',
        plot_bgcolor: 'white',
        showlegend: false,
        xaxis: {
            range: [-mm/2, mm/2],
            showticklabels: false,
            zeroline: false,
            showgrid: false
        },
        yaxis: {
            range: [mm, 0],
            scaleanchor: "x", // This line ensures the aspect ratio remains as 1:1
            scaleratio: 1,
            // showticklabels: false,
            zeroline: false,
            showgrid: false
        },  
        shapes: exc.map(x => ({
            type: 'line',
            xref: 'paper',
            yref: 'y',
            // x0: x, y0: 0, x1: x, y1: 1,
            x0: 0, y0: x, x1: 1, y1: x,
            line: { color: 'black', width: 1 }
        })).concat([ // outline
            { type: 'line', xref: 'paper', yref: 'paper', x0: 0, y0: 0, x1: 1, y1: 0, line: { color: 'blue', width: 1.5 }},
            { type: 'line', xref: 'paper', yref: 'paper', x0: 1, y0: 0, x1: 1, y1: 1, line: { color: 'blue', width: 1.5 }},
            { type: 'line', xref: 'paper', yref: 'paper', x0: 0, y0: 1, x1: 1, y1: 1, line: { color: 'blue', width: 1.5 }},
            { type: 'line', xref: 'paper', yref: 'paper', x0: 0, y0: 0, x1: 0, y1: 1, line: { color: 'blue', width: 1.5 }}
        ])
    };

    Plotly.newPlot('plotDiv', data, layout);
}

function parseListInput(input) {
    return input.split(',').map(Number);
}

function replot() {
    var N = Number(document.getElementById('pointsSliderValue').innerText)
    var x_coords = parseListInput(document.getElementById('xcoordsInput').value);
    drawPlot(N, x_coords);
}

function updatePointsSlider() {
    document.getElementById('pointsSliderValue').innerText = this.value;
    replot()
}

function handleInputKeydown(e) {
    if (e.key == "Enter") {
        replot()
    }
}


function setupEventListeners() {
    // Remove any old event listeners
    document.getElementById('pointsSlider').removeEventListener('input', updatePointsSlider);
    document.getElementById('plotButton').removeEventListener('click', replot);
    document.getElementById('xcoordsInput').removeEventListener('keydown', handleInputKeydown);
  
    // Add new event listeners
    document.getElementById('pointsSlider').addEventListener('input', updatePointsSlider);
    document.getElementById('plotButton').addEventListener('click', replot);
    document.getElementById('xcoordsInput').addEventListener('keydown', handleInputKeydown);
}



var styles = `   
    #recaman-wallpaper {
        position: absolute;
        top: -20%;
        left: -20%;
        width: 140%;
        height: 120%;
        z-index: -1; 
        object-fit: cover; 
        filter: blur(4px) contrast(90%) brightness(120%) opacity(25%);  
    }
`
var styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);


// Initial plot
// drawPlot(N, x_coords);
replot();
setupEventListeners();