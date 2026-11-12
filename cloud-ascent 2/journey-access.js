// Keep the complete narrative readable, but skip controls in visually absent sections.
(()=>{
 const saved=new WeakMap();let last=0;
 function update(now){
  if(now-last<100){requestAnimationFrame(update);return;}last=now;
  for(const section of document.querySelectorAll('#journey>section,#personal-journey>section')){
   const r=section.getBoundingClientRect(),inner=section.querySelector('.stick,.personal-panel,.stage-inner,.personal-intro,.inter-inner')||section;
   const box=inner.getBoundingClientRect();
   const visible=r.bottom>0&&r.top<innerHeight&&box.bottom>0&&box.top<innerHeight;
   const active=visible&&(!section.classList.contains('tier')||section.querySelector('.stick.live'))&&(!section.classList.contains('personal-layer')||section.classList.contains('is-current'));
   for(const control of section.querySelectorAll('button,a[href],input,select,textarea,summary')){
    if(!active){if(!saved.has(control))saved.set(control,control.getAttribute('tabindex'));if(control.getAttribute('tabindex')!=='-1')control.setAttribute('tabindex','-1');}
    else if(saved.has(control)){
     const original=saved.get(control);saved.delete(control);
     if(control.getAttribute('role')==='tab')control.tabIndex=control.getAttribute('aria-selected')==='true'?0:-1;
     else original===null?control.removeAttribute('tabindex'):control.setAttribute('tabindex',original);
    }
   }
  }
  requestAnimationFrame(update);
 }
 requestAnimationFrame(update);
})();
