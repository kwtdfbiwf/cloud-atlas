// Small, optional experiments. The personal forecast keeps its weather-driven sky.
(()=>{
 'use strict';
 const state=window.CloudExperiments={id:null,growth:0,engaged:0,strike:false};
 const panel=document.createElement('aside');panel.id='cloud-experiment';panel.hidden=true;
 panel.setAttribute('aria-label','Try a cloud experiment');
 panel.innerHTML='<p class="experiment-copy" role="status" aria-live="polite"></p><div class="updraft-meter" aria-hidden="true"><i></i></div><div class="experiment-actions"><button type="button" class="feed-cloud">Hold to grow</button><button type="button" class="auto-cloud">Grow it for me</button></div>';
 document.body.append(panel);
 const copy=panel.querySelector('p'),hold=panel.querySelector('.feed-cloud'),auto=panel.querySelector('.auto-cloud'),meter=panel.querySelector('.updraft-meter');
 let holding=false,automatic=false,previous=performance.now(),mode='',keyboardHeld=false,fingerTried=false;
 const reset=()=>{holding=false;automatic=false;keyboardHeld=false;state.growth=0;state.engaged=0;state.strike=false;mode='';fingerTried=false;};
 const release=()=>{holding=false;keyboardHeld=false;};
 hold.addEventListener('pointerdown',e=>{if(e.button!==0||state.id===5||state.growth===1)return;e.preventDefault();hold.focus();hold.setPointerCapture(e.pointerId);holding=true;});
 ['pointerup','pointercancel','lostpointercapture'].forEach(type=>hold.addEventListener(type,release));
 hold.addEventListener('keydown',e=>{if(state.id===5||![' ','Enter'].includes(e.key))return;e.preventDefault();if(state.growth<1){holding=true;keyboardHeld=true;}});
 hold.addEventListener('keyup',e=>{if(state.id!==5&&[' ','Enter'].includes(e.key)){e.preventDefault();release();}});
 hold.addEventListener('blur',release);
 hold.addEventListener('click',e=>{if(state.id===5)openFingerTest();else if(e.detail===0&&!keyboardHeld)automatic=true;});
 auto.addEventListener('click',()=>{if(state.growth===1)reset();automatic=true;});
 addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden){release();automatic=false;}});
 function frame(now){
  const dt=Math.min(.05,(now-previous)/1000);previous=now;
  const view=window.CloudExperimentView;
  const id=view?.visible&&window.Scene3D?.ok&&[0,3,5].includes(view.id)?view.id:null;
  if(id!==state.id){reset();state.id=id;}
  const host=id!==null?document.querySelector(`[data-cloud-discovery="${id}"]`):null;
  const active=!!host&&!document.querySelector('dialog[open],.card.open');
  if(active&&panel.parentNode!==host)host.append(panel);
  panel.hidden=!active;
  if(!active){release();automatic=false;requestAnimationFrame(frame);return;}
  const reduced=window.SkyPreferences?.reduced;
  if(id!==5&&(holding||automatic)&&state.growth<1){
   state.engaged=reduced?1:Math.min(1,state.engaged+dt*3);
   state.growth=reduced?1:Math.min(1,state.growth+dt/(id===3?4.5:3));
   if(state.growth===1){automatic=false;holding=false;state.strike=id===3&&!reduced;}
  }
  const next=id+':'+fingerTried+':'+(state.growth===1?'done':state.growth>0?'growing':'invite');
  if(mode!==next){
   mode=next;
   copy.textContent=id===5?(fingerTried?'Altocumulus cloudlets look one to three fingers wide at arm’s length.':'One to three fingers wide? Try the finger test from the ground.'):id===0?(state.growth===1?'Warm air rises and cools, building the fluffy top above a level base.':state.growth>0?'Keep feeding the thermal. The top grows upwards; the flat base stays put.':'Give this cumulus a warm updraft. Hold to help its fluffy top grow.'):(state.growth===1?'At a stable layer, rising air spreads sideways into an anvil.':state.growth>0?'Keep the updraft going. Watch the tower rise and its icy top spread.':'Build a storm: hold to feed an updraft through the tower.');
   hold.textContent=id===5?(fingerTried?'Compare again':'Try the finger test'):id===3?'Hold to build':'Hold to grow';
   hold.hidden=id!==5&&state.growth===1;hold.disabled=hold.hidden;
   auto.textContent=state.growth===1?'Try again':'Grow it for me';
   if(hold.hidden&&document.activeElement===hold)auto.focus({preventScroll:true});
   auto.hidden=id===5;meter.hidden=id===5||state.growth===1;
  }
  meter.style.setProperty('--growth',state.growth);
  hold.dataset.holding=String(holding);
  panel.dataset.cloud=String(id);panel.dataset.complete=String(state.growth===1);
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);

 // A movable, angular-size guide over the ground view; no quiz or scoring.
 const dialog=document.createElement('dialog');dialog.id='finger-dialog';dialog.setAttribute('aria-labelledby','finger-title');
 dialog.innerHTML=`<button type="button" class="finger-close" aria-label="Close finger test">×</button><h2 id="finger-title">A little rule of thumb.</h2><p>At arm’s length, altocumulus cloudlets are roughly one to three fingers wide. Cirrocumulus is usually smaller than one.</p><div class="finger-tabs" role="group" aria-label="Compare cloudlets"><button type="button" data-cloud="5" aria-pressed="true">Altocumulus</button><button type="button" data-cloud="9" aria-pressed="false">Cirrocumulus</button></div><div class="finger-view"><img alt=""/><div class="finger-guide" aria-hidden="true"><svg viewBox="0 0 60 100" preserveAspectRatio="none"><path d="M4 100V34Q4 24 12 24Q20 24 20 34V17Q20 7 29 7Q38 7 38 17V28Q38 18 47 18Q56 18 56 28V100Z"/></svg><span>3 fingers</span></div></div><label class="finger-slider">Move your finger guide<input type="range" min="10" max="90" value="50" aria-label="Move finger guide across the cloudlets"/></label><p class="finger-caption" role="status"></p><p class="finger-note">An illustrated practice view. Try it outdoors with your own hand.</p>`;
 document.body.append(dialog);
 const image=dialog.querySelector('img'),guide=dialog.querySelector('.finger-guide'),slider=dialog.querySelector('input'),caption=dialog.querySelector('.finger-caption');
 let captureVersion=0;
 function moveGuide(){guide.style.left=slider.value+'%';}slider.addEventListener('input',moveGuide);
 dialog.querySelector('.finger-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{captureVersion++;requestAnimationFrame(()=>{if(state.id===5){panel.hidden=false;hold.focus();}});});
 async function showCloud(id){
  const version=++captureVersion;
  dialog.querySelectorAll('[data-cloud]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.cloud===id)));
  caption.textContent=id===5?'Altocumulus: shaded puffs, about one to three fingers wide.':'Cirrocumulus: finer grains, usually less than a finger wide.';
  image.alt=window.CLOUDS.find(c=>c.id===id).look;
  const spotter=window.Scene3D?.spotter;if(!spotter)return;
  try{
   const src=await spotter.capture(id,900,450);
   if(version!==captureVersion||!dialog.open)return;
   image.src=src;
   // 3 fingers ≈ 5 degrees. Preserve that angular width in this camera view.
   const width=Math.tan(2.5*Math.PI/180)/(Math.tan(spotter.vfov*Math.PI/360)*2)*100;
   guide.style.width=width+'%';
  }catch{caption.textContent='The ground view could not load. Close this and try again.';}
 }
 dialog.querySelectorAll('[data-cloud]').forEach(b=>b.onclick=()=>showCloud(+b.dataset.cloud));
 function openFingerTest(){fingerTried=true;dialog.showModal();moveGuide();showCloud(5);}
})();
