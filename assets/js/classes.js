class FractalFunction{
    constructor(p, f) {
        this.params = p;
        this.step = f
    }
}



class FractalCanvas {
    constructor(canvasId, fractalFunction, scale = 1, offsetX = 0, offsetY = 0, n = 0) {
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext('2d');
        this.scale = scale*(this.canvas.width+this.canvas.height)/4
        this.offsetX = Math.round(this.canvas.width/2) + offsetX;
        this.offsetY = Math.round(this.canvas.height/2) + offsetY;
        this.maxIter = 300;
        this.n = n;
        this.fractalFunction = fractalFunction;
        this.stepMap = {
            1: [19, 0.1504440784612413, 113, 0.09733552923255218],
            2: [38, 0.3008881569224826, 94, 0.24777960769379348],
            3: [69, 0.11503837897544855, 57, 0.4513322353837239],
            4: [44, 0.017702849742896376, 12, 0.5663706143591725],
            5: [25, 0.13274122871834493, 95, 0.7522203923062065]
        };
        this.colorMap = {
            1: [0,95,95,255],
            2: [94,0,0,255],
            3: [0,99,0,255],
            4: [0,0,144,255],
            5: [85,85,0,255]
        };
        

        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.imgData = this.context.createImageData(this.width, this.height);
        this.data = this.imgData.data;
        this.dataStore = this.data.slice(); // Initialize the store

        this.isDrawing = false;
        this.color = [220, 0, 220, 255];
        this.drawFractal();

    }

    toComplexPlane(x, y) {
        let cX = (x - this.offsetX) / this.scale;
        let cY = (this.offsetY - y) / this.scale;
        return [cX, cY];
    }

    toPixelCoords(cX, cY) {
        let x = Math.round(cX * this.scale + this.offsetX);
        let y = Math.round(this.offsetY - cY * this.scale );
        return [x, y];
    }

    toIdx(x, y) {
        if ((x < 0 || x > this.width) || (y < 0 || y > this.height) ){
            return -1;   
        }
        return 4*(y*this.width + x);
    }

    store(){
        this.dataStore.set(this.data, 0);
    }
    
    restore(){
        this.data.set(this.dataStore, 0);
    }

    distance(point1, point2) {
        let [x1, y1] = point1;
        let [x2, y2] = point2;
        return Math.sqrt((x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1));
    }

    draw(n = this.n) {
        let [cXcopy, cYcopy] = this.fractalFunction.params[n]; 
        let seq = [];
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                this.fractalFunction.params[n] = this.toComplexPlane(x, y);
                let i = 0;
                let [xx, yy] = [0.0, 0.0];
                seq = [];
                while (xx + yy <= 10 && i < this.maxIter + 1) {
                    [xx, yy] = this.fractalFunction.step(xx, yy, i);
                    seq.push([xx, yy]);
                    i++;
                }
                let color  = [0, 0, 0, 255];
                if (xx + yy <= 10.0) {
                    let penPoint = seq[seq.length - 4];
                    let lastPoint = seq[seq.length - 1];
                    let refdist = Math.sqrt(this.distance(penPoint, lastPoint)*this.distance([0,0], lastPoint));
                    
                    for(let k=1;k<6;k++){
                        let referencePoint1 = seq[seq.length - this.stepMap[k][0] - 1];
                        let referencePoint2 = seq[seq.length - this.stepMap[k][2] - 1];
                        let sumweight = this.stepMap[k][1] + this.stepMap[k][3];
                        let difdist = Math.abs(this.distance(referencePoint1, lastPoint)*this.stepMap[k][3]-
                            this.distance(referencePoint2, lastPoint)*this.stepMap[k][1])/sumweight;
                        if (difdist < 0.01*refdist) {
                            color = this.colorMap[k];
                            break;
                        }
                    } 
                } else {
                    let brightness = Math.floor(Math.log(i) / Math.log(this.maxIter) * 255);
                    color = [brightness, 100, 255 - brightness, 255];
                }
                this.data.set(color, this.toIdx(x, y));
            }
        }
        this.fractalFunction.params[n] =  [cXcopy, cYcopy]; 
        this.store();
        console.log(this.fractalFunction);
    }

    setPixel(ix, iy, color){
        let idx = this.toIdx(ix, iy);
        if (idx >= 0 && idx < this.data.length) {
            this.data.set(color, idx);
        }
    }

    trace(n = this.n){
        let [x, y] = [0, 0];
        let [ix, iy] = this.toPixelCoords(...this.fractalFunction.params[n]);
        let idx = 0;
        let markColor = [222, 222, 222, 255];

        this.setPixel(ix, iy, [255, 255, 255, 255]);
        this.setPixel(ix + 1, iy, markColor);
        this.setPixel(ix, iy + 1, markColor);
        this.setPixel(ix - 1, iy, markColor);
        this.setPixel(ix, iy - 1, markColor);

        let traceColor = [220, 0, 220, 255];

        for (let j = 0; j<200000; j++){
            [x, y] = this.fractalFunction.step(x, y, j);
            if (j>100){
                this.setPixel(...this.toPixelCoords(x, y), traceColor);
            }
        }
    }

    display() {
        this.context.putImageData(this.imgData, 0, 0);
    }

    drawFractal(){
        this.draw();
        this.trace();
        this.display();
    }


    startDrawing(event) {
        this.isDrawing = true;
        this.drawTrace(event);
    }

    drawTrace(event) {
        if (!this.isDrawing) return;
        let rect = this.canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        this.fractalFunction.params[this.n] = this.toComplexPlane(x, y);
        this.restore();
        this.trace();
        this.display();
    }

    stopDrawing(event) {
        this.isDrawing = false;
    }



    changeScale(event) {
        event.preventDefault();
        let rect = this.canvas.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        let [cX, cY] = this.toComplexPlane(x, y);

        let scaleSpeed = 1.2;
        let scaleChange = event.deltaY < 0 ? scaleSpeed : 1/scaleSpeed;
        let newScale = this.scale * scaleChange;
        
        // Update the offsets
        this.offsetX = x - cX * newScale;
        this.offsetY = y + cY * newScale;
        
        // Update the scale
        this.scale = newScale;
        this.drawFractal();
    }
}
