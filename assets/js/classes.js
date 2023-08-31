class Vector3D {
    constructor(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  
    // Dot product
    dot(otherVector) {
      return this.x * otherVector.x + this.y * otherVector.y + this.z * otherVector.z;
    }
  
    // Cross product
    cross(otherVector) {
      const x = this.y * otherVector.z - this.z * otherVector.y;
      const y = this.z * otherVector.x - this.x * otherVector.z;
      const z = this.x * otherVector.y - this.y * otherVector.x;
      return new Vector3D(x, y, z);
    }
  
    add(otherVector) {
      return new Vector3D(this.x + otherVector.x, this.y + otherVector.y, this.z + otherVector.z);
    }
  
    subtract(otherVector) {
      return new Vector3D(this.x - otherVector.x, this.y - otherVector.y, this.z - otherVector.z);
    }
  
    scale(scalar) {
      return new Vector3D(this.x * scalar, this.y * scalar, this.z * scalar);
    }
  
    magnitude() {
      return Math.sqrt(this.dot(this));
    }
  
    normalize() {
      const mag = this.magnitude();
      if (mag === 0) return new Vector3D(0, 0, 0);
      return this.scale(1 / mag);
    }
  
    negate() {
      return this.scale(-1);
    }
  
    static distance(vec1, vec2) {
      return vec1.subtract(vec2).magnitude();
    }
    
    distanceTo(vec2) {
        return this.subtract(vec2).magnitude();
    }
  
    static angleBetween(vec1, vec2) {
      const dotProduct = vec1.dot(vec2);
      const mag1 = vec1.magnitude();
      const mag2 = vec2.magnitude();
      return Math.acos(dotProduct / (mag1 * mag2));
    }

    angleTo(vec2) {
        const dotProduct = this.dot(vec2);
        const mag1 = this.magnitude();
        const mag2 = vec2.magnitude();
        return Math.acos(dotProduct / (mag1 * mag2));
    }

    angleBetween(vec2) {
        const dotProduct = this.dot(vec2);
        const mag1 = this.magnitude();
        const mag2 = vec2.magnitude();
        return Math.acos(dotProduct / (mag1 * mag2));
    }
  
    projectOnto(otherVector) {
        const dotProduct = this.dot(otherVector);
        const magSquare = otherVector.dot(otherVector);
        return otherVector.scale(dotProduct / magSquare);
    }

    // Projection of this vector onto a plane perpendicular to another    
    antiprojectOnto(otherVector) {
        return this.subtract(this.projectOnto(otherVector));
    }

    rotate(axis, angle) {
        const cosTheta = Math.cos(angle);
        const sinTheta = Math.sin(angle);

        const cross = axis.cross(this);
        const dot = axis.dot(this);

        const rotated = this.scale(cosTheta)
        .add(cross.scale(sinTheta))
        .add(axis.scale(dot * (1 - cosTheta)));

        return rotated;
    }
    
  
    copy() {
      return new Vector3D(this.x, this.y, this.z);
    }
  }
  



class FractalFunction{
    constructor(p, f) {
        this.params = p;
        this.step = f;
    }
}



class FractalCanvas {
    constructor(canvasId, fractalFunction, scale = 1, offsetX = 0, offsetY = 0, n = 0) {
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext('2d');
        this.scale = scale*(this.canvas.width+this.canvas.height)/4
        this.offsetX = Math.round(this.canvas.width/2) + offsetX;
        this.offsetY = Math.round(this.canvas.height/2) + offsetY;
        this.maxIter = 145;
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

    orbitColor(k, K = 1){
        return  [Math.floor(Math.cos(k/K)*100+101),
            Math.floor(Math.cos(k/K + Math.PI*2/3)*100+121),
            Math.floor(Math.cos(k/K + Math.PI*4/3)*100+121),
            255];
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
                this.setPixel(...this.toPixelCoords(x, y), this.orbitColor(j) );
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


class PolFunction{
    constructor(p, f) {
        this.params = p;
        this.total = f;
    }
}



class PolCanvas {
    constructor(canvasId, polFunction, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, n =0, m =1) {
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext('2d');
        this.scaleX = scaleX*(this.canvas.width)/2;
        this.scaleY = scaleY*(this.canvas.height)/2;
        this.offsetX = Math.round(this.canvas.width/2) + offsetX;
        this.offsetY = Math.round(this.canvas.height/2) + offsetY;
        this.n = n;
        this.m = m;
        this.polFunction = polFunction;
        

        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.imgData = this.context.createImageData(this.width, this.height);
        this.data = this.imgData.data;
        this.data.fill(250);
        this.dataStore = this.data.slice(); 

        this.isDrawing = false;
        this.color = [220, 0, 220, 255];
        this.drawAll();

    }

    toPlane(x, y) {
        let cX = (x - this.offsetX) / this.scaleX;
        let cY = (this.offsetY - y) / this.scaleY;
        return [cX, cY];
    }

    toPixelCoords(cX, cY) {
        let x = Math.round(cX * this.scaleX + this.offsetX);
        let y = Math.round(this.offsetY - cY * this.scaleY );
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

    orbitColor(k, K){
        return  [Math.floor(Math.cos(k/K)*100+101),
            Math.floor(Math.cos(k/K + Math.PI*2/3)*100+121),
            Math.floor(Math.cos(k/K + Math.PI*4/3)*100+121),
            255];
    }


    setPixel(ix, iy, color){
        let idx = this.toIdx(ix, iy);
        if (idx >= 0 && idx < this.data.length) {
            this.data.set(color, idx);
        }
    }

    trace(n = this.n, m = this.m){
        let K = 100;
        let inclination = this.polFunction.params[0];
        let azimuth = this.polFunction.params[1];
        let height = this.polFunction.params[2];
        let width = this.polFunction.params[3];
        for (let k=0; k<K; k++){
          let phi = k*2*Math.PI/K+azimuth;
          let total = this.polFunction.total(
            new Vector3D(Math.sin(inclination)*Math.cos(phi),Math.sin(inclination)*Math.sin(phi) , Math.cos(inclination)),
            new Vector3D(Math.cos(phi), Math.sin(phi), 0),
            new Vector3D(0, Math.sin(Math.PI/6), Math.cos(Math.PI/6)),
            0, height, 
            100, 100, width*100
          );
        //   console.log(k,n,m,total[n],total[m],this.toPixelCoords(total[n],total[m]));
          this.setPixel(...this.toPixelCoords(total[n],total[m]), this.orbitColor(k, K) );

        }
    }




    display() {
        this.context.putImageData(this.imgData, 0, 0);
    }

    drawAll(){
        // this.draw();
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
        // this.fractalFunction.params[this.n] = this.toPlane(x, y);
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
        let [cX, cY] = this.toPlane(x, y);

        let scaleSpeed = 1.2;
        let scaleChange = event.deltaY < 0 ? scaleSpeed : 1/scaleSpeed;
        let newScaleX = this.scaleX * scaleChange;
        let newScaleY = this.scaleY * scaleChange;
        
        // Update the offsets
        this.offsetX = x - cX * newScaleX;
        this.offsetY = y + cY * newScaleY;
        
        // Update the scale
        this.scaleX = newScaleX;
        this.scaleY = newScaleY;
        this.drawAll();
    }
}




