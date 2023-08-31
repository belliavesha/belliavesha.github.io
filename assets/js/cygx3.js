
  


function connectCanvases(canvases){

    for (j = 0; j<canvases.length; j++){
        canvas = canvases[j];
        for (k = 0; k<canvases.length; k++){
            if (j==k){
                canvas.canvas.addEventListener('mousedown', canvas.startDrawing.bind(canvas));
                canvas.canvas.addEventListener('mousemove', canvas.trace.bind(canvas));
                canvas.canvas.addEventListener('mouseup', canvas.stopDrawing.bind(canvas));
                canvas.canvas.addEventListener('wheel', canvas.changeScale.bind(canvas), { passive: false });
            } else{ 
                canvas2 = canvases[k];
                // canvas.canvas.addEventListener('mouseup', canvas2.drawFractal.bind(canvas2));
            }
        }            
    }
}


function initCygX3(){

    
    
  function integrateOverCylinder(rotationAxis, reference, observer, h1, h2, N, M, n) {
    let O = observer.normalize();
    let Ox = O.cross( new Vector3D(0,0,1)).normalize();
    let Oy = O.cross(Ox).normalize();
    n = Math.floor(n);
    

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

    connectCanvases([
        new PolCanvas('hw-canvas', pf, 1, 1, 0, 0, 0,1),
        new PolCanvas('iphi-canvas', pf, 1, 1, 0, 0, 1,2),
        new PolCanvas('qu-canvas', pf, 1, 1, 0, 0, 2,3),
        new PolCanvas('ip-canvas', pf, 1, 1, 0, 0, 3,1)
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

initCygX3();


