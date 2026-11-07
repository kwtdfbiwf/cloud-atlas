(() => {
  const clouds=window.CLOUDS, byId=Object.fromEntries(clouds.map(c=>[c.id,c]));
  const dialog=document.createElement('dialog');dialog.id='field-dialog';dialog.setAttribute('aria-labelledby','field-title');
  dialog.innerHTML='<button class="field-close" type="button" aria-label="Close field tools">×</button><h2 id="field-title">Your pocket field guide</h2><div class="field-menu"><button type="button" data-tool="sky">Your sky now</button><button type="button" data-tool="compare">Compare cloud sizes</button><button type="button" data-tool="quiz">Test your eye</button></div><div id="field-content"></div>';
  document.body.append(dialog);
  const content=dialog.querySelector('#field-content'), cache=new Map();let token=0,returnFocus=null,rainAnimation=0;
  addEventListener('skythemechange',()=>cache.clear());
  function close(){token++;dialog.close();returnFocus?.focus();}
  dialog.querySelector('.field-close').onclick=close;dialog.addEventListener('cancel',()=>{token++;});dialog.addEventListener('close',()=>{cancelAnimationFrame(rainAnimation);rainAnimation=0;returnFocus?.focus();});
  document.getElementById('field-tools-button').onclick=e=>{returnFocus=e.currentTarget;dialog.showModal();openTool('compare');};
  // other parts of the page can open a tool directly (e.g. the ground's "what's in your sky" link)
  document.querySelectorAll('[data-open-sky]').forEach(b=>b.addEventListener('click',()=>window.FieldTools.open('sky',b)));
  window.FieldTools={open(name,from){returnFocus=from||null;if(!dialog.open)dialog.showModal();openTool(name);}};
  if(new URLSearchParams(location.search).has('choose-sky'))setTimeout(()=>window.FieldTools.open('sky'),0);
  const tools={sky:()=>showSky(),compare:()=>showCompare(),quiz:()=>startQuiz()};
  function openTool(name){dialog.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===name)));tools[name]();}
  dialog.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>openTool(b.dataset.tool));
  async function picture(id){
    if(cache.has(id))return cache.get(id);
    const deadline=performance.now()+20000;
    while(!window.Scene3D?.ok && !window.Scene3D?.unavailable && performance.now()<deadline) await new Promise(resolve=>setTimeout(resolve,100));
    if(window.Scene3D?.ok&&window.Scene3D.spotter?.capture){
      try { const src=await window.Scene3D.spotter.capture(id);cache.set(id,src);return src; }
      catch(error){ console.warn('3D ground view unavailable',error); }
    }
    content.innerHTML='<p role="status">The 3D ground view could not load. Please reload and try again.</p>';
    return null;
  }
  function animateRain(){if(!dialog.open)return;dialog.querySelectorAll('[data-rain-id]').forEach(frame=>window.drawGroundRain(frame,+frame.dataset.rainId,window.SkyPreferences?.reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches));rainAnimation=requestAnimationFrame(animateRain);}
  dialog.addEventListener('toggle',()=>{cancelAnimationFrame(rainAnimation);rainAnimation=0;if(dialog.open)animateRain();});
  async function showCompare(){
    const current=++token;content.innerHTML='<p class="field-intro">Compare the apparent size of cloud elements from the ground. All three views use the same field of view.</p><p role="status">Preparing ground views…</p>';
    const ids=[1,5,9];const sources=[];
    for(const id of ids){const source=await picture(id);if(!source)return;sources.push(source);if(current!==token||!dialog.open)return;}
    content.innerHTML='<p class="field-intro">At arm’s length: a fist, a few fingers, or less than a fingertip. Similar patterns can be at very different heights.</p><div class="cloud-compare">'+ids.map((id,i)=>{const c=byId[id];return `<figure><div class="compare-view"><img src="${sources[i]}" alt="${c.look}"><span class="angular-marker" style="width:${c.scale.deg/91*100}%"></span></div><figcaption><h3>${c.name}</h3><p>${c.scale.label}</p><small>${c.base}</small></figcaption></figure>`;}).join('')+'</div><p class="field-note">Size bars are approximate angular guides, not measurements of physical cloud size. Cloud height ranges overlap.</p>';
  }
  const rounds=[{id:0,options:[0,2,7],tip:'Separate heaps and flatter bases are the key to cumulus.'},{id:7,options:[5,7,4],tip:'Fine, high, silky hooks identify cirrus.'},{id:4,options:[4,0,9],tip:'A dark continuous ceiling with steady precipitation points to nimbostratus.'},{id:9,options:[1,5,9],tip:'Tiny, bright grains without shaded undersides identify cirrocumulus.'}];
  let question=0,score=0;
  function startQuiz(){question=0;score=0;showQuestion();}
  async function showQuestion(){
    const current=++token;
    if(question===rounds.length){content.innerHTML=`<div class="quiz-result" role="status"><p>Field test complete</p><h3>${score} / ${rounds.length}</h3><p>${score===rounds.length?'Ready to read the sky.':'Keep looking up — these shapes become familiar with practice.'}</p><button type="button" id="quiz-again">Try again</button></div>`;content.querySelector('#quiz-again').onclick=startQuiz;return;}
    const round=rounds[question];content.innerHTML='<p role="status">Preparing a ground view…</p>';
    const source=await picture(round.id);if(!source)return;if(current!==token||!dialog.open)return;
    content.innerHTML=`<p class="field-intro">${question+1} / ${rounds.length} · Which cloud are you looking at?</p><figure class="quiz-cloud"><div class="compare-view" data-rain-id="${round.id}"><img src="${source}" alt="${byId[round.id].look}"></div></figure><div class="quiz-options">${round.options.map(id=>`<button type="button" data-answer="${id}">${byId[id].name}</button>`).join('')}</div><p id="quiz-feedback" role="status"></p><button id="quiz-next" type="button" hidden>Next cloud →</button>`;
    content.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{const correct=+b.dataset.answer===round.id;if(correct)score++;content.querySelectorAll('[data-answer]').forEach(option=>{option.disabled=true;option.classList.toggle('answer-correct',+option.dataset.answer===round.id);});content.querySelector('#quiz-feedback').textContent=`${correct?'That’s right.':'It’s '+byId[round.id].name+'.'} ${round.tip}`;const next=content.querySelector('#quiz-next');next.hidden=false;next.textContent=question===rounds.length-1?'See your result →':'Next cloud →';next.focus();});
    content.querySelector('#quiz-next').onclick=()=>{question++;showQuestion();};
  }
  // ---------------------------------------------------------------- your sky now
  // Live weather from Open-Meteo (free, no key, CC BY 4.0). There is no camera: the clouds are
  // estimated from the model's cloud cover at each level, the kind of rain, and air instability.
  const esc=t=>String(t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const SKY_KEY='cloud-atlas-sky-place';
  let skyPlace=null;try{skyPlace=JSON.parse(localStorage.getItem(SKY_KEY)||'null');}catch{}
  function skyShell(){
    return `<p class="field-intro">Choose a place to open your own sky journey. Scroll up through only the clouds estimated there, with weather for your chosen time.</p>
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
