// Longer reading has its own dialog, keeping desktop cards free of nested scrolling.
(()=>{
 const dialog=document.createElement('dialog');dialog.id='cloud-details';dialog.setAttribute('aria-labelledby','cloud-details-title');document.body.append(dialog);
 let opener=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-cloud-details]');if(!button)return;
  const c=window.CLOUDS.find(c=>c.id===Number(button.dataset.cloudDetails));if(!c)return;opener=button;
  dialog.dataset.cloud=String(c.id);
  dialog.innerHTML=`<button class="details-close" type="button" aria-label="Close cloud details">×</button><h2 id="cloud-details-title">${esc(c.name)}</h2><p class="latin">${esc(c.latin)}</p><figure class="details-ground"><img src="${esc(c.image)}" alt="${esc(c.look)}"/><figcaption>From the ground</figcaption></figure><dl class="details-facts"><div><dt>Typical base</dt><dd>${esc(c.base)}</dd></div><div><dt>Made of</dt><dd>${esc(c.made)}</dd></div></dl>${[['How to spot it',c.spot],['How it forms',c.desc],['Weather',c.weather],['Did you know?',c.fact]].map(([label,text])=>`<section><h3>${label}</h3><p>${esc(text)}</p></section>`).join('')}`;
  dialog.querySelector('.details-close').onclick=()=>dialog.close();dialog.showModal();
  // Keep the ground view available as optional reading, in the same sky style.
  const spotter=window.Scene3D?.spotter;
  if(spotter)spotter.capture(c.id,900,450).then(src=>{
   if(dialog.open&&dialog.dataset.cloud===String(c.id))dialog.querySelector('.details-ground img').src=src;
  }).catch(()=>{});
 });
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>opener?.isConnected&&opener.focus({preventScroll:true}));
})();
