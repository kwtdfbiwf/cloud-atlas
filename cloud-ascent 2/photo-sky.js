(()=>{
 const layer=document.createElement('div');layer.id='photo-sky';layer.setAttribute('aria-label','Photographic cloud view');
 const image=document.createElement('img');image.alt='';layer.append(image);document.body.append(layer);let lastId=null;
 window.PhotoSky={render({alt=0,activeId=null,weatherRain=null}){
  document.body.classList.add('photo-mode');document.body.dataset.skyMode='photographic';
  document.querySelectorAll('.spotter-canvas').forEach(c=>c.remove());
  const cloud=window.CLOUDS.find(c=>c.id===activeId);
  if(cloud&&lastId!==cloud.id){lastId=cloud.id;image.src=cloud.image;image.alt=cloud.look;}
  layer.classList.toggle('visible',!!cloud);
  const night=document.body.classList.contains('night-sky'),f=Math.min(1,alt/12500),sky=document.querySelector('#vector-sky');
  sky.style.background=night?'linear-gradient(#111a39,#354571)':`linear-gradient(hsl(226 60% ${56-f*24}%),hsl(218 72% ${79-f*15}%))`;
  // The same photographs remain visible in the ground-view cards if 3D cannot run.
  document.querySelectorAll('.ground-photo').forEach(e=>e.style.opacity='1');
  document.querySelector('#sky-status').hidden=true;
 }};
})();
