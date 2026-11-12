// Longer reading has its own dialog, keeping desktop cards free of nested scrolling.
(()=>{
 const dialog=document.createElement('dialog');dialog.id='cloud-details';dialog.setAttribute('aria-labelledby','cloud-details-title');document.body.append(dialog);
 let opener=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-cloud-details]');if(!button)return;
  const c=window.CLOUDS.find(c=>c.id===Number(button.dataset.cloudDetails));if(!c)return;opener=button;
  dialog.innerHTML=`<button class="details-close" type="button" aria-label="Close cloud details">×</button><h2 id="cloud-details-title">${esc(c.name)}</h2><p class="latin">${esc(c.latin)}</p>${[['How to spot it',c.spot],['How it forms',c.desc],['Did you know?',c.fact]].map(([label,text])=>`<section><h3>${label}</h3><p>${esc(text)}</p></section>`).join('')}`;
  dialog.querySelector('.details-close').onclick=()=>dialog.close();dialog.showModal();
 });
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>opener?.isConnected&&opener.focus({preventScroll:true}));
})();
