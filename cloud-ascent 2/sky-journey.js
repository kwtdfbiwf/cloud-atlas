(()=>{
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),lat=Number(params.get('lat')),lon=Number(params.get('lon'));
const name=params.get('name')||'Your location',region=params.get('region')||'';
const motion=matchMedia('(prefers-reduced-motion: reduce)');
window.SkyPreferences={get reduced(){return motion.matches;}};
window.SunLight={x:.755,y:.12,moved:false};
$('#place-label').textContent=name;$('#personal-title').textContent='The sky over '+name;document.title=name+' — Your sky | Cloud Atlas';
const journey=$('#personal-journey'),ground=$('#personal-ground'),status=$('#weather-status');
let request,groups=[],ready=false,last=performance.now(),snapshot=null;
const clouds=Object.fromEntries(window.CLOUDS.map(c=>[c.id,c]));
const heights={low:1200,mid:4500,high:9000},labels={low:'Close to home',mid:'The alto layer',high:'Made of ice'};
const units=v=>v==null?'–':Math.round(v);
function card(c,estimate){return `<span class="sheet-handle" aria-hidden="true"></span><button type="button" class="sheet-close" aria-label="Close ${c.name.toLowerCase()} details">×</button><div class="card-head"><span class="abbr">${c.abbr}</span><div><h3>${c.name}</h3><p class="latin">${c.latin}</p></div></div><p class="cloud-tip">${c.tip||c.look}</p><p class="personal-estimate"><b>${estimate.level==='likely'?'Likely':'Possible'}</b> · ${esc(estimate.why)}${estimate.hidden?'. May be hidden above lower cloud.':''}</p><button type="button" class="card-toggle" aria-expanded="false"><span class="more">Show more about ${c.name.toLowerCase()}</span><span class="less">Show less</span></button><dl class="stats"><div><dt>Typical base</dt><dd>${c.base}</dd></div><div><dt>Made of</dt><dd>${c.made}</dd></div></dl><p class="body"><span class="label">How it forms</span>${c.desc}</p><p class="body"><span class="label">How to spot it</span>${c.spot}</p><p class="body"><span class="label">Weather</span>${c.weather}</p>`;}
function build(estimates){
 window.MobileSheetFocus.deactivate(false);
 document.documentElement.classList.remove('sheet-open');
 document.querySelectorAll('.personal-layer,.personal-end').forEach(e=>e.remove());
 groups=['low','mid','high'].flatMap(tier=>{
   const matches=estimates.filter(e=>clouds[e.id].tier===tier);if(!matches.length)return [];
   const el=document.createElement('section');el.className='personal-layer';el.dataset.level=tier;
   el.innerHTML=`<div class="personal-sticky"><div class="personal-panel"><p class="eyebrow">${tier==='mid'?'Middle':tier[0].toUpperCase()+tier.slice(1)} clouds · ${heights[tier]/1000} km viewpoint</p><h2>${labels[tier]}</h2><div class="chips" role="tablist" aria-label="${tier} clouds estimated here">${matches.map((e,i)=>`<button class="chip" type="button" role="tab" id="tab-${e.id}" aria-controls="panel-${tier}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-id="${e.id}">${clouds[e.id].name}</button>`).join('')}</div><article class="card" id="panel-${tier}" role="tabpanel" aria-labelledby="tab-${matches[0].id}">${card(clouds[matches[0].id],matches[0])}</article></div></div>`;
   journey.prepend(el);
   const group={el,tier,alt:heights[tier],matches,id:matches[0].id,arrived:false};
   const choose=id=>{group.id=id;el.querySelectorAll('.chip').forEach(b=>{b.setAttribute('aria-selected',String(+b.dataset.id===id));b.tabIndex=+b.dataset.id===id?0:-1;});const panel=el.querySelector('.card');panel.setAttribute('aria-labelledby','tab-'+id);setCardOpen(panel,false);panel.innerHTML=card(clouds[id],matches.find(e=>e.id===id));panel.scrollTop=0;};
   el.querySelectorAll('.chip').forEach((button,i)=>{
     button.onclick=()=>choose(+button.dataset.id);
     button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?matches.length-1:(i+(e.key==='ArrowRight'?1:-1)+matches.length)%matches.length;choose(matches[next].id);el.querySelectorAll('.chip')[next].focus();};
   });return [group];
 });
 const end=document.createElement('section');end.className='personal-end';end.innerHTML=`<div><p class="eyebrow">Your sky, explored</p><h2>${estimates.length?'That’s your sky.':'Room to breathe.'}</h2><p>${estimates.length?`${estimates.length} cloud ${estimates.length===1?'type':'types'} estimated over ${esc(name)} for this time.`:'No cloud types are estimated for this time. Enjoy a clear climb, or try another hour.'}</p><p class="personal-source">Cloud types are estimates from weather-model data, not direct observations. Higher clouds may be hidden from the ground. <a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather: Open-Meteo</a>.</p><a class="btn" href="index.html">Explore all ten clouds →</a><button class="btn" type="button" id="return-weather">Change the time ↓</button></div>`;journey.prepend(end);
 $('#return-weather').onclick=()=>scrollTo({top:groundStart(),behavior:motion.matches?'instant':'smooth'});
}
async function load(time){
 request?.abort();request=new AbortController();const signal=request.signal;
 status.textContent='Reading the weather…';$('#time-form button[type="submit"]').disabled=true;
 try{
  if(!params.has('lat')||!params.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Choose a location in the atlas to begin.');
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  const day=time?.slice(0,10);
  const variables='temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,is_day';
  const query={latitude:lat,longitude:lon,current:variables,hourly:variables+',cape,visibility,freezing_level_height,precipitation_probability',timezone:'auto'};
  if(day){query.start_date=day;query.end_date=day;}else query.forecast_days=1;
  url.search=new URLSearchParams(query);
  const response=await fetch(url,{signal});const w=await response.json();if(!response.ok)throw new Error(w.reason||'The weather service could not load. Try again.');
  const h=w.hourly,selected=time||w.current.time,target=selected.slice(0,13)+':00',i=h.time.indexOf(target);
  if(i<0)throw new Error('No weather data is available for that hour. Choose another time.');
  const at=key=>time?h[key]?.[i]:w.current[key];
  const estimate={low:at('cloud_cover_low')??0,mid:at('cloud_cover_mid')??0,high:at('cloud_cover_high')??0,code:at('weather_code'),cape:h.cape[i]??0,vis:h.visibility[i]};
  const matches=window.SkyWeather.inferClouds(estimate);snapshot={w,i,time:selected,matches,rain:window.SkyWeather.rainForCode(estimate.code)};
  build(matches);ready=true;
  document.body.classList.toggle('night-sky',!at('is_day'));document.body.dataset.skyTheme=at('is_day')?'day':'night';
  const when=new Date(selected).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  $('#place-label').textContent=name+' · '+when;
  status.textContent=`${region?region+' · ':''}${when} · ${w.timezone.replaceAll('_',' ')}${time?' · selected hour':' · latest model update'}`;
  $('#weather-summary').innerHTML=`<p class="personal-condition">${esc(window.SkyWeather.WEATHER[estimate.code]||'Weather')} · ${units(at('temperature_2m'))}°C</p><details class="personal-weather-details" ${PHONE.matches?'':'open'}><summary>Weather details</summary><dl class="personal-weather">${[['Feels like',units(at('apparent_temperature'))+'°C'],['Wind',units(at('wind_speed_10m'))+' km/h '+['N','NE','E','SE','S','SW','W','NW'][Math.round((at('wind_direction_10m')||0)/45)%8]],['Humidity',units(at('relative_humidity_2m'))+'%'],['Rain chance',units(h.precipitation_probability[i])+'%'],['Cloud cover',units(at('cloud_cover'))+'%'],['Visibility',h.visibility[i]==null?'–':(h.visibility[i]/1000).toFixed(1)+' km'],['Freezing level',h.freezing_level_height[i]==null?'–':(h.freezing_level_height[i]/1000).toFixed(1)+' km']].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><p class="personal-source">${matches.length?matches.map(e=>esc(clouds[e.id].name)).join(' · '):'No clouds estimated at this time.'}</p><p class="personal-source">An illustrated journey through estimated clouds, not a live camera view.</p></details>`;
  $('#sky-time').value=selected.slice(0,13)+':00';$('#time-form').hidden=false;
  const today=w.current.time.slice(0,10),date=new Date(today+'T12:00');date.setDate(date.getDate()-7);$('#sky-time').min=date.toISOString().slice(0,10)+'T00:00';date.setDate(date.getDate()+14);$('#sky-time').max=date.toISOString().slice(0,10)+'T23:00';
  if(time)params.set('time',time);else params.delete('time');history.replaceState(null,'',location.pathname+'?'+params);
  await document.fonts.ready;if(signal.aborted)return;scrollTo({top:groundStart(),behavior:'instant'});
 }catch(error){if(error.name==='AbortError')return;status.textContent=error.message||'Could not read the weather. Please try again.';if(!ready)$('#personal-title').textContent='Your sky is taking a moment';}
 finally{if(!signal.aborted)$('#time-form button[type="submit"]').disabled=false;}
}
// Phones: each card is a small preview at the bottom that opens into a bottom sheet over a dimmed
// sky (the same pattern as the atlas page); the page underneath stays put until it's closed.
const PHONE=matchMedia('(max-width: 760px)');
function setCardOpen(c,open,byKeyboard=false){
 c.classList.toggle('open',open);c.querySelector('.card-toggle')?.setAttribute('aria-expanded',String(open));c.scrollTop=0;
 document.documentElement.classList.toggle('sheet-open',PHONE.matches&&!!document.querySelector('.personal-panel .card.open'));
 if(PHONE.matches&&open)window.MobileSheetFocus.activate(c);else if(!document.querySelector('.personal-panel .card.open'))window.MobileSheetFocus.deactivate();
}
const closeSheets=(byKeyboard=false)=>document.querySelectorAll('.personal-panel .card.open').forEach(c=>setCardOpen(c,false,byKeyboard));
document.addEventListener('click',e=>{
 const c=e.target.closest('.personal-panel .card');
 if(document.documentElement.classList.contains('sheet-open')&&!e.target.closest('.card.open')){e.preventDefault();e.stopPropagation();closeSheets();return;}
 if(!c)return;
 if(e.target.closest('.sheet-close')){setCardOpen(c,false,e.detail===0);return;}
 if(e.target.closest('.card-toggle')||(PHONE.matches&&!c.classList.contains('open')))setCardOpen(c,!c.classList.contains('open'),e.detail===0);
},true);
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.documentElement.classList.contains('sheet-open'))closeSheets(true);});
PHONE.addEventListener('change',()=>{const card=document.querySelector('.personal-panel .card.open');document.documentElement.classList.toggle('sheet-open',PHONE.matches&&!!card);if(PHONE.matches&&card)window.MobileSheetFocus.activate(card);else window.MobileSheetFocus.deactivate(false);document.querySelector('.personal-weather-details')?.toggleAttribute('open',!PHONE.matches);});
// swipe the sheet down (from its top) to close it
let swipe=null;
document.addEventListener('touchstart',e=>{const c=e.target.closest('.personal-panel .card.open');swipe=c&&c.scrollTop<=0?{c,y:e.touches[0].clientY}:null;},{passive:true});
document.addEventListener('touchmove',e=>{if(!swipe)return;const dy=e.touches[0].clientY-swipe.y;if(dy>0&&swipe.c.scrollTop<=0)swipe.c.style.translate=`0 ${dy}px`;},{passive:true});
document.addEventListener('touchend',e=>{if(!swipe)return;const {c,y}=swipe,dy=e.changedTouches[0].clientY-y;swipe=null;c.style.translate='';if(dy>90&&c.scrollTop<=0)setCardOpen(c,false);});
// Where the climb starts: the bottom of the page, unless the weather block is taller than the
// screen (phones) - then its top, just below the fixed header, so the title is never hidden.
function groundStart(){
 const max=document.documentElement.scrollHeight-innerHeight,intro=$('.personal-intro');
 const below=$('.personal-header').getBoundingClientRect().bottom+16;
 const top=intro.getBoundingClientRect().top+scrollY;
 groundY=top-max>=below?max:Math.max(0,Math.min(max,top-below));
 return groundY;
}
let groundY=null;
$('#time-form').onsubmit=e=>{e.preventDefault();load($('#sky-time').value);};$('#sky-now').onclick=()=>load(null);
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),view=scrollY+innerHeight/2;
 const anchors=[{y:groundY??max,alt:0},...groups.map(g=>({y:g.el.offsetTop+g.el.offsetHeight/2-innerHeight/2,alt:g.alt})),{y:0,alt:12000}].sort((a,b)=>b.y-a.y);
 let alt=0;for(let i=1;i<anchors.length;i++){if(scrollY>=anchors[i].y){const a=anchors[i-1],b=anchors[i],p=Math.max(0,Math.min(1,(a.y-scrollY)/Math.max(1,a.y-b.y)));alt=a.alt+(b.alt-a.alt)*p;break;}}
 let active=null,best=Infinity;for(const g of groups){const distance=Math.abs(view-(g.el.offsetTop+g.el.offsetHeight/2));if(distance<best){best=distance;active=g;}}
 const visible=active&&best<innerHeight*1.15;
 for(const g of groups){const show=g===active&&visible;g.el.classList.toggle('is-current',!!show);if(show&&!g.arrived){g.arrived=true;if(!motion.matches)g.el.querySelector('.card').animate([{translate:'0 -18px'},{translate:'0 0'}],{duration:850,easing:'ease-out'});}if(g!==active)g.arrived=false;}
 $('#altKm').textContent=(alt/1000).toFixed(1);
 if(window.Scene3D?.ok){$('#sky-status').hidden=true;document.body.classList.add('has3d');window.Scene3D.render({alt,dt,weatherRain:snapshot?.rain??0,clearSky:!ready||!visible,activeId:visible?active.id:null,waterOpacity:visible?1:0});}
 else if(window.Scene3D?.unavailable){$('#sky-status').textContent='The illustrated sky could not load. Please reload.';}
 requestAnimationFrame(frame);
}
addEventListener('resize',()=>{window.Scene3D?.resize?.(innerWidth,innerHeight);groundStart();});
history.scrollRestoration='manual';document.body.classList.remove('loading');scrollTo(0,groundStart());requestAnimationFrame(frame);load(params.get('time'));
})();
