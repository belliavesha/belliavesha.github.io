import {prepare,calculateAxes,band,ENERGY_MIN,ENERGY_MAX,ENERGY_STEP} from './hid_math.mjs';
import {freshSwan,movePart,neckBezier,wingTransformFromPoint,bodyStretchFromPoint,cygnetScaleFromPoint} from './swan_math.mjs';
const $=s=>document.querySelector(s);
const defaultAxes=()=>({x:{kind:'color',band:[3,30],soft:[6,10],hard:[10,20]},y:{kind:'rate',band:[3,30],soft:[6,10],hard:[10,20]}});
const state={axes:defaultAxes(),module:'AB',selected:0,errors:false};
let data,prepared,points,screenPoints=[],pending=false,calculationMs=0;
const datasets=new Map(),revisions=new Map(),colors=new Map();
const visibleObs=new Set();
const catalogRows=[
  ['11001313002','#0072b2'],['11001313012','#d55e00'],['80511301004','#009e73'],['11001313013','#cc79a7'],
  ['80511301002','#a07800'],['30801012002','#56a9cf'],['11001313016','#343e8c'],['11001313008','#af3434'],
  ['11001313006','#756432'],['11001313014','#743dc0'],['11001313010','#168583'],['30001141002','#bf5382'],
  ['11001313004','#536900'],['11001313015','#604039'],
].map(([obsid,color])=>({obsid,color,file:`./data/${obsid}.json`}));
let detailsKey=null;
const SPAN=ENERGY_MAX-ENERGY_MIN;
let swan=freshSwan(),swanEnabled=false,swanReversed=false,cygnetCount=1,swanDrag=null,swanConsumedClick=false;
const fmt=(n,d=2)=>Number(n).toFixed(d).replace(/\.00$/,'');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snap=x=>Math.round((x-3)/.04)*.04+3;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const bandNames=['x-band','x-soft','x-hard','y-band','y-soft','y-hard'];
function bandRef(name){const [axis,key]=name.split('-');return state.axes[axis][key];}
function bandHTML(name,title,note,kind){return `<div class="band-control ${kind}" id="${name}-control"><div class="band-title"><h3>${title}</h3><span>${note}</span></div><div class="number-pair"><label>From <input id="${name}-low" type="number" min="3" max="29.96" step="0.04"></label><span>—</span><label>To <input id="${name}-high" type="number" min="3.04" max="30" step="0.04"></label><span>keV</span></div><div class="window-track" id="${name}-track"><div class="rail"></div><div class="window" data-part="body" title="Drag ${title.toLowerCase()}"><button class="handle left" data-part="low" role="slider" aria-label="${title} lower energy" aria-valuemin="3" aria-valuemax="30"></button><button class="handle right" data-part="high" role="slider" aria-label="${title} upper energy" aria-valuemin="3" aria-valuemax="30"></button></div></div><div class="ruler"><span>3</span><span style="left:25.925926%">10</span><span style="left:62.962963%">20</span><span>30 keV</span></div></div>`;}
function buildAxisControls(axis){$(`#${axis}-bands`).innerHTML=bandHTML(`${axis}-band`,'Count-rate band','Rate','rate')+bandHTML(`${axis}-soft`,'Soft band','Denominator','soft')+bandHTML(`${axis}-hard`,'Hard band','Numerator','hard');}
buildAxisControls('x');buildAxisControls('y');
function axisConfig(axis){const value=state.axes[axis];return value.kind==='rate'?{kind:'rate',band:value.band}:{kind:'color',soft:value.soft,hard:value.hard};}
function axisLabel(axis){const cfg=state.axes[axis];if(cfg.kind==='rate')return `Count rate · ${fmt(cfg.band[0])}–${fmt(cfg.band[1])} keV (counts/s)`;return `Color · R(${fmt(cfg.hard[0])}–${fmt(cfg.hard[1])}) / R(${fmt(cfg.soft[0])}–${fmt(cfg.soft[1])})`;}
function updateControls(){
  for(const axis of ['x','y']){
    const color=state.axes[axis].kind==='color';$(`#${axis}-band-control`).hidden=color;$(`#${axis}-soft-control`).hidden=!color;$(`#${axis}-hard-control`).hidden=!color;
    $(`#${axis}-kind`).value=state.axes[axis].kind;$(`#${axis}-formula`).textContent=axisLabel(axis);
  }
  for(const name of bandNames){
    const [lo,hi]=bandRef(name),track=$(`#${name}-track`),window=track.querySelector('.window');
    window.style.left=`${(lo-3)/SPAN*100}%`;window.style.width=`${(hi-lo)/SPAN*100}%`;
    for(const [part,i] of [['low',0],['high',1]]){
      const input=$(`#${name}-${part}`);if(document.activeElement!==input)input.value=fmt(bandRef(name)[i]);
      const handle=track.querySelector(`[data-part=${part}]`);handle.setAttribute('aria-valuenow',bandRef(name)[i].toFixed(2));handle.setAttribute('aria-valuetext',`${fmt(bandRef(name)[i])} keV`);
    }
  }
}
function schedule(){updateControls();if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;recalculate();});}}
function recalculate(){
  if(!data)return;
  const t=performance.now();points=calculateAxes(prepared,axisConfig('x'),axisConfig('y'));calculationMs=performance.now()-t;
  draw();$('#performance').textContent=`${calculationMs.toFixed(1)} ms rebin`;
}
function setupWindows(){
  for(const name of bandNames){
    const track=$(`#${name}-track`);let drag=null;
    track.addEventListener('pointerdown',e=>{
      const rect=track.getBoundingClientRect();let part=e.target.dataset.part;
      const current=bandRef(name);
      if(!part){const energy=3+(e.clientX-rect.left)/rect.width*SPAN;part=Math.abs(energy-current[0])<Math.abs(energy-current[1])?'low':'high';current[part==='low'?0:1]=clamp(snap(energy),part==='low'?3:current[0]+.04,part==='low'?current[1]-.04:ENERGY_MAX);schedule();}
      drag={part,startX:e.clientX,initial:[...current],width:rect.width};track.setPointerCapture(e.pointerId);e.preventDefault();
    });
    track.addEventListener('pointermove',e=>{
      if(!drag)return;const delta=(e.clientX-drag.startX)/drag.width*SPAN;let [lo,hi]=drag.initial;
      if(drag.part==='body'){const width=hi-lo;lo=clamp(snap(lo+delta),3,ENERGY_MAX-width);hi=lo+width;}
      else if(drag.part==='low')lo=clamp(snap(lo+delta),3,hi-.04);
      else hi=clamp(snap(hi+delta),lo+.04,ENERGY_MAX);
      const [axis,key]=name.split('-');state.axes[axis][key]=[lo,hi];schedule();
    });
    const stop=()=>drag=null;track.addEventListener('pointerup',stop);track.addEventListener('pointercancel',stop);track.addEventListener('lostpointercapture',stop);
    for(const [part,i]of [['low',0],['high',1]]){
      const input=$(`#${name}-${part}`);
      input.addEventListener('input',()=>{
        if(input.value===''||!Number.isFinite(input.valueAsNumber))return;
        const current=bandRef(name);current[i]=clamp(snap(input.valueAsNumber),i?current[0]+.04:3,i?ENERGY_MAX:current[1]-.04);schedule();
      });
      input.addEventListener('change',()=>{input.value=fmt(bandRef(name)[i]);});
      track.querySelector(`[data-part=${part}]`).addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
        e.preventDefault();const delta=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*(e.shiftKey?1:.04);
        const current=bandRef(name);let value=e.key==='Home'?3:e.key==='End'?ENERGY_MAX:snap(current[i]+delta);
        current[i]=clamp(value,i?current[0]+.04:3,i?ENERGY_MAX:current[1]-.04);schedule();
      });
    }
  }
}
function canvasContext(id){
  const canvas=$(id),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
  return {ctx,w:rect.width,h:rect.height};
}
function bounds(values){let lo=Math.min(...values),hi=Math.max(...values);if(!Number.isFinite(lo+hi))return [0,1];const pad=(hi-lo||Math.abs(hi)*.1||.1)*.12;return [lo-pad,hi+pad];}
function ticks(lo,hi,count=5){const rough=(hi-lo)/count,pow=10**Math.floor(Math.log10(rough));const step=[1,2,2.5,5,10].map(n=>n*pow).find(n=>n>=rough)||pow*10;const out=[];for(let x=Math.ceil(lo/step)*step;x<=hi+step*1e-8;x+=step)out.push(x);return out;}
function logTicks(lo,hi){const out=[];for(let exponent=Math.floor(lo);exponent<=Math.ceil(hi);exponent++)for(const multiplier of [1,2,3,4,5,6,8]){const value=multiplier*10**exponent,logged=Math.log10(value);if(logged>=lo-1e-9&&logged<=hi+1e-9)out.push(value);}return out;}
function decadeTicks(lo,hi){const out=[];for(let exponent=Math.ceil(lo);exponent<=Math.floor(hi);exponent++)out.push(10**exponent);return out;}
function tickText(v){if(v===0)return '0';if(Math.abs(v)<.01||Math.abs(v)>=10000)return v.toExponential(1);return Number(v.toPrecision(4)).toString();}
function axes(ctx,w,h,xb,yb,xlabel,ylabel,{xLog=false,yLog=false}={}){
  const m={l:76,r:22,t:18,b:58},pw=w-m.l-m.r,ph=h-m.t-m.b;
  const x=v=>m.l+((xLog?Math.log10(v):v)-xb[0])/(xb[1]-xb[0])*pw;
  const y=v=>h-m.b-((yLog?Math.log10(v):v)-yb[0])/(yb[1]-yb[0])*ph;
  ctx.font='12px system-ui';ctx.lineWidth=1;ctx.strokeStyle='#e6ecef';ctx.fillStyle='#657680';
  const xt=xLog?logTicks(...xb):ticks(...xb);for(const v of xt){const px=x(v);ctx.beginPath();ctx.moveTo(px,m.t);ctx.lineTo(px,h-m.b);ctx.stroke();ctx.textAlign='center';ctx.fillText(tickText(v),px,h-m.b+22);}
  const yt=yLog?decadeTicks(...yb):ticks(...yb);
  for(const v of yt){const py=y(v);ctx.beginPath();ctx.moveTo(m.l,py);ctx.lineTo(w-m.r,py);ctx.stroke();ctx.textAlign='right';ctx.fillText(tickText(v),m.l-10,py+4);}
  ctx.strokeStyle='#b7c5ce';ctx.beginPath();ctx.moveTo(m.l,m.t);ctx.lineTo(m.l,h-m.b);ctx.lineTo(w-m.r,h-m.b);ctx.stroke();
  ctx.fillStyle='#344e5c';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText(xlabel,m.l+pw/2,h-13);ctx.save();ctx.translate(19,m.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText(ylabel,0,0);ctx.restore();
  return {x,y,m,pw,ph};
}
function swanMetrics(w,h){
  const scale=Math.min(w/800,h/500);
  const bx=swan.body.x*w,by=swan.body.y*h,bodyLeft=bx-98*scale;
  return {
    scale,bx,by,bodyLeft,hx:swan.head.x*w,hy:swan.head.y*h,
    bodyTail:{x:bodyLeft+224*scale*swan.bodyScaleX,y:by+3*scale},
    wingAnchor:{x:bodyLeft+35*scale,y:by+1*scale},
  };
}
function wingHandle(w,h){
  const {scale,wingAnchor}=swanMetrics(w,h),x=153*scale*swan.wingScale,y=-15*scale*swan.wingScale,c=Math.cos(swan.wingAngle),s=Math.sin(swan.wingAngle);
  return {x:wingAnchor.x+x*c-y*s,y:wingAnchor.y+x*s+y*c};
}
function cygnetGeometry(point,w,h,index){
  const baseScale=Math.min(w/800,h/500)*.72,scale=baseScale*swan.cygnetScales[index],x=point.x*w,y=point.y*h;
  return {baseScale,scale,x,y,head:{x:x+4*scale,y:y-42*scale}};
}
function drawCygnet(ctx,point,w,h,index){
  const {scale,x,y,head}=cygnetGeometry(point,w,h,index);
  ctx.save();ctx.strokeStyle='rgba(24,45,58,.88)';ctx.fillStyle='rgba(255,255,255,.62)';ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
  const body=new Path2D();body.moveTo(x-30*scale,y);body.bezierCurveTo(x-22*scale,y-19*scale,x+12*scale,y-18*scale,x+31*scale,y-2*scale);body.bezierCurveTo(x+24*scale,y+18*scale,x-18*scale,y+20*scale,x-30*scale,y);body.closePath();ctx.fill(body);ctx.stroke(body);
  ctx.beginPath();ctx.moveTo(x-10*scale,y-10*scale);ctx.bezierCurveTo(x-9*scale,y-28*scale,x-2*scale,y-34*scale,x+2*scale,y-39*scale);ctx.stroke();
  ctx.beginPath();ctx.arc(x+4*scale,y-42*scale,7*scale,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(x-2*scale,y-43*scale);ctx.lineTo(x-13*scale,y-39*scale);ctx.lineTo(x-2*scale,y-36*scale);ctx.stroke();
  ctx.fillStyle='rgba(24,45,58,.88)';ctx.beginPath();ctx.arc(x+2*scale,y-44*scale,1.2*scale,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(18,127,152,.88)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(head.x,head.y,11*scale,0,Math.PI*2);ctx.stroke();
  ctx.font=`${11*scale}px system-ui`;ctx.fillText(String(index+1),x-3*scale,y+4*scale);ctx.restore();
}
function drawSwan(){
  const {ctx,w,h}=canvasContext('#swan-layer');
  if(!swanEnabled)return;
  const metrics=swanMetrics(w,h),{scale,bx,by,bodyLeft,bodyTail,wingAnchor,hx,hy}=metrics;
  const neckRoot={x:(bodyLeft+14*scale)/w,y:(by-3*scale)/h},neck=neckBezier(neckRoot,swan.head);
  const p=value=>({x:value.x*w,y:value.y*h});
  const ns=p(neck.start),ne=p(neck.end),c1=p(neck.c1),c2=p(neck.c2);
  ctx.save();if(swanReversed){ctx.translate(w,0);ctx.scale(-1,1);}ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=19*scale;ctx.beginPath();ctx.moveTo(ns.x,ns.y);ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,ne.x,ne.y);ctx.stroke();
  ctx.strokeStyle='rgba(24,45,58,.90)';ctx.lineWidth=2.1;ctx.beginPath();ctx.moveTo(ns.x,ns.y);ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,ne.x,ne.y);ctx.stroke();
  const sx=local=>bodyLeft+(local+98)*scale*swan.bodyScaleX;
  const body=new Path2D();body.moveTo(sx(-98),by-8*scale);body.bezierCurveTo(sx(-55),by-67*scale,sx(33),by-59*scale,sx(109),by-10*scale);body.bezierCurveTo(sx(126),by+2*scale,sx(132),by+3*scale,sx(116),by+9*scale);body.bezierCurveTo(sx(91),by+61*scale,sx(-18),by+69*scale,sx(-77),by+39*scale);body.bezierCurveTo(sx(-104),by+25*scale,sx(-113),by+7*scale,sx(-98),by-8*scale);body.closePath();ctx.fillStyle='rgba(255,255,255,.58)';ctx.strokeStyle='rgba(24,45,58,.90)';ctx.lineWidth=2.2;ctx.fill(body);ctx.stroke(body);
  const ws=scale*swan.wingScale;ctx.save();ctx.translate(wingAnchor.x,wingAnchor.y);ctx.rotate(swan.wingAngle);const wing=new Path2D();wing.moveTo(0,0);wing.bezierCurveTo(44*ws,-54*ws,119*ws,-50*ws,153*ws,-15*ws);wing.bezierCurveTo(110*ws,-23*ws,82*ws,10*ws,43*ws,20*ws);wing.bezierCurveTo(22*ws,25*ws,6*ws,15*ws,0,0);wing.closePath();ctx.fillStyle='rgba(18,127,152,.10)';ctx.fill(wing);ctx.stroke(wing);ctx.beginPath();ctx.moveTo(24*ws,2*ws);ctx.bezierCurveTo(68*ws,-19*ws,103*ws,-20*ws,136*ws,-13*ws);ctx.stroke();ctx.restore();
  const handle=wingHandle(w,h);ctx.fillStyle='rgba(255,255,255,.92)';ctx.strokeStyle='rgba(18,127,152,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(handle.x,handle.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.rect(bodyTail.x-6,bodyTail.y-6,12,12);ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.68)';ctx.strokeStyle='rgba(24,45,58,.90)';ctx.lineWidth=2.2;ctx.beginPath();ctx.ellipse(hx,hy,22*scale,25*scale,-.28,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(hx-17*scale,hy+2*scale);ctx.lineTo(hx-43*scale,hy+14*scale);ctx.lineTo(hx-17*scale,hy+17*scale);ctx.stroke();
  ctx.fillStyle='rgba(24,45,58,.90)';ctx.beginPath();ctx.arc(hx-5*scale,hy-7*scale,2*scale,0,Math.PI*2);ctx.fill();
  for(let i=0;i<cygnetCount;i++)drawCygnet(ctx,swan.cygnets[i],w,h,i);
  ctx.restore();
}
function hitSwan(x,y,w,h){
  if(!swanEnabled)return null;
  const {scale,by,bodyLeft,bodyTail,hx,hy}=swanMetrics(w,h),handle=wingHandle(w,h);
  if(Math.hypot(x-bodyTail.x,y-bodyTail.y)<14)return 'body-tail';
  if(Math.hypot(x-handle.x,y-handle.y)<14)return 'wing';
  for(let i=cygnetCount-1;i>=0;i--){const c=swan.cygnets[i],g=cygnetGeometry(c,w,h,i);if(Math.hypot(x-g.head.x,y-g.head.y)<14*g.scale)return `cygnet-scale-${i}`;if(((x-g.x)/(36*g.scale))**2+((y-g.y)/(23*g.scale))**2<1.2)return `cygnet-${i}`;}
  if(Math.hypot(x-hx,y-hy)<34*scale)return 'head';
  const bodyCenter=bodyLeft+112*scale*swan.bodyScaleX;
  if(((x-bodyCenter)/(116*scale*swan.bodyScaleX))**2+((y-by)/(68*scale))**2<1.15)return 'body';
  return null;
}
function swanPointer(e){const rect=$('#hid').getBoundingClientRect(),rawX=e.clientX-rect.left;return {x:swanReversed?rect.width-rawX:rawX,y:e.clientY-rect.top,w:rect.width,h:rect.height};}
function setupSwan(){
  const canvas=$('#hid');
  canvas.addEventListener('pointerdown',e=>{
    const point=swanPointer(e),part=hitSwan(point.x,point.y,point.w,point.h);if(!part)return;
    swanDrag={part,lastX:point.x/point.w,lastY:point.y/point.h,moved:false};swanConsumedClick=true;canvas.setPointerCapture(e.pointerId);$('#tooltip').hidden=true;e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    const point=swanPointer(e);
    if(swanDrag){
      if(swanDrag.part==='wing'){
        const metrics=swanMetrics(point.w,point.h),transform=wingTransformFromPoint(metrics.wingAnchor,{x:point.x,y:point.y},{x:153*metrics.scale,y:-15*metrics.scale});swan={...swan,wingAngle:transform.angle,wingScale:transform.scale};
      }else if(swanDrag.part==='body-tail'){
        const metrics=swanMetrics(point.w,point.h);swan={...swan,bodyScaleX:bodyStretchFromPoint(metrics.bodyLeft,point.x,224*metrics.scale)};
      }else if(swanDrag.part.startsWith('cygnet-scale-')){
        const index=Number(swanDrag.part.slice(13)),g=cygnetGeometry(swan.cygnets[index],point.w,point.h,index),scales=[...swan.cygnetScales];scales[index]=cygnetScaleFromPoint({x:g.x,y:g.y},{x:point.x,y:point.y},Math.hypot(4,42)*g.baseScale);swan={...swan,cygnetScales:scales};
      }else{swan=movePart(swan,swanDrag.part,point.x/point.w-swanDrag.lastX,point.y/point.h-swanDrag.lastY);swanDrag.lastX=point.x/point.w;swanDrag.lastY=point.y/point.h;}
      swanDrag.moved=true;canvas.style.cursor=swanDrag.part==='wing'?'grabbing':'move';drawSwan();e.preventDefault();return;
    }
    const part=hitSwan(point.x,point.y,point.w,point.h);canvas.style.cursor=part?(part==='wing'?'grab':'move'):'';
  });
  const finish=e=>{if(!swanDrag)return;swanConsumedClick=true;swanDrag=null;canvas.style.cursor='';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
}
function observationColor(i){return colors.get(prepared[i].segment.obsid)||'#0072b2';}
function drawHid(){
  const {ctx,w,h}=canvasContext('#hid'),valid=points.filter(p=>p.valid&&visibleObs.has(p.obsid)).map(p=>({...p,plotX:p.x,plotY:p.y,plotXE:p.xe,plotYE:p.ye}));
  screenPoints=[];
  const xLabel=axisLabel('x'),yLabel=axisLabel('y');
  if(!valid.length){axes(ctx,w,h,[0,1],[0,1],xLabel,yLabel);ctx.fillStyle='#657680';ctx.textAlign='center';ctx.font='14px system-ui';ctx.fillText(visibleObs.size?'No valid segments for these axis bands.':'Select at least one observation.',w/2,h/2);drawSwan();return;}
  const xb=bounds(valid.flatMap(p=>state.errors?[p.plotX-p.plotXE,p.plotX+p.plotXE]:[p.plotX]));
  const yb=bounds(valid.flatMap(p=>state.errors?[p.plotY-p.plotYE,p.plotY+p.plotYE]:[p.plotY]));
  const a=axes(ctx,w,h,xb,yb,xLabel,yLabel);
  for(const p of valid){
    const x=a.x(p.plotX),y=a.y(p.plotY);screenPoints.push({...p,px:x,py:y});ctx.strokeStyle=observationColor(p.i);ctx.fillStyle=observationColor(p.i);
    if(state.errors){ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(a.x(p.plotX-p.plotXE),y);ctx.lineTo(a.x(p.plotX+p.plotXE),y);ctx.moveTo(x,a.y(p.plotY-p.plotYE));ctx.lineTo(x,a.y(p.plotY+p.plotYE));ctx.stroke();ctx.globalAlpha=1;}
    ctx.beginPath();ctx.arc(x,y,3.8,0,2*Math.PI);ctx.fill();
  }
  const selected=screenPoints.find(p=>p.i===state.selected);
  if(selected){ctx.strokeStyle='#142f41';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(selected.px,selected.py,7.5,0,2*Math.PI);ctx.stroke();}
  drawSwan();
}
function drawSpectrum(){
  const included=prepared.filter(row=>visibleObs.has(row.segment.obsid)),{ctx,w,h}=canvasContext('#spectrum'),values=[];
  if(!included.length){ctx.fillStyle='#657680';ctx.textAlign='center';ctx.font='14px system-ui';ctx.fillText('Select at least one observation.',w/2,h/2);$('#spectrum-summary').textContent='No observations included';return;}
  const channels=Math.min(...included.map(row=>row.meta.channels)),weighted=new Float64Array(channels);let totalWeight=0;
  for(const row of included){const weight=Math.max(0,row.segment.stop-row.segment.start);totalWeight+=weight;for(let c=0;c<channels;c++)weighted[c]+=row.rate[c]*weight;}
  for(let c=0;c<channels;c++)weighted[c]/=totalWeight||1;
  for(let c=0;c<channels;c+=10){const upper=Math.min(c+10,channels),width=(upper-c)*ENERGY_STEP;let sum=0;for(let channel=c;channel<upper;channel++)sum+=weighted[channel];values.push({lo:ENERGY_MIN+c*ENERGY_STEP,hi:ENERGY_MIN+upper*ENERGY_STEP,rate:sum/width});}
  const positive=values.filter(p=>p.rate>0);const max=positive.length?Math.max(...positive.map(p=>p.rate)):1;
  const min=Math.max(max/10000,positive.length?Math.min(...positive.map(p=>p.rate)):max/100);const lower=Math.floor(Math.log10(min)),upper=Math.ceil(Math.log10(max));
  const a=axes(ctx,w,h,[Math.log10(ENERGY_MIN),Math.log10(ENERGY_MAX)],[lower,Math.max(lower+1,upper)],'Energy (keV)','Mean rate density (counts/s/keV)',{xLog:true,yLog:true});
  const windows=[];for(const axis of ['x','y']){const cfg=state.axes[axis];if(cfg.kind==='rate')windows.push([cfg.band,'rgba(101,88,166,.08)']);else windows.push([cfg.soft,'rgba(18,127,152,.08)'],[cfg.hard,'rgba(179,102,35,.08)']);}
  for(const [window,color]of windows){ctx.fillStyle=color;ctx.fillRect(a.x(window[0]),a.m.t,a.x(window[1])-a.x(window[0]),a.ph);}
  ctx.save();ctx.beginPath();ctx.rect(a.m.l,a.m.t,a.pw,a.ph);ctx.clip();ctx.strokeStyle='#2e5066';ctx.lineWidth=1.3;ctx.beginPath();let last=false;
  for(const p of values){if(p.rate<=0){last=false;continue;}const y=a.y(p.rate);if(last)ctx.lineTo(a.x(p.lo),y);else ctx.moveTo(a.x(p.lo),y);ctx.lineTo(a.x(p.hi),y);last=true;}ctx.stroke();ctx.restore();
  $('#spectrum-summary').textContent=`${included.length} segments from ${new Set(included.map(row=>row.segment.obsid)).size} included observations · ${fmt(totalWeight/1000,2)} ks good time`;
}
function draw(){
  if(!data)return;drawHid();drawSpectrum();showDetails();const included=points.filter(p=>visibleObs.has(p.obsid)),valid=included.filter(p=>p.valid).length;
  $('#point-count').textContent=`${valid} / ${included.length} included segments${valid<included.length?` · ${included.length-valid} invalid for selected color bands`:''}`;
  $('#plot-caption').textContent=`${visibleObs.size} of ${datasets.size} observations included · ${data.segment_seconds} s target segments${state.module==='AB'?'':` · FPM${state.module}`} · background + dead-time corrected`;
}
function choose(i){state.selected=clamp(i,0,data.segments.length-1);draw();}
function nearest(e){const rect=$('#hid').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;let best=null,d=144;for(const p of screenPoints){const dist=(p.px-x)**2+(p.py-y)**2;if(dist<d){d=dist;best=p;}}return best;}
$('#hid').addEventListener('pointermove',e=>{const position=swanPointer(e),tip=$('#tooltip');if(swanDrag||hitSwan(position.x,position.y,position.w,position.h)){tip.hidden=true;return;}const p=nearest(e);if(!p){tip.hidden=true;return;}const row=prepared[p.i],s=row.segment;tip.innerHTML=`<strong>${escape(row.observation.date_obs.slice(0,10))}</strong> · ${escape(s.obsid)} · segment ${s.id+1}<br>${fmt((s.start-row.observation.time_origin_met)/1000,2)} ks since observation start<br>X ${fmt(p.x,3)} ± ${fmt(p.xe,3)}<br>Y ${fmt(p.y,3)} ± ${fmt(p.ye,3)}`;
  tip.hidden=false;tip.style.left=`${clamp(p.px+20,10,$('.chart-wrap').clientWidth-tip.offsetWidth-10)}px`;tip.style.top=`${clamp(p.py-30,10,$('.chart-wrap').clientHeight-tip.offsetHeight-10)}px`;});
$('#hid').addEventListener('pointerleave',()=>$('#tooltip').hidden=true);$('#hid').addEventListener('click',e=>{if(swanConsumedClick){swanConsumedClick=false;return;}const p=nearest(e);if(p)choose(p.i);});
$('#reset').onclick=()=>{state.axes=defaultAxes();schedule();};
for(const axis of ['x','y'])$(`#${axis}-kind`).onchange=e=>{state.axes[axis].kind=e.target.value;schedule();};
$('#errors').onchange=e=>{state.errors=e.target.checked;draw();};$('#module').onchange=e=>{state.module=e.target.value;rebuild();schedule();};
$('#swan-overlay').onchange=e=>{swanEnabled=e.target.checked;swanDrag=null;$('#hid').style.cursor='';$('#swan-controls').disabled=!swanEnabled;drawSwan();};
$('#swan-reverse').onchange=e=>{swanReversed=e.target.checked;swanDrag=null;$('#hid').style.cursor='';drawSwan();};
$('#cygnet-count').onchange=e=>{cygnetCount=Number(e.target.value);drawSwan();};
$('#reset-swan').onclick=()=>{swan=freshSwan();drawSwan();};
function showDetails(){
  const observation=prepared[state.selected].observation,key=observation.obsid+':'+revisions.get(observation.obsid);
  if(detailsKey===key)return;detailsKey=key;
  const rows=[['Observation',observation.obsid],['Segments',observation.segments.length],['Native channels','675 in 3–30 keV'],['Source radius',`${observation.provenance.A.source_radius_arcsec} arcsec`],['Live exposure A',`${fmt(observation.segments.reduce((s,x)=>s+x.exposure_A,0)/1000,2)} ks`],['Live exposure B',`${fmt(observation.segments.reduce((s,x)=>s+x.exposure_B,0)/1000,2)} ks`],['Excluded short GTIs',`${fmt(observation.excluded_short_gti_seconds,1)} s`]];
  $('#extraction').innerHTML=rows.map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('');
  $('#method').innerHTML=`<p>${escape(observation.intensity_definition)}</p><p>Each point stores a native-channel spectrum. Either axis can show a band count rate or a hard/soft color. Band edges snap to 0.04 keV boundaries within 3–30 keV; prefix sums evaluate every axis in constant time.</p><p>The total spectrum is weighted by segment elapsed time across the observations currently checked in the legend. Only common A/B good-time intervals are used. Short tails are merged within the same GTI; intervals shorter than ${observation.minimum_segment_seconds} s are excluded.</p>`+observation.limitations.map(s=>`<p>${escape(s)}</p>`).join('');
  $('#region-link').href=`./data/regions/${encodeURIComponent(observation.obsid)}.png`;
}
function rebuild(){
  const selected=prepared?.[state.selected]?.segment;
  const ordered=catalogRows.filter(row=>datasets.has(row.obsid));
  prepared=ordered.flatMap(row=>prepare(datasets.get(row.obsid),state.module));
  if(!prepared.length)return;
  const first=datasets.get(ordered[0].obsid);data={...first,segments:prepared.map(r=>r.segment)};
  state.selected=selected?Math.max(0,prepared.findIndex(r=>r.segment.obsid===selected.obsid&&r.segment.id===selected.id)):0;
  $('#observation-count').textContent=`${datasets.size} observations`;
  const days=ordered.map(row=>datasets.get(row.obsid).date_obs.slice(0,10)).sort();
  $('#date').textContent=`${days[0]}${days.at(-1)!==days[0]?' – '+days.at(-1):''} · ${fmt(ordered.reduce((sum,row)=>sum+datasets.get(row.obsid).retained_seconds,0)/1000,2)} ks good time`;
  $('#observation-legend').innerHTML=ordered.map(row=>{const observation=datasets.get(row.obsid),date=observation.date_obs.slice(0,10);return `<label class="legend-item" title="ObsID ${escape(row.obsid)}"><input type="checkbox" data-obsid="${escape(row.obsid)}" ${visibleObs.has(row.obsid)?'checked':''} aria-label="Include ${escape(date)} observation ${escape(row.obsid)}"><i class="legend-swatch" style="background:${escape(row.color)}"></i>${escape(date)} <small>(${observation.segments.length})</small></label>`;}).join('');
}
$('#observation-legend').addEventListener('change',e=>{const obsid=e.target.dataset.obsid;if(!obsid)return;if(e.target.checked)visibleObs.add(obsid);else visibleObs.delete(obsid);if(prepared[state.selected]&&!visibleObs.has(prepared[state.selected].segment.obsid)){const next=prepared.findIndex(row=>visibleObs.has(row.segment.obsid));if(next>=0)state.selected=next;detailsKey=null;}draw();});
async function getJSON(url){const response=await fetch(url);if(!response.ok)throw new Error((await response.text()).slice(0,200));return response.json();}
async function initialize(){
  if(location.protocol==='file:'){
    $('#loading').textContent='This site is ready to use, but browsers cannot load bundled spectra from a file URL. Open it through your website or any local web server.';
    $('#loading').style.color='#9a332b';
    return;
  }
  try{
    const observations=await Promise.all(catalogRows.map(row=>getJSON(row.file)));
    for(let index=0;index<catalogRows.length;index++){
      const row=catalogRows[index],observation=observations[index];
      if(observation.schema_version!==1||!observation.segments.length||observation.obsid!==row.obsid)throw new Error(`Invalid spectra for ${row.obsid}`);
      datasets.set(row.obsid,observation);revisions.set(row.obsid,'bundled');colors.set(row.obsid,row.color);visibleObs.add(row.obsid);
    }
    rebuild();$('#workspace').hidden=false;$('#loading').hidden=true;updateControls();recalculate();
  }catch(e){
    $('#loading').textContent=`Unable to load bundled spectra: ${e.message}`;$('#loading').style.color='#9a332b';
  }
}
setupWindows();setupSwan();updateControls();
new ResizeObserver(()=>draw()).observe($('.plot-panel'));
initialize();
