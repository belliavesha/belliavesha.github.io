// Prefix sums preserve native PI-channel resolution; each band costs two reads.
export const ENERGY_MIN=3, ENERGY_MAX=30, ENERGY_STEP=.04;
export function cumulative(values){const p=new Float64Array(values.length+1);for(let i=0;i<values.length;i++)p[i+1]=p[i]+values[i];return p;}
export function indexAt(energy,meta){return Math.max(0,Math.min(meta.channels,Math.round((energy-meta.energy_min)/meta.energy_step)));}
export function band(prefix,lo,hi,meta){return prefix[indexAt(hi,meta)]-prefix[indexAt(lo,meta)];}
export function prepare(data,module='AB'){
  const count=Math.min(data.channels,indexAt(ENERGY_MAX,data));
  const meta={energy_min:data.energy_min,energy_step:data.energy_step,channels:count};
  return data.segments.map((segment,i)=>{
    const rate=new Float64Array(count),variance=new Float64Array(count);
    for(const m of (module==='AB'?['A','B']:[module]))for(let c=0;c<count;c++){
      rate[c]+=data.modules[m].rate[i][c];variance[c]+=data.modules[m].variance[i][c];
    }
    return {segment:{...segment,obsid:data.obsid},meta,observation:data,rate,variance,p:cumulative(rate),v:cumulative(variance)};
  });
}
export function evaluateAxis(row,config){
  const m=row.meta;
  if(config.kind==='rate'){
    const value=band(row.p,config.band[0],config.band[1],m),variance=band(row.v,config.band[0],config.band[1],m);
    return {value,error:Math.sqrt(Math.max(0,variance)),valid:Number.isFinite(value)};
  }
  if(config.kind!=='color')throw new Error('Unknown axis type');
  const [sl,sh]=config.soft,[hl,hh]=config.hard,ol=Math.max(sl,hl),oh=Math.min(sh,hh);
  const s=band(row.p,sl,sh,m),h=band(row.p,hl,hh,m),vs=band(row.v,sl,sh,m),vh=band(row.v,hl,hh,m);
  const cov=oh>ol?band(row.v,ol,oh,m):0,value=h/s;
  const variance=vh/(s*s)+h*h*vs/(s**4)-2*h*cov/(s**3);
  return {value,error:Math.sqrt(Math.max(0,variance)),valid:s>0&&h>0&&Number.isFinite(value)};
}
export function calculateAxes(prepared,xConfig,yConfig){
  return prepared.map((row,i)=>{
    const x=evaluateAxis(row,xConfig),y=evaluateAxis(row,yConfig);
    return {i,obsid:row.segment.obsid,x:x.value,y:y.value,xe:x.error,ye:y.error,valid:x.valid&&y.valid};
  });
}
export function calculate(prepared,meta,soft,hard,intensity='union'){
  if(!['union','3-30','soft','hard'].includes(intensity))throw new Error('Unknown intensity band');
  const [sl,sh]=soft,[hl,hh]=hard,ol=Math.max(sl,hl),oh=Math.min(sh,hh);
  return prepared.map((r,i)=>{
    const m=r.meta||meta;
    const s=band(r.p,sl,sh,m),h=band(r.p,hl,hh,m),vs=band(r.v,sl,sh,m),vh=band(r.v,hl,hh,m);
    const overlap=oh>ol?band(r.p,ol,oh,m):0,cov=oh>ol?band(r.v,ol,oh,m):0;
    let y=s+h-overlap,vy=vs+vh-cov;
    if(intensity==='3-30'){y=band(r.p,3,30,m);vy=band(r.v,3,30,m);}
    else if(intensity==='soft'){y=s;vy=vs;}
    else if(intensity==='hard'){y=h;vy=vh;}
    const x=h/s,vx=vh/(s*s)+h*h*vs/(s**4)-2*h*cov/(s**3);
    return {i,obsid:r.segment.obsid,x,y,xe:Math.sqrt(Math.max(0,vx)),ye:Math.sqrt(Math.max(0,vy)),soft:s,hard:h,valid:s>0&&h>0&&y>0&&Number.isFinite(x+y)};
  });
}
// Keep scientific values unchanged; swap coordinates and uncertainties only for display.
export function projectPoint(point,flipped=false){return {...point,plotX:flipped?point.y:point.x,plotY:flipped?point.x:point.y,plotXE:flipped?point.ye:point.xe,plotYE:flipped?point.xe:point.ye};}
