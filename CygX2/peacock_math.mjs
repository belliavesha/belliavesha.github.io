export const DEFAULT_PEACOCK = Object.freeze({
  center: Object.freeze({x: .49, y: .57}),
  headOffset: Object.freeze({x: -.10, y: -.34}),
  footOffsets: Object.freeze([
    Object.freeze({x: -.13, y: .31}),
    Object.freeze({x: .10, y: .31}),
  ]),
  scale: 1,
  tailScale: 1,
  tailSpread: 1.12,
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function freshPeacock(){
  return {
    center: {...DEFAULT_PEACOCK.center},
    headOffset: {...DEFAULT_PEACOCK.headOffset},
    footOffsets: DEFAULT_PEACOCK.footOffsets.map(point=>({...point})),
    scale: DEFAULT_PEACOCK.scale,
    tailScale: DEFAULT_PEACOCK.tailScale,
    tailSpread: DEFAULT_PEACOCK.tailSpread,
  };
}

export function movePeacockPart(peacock,part,dx,dy){
  const next={...peacock,center:{...peacock.center},headOffset:{...peacock.headOffset},footOffsets:peacock.footOffsets.map(point=>({...point}))};
  if(part==='body'){
    next.center.x=clamp(next.center.x+dx,.10,.90);
    next.center.y=clamp(next.center.y+dy,.10,.90);
  }else if(part==='head'){
    const point={x:next.center.x+(next.headOffset.x+dx/next.scale)*next.scale,y:next.center.y+(next.headOffset.y+dy/next.scale)*next.scale};
    const bounded={x:clamp(point.x,.04,.96),y:clamp(point.y,.04,.96)};
    next.headOffset={x:(bounded.x-next.center.x)/next.scale,y:(bounded.y-next.center.y)/next.scale};
  }else if(part.startsWith('leg-')){
    const index=Number(part.slice(4)),offset=next.footOffsets[index];
    if(offset){
      const point={x:next.center.x+(offset.x+dx/next.scale)*next.scale,y:next.center.y+(offset.y+dy/next.scale)*next.scale};
      const bounded={x:clamp(point.x,.04,.96),y:clamp(point.y,.08,.97)};
      next.footOffsets[index]={x:(bounded.x-next.center.x)/next.scale,y:(bounded.y-next.center.y)/next.scale};
    }
  }
  return next;
}

export function peacockScaleFromPoint(center,point,baseDistance){
  return clamp(Math.hypot(point.x-center.x,point.y-center.y)/baseDistance,.45,1.9);
}

export function tailScaleFromPoint(anchor,point,baseLength){
  return clamp(Math.hypot(point.x-anchor.x,point.y-anchor.y)/baseLength,.45,2.1);
}

export function tailSpreadFromPoint(anchor,point,axis=.04){
  const angle=Math.atan2(point.y-anchor.y,point.x-anchor.x);
  const delta=Math.atan2(Math.sin(angle-axis),Math.cos(angle-axis));
  return clamp(2*Math.abs(delta),.28,1.9);
}
