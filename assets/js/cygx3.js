
  


function connectCanvases(canvases1, canvases2){

    for (j = 0; j<canvases1.length; j++){
        canvas = canvases1[j];
        canvas.canvas.addEventListener('wheel', canvas.changeScale.bind(canvas), { passive: false });
        for (k = 0; k<canvases2.length; k++){
            canvas2 = canvases2[k];
            canvas.canvas.addEventListener('mousedown', canvas2.startDrawing.bind(canvas2));
            canvas2.canvas.addEventListener('mousedown', canvas.draw.bind(canvas));
            canvas.canvas.addEventListener('mousemove', canvas2.trace.bind(canvas2));
            canvas.canvas.addEventListener('mouseup', canvas2.stopDrawing.bind(canvas2));

        }            
    }
}


function initCygX3(){

    
    
  function integrateOverCylinder(rotationAxis, reference, observer, h1, h2, N, M, n) {
    let O = observer.normalize();
    let Ox = O.cross( new Vector3D(0,0,1)).normalize();
    let Oy = O.cross(Ox).normalize();
    n = Math.floor(n*N);
    

    const z = rotationAxis.normalize();
    let totalI = 0;
    let totalQ = 0;
    let totalU = 0;
  
    let r = reference.antiprojectOnto(z).normalize(); 
    let r2 = r.cross(z).normalize();
    const deltaH = (h2 - h1) / M;
    const deltaP = Math.PI / N;

    // Integrate over the lateral surface
    for (let j = 0; j < M - 1; j++) {
      const currentH = h1 + (j + 0.5) * deltaH;
  
      for (let i = -n; i < n; i++) {
        const theta12 = (i + 0.5) * deltaP;

        let P = r.scale(Math.cos(theta12))
          .add(r2.scale(Math.sin(theta12)));

        let Q = P.negate();
  
        P = P.add(z.scale(currentH));

        let R2 = P.dot(P);
        let solid = deltaH*deltaP*P.dot(Q)*O.dot(Q)/(R2*R2);
        if (solid > 0){
            let mu = O.dot(P.normalize());
            let p = (1 - mu*mu)/( 1 + mu*mu);
            chi = 2*Math.atan2(P.dot(Oy),P.dot(Ox));
            totalI = totalI + solid;
            totalQ = totalQ + solid*p*Math.cos(chi);
            totalU = totalU + solid*p*Math.sin(chi);
        }
      }
    }

    // console.log(totalI, Math.sqrt(totalQ*totalQ + totalU*totalU), totalQ/totalI, totalU/totalI);
    return [totalI, Math.sqrt(totalQ*totalQ + totalU*totalU), totalQ/totalI, totalU/totalI];

  }
  


    var pf = new PolFunction([1,1,1,1], integrateOverCylinder);

    
    hwCanvas = new PolCanvas('hw-canvas', pf, 1, 1, 0, 0, 0, 1);
    iphiCanvas = new PolCanvas('iphi-canvas', pf, 1, 1, 0, 0, 2, 3);
    quCanvas = new PolCanvas('qu-canvas', pf, 1, 1, 0, 0, 0,1);
    ipCanvas = new PolCanvas('ip-canvas', pf, 1, 1, 0, 0, 2,3);

    connectCanvases([hwCanvas,iphiCanvas],[quCanvas,ipCanvas]);
    

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

initCygX3();


