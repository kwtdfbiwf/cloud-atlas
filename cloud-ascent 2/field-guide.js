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
  const WEATHER={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'};
  const COMPASS=['N','NE','E','SE','S','SW','W','NW'];
  const SKY_KEY='cloud-atlas-sky-place';
  let skyPlace=null;try{skyPlace=JSON.parse(localStorage.getItem(SKY_KEY)||'null');}catch{}
  // Which genera fit one hour of model data. Cu 0, Sc 1, St 2, Cb 3, Ns 4, Ac 5, As 6, Ci 7, Cs 8, Cc 9.
  function inferClouds(h){
    const out=new Map(),add=(id,level,why)=>{const old=out.get(id);if(!old||(old.level==='possible'&&level==='likely'))out.set(id,{id,level,why});};
    const {low=0,mid=0,high=0,code=0,cape=0}=h,vis=h.vis??1e5;
    const thunder=[95,96,99].includes(code),showers=[80,81,82,85,86].includes(code),
      steady=[61,63,65,66,67,71,73,75,77].includes(code),drizzle=[51,53,55,56,57].includes(code),fog=[45,48].includes(code),
      snow=[71,73,75,77,85,86].includes(code);
    if(thunder)add(3,'likely','Thunderstorms are being reported');
    else if(showers&&cape>=800)add(3,'possible','Heavy showers in very unstable air');
    else if(cape>=1500&&low>=20)add(3,'possible','Unstable air that could build storm towers');
    if(steady&&(mid>=50||low>=70))add(4,'likely',`Steady ${snow?'snow':'rain'} from a thick, dark layer`);
    if(fog)add(2,'likely','Fog is stratus touching the ground');
    else if(drizzle)add(2,'likely','Drizzle falls from low stratus');
    else if(low>=80&&vis<5000)add(2,'likely','A low, even sheet with poor visibility');
    if(showers)add(0,'likely','Showers fall from growing cumulus');
    if(low>=10&&!steady&&!fog&&!drizzle){
      if(cape>=150&&low<75)add(0,'likely','Rising warm air is building heaps');
      else if(low>=40)add(1,'likely',`A lumpy low layer over ${low}% of the sky`);
      else add(cape>=50?0:1,'possible',`Some low cloud (${low}% of the sky)`);
    }
    if(mid>=60&&!steady)add(6,'likely',`A grey mid-level veil over ${mid}% of the sky`);
    else if(mid>=15&&!steady)add(5,mid>=30?'likely':'possible',`Mid-level patches over ${mid}% of the sky`);
    if(high>=60)add(8,'likely',`A thin, milky ice veil over ${high}% of the sky`);
    else if(high>=10)add(7,high>=25?'likely':'possible',`Wisps of high ice cloud over ${high}% of the sky`);
    if(high>=15&&high<60&&mid<15&&low<15)add(9,'possible','High cloud this thin sometimes breaks into tiny ripples');
    // a thick low deck (or steady rain) hides whatever sits above it
    const lid=low>=85||steady;
    out.forEach(c=>{c.hidden=lid&&CLOUD_TIER[c.id]!=='low'&&c.id!==4;});
    return [...out.values()].sort((a,b)=>(a.hidden-b.hidden)||(a.level==='likely'?-1:1)+(b.level==='likely'?1:-1)||ORDER.indexOf(a.id)-ORDER.indexOf(b.id));
  }
  const CLOUD_TIER=Object.fromEntries(clouds.map(c=>[c.id,c.tier]));
  const ORDER=[3,4,0,1,2,5,6,7,8,9];
  function skyShell(){
    return `<p class="field-intro">Choose a place to see the weather there right now, and which of the ten clouds are likely in its sky.</p>
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
    if(skyPlace)loadSky(skyPlace);
  }
  async function loadSky(place){
    const result=content.querySelector('.sky-result');if(!result)return;
    const current=++token;skyPlace=place;try{localStorage.setItem(SKY_KEY,JSON.stringify(place));}catch{}
    result.innerHTML=`<p class="sky-status">Reading the sky over ${esc(place.name)}…</p>`;
    const url='https://api.open-meteo.com/v1/forecast?latitude='+place.lat+'&longitude='+place.lon+
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,is_day'+
      '&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,weather_code,cape,visibility,freezing_level_height,precipitation_probability'+
      '&forecast_days=1&timezone=auto';
    let w;
    try{const r=await fetch(url);if(!r.ok)throw 0;w=await r.json();}
    catch{if(current===token)result.innerHTML='<p class="sky-status">The weather service isn’t answering. Check your connection and try again.</p>';return;}
    if(current!==token||!dialog.open)return;
    const H=w.hourly,cur=w.current,nowHour=cur.time.slice(0,13)+':00';
    let ni=H.time.indexOf(nowHour);if(ni<0)ni=H.time.length-1;
    const hour=i=>({low:H.cloud_cover_low[i],mid:H.cloud_cover_mid[i],high:H.cloud_cover_high[i],code:H.weather_code[i],cape:H.cape[i],vis:H.visibility[i]});
    // right now: the live cover and weather, with stability and visibility from this hour
    const now=inferClouds({...hour(ni),low:cur.cloud_cover_low,mid:cur.cloud_cover_mid,high:cur.cloud_cover_high,code:cur.weather_code});
    // earlier today: when each cloud type was likely in the sky
    const seen=new Map();
    for(let i=0;i<ni;i++)inferClouds(hour(i)).filter(c=>c.level==='likely'&&!c.hidden).forEach(c=>{const runs=seen.get(c.id);const run=runs?.at(-1);if(run&&i-run.last<=3)run.last=i;else if(runs)runs.push({first:i,last:i});else seen.set(c.id,[{first:i,last:i}]);});
    const hh=i=>H.time[i].slice(11,16),until=i=>i+1>=H.time.length?'24:00':hh(i+1);
    const visible=now.filter(c=>!c.hidden),hidden=now.filter(c=>c.hidden);
    const km=m=>m>=10000?`${Math.round(m/1000)} km`:m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m)} m`;
    const vis=H.visibility[ni],freeze=H.freezing_level_height[ni],rainChance=H.precipitation_probability[ni];
    const layer=(label,range,v)=>`<div class="sky-layer"><span>${label}<small>${range}</small></span><div class="sky-bar"><i style="width:${v}%"></i></div><b>${v}%</b></div>`;
    const cloudCard=c=>{const k=byId[c.id];return `<li class="sky-cloud${c.hidden?' is-hidden':''}"><div class="sky-thumb" data-thumb="${c.id}"></div><div><p class="sky-tag ${c.level}">${c.hidden?'Above the low cloud':c.level==='likely'?'Likely':'Possible'}</p><h4>${k.name} <small>${k.abbr}</small></h4><p>${esc(c.why)}${c.hidden?'. You probably can’t see it from the ground.':'.'}</p><button type="button" class="sky-visit" data-visit="${c.id}">See it in the atlas →</button></div></li>`;};
    const where=[place.name,place.region].filter(Boolean).join(', ');
    result.innerHTML=`<section class="sky-report">
      <header class="sky-head"><div><p class="sky-place">${esc(where)} · ${cur.time.slice(11,16)} local time</p><h3>${WEATHER[cur.weather_code]??'Cloudy'}, ${Math.round(cur.temperature_2m)}°C</h3></div><button type="button" class="sky-change">Change place</button></header>
      <dl class="sky-stats">
        <div><dt>Feels like</dt><dd>${Math.round(cur.apparent_temperature)}°C</dd></div>
        <div><dt>Wind</dt><dd>${Math.round(cur.wind_speed_10m)} km/h ${COMPASS[Math.round(cur.wind_direction_10m/45)%8]}</dd></div>
        <div><dt>Humidity</dt><dd>${cur.relative_humidity_2m}%</dd></div>
        <div><dt>Chance of rain</dt><dd>${rainChance??'–'}%</dd></div>
        <div><dt>Visibility</dt><dd>${vis==null?'–':km(vis)}</dd></div>
        <div><dt>Freezing level</dt><dd>${freeze==null?'–':km(freeze)}</dd></div>
      </dl>
      <h4 class="sky-sub">Cloud cover by level <span>${cur.cloud_cover}% overall</span></h4>
      <div class="sky-layers">${layer('High','5–13 km',cur.cloud_cover_high)}${layer('Middle','2–7 km',cur.cloud_cover_mid)}${layer('Low','0–2 km',cur.cloud_cover_low)}</div>
      <h4 class="sky-sub">In the sky right now</h4>
      ${cur.is_day?'':'<p class="sky-note">It’s dark there now, so these clouds are hard to see. Look for them blotting out the stars, or lit orange by streetlights.</p>'}
      ${now.length?`<ul class="sky-clouds">${[...visible,...hidden].map(cloudCard).join('')}</ul>`:'<p class="sky-clear">A clear sky. There are no clouds to spot right now. Try again later, or pick another place.</p>'}
      ${ni>0?`<h4 class="sky-sub">Earlier today</h4>${seen.size?`<ul class="sky-earlier">${[...seen].sort((a,b)=>a[1][0].first-b[1][0].first).map(([id,runs])=>`<li><button type="button" data-visit="${id}"><b>${byId[id].abbr}</b>${byId[id].name}</button><span>${runs.map(r=>`${hh(r.first)}–${until(r.last)}`).join(', ')}</span></li>`).join('')}</ul>`:'<p class="sky-note">No clouds were likely earlier today.</p>'}`:''}
      <p class="field-note">These clouds are estimated from forecast model data (cloud cover at each level, the type of rain, and how unstable the air is), not seen by a camera. Look up to check! Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>.</p>
    </section>`;
    result.querySelector('.sky-change').onclick=()=>{const input=content.querySelector('.sky-search input');input.focus();input.select();};
    result.querySelectorAll('[data-visit]').forEach(b=>b.onclick=()=>{token++;dialog.close();window.CloudAtlas?.visit(+b.dataset.visit);});
    // the site's own 3D ground views, filled in one by one
    for(const el of result.querySelectorAll('[data-thumb]')){
      if(!window.Scene3D?.ok||!window.Scene3D.spotter?.capture)break;
      const id=+el.dataset.thumb;let src=cache.get(id);
      if(!src){try{src=await window.Scene3D.spotter.capture(id);cache.set(id,src);}catch{break;}}
      if(current!==token||!dialog.open)return;
      el.innerHTML=`<img src="${src}" alt="${esc(byId[id].look)}">`;
    }
  }
})();
