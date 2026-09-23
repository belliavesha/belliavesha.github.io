export const DEFAULT_SNAIL = Object.freeze({
  center: Object.freeze({x: .50, y: .55}),
  headOffset: Object.freeze({x: -.24, y: -.25}),
  tailOffset: Object.freeze({x: .40, y: .17}),
  scale: 1,
  shellScaleX: 1,
  shellScaleY: 1,
});

export function freshSnail(){
  return {
    center: {...DEFAULT_SNAIL.center},
    headOffset: {...DEFAULT_SNAIL.headOffset},
    tailOffset: {...DEFAULT_SNAIL.tailOffset},
    scale: DEFAULT_SNAIL.scale,
    shellScaleX: DEFAULT_SNAIL.shellScaleX,
    shellScaleY: DEFAULT_SNAIL.shellScaleY,
  };
}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function moveSnailPart(snail,part,dx,dy){
  const next={...snail,center:{...snail.center},headOffset:{...snail.headOffset},tailOffset:{...snail.tailOffset}};
  if(part==='body'){
    next.center.x=clamp(next.center.x+dx,.08,.92);
    next.center.y=clamp(next.center.y+dy,.08,.92);
  }else if(part==='head'){
    const head={
      x:next.center.x+(next.headOffset.x+dx/next.scale)*next.scale,
      y:next.center.y+(next.headOffset.y+dy/next.scale)*next.scale,
    };
    const bounded={x:clamp(head.x,.04,.96),y:clamp(head.y,.04,.96)};
    next.headOffset.x=(bounded.x-next.center.x)/next.scale;
    next.headOffset.y=(bounded.y-next.center.y)/next.scale;
  }else if(part==='tail'){
    const tail={
      x:next.center.x+(next.tailOffset.x+dx/next.scale)*next.scale,
      y:next.center.y+(next.tailOffset.y+dy/next.scale)*next.scale,
    };
    const bounded={x:clamp(tail.x,.04,.96),y:clamp(tail.y,.04,.96)};
    next.tailOffset.x=(bounded.x-next.center.x)/next.scale;
    next.tailOffset.y=(bounded.y-next.center.y)/next.scale;
  }
  return next;
}

export function snailScaleFromPoint(center,point,baseDistance){
  return clamp(Math.hypot(point.x-center.x,point.y-center.y)/baseDistance,.45,2.15);
}

export function shellStretchFromPoint(centerCoordinate,pointerCoordinate,baseRadius,uniformScale){
  return clamp(Math.abs(pointerCoordinate-centerCoordinate)/(baseRadius*uniformScale),.42,2.25);
}

export function anchoredEllipse(left,bottom,baseRx,baseRy,scaleX,scaleY){
  const rx=baseRx*scaleX,ry=baseRy*scaleY;
  return {left,bottom,rx,ry,cx:left+rx,cy:bottom-ry,right:left+2*rx,top:bottom-2*ry};
}
