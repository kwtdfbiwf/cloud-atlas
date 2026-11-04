// Small deterministic water simulation in CSS pixels; independent of rendering.
export const MAX_DROPS = 24;
const random = seed => { let n=seed;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;}; };
export function createDropField(){
 let width=0,height=0,stationary=[],runners=[],lastTime=0,merges=0;
 function reset(w,h){
  width=w;height=h;lastTime=0;merges=0;const r=random(7281);
  stationary=Array.from({length:13},(_,i)=>({
   x:i%2?w-9-r()*10:8+r()*11,y:h*(.07+r()*.86),
   rx:2+r()*2.4,ry:3+r()*4.2,hiddenUntil:-1
  }));
  // A small bead lies in a runner's path so it can collect water naturally.
  stationary.push({x:12,y:h*.36+14,rx:2.6,ry:3.4,hiddenUntil:-1});
  stationary.push({x:w-14,y:h*.66+26,rx:2.1,ry:3.5,hiddenUntil:-1});
  runners=[{x:12,start:.36,cycle:39,offset:0,rx:5.5,cycleIndex:-1,mass:0},
           {x:w-14,start:.66,cycle:49,offset:6,rx:4.7,cycleIndex:-1,mass:0}];
 }
 return {sample(w,h,time,reduced=false){
  if(w!==width||h!==height)reset(w,h);
  const t=reduced?lastTime:Math.max(lastTime,time);lastTime=t;
  const moving=[];
  for(const run of runners){
   const clock=t+run.offset,cycleIndex=Math.floor(clock/run.cycle),phase=clock%run.cycle;
   if(run.cycleIndex!==cycleIndex){run.cycleIndex=cycleIndex;run.mass=run.rx*run.rx;}
   const p=Math.max(0,(phase-2)/(run.cycle-2));
   const y=h*run.start+(h+18-h*run.start)*Math.pow(p,1.55);
   let rx=Math.min(7,Math.sqrt(run.mass)),ry=rx*(1.45+p*.45);
   if(!reduced){for(const bead of stationary){
    if(bead.hiddenUntil>t)continue;
    if(Math.hypot((bead.x-run.x)*1.1,bead.y-y)<rx+bead.rx){
     bead.hiddenUntil=t+18;run.mass+=bead.rx*bead.rx*.7;merges++;
    }
   }}
   rx=Math.min(7,Math.sqrt(run.mass));ry=rx*(1.45+p*.45);
   moving.push({x:run.x,y,rx,ry,amount:1});
   if(p>.01)moving.push({x:run.x+.3,y:y-ry-5,rx:.6,ry:8,amount:.18});
  }
  const drops=stationary.filter(d=>d.hiddenUntil<=t).map(d=>({...d,amount:1})).concat(moving).slice(0,MAX_DROPS);
  return {drops,merges,time:t};
 }};
}
