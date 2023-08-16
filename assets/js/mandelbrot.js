

function connectCanvases(canvases){

    for (j = 0; j<canvases.length; j++){
        canvas = canvases[j];
        for (k = 0; k<canvases.length; k++){
            if (j==k){
                canvas.canvas.addEventListener('mousedown', canvas.startDrawing.bind(canvas));
                canvas.canvas.addEventListener('mousemove', canvas.drawTrace.bind(canvas));
                canvas.canvas.addEventListener('mouseup', canvas.stopDrawing.bind(canvas));
                canvas.canvas.addEventListener('wheel', canvas.changeScale.bind(canvas), { passive: false });
            } else{ 
                canvas2 = canvases[k];
                canvas.canvas.addEventListener('mouseup', canvas2.drawFractal.bind(canvas2));
            }
        }            
    }
}

function complexAdd(a, b) {
    let real = a[0] + b[0];
    let imag = a[1] + b[1];
    return [real, imag];
}

function complexMul(a, b) {
    let real = a[0]*b[0] - a[1]*b[1];
    let imag = a[0]*b[1] + a[1]*b[0];
    return [real, imag];
}

function complexExp(a) {
    let real = Math.exp(a[0]) * Math.cos(a[1]);
    let imag = Math.exp(a[0]) * Math.sin(a[1]);
    return [real, imag];
}

function complexInv(a) {
    let modulusSquared = a[0]*a[0] + a[1]*a[1];
    let real = a[0] / modulusSquared;
    let imag = -a[1] / modulusSquared;
    return [real, imag];
}

function complexDiv(a, b) {
    let real = (a[0]*b[0] + a[1]*b[1]) / (b[0]*b[0] + b[1]*b[1]);
    let imag = (a[1]*b[0] - a[0]*b[1]) / (b[0]*b[0] + b[1]*b[1]);
    return [real, imag];
}

function initMandelbrot(){

    
    function stepM3(x, y, i){
        if (i == 0){
            return this.params[0];
        }
        let n = complexExp([0,i]);
        let c = complexAdd(n, complexInv(n)); 
        let d = complexAdd(complexMul(n, [-0.5,0]), complexInv(n));   
        let z2 = complexMul([x,y],[x,y]);
        let z1 = complexMul(complexMul([x,y],this.params[1]),d);
        let z0 = complexMul(this.params[2],c);
        return complexAdd(complexAdd(z0,z1),z2);
    }


    function stepM2(x, y, i){
        if (i == 0){
            return this.params[0];
        }   

        let n = complexExp([0,i]);
        let m = complexExp([0,-i]);
        let z2 = complexMul([x,y],[x,y]);
        // let z1 = complexMul(complexMul([x,y],this.params[3]),c);
        let z0 = complexMul(this.params[1],n)
        let z1 = complexAdd( complexMul(this.params[3],[x,0]), complexMul(this.params[2],[0,y])) ;
        return complexAdd(complexAdd(z0,z1),z2);
    }

    var ff = new FractalFunction([[0.0, 0.0], [0.02, 0.01], [0.5, -0.8], [-0.5, 1.0]], stepM2);

    connectCanvases([
        new FractalCanvas('j2-canvas', ff, 0.5, 0, 0, 0),
        new FractalCanvas('m2x0-canvas', ff, 1, 0, 0, 1),
        new FractalCanvas('m2x1-canvas', ff, 0.3, 0, 0, 2),
        new FractalCanvas('m2x2-canvas', ff, 0.3, 0, 0, 3)
    ]);


    function stepM1(x, y, i){
        if (i == 0){
            return this.params[0];
        }
        let n = complexExp([0,i]);
        let z2 = complexMul([x,y],[x,y]);
        let z0 = complexAdd(this.params[1], complexMul(this.params[2],n)) ;
        return complexAdd([-1,0],complexAdd(z0,z2));
    }

    var ff = new FractalFunction([[0.0, 0.0], [0.38, 0.38], [0.0, 0.0]], stepM1);

    connectCanvases([
        new FractalCanvas('j1-canvas', ff, 0.5, 0, 0, 0), 
        new FractalCanvas('m1x0-canvas', ff, 1, 0, 0, 1), 
        new FractalCanvas('m1x1-canvas', ff, 1, 0, 0, 2)
    ]);
}

renderMathInElement(document.body, {
    delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
    ],
    throwOnError : false
});

initMandelbrot();


