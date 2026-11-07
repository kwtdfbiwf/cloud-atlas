// SardineFish/raindrop-fx (MIT) runs the simulation and refraction renderer.
// The local bundle adds a transparent composition option, documented in vendor/raindrop-fx/README.txt.
export function createWindowRain() {
  const canvas=document.createElement('canvas');
  canvas.id='window-rain';canvas.setAttribute('aria-hidden','true');
  document.querySelector('#sky3d').after(canvas);
  const source=document.createElement('canvas'),ctx=source.getContext('2d',{alpha:false});
  let fx=null,loading=null,failed=false,clock=0,lastDraw=-1,lastUpload=-1,lastWet=-10,frames=0;
  let width=0,height=0;
  const art=new Map();
  // These beads use the same normal-map water renderer but never enter the falling simulation.
  const beadLayout=[[.11,.10,60],[.87,.08,76],[.95,.25,48],[.045,.49,65],[.92,.60,78],[.09,.77,56],[.94,.88,68],[.48,.71,48]];
  let fixedBeads=[];
  function stationaryBeads(id) {
    if(id!==3&&id!==4&&!document.body.hasAttribute('data-personal-sky'))return [];
    const card=document.querySelector('.personal-layer.is-current .card')||document.querySelector(`.tier[data-tier="${id===3?'low':'mid'}"] .card`);
    const template=fx.simulator.raindrops[0];
    if(!card||!template)return [];
    const rect=card.getBoundingClientRect(),scaleX=width/innerWidth,scaleY=height/innerHeight;
    if(!fixedBeads.length)fixedBeads=beadLayout.map(([, ,size])=>new template.constructor(fx.simulator,template.pos.clone(),size));
    const visible=[];
    fixedBeads.forEach((drop,i)=>{
      const [u,v,size]=beadLayout[i];
      drop.pos.x=(rect.left+rect.width*u)*scaleX;
      drop.pos.y=(innerHeight-rect.top-rect.height*v)*scaleY;
      drop.mass=Math.pow(size*Math.min(scaleX,scaleY),2);
      if(drop.pos.y>=0&&drop.pos.y<=height)visible.push(drop);
    });
    canvas.dataset.stationary=String(visible.length);
    canvas.dataset.beadPositions=visible.map(d=>`${d.pos.x.toFixed(1)},${d.pos.y.toFixed(1)}`).join(';');
    return visible;
  }
  function loadArt() {
    for(const id of ['night-moon','night-stars','day-sun']) {
      const el=document.getElementById(id);
      if(!el)continue;
      const svg=(el.tagName.toLowerCase()==='svg'?el:el.querySelector('.day-sun-disc')).cloneNode(true);
      svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
      svg.setAttribute('width',id==='night-stars'?'1024':'96');
      svg.setAttribute('height',id==='night-stars'?'768':'96');
      svg.style.cssText='';
      svg.setAttribute('fill',id==='night-stars'?'#e5ebff':'#fff0d4');
      const img=new Image(),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
      img.onload=()=>{art.set(id,img);URL.revokeObjectURL(url);};img.onerror=()=>URL.revokeObjectURL(url);img.src=url;
    }
  }
  loadArt();
  function size() {
    const scale=Math.min(1,1280/innerWidth,900/innerHeight);
    const w=Math.max(1,Math.round(innerWidth*scale)),h=Math.max(1,Math.round(innerHeight*scale));
    if(w===width&&h===height)return;
    width=w;height=h;
    // A smaller, live refraction source keeps cross-context texture uploads bounded.
    source.width=Math.min(w,640);source.height=Math.round(source.width*h/w);
    if(fx)fx.resize(w,h);else{canvas.width=w;canvas.height=h;}
    lastUpload=-1;
  }
  function capture({background,sky}) {
    ctx.globalAlpha=1;ctx.drawImage(background,0,0,source.width,source.height);
    for(const id of ['night-stars','night-moon','day-sun']) {
      const el=document.getElementById(id),img=art.get(id);if(!el||!img)continue;
      const alpha=Number(getComputedStyle(el).opacity);if(alpha<.005)continue;
      const r=el.getBoundingClientRect();
      ctx.globalAlpha=alpha;
      ctx.drawImage(img,r.left/innerWidth*source.width,r.top/innerHeight*source.height,r.width/innerWidth*source.width,r.height/innerHeight*source.height);
    }
    ctx.globalAlpha=1;ctx.drawImage(sky,0,0,source.width,source.height);
  }
  async function initialize() {
    if(fx||failed||loading)return;
    loading=(async()=>{
      if(!window.RaindropFX)await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='vendor/raindrop-fx/raindrop-fx.js';script.onload=resolve;script.onerror=reject;document.head.append(script);
      });
      size();
      const instance=new window.RaindropFX({canvas,background:source,windowOverlay:true,
        // tuned to read clearly on a phone: more drops, stronger lensing, brighter glints, darker rims
        spawnSize:[48,88],spawnInterval:[.1,.2],spawnLimit:230,
        dropletsPerSeconds:70,dropletSize:[4,11],gravity:740,slipRate:.3,
        motionInterval:[.6,1.5],evaporate:5,backgroundBlurSteps:1,mist:false,
        smoothRaindrop:[.93,.99],refractBase:.34,refractScale:.55,
        raindropDiffuseLight:[.34,.35,.4],raindropShadowOffset:.66,
        raindropSpecularLight:[.62,.62,.58],raindropSpecularShininess:56});
      await instance.renderer.loadAssets();
      // Seed a few beads before the first visible frame, without running extra GPU frames.
      for(let i=0;i<24;i++)instance.simulator.update({dt:.1,total:i*.1});
      fx=instance;canvas.dataset.state='ready';
    })().catch(error=>{failed=true;canvas.dataset.state='unavailable';canvas.style.opacity='0';console.warn('Window rain unavailable:',error);});
    return loading;
  }
  return {render(frame) {
    try {
    clock+=Math.min(frame.dt,.05);
    const weatherDriven=frame.weatherRain!==null&&frame.weatherRain!==undefined;
    const wet=weatherDriven?Math.max(0,Math.min(1,frame.weatherRain)):(frame.id===3||frame.id===4)&&frame.activeId!==null?Math.max(0,Math.min(1,frame.visibility)):0;
    canvas.dataset.source=weatherDriven?'weather':'cloud';
    canvas.style.opacity=String(wet);
    canvas.dataset.active=wet>.01?'true':'false';
    if(wet>.01)lastWet=clock;
    if(failed||document.hidden||clock-lastWet>.7)return;
    size();
    if(!fx){capture(frame);initialize();return;}
    if(clock-lastUpload>=1/12||lastUpload<0){
      capture(frame);
      const r=fx.renderer;
      r.originalBackground.setData(source);
      r.renderer.blit(r.originalBackground,r.background);
      r.background.generateMipmap();r.blurBackground();
      lastUpload=clock;
    }
    if(clock-lastDraw<1/30)return;
    const dt=frame.reduced?0:Math.min(.07,lastDraw<0?1/30:clock-lastDraw);
    lastDraw=clock;
    fx.options.spawnInterval=weatherDriven?[.12/Math.max(.3,wet),.22/Math.max(.3,wet)]:frame.id===3?[.08,.15]:[.12,.22];
    const tick={dt,total:clock};
    fx.simulator.update(tick);
    fx.renderer.render([...fx.simulator.raindrops,...stationaryBeads(frame.id)],tick);
    if(++frames%30===0){canvas.dataset.drops=String(fx.simulator.raindrops.length);canvas.dataset.frames=String(frames);canvas.dataset.motion=frame.reduced?'still':'moving';}
    } catch(error) {
      if(!failed) console.warn('Window rain stopped:',error);
      failed=true;canvas.dataset.state='unavailable';canvas.style.opacity='0';
    }
  }};
}
