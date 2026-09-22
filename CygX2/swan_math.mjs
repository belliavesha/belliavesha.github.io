export const DEFAULT_SWAN = Object.freeze({
  body: Object.freeze({x: .64, y: .62}),
  head: Object.freeze({x: .42, y: .29}),
  wingAngle: -.12,
  wingScale: 1,
  bodyScaleX: 1,
  cygnetScales: Object.freeze([1,1]),
  cygnets: Object.freeze([
    Object.freeze({x: .27, y: .70}),
    Object.freeze({x: .82, y: .72}),
  ]),
});

export function freshSwan(){
  return {
    body: {...DEFAULT_SWAN.body},
    head: {...DEFAULT_SWAN.head},
    wingAngle: DEFAULT_SWAN.wingAngle,
    wingScale: DEFAULT_SWAN.wingScale,
    bodyScaleX: DEFAULT_SWAN.bodyScaleX,
    cygnetScales: [...DEFAULT_SWAN.cygnetScales],
    cygnets: DEFAULT_SWAN.cygnets.map(point=>({...point})),
  };
}

export function clampPoint(point, margin=.04){
  return {
    x: Math.max(margin, Math.min(1-margin, point.x)),
    y: Math.max(margin, Math.min(1-margin, point.y)),
  };
}

export function movePart(swan, part, dx, dy){
  const next={...swan,body:{...swan.body},head:{...swan.head},cygnets:swan.cygnets.map(point=>({...point})),cygnetScales:[...swan.cygnetScales]};
  if(part==='body')next.body=clampPoint({x:next.body.x+dx,y:next.body.y+dy},.12);
  else if(part==='head')next.head=clampPoint({x:next.head.x+dx,y:next.head.y+dy},.06);
  else if(part.startsWith('cygnet-')){
    const index=Number(part.slice(7));
    if(Number.isInteger(index)&&next.cygnets[index])next.cygnets[index]=clampPoint({x:next.cygnets[index].x+dx,y:next.cygnets[index].y+dy},.05);
  }
  return next;
}

export function angleFromPoint(center, point){
  return Math.atan2(point.y-center.y,point.x-center.x);
}

export function clampScale(value,min=.45,max=2.2){
  return Math.max(min,Math.min(max,value));
}

export function wingTransformFromPoint(anchor,point,baseVector){
  const dx=point.x-anchor.x,dy=point.y-anchor.y;
  return {
    angle:angleFromPoint(anchor,point)-Math.atan2(baseVector.y,baseVector.x),
    scale:clampScale(Math.hypot(dx,dy)/Math.hypot(baseVector.x,baseVector.y)),
  };
}

export function bodyStretchFromPoint(leftX,pointerX,baseWidth){
  return clampScale((pointerX-leftX)/baseWidth,.55,2.2);
}

export function cygnetScaleFromPoint(center,point,baseHeadDistance){
  return clampScale(Math.hypot(point.x-center.x,point.y-center.y)/baseHeadDistance,.5,2.25);
}

export function neckBezier(start,head){
  const end={x:head.x+.008,y:head.y+.032};
  const dx=end.x-start.x,dy=end.y-start.y,length=Math.max(.04,Math.hypot(dx,dy));
  const nx=-dy/length,ny=dx/length;
  return {
    start,end,
    c1:{x:start.x+dx*.30-nx*length*.30,y:start.y+dy*.30-ny*length*.30},
    c2:{x:start.x+dx*.70+nx*length*.17,y:start.y+dy*.70+ny*length*.17},
  };
}
