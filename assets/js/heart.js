// let nj = require('numjs');

function seq(
    rule = (s) => { return s[s.length - s[s.length - 1]] + s[s.length - s[s.length - 2]]; }, 
    start = [2,2,1], 
    n = 30000) {
    let m = start.length;
    let res = start;
    for (let i = 0; i < n - m; i++) {
        try {
            let nxt = rule(res);
            res.push(nxt);
            if (nxt < 0) {
                break;
            }
        } catch(e) {
            console.log(res.slice(1),i);
            break;
        }
    }
    console.log((res))
    return res;
}

function convert(s, offset = 100, split = 1, slope = null, fold = null, Nbins = 100) {
    let x = Array.from({length: s.length}, (_, i) => i + 1);
    let y = s.map((val, index) => val / x[index]);
    let binx = Array.from({length: Nbins}, (_, i) => i*1.0/Nbins+0.5/Nbins);
    let bincounts = Array.from({length: Nbins});
    let binsums = Array.from({length: Nbins});
    
    
    if (slope) {
        y = y.map(val => val / slope - 1);
    }
    if (fold) {
        for (let i = 0; i < s.length; i++) {
            while (x[i] > fold * offset) {
                x[i] = x[i] / fold;
            }
            x[i] = (x[i]/offset-1)/(fold-1);
        }
    }

    
    let data = [];
    for (let j = 0; j < split; j++) {
        bincounts.fill(0)
        binsums.fill(0)
        console.log("last",j, split);
        let xValues = x.slice(offset - (offset % split) + j).filter((_, index) => index % split === 0);
        let yValues = y.slice(offset - (offset % split) + j).filter((_, index) => index % split === 0);
        for (let i = 0; i < xValues.length; i++) {
            let binIndex = Math.floor(xValues[i] * Nbins);
            if (binIndex < 0) binIndex = 0;
            if (binIndex >= Nbins) binIndex = Nbins - 1;
            binsums[binIndex] += yValues[i];
            bincounts[binIndex] += 1;
        }        
        let averages = binsums.map((bin, i) => bincounts[i] > 0 ? bin/bincounts[i] : 0);
        data.push([binx, averages]); 
    }
    return data;
}




function generateData(n) {
    let data1 = [];
    let data2 = [];
    for(let i = 0; i < n; i++) {
        data1.push(Math.random());
        data2.push(Math.random());
      
    }
    return [data1,data2];
}
  

function drawPlot(N, start, Nbins) {
    let fold = Math.sqrt(10);
    offset  = Nbins;
    N = Math.round(50*Math.pow(fold,N));
    data = convert(
        seq( 
            (s) => { return s[s.length - s[s.length - 1]] + s[s.length - s[s.length - 2] - s[s.length - 1]] + s[s[s[s.length - 2]]]; },
            start,
            n = N),
        offset = offset,
        split = 4, 
        slope = 1.5 - Math.sqrt(1.25),  
        fold = fold,
        Nbins = Nbins
    );
    // data = [generateData(N), generateData(N), generateData(N)];

    for (let i = 0; i < data.length; i++) {
        console.log(Math.max(...data[i][0]));
        console.log(Math.max(...data[i][1]));
    }
    let colorMapping = ['rgba(235,24,25,1)', 'rgba(23,243,25,1)', 'rgba(23,24,233,1)','rgba(235,24,252,1)', 'rgba(23,243,245,1)'];



//   let plotData = data.map((d, i) => ({
//     x: d[0],
//     y: d[1],
//     name: `density ${i}`,
//     ncontours: 10,
//     colorscale: [[0, 'rgba(255,255,255,0)'], [1, colorMapping[i]] ], 
//     reversescale: false,
//     showscale: false,
//     type: 'histogram2dcontour',
//     opacity: 0.7    
//   }));
  
  let scatterData = data.map((d, i) => ({
    x: d[0],
    y: d[1],
    mode: 'markers',
    type: 'scatter',
    name: `scatter ${i}`,
    marker: {
      color: colorMapping[i],  // Adjust this to set color of markers
      size: 6  // Adjust this to change size of markers
    }
  }));


  let layout = {
    title: 'Stacked 2D density plot',
    width: 724,
    height: 724,
    autosize: false,
    showlegend: false,
    xaxis: {
        title: 'x fold',
        range: [0, 1],
        // showticklabels: false,
        zeroline: false,
        showgrid: false
    },
    yaxis: {
        title: 'y',
        range: [-0.5, 0.5],
        // scaleanchor: "x",
        scaleratio: 1,
        // showticklabels: false,
        zeroline: false,
        showgrid: false
    },
    plot_bgcolor: 'white'
  };
  
  Plotly.newPlot('plotDiv', scatterData, layout);
}
  


function parseListInput(input) {
    return input.split(',').map(Number);
}

function replot() {
    var N = Number(document.getElementById('pointsSliderValue').innerText);
    var Nbins = Number(document.getElementById('binsSliderValue').innerText);
    var start = parseListInput(document.getElementById('startInput').value);
    drawPlot(N, start, Nbins);
}

function updatePointsSlider() {
    document.getElementById('pointsSliderValue').innerText = this.value;
    replot()
}

function updateBinsSlider() {
    document.getElementById('binsSliderValue').innerText = this.value;
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
    document.getElementById('binsSlider').removeEventListener('input', updateBinsSlider);
    document.getElementById('plotButton').removeEventListener('click', replot);
    document.getElementById('startInput').removeEventListener('keydown', handleInputKeydown);
  
    // Add new event listeners
    document.getElementById('pointsSlider').addEventListener('input', updatePointsSlider);
    document.getElementById('binsSlider').addEventListener('input', updateBinsSlider);
    document.getElementById('plotButton').addEventListener('click', replot);
    document.getElementById('startInput').addEventListener('keydown', handleInputKeydown);
}

replot();
setupEventListeners();