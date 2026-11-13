// One small discovery within the atlas, with an equivalent keyboard action.
(()=>{
 const state=window.HaloDiscovery={amount:0};
 const target=document.createElement('div');target.id='halo-veil-target';target.hidden=true;target.setAttribute('aria-hidden','true');target.innerHTML='<span>Ice veil</span>';
 const note=document.createElement('aside');note.id='halo-discovery';note.hidden=true;note.setAttribute('aria-label','Try the cirrostratus halo');
 note.innerHTML='<p class="halo-instruction" role="status" aria-live="polite"></p><button type="button">Place the sun in the veil</button>';
 document.body.append(target,note);
 const text=note.querySelector('p'),button=note.querySelector('button');let previous='',found=false;
 button.onclick=()=>{
  if(document.body.classList.contains('night-sky')){document.querySelector('#sky-theme').click();return;}
  const veil=window.HaloVeil;if(!veil?.visible)return;
  dispatchEvent(new CustomEvent('place-sun-in-veil',{detail:{x:veil.x,y:veil.y}}));
 };
 function frame(){
  const veil=window.HaloVeil,night=document.body.classList.contains('night-sky');
  const active=!!veil?.visible&&!!window.Scene3D?.ok&&!document.querySelector('dialog[open],.card.open');
  note.hidden=!active;
  if(!active){target.hidden=true;state.amount=0;requestAnimationFrame(frame);return;}
  const sun=window.SunLight,reduced=window.SkyPreferences?.reduced;
  const distance=sun?Math.hypot((sun.x-veil.x)/veil.rx,(sun.y-veil.y)/veil.ry):2;
  const desired=!night&&sun?.moved?Math.max(0,Math.min(1,(1-distance)*2)):0;
  state.amount=reduced?desired:state.amount+(desired-state.amount)*.16;
  if(state.amount<.002)state.amount=0;
  if(state.amount>.65)found=true;
  target.hidden=night||state.amount>.65;
  target.style.left=`${veil.x*100}%`;target.style.top=`${veil.y*100}%`;
  const mode=night?'night':found?'found':'invite';
  if(mode!==previous){
   previous=mode;
   text.textContent=night?'Try this in daylight: move the sun behind the ice veil.':found?'A halo! Ice crystals bend sunlight into a ring about 22° from the sun. Move the sun out of the veil and the ring fades.':'Move the sun into the ice veil. Can you reveal its ring of light?';
   button.textContent=night?'Switch to daylight':'Place the sun in the veil';
  }
  note.dataset.state=mode;document.body.dataset.haloDiscovered=String(found);
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
})();
