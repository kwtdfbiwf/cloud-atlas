(() => {
  const clouds=window.CLOUDS, byId=Object.fromEntries(clouds.map(c=>[c.id,c]));
  const dialog=document.createElement('dialog');dialog.id='field-dialog';dialog.setAttribute('aria-labelledby','field-title');
  dialog.innerHTML='<button class="field-close" type="button" aria-label="Close field tools">×</button><h2 id="field-title">Your pocket field guide</h2><div class="field-menu"><button type="button" data-tool="compare">Compare cloud sizes</button><button type="button" data-tool="quiz">Test your eye</button></div><div id="field-content"></div>';
  document.body.append(dialog);
  const content=dialog.querySelector('#field-content'), cache=new Map();let token=0,returnFocus=null,rainAnimation=0;
  addEventListener('skythemechange',()=>cache.clear());
  function close(){token++;dialog.close();returnFocus?.focus();}
  dialog.querySelector('.field-close').onclick=close;dialog.addEventListener('cancel',()=>{token++;});dialog.addEventListener('close',()=>{cancelAnimationFrame(rainAnimation);rainAnimation=0;returnFocus?.focus();});
  document.getElementById('field-tools-button').onclick=e=>{returnFocus=e.currentTarget;dialog.showModal();showCompare();};
  dialog.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>b.dataset.tool==='quiz'?startQuiz():showCompare());
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
})();
