// A lightweight near-ground precipitation layer; cloud volume remains the depth cue behind it.
(() => {
  const states=new WeakMap();
  window.drawGroundRain=(frame,id,reduced=false)=>{
    let state=states.get(frame);
    if(![3,4].includes(id)||reduced){if(state)state.canvas.style.display='none';return;}
    if(!state){
      const canvas=document.createElement('canvas');canvas.className='spot-rain';canvas.setAttribute('aria-hidden','true');frame.append(canvas);
      state={canvas,ctx:canvas.getContext('2d'),time:performance.now(),drops:Array.from({length:65},()=>({x:Math.random(),y:Math.random(),depth:.3+Math.random()*.7}))};states.set(frame,state);
    }
    state.canvas.style.display='block';
    const w=frame.clientWidth,h=frame.clientHeight;if(!w||!h)return;
    if(state.canvas.width!==w||state.canvas.height!==h){state.canvas.width=w;state.canvas.height=h;}
    const now=performance.now(),dt=Math.min(.05,(now-state.time)/1000);state.time=now;
    const ctx=state.ctx;ctx.clearRect(0,0,w,h);ctx.lineWidth=.65;
    for(const d of state.drops){d.y+=dt*(.7+d.depth);d.x-=dt*.02;if(d.y>1){d.y=-.02;d.x=Math.random();}const y=d.y*h;if(y<h*.24)continue;
      ctx.strokeStyle=`rgba(228,237,247,${.09+d.depth*.22})`;ctx.beginPath();ctx.moveTo(d.x*w,y);ctx.lineTo(d.x*w+.4,y-(3+d.depth*8));ctx.stroke();}
  };
})();
