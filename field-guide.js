(() => {
  // "Your sky now": choose a place, then open its own sky journey (sky.html).
  const dialog=document.createElement('dialog');dialog.id='field-dialog';dialog.setAttribute('aria-labelledby','field-title');
  dialog.innerHTML='<button class="field-close" type="button" aria-label="Close">×</button><h2 id="field-title">Your sky now</h2><div id="field-content"></div>';
  document.body.append(dialog);
  const content=dialog.querySelector('#field-content');let token=0,returnFocus=null;
  function close(){token++;dialog.close();returnFocus?.focus();}
  dialog.querySelector('.field-close').onclick=close;dialog.addEventListener('cancel',()=>{token++;});dialog.addEventListener('close',()=>{returnFocus?.focus();});
  // buttons on the page open it (the ground's "See what's above you" link, the top's "What's in your sky today?")
  window.FieldTools={open(name,from){returnFocus=from||null;if(!dialog.open)dialog.showModal();showSky();}};
  document.querySelectorAll('[data-open-sky]').forEach(b=>b.addEventListener('click',()=>window.FieldTools.open('sky',b)));
  // the sky page's "Change place" link comes back here with ?choose-sky
  if(new URLSearchParams(location.search).has('choose-sky'))setTimeout(()=>window.FieldTools.open('sky'),0);
  // ---------------------------------------------------------------- your sky now
  // Live weather from Open-Meteo (free, no key, CC BY 4.0). There is no camera: the clouds are
  // estimated from the model's cloud cover at each level, the kind of rain, and air instability.
  const esc=t=>String(t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const SKY_KEY='cloud-atlas-sky-place';
  let skyPlace=null;try{skyPlace=JSON.parse(localStorage.getItem(SKY_KEY)||'null');}catch{}
  function skyShell(){
    return `<p class="field-intro">Choose a place for your own sky journey. Weather data suggests likely cloud types; it doesn’t directly identify the clouds overhead.</p>
    <form class="sky-search" role="search"><button type="button" class="sky-locate">Use my location</button><label class="sky-field"><span class="sr-only">Town or city</span><input type="search" name="q" placeholder="Or type a town or city" autocomplete="off" required></label><button type="submit">Search</button></form>
    <ul class="sky-places" hidden></ul><div class="sky-result" aria-live="polite"></div>`;
  }
  function showSky(){
    ++token;content.innerHTML=skyShell();
    const form=content.querySelector('.sky-search'),places=content.querySelector('.sky-places'),result=content.querySelector('.sky-result');
    content.querySelector('.sky-locate').onclick=()=>{
      if(!navigator.geolocation){result.innerHTML='<p class="sky-status">Your browser can’t share its location. Try searching instead.</p>';return;}
      result.innerHTML='<p class="sky-status">Finding you…</p>';places.hidden=true;
      navigator.geolocation.getCurrentPosition(pos=>{
        // two decimals (about 1 km) is plenty for weather, and keeps your exact spot private
        loadSky({name:'Your location',lat:+pos.coords.latitude.toFixed(2),lon:+pos.coords.longitude.toFixed(2)});
      },err=>{result.innerHTML=`<p class="sky-status">${err.code===1?'Location access was turned off. You can allow it in your browser settings, or search for a place instead.':'Your location couldn’t be found. Try searching instead.'}</p>`;},{timeout:12000,maximumAge:600000});
    };
    form.onsubmit=async e=>{
      e.preventDefault();const q=form.q.value.trim();if(!q)return;
      const current=++token;result.innerHTML='<p class="sky-status">Searching…</p>';places.hidden=true;
      try{
        const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
        const data=await r.json();if(current!==token)return;
        const list=data.results||[];
        if(!list.length){result.innerHTML=`<p class="sky-status">No places called “${esc(q)}”. Check the spelling, or try a bigger town nearby.</p>`;return;}
        if(list.length===1){choose(list[0]);return;}
        result.innerHTML='';places.hidden=false;
        places.innerHTML=list.map((p,i)=>`<li><button type="button" data-i="${i}"><b>${esc(p.name)}</b> ${esc([p.admin1,p.country].filter(Boolean).join(', '))}</button></li>`).join('');
        places.querySelectorAll('button').forEach(b=>b.onclick=()=>choose(list[+b.dataset.i]));
        places.querySelector('button').focus();
      }catch{if(current===token)result.innerHTML='<p class="sky-status">The place search isn’t answering. Check your connection and try again.</p>';}
    };
    function choose(p){places.hidden=true;loadSky({name:p.name,region:[p.admin1,p.country].filter(Boolean).join(', '),lat:+p.latitude.toFixed(2),lon:+p.longitude.toFixed(2)});}
    if(skyPlace){
      const resume=document.createElement('button');resume.type='button';resume.className='sky-resume';
      resume.textContent='Open the sky over '+skyPlace.name+' →';resume.onclick=()=>loadSky(skyPlace);result.append(resume);
    }
  }
  function loadSky(place){
    try{localStorage.setItem(SKY_KEY,JSON.stringify(place));}catch{}
    const url=new URL('sky.html',location.href);
    for(const [key,value] of Object.entries(place))url.searchParams.set(key,String(value));
    location.assign(url.href);
  }
})();
