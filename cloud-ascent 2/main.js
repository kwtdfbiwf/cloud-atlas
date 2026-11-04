(() => {
  'use strict';

  const CLOUDS = window.CLOUDS;
  const byId = {};
  CLOUDS.forEach(c => (byId[c.id] = c));

  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const forceReduced = new URLSearchParams(location.search).get('motion')==='reduce';
  let REDUCED = forceReduced || motionPreference.matches;
  window.SkyPreferences={get reduced(){return REDUCED;}};
  motionPreference.addEventListener('change', e => { REDUCED=forceReduced||e.matches; });
  const SNAP = /[?&]snap\b/.test(location.search);   // ?snap: camera follows scroll exactly (handy for screenshots)
  const K = 0.55;               // cloud parallax: how far the world moves per scrolled px
  const ALT = { low: 1200, mid: 4500, high: 9000, top: 12500 };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  const skyThemeButton = $('#sky-theme');
  let nightSky = false;
  try { nightSky = localStorage.getItem('cloud-atlas-sky-theme') === 'night'; } catch {}
  function applySkyTheme() {
    document.body.classList.toggle('night-sky', nightSky);
    document.body.dataset.skyTheme = nightSky ? 'night' : 'day';
    skyThemeButton.setAttribute('aria-pressed', String(nightSky));
    skyThemeButton.setAttribute('aria-label', nightSky ? 'Switch to day sky' : 'Switch to night sky');
    skyThemeButton.innerHTML = nightSky
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><span>Day sky</span>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg><span>Night sky</span>';
  }
  applySkyTheme();
  skyThemeButton.addEventListener('click', () => {
    nightSky = !nightSky;
    applySkyTheme();
    try { localStorage.setItem('cloud-atlas-sky-theme', nightSky ? 'night' : 'day'); } catch {}
    dispatchEvent(new Event('skythemechange'));
  });

  // A direct-manipulation light, with equivalent keyboard controls.
  const draggableSun = $('#day-sun');
  // The artwork stays below the cloud canvas; only an invisible drag target sits above it.
  $('#vector-sky').append(draggableSun);
  const sunDragTarget=document.createElement('button');
  sunDragTarget.id='sun-drag-target';sunDragTarget.type='button';
  document.body.append(sunDragTarget);
  sunDragTarget.setAttribute('role','button');
  sunDragTarget.setAttribute('aria-label','Move the sun to change cloud lighting');
  sunDragTarget.setAttribute('aria-describedby','sun-drag-help');
  sunDragTarget.setAttribute('title','Drag to move the light · Double-click to reset');
  sunDragTarget.tabIndex=nightSky?-1:0;
  document.body.insertAdjacentHTML('beforeend','<span class="sun-help" id="sun-drag-help">Drag the sun, or use the arrow keys to move it. Press Home or Enter to reset its position.</span>');
  const sunLight=window.SunLight={x:.755,y:.12,moved:false};
  let sunPointer=null, sunOffset={x:0,y:0};
  function rememberSunPosition() {
    // Layout offsets exclude the separate day/night travel transform.
    sunLight.x=(draggableSun.offsetLeft+draggableSun.offsetWidth/2)/innerWidth;
    sunLight.y=(draggableSun.offsetTop+draggableSun.offsetHeight/2)/innerHeight;
    draggableSun.dataset.x=sunLight.x.toFixed(3);
    draggableSun.dataset.y=sunLight.y.toFixed(3);
    sunDragTarget.style.left=`${draggableSun.offsetLeft}px`;
    sunDragTarget.style.top=`${draggableSun.offsetTop}px`;
    sunDragTarget.style.width=`${draggableSun.offsetWidth}px`;
    sunDragTarget.style.height=`${draggableSun.offsetHeight}px`;
  }
  rememberSunPosition();
  function moveSun(x,y) {
    const r=draggableSun.getBoundingClientRect(),edge=r.width/2+8;
    const cx=clamp(x,edge,innerWidth-edge),cy=clamp(y,edge,innerHeight-edge);
    draggableSun.style.left=`${cx-r.width/2}px`;
    draggableSun.style.top=`${cy-r.height/2}px`;
    draggableSun.style.right='auto';
    sunLight.moved=true;rememberSunPosition();
  }
  function refreshLightPreview() {
    if(window.Scene3D?.spotter)Scene3D.spotter.key=null;
    dispatchEvent(new Event('skythemechange'));
  }
  function resetSun() {
    draggableSun.style.left='';draggableSun.style.top='';draggableSun.style.right='';
    sunLight.moved=false;rememberSunPosition();refreshLightPreview();
  }
  sunDragTarget.addEventListener('pointerdown',e=>{
    if(e.button!==0||nightSky)return;
    e.preventDefault();
    const r=draggableSun.getBoundingClientRect();
    sunOffset={x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2};
    sunPointer=e.pointerId;sunDragTarget.setPointerCapture(e.pointerId);
    sunDragTarget.classList.add('is-dragging');
    sunDragTarget.focus({preventScroll:true});
  });
  sunDragTarget.addEventListener('pointermove',e=>{
    if(e.pointerId!==sunPointer)return;
    moveSun(e.clientX-sunOffset.x,e.clientY-sunOffset.y);
  });
  function finishSunDrag(e) {
    if(e.pointerId!==sunPointer)return;
    sunPointer=null;sunDragTarget.classList.remove('is-dragging');refreshLightPreview();
  }
  sunDragTarget.addEventListener('pointerup',finishSunDrag);
  sunDragTarget.addEventListener('pointercancel',finishSunDrag);
  sunDragTarget.addEventListener('lostpointercapture',finishSunDrag);
  sunDragTarget.addEventListener('dblclick',resetSun);
  sunDragTarget.addEventListener('keydown',e=>{
    const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(dirs[e.key]){
      e.preventDefault();e.stopPropagation();
      const d=dirs[e.key],step=e.shiftKey?40:16;
      moveSun(sunLight.x*innerWidth+d[0]*step,sunLight.y*innerHeight+d[1]*step);refreshLightPreview();
    }else if(['Home','Enter',' '].includes(e.key)){
      e.preventDefault();e.stopPropagation();resetSun();
    }
  });
  addEventListener('resize',()=>{
    if(sunLight.moved)moveSun(sunLight.x*innerWidth,sunLight.y*innerHeight);
    else rememberSunPosition();
  });

  // ---------------------------------------------------------------- tiers
  const TIERS = ['low', 'mid', 'high'].map(key => {
    const el = $(`.tier[data-tier="${key}"]`);
    const types = CLOUDS.filter(c => c.tier === key).map(c => c.id);
    return { key, el, stick: $('.stick', el), chips: $('.chips', el), card: $('.card', el),
             types, cur: types[0], prev: types[0], t0: -10, mix: 1, vis: 0, picked: false };
  });
  const tierByKey = Object.fromEntries(TIERS.map(t => [t.key, t]));
  const seen = new Set();

  const DROP = '<svg class="drop" viewBox="0 0 8 11" aria-hidden="true"><path d="M4 0C4 0 0 5 0 7a4 4 0 0 0 8 0C8 5 4 0 4 0z" fill="currentColor"/></svg>';

  function rainWord(p) {
    return p < 15 ? 'Very low' : p < 35 ? 'Low' : p < 60 ? 'Moderate' : p < 80 ? 'High' : 'Very high';
  }

  // Live water optics share the sky renderer and remain behind readable content.
  function glassRaindrops(c) {
    return ''; // Rain effects are temporarily disabled.
  }

  // `open`: phones show only the name and tip until the card is expanded (see .card-toggle in styles.css)
  function cardHTML(c, open = false) {
    return `
      ${glassRaindrops(c)}
      <div class="card-head">
        <span class="abbr">${c.abbr}</span>
        <div><h3>${c.name}</h3><p class="latin">${c.latin}</p></div>
      </div>
      <p class="cloud-tip">${c.tip}</p>
      <button type="button" class="card-toggle" aria-expanded="${open}">
        <span class="more">Show more about ${c.name.toLowerCase()}</span><span class="less">Show less</span>
      </button>
      <figure class="spotter">
        <div class="spot-frame" role="img" aria-label="${c.look}"><img class="ground-photo" src="${c.image}" alt="" loading="lazy" />
          <span class="spot-tag">From the ground</span>
          ${c.scale ? `<div class="spot-scale" data-deg="${c.scale.deg}"><i></i><span>${c.scale.label}</span></div>` : ''}
        </div>
        <figcaption><b>Look for:</b> ${c.look}</figcaption>
      </figure>
      <dl class="stats">
        <div><dt>Typical base</dt><dd>${c.base}</dd></div>
        <div><dt>Made of</dt><dd>${c.made}</dd></div>
      </dl>
      <div class="rainline"><span>Rain</span><div class="bar"><i style="width:${c.rain}%"></i></div><b>${rainWord(c.rain)}</b></div>
      
      <p class="body">${c.desc}</p>
      <p class="body"><b>Weather:</b> ${c.weather}</p>
      <p class="body"><b>Did you know?</b> ${c.fact}</p>`;
  }

  function buildTier(t) {
    t.chips.innerHTML = t.types.map(id => {
      const c = byId[id];
      return `<button class="chip" role="tab" data-id="${id}" aria-selected="${id === t.cur}" tabindex="${id===t.cur?0:-1}">
        ${c.rainFx ? DROP : ''}${c.name}</button>`;
    }).join('');
    t.card.innerHTML = cardHTML(byId[t.cur]);
    t.card.addEventListener('click', e => {
      const toggle = e.target.closest('.card-toggle');
      if (!toggle) return;
      const open = t.card.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      if (!open) t.card.scrollTop = 0;
    });
    t.chips.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      t.picked = true;            // the camera only turns toward a cloud when you ask (even the one already open)
      select(t, +b.dataset.id);
    });
    // where you're headed next, so it's clear there's more above
    const NEXT = { low: 'Mid-level clouds next', mid: 'High clouds next', high: 'The top of the weather next' };
    t.chips.closest('.col').insertAdjacentHTML('beforeend', `<p class="next-cue">${NEXT[t.key]} <span aria-hidden="true">↑</span></p>`);
    t.chips.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = t.types.indexOf(t.cur);
      const n = t.types[(i + (e.key === 'ArrowRight' ? 1 : -1) + t.types.length) % t.types.length];
      select(t, n);
      $(`.chip[data-id="${n}"]`, t.chips).focus();
    });
  }

  function select(t, id) {
    if (id === t.cur) return;
    // freeze the current blend as the new "previous" so rapid clicks don't pop
    t.prev = t.mix < 0.5 ? t.prev : t.cur;
    t.cur = id;
    t.t0 = performance.now() / 1000;
    $$('.chip', t.chips).forEach(b => (b.setAttribute('aria-selected', +b.dataset.id === id), b.tabIndex=+b.dataset.id===id?0:-1));
    t.card.classList.add('swap');
    setTimeout(() => {
      t.card.innerHTML = cardHTML(byId[id], t.card.classList.contains('open'));
      t.card.scrollTop = 0;
      t.card.classList.remove('swap');
    }, 200);
    if (t.vis > 0.6) markSeen(id);
  }

  function markSeen(id) {
    if (seen.has(id)) return;
    seen.add(id);
    const seenN = $('#seenN');
    if (seenN) seenN.textContent = seen.size;
    try { localStorage.setItem('cloud-atlas-spotted',JSON.stringify([...seen])); } catch {}
    $$(`.chip[data-id="${id}"]`).forEach(b => b.classList.add('seen'));
    const r = $(`#roster [data-id="${id}"]`);
    if (r) r.classList.add('seen');
  }

  TIERS.forEach(buildTier);

  // finale roster, ordered high to low like the page
  const roster = $('#roster');
  roster.innerHTML = ['high', 'mid', 'low'].flatMap(k => tierByKey[k].types).map(id => {
    const c = byId[id];
    return `<button data-id="${id}" type="button"><b>${c.abbr}</b>${c.name}</button>`;
  }).join('');
  try { const saved=JSON.parse(localStorage.getItem('cloud-atlas-spotted')||'[]'); if(Array.isArray(saved))saved.filter(id=>byId[id]).forEach(markSeen); } catch {}
  roster.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const c = byId[+b.dataset.id];
    const t = tierByKey[c.tier];
    t.picked = true;
    select(t, c.id);
    jumpTo(t);
  });

  function jumpTo(t) {
    cancelAltitudeStop();
    altitudeStop.visited.add(t.key);
    scrollTo({ top: t.centerScroll, behavior: REDUCED ? 'auto' : 'smooth' });
  }
  $$('[data-jump]').forEach(b => b.addEventListener('click', () =>
    b.dataset.jump === 'ground' ? (cancelAltitudeStop(), scrollTo({ top: M.maxScroll, behavior: REDUCED ? 'auto' : 'smooth' })) : jumpTo(tierByKey[b.dataset.jump])));
  $('#descend').addEventListener('click', () => { cancelAltitudeStop(); scrollTo({ top: M.maxScroll, behavior: REDUCED ? 'auto' : 'smooth' }); });

  // gentle stops: a snap marker at the centre of every section (see .snap-mark in styles.css)
  $$('.tier, .interlude, .top').forEach(sec => sec.insertAdjacentHTML('beforeend', '<span class="snap-mark" aria-hidden="true"></span>'));

  // ---------------------------------------------------------------- "looking at" label (3D only)
  document.body.insertAdjacentHTML('beforeend',
    `<div class="looking" id="looking" role="status"><span>Looking at <b></b></span><button type="button">Face forward</button></div>`);
  const lookingEl = $('#looking'), lookingName = $('b', lookingEl);
  $('button', lookingEl).addEventListener('click', () => TIERS.forEach(t => (t.picked = false)));

  // the open card's cloud, live, as you'd see it from the ground (3D only)
  function drawGroundView(t) {
    if (t.vis < 0.15 || !Scene3D.spotter || Scene3D.captureBusy || document.querySelector('#field-dialog[open]')) return;
    const frame = $('.spot-frame', t.card);
    if (!frame) return;
    const w = frame.clientWidth, h = frame.clientHeight;
    if (w < 40 || h < 40) return;
    Scene3D.spotter.render(t.cur, w, h);
    // Rain is drawn as part of the illustrated cloud artwork.
    const cv = Scene3D.spotter.canvas;
    if (cv && cv.parentNode !== frame) frame.prepend(cv);
    // finger test: draw the bar at its true angular size in this view
    const bar = $('.spot-scale', frame);
    if (bar) {
      const v = Scene3D.spotter.vfov * Math.PI / 180;
      const hfov = 2 * Math.atan(Math.tan(v / 2) * w / h);
      $('i', bar).style.width = `${(w * (+bar.dataset.deg * Math.PI / 180) / hfov).toFixed(1)}px`;
    }
  }

  // ---------------------------------------------------------------- metrics
  const M = {};
  const skyCanvas = $('#sky');
  const fx = $('#fx');
  const fctx = fx.getContext('2d');
  let renderScale = 1;
  let dpr = Math.min(2, devicePixelRatio || 1);

  function measure() {
    M.vw = innerWidth;
    M.vh = innerHeight;
    M.docH = document.documentElement.scrollHeight;
    M.maxScroll = M.docH - M.vh;
    TIERS.forEach(t => {
      const r = t.el.getBoundingClientRect();
      const top = r.top + scrollY;
      const center = top + r.height / 2;
      t.top = top;
      t.h = r.height;
      t.centerScroll = center - M.vh / 2;            // scrollY where this tier is centred
      t.fromBottom = M.maxScroll - t.centerScroll;   // same, measured from the ground
      // world y of the cloud band, chosen so it sits mid-screen at centerScroll
      t.bandY = (M.docH - center) * K + (M.vh / 2) * (1 - K);
    });
    M.worldTop = M.maxScroll * K + M.vh;
    M.anchors = [
      [0, 0],
      [tierByKey.low.fromBottom, ALT.low],
      [tierByKey.mid.fromBottom, ALT.mid],
      [tierByKey.high.fromBottom, ALT.high],
      [M.maxScroll, ALT.top]
    ];
    $$('[data-alt-label]').forEach(el => {
      const r = el.closest('section').getBoundingClientRect();
      const s = M.maxScroll - (r.top + scrollY + r.height / 2 - M.vh / 2);
      const m = Math.round(altitudeAt(s) / 100) * 100;
      el.textContent = `≈ ${m.toLocaleString()} m`;
    });

    // the sky canvases are 100lvh tall (see styles.css), so draw them at that height
    const skyH = Math.max(M.vh, Math.round(document.getElementById('sky3d').getBoundingClientRect().height) || 0);
    const px = M.vw * skyH;
    renderScale = Math.min(1, Math.sqrt(1.4e6 / px)) * qualityScale;
    skyCanvas.width = Math.round(M.vw * renderScale);
    skyCanvas.height = Math.round(skyH * renderScale);
    dpr = Math.min(2, devicePixelRatio || 1);
    fx.width = Math.round(M.vw * dpr);
    fx.height = Math.round(skyH * dpr);
    if (window.Scene3D && Scene3D.resize) Scene3D.resize(M.vw, skyH);
  }

  function altitudeAt(s) {
    const a = M.anchors;
    for (let i = 1; i < a.length; i++) {
      if (s <= a[i][0]) {
        const t = (s - a[i - 1][0]) / Math.max(1, a[i][0] - a[i - 1][0]);
        return a[i - 1][1] + (a[i][1] - a[i - 1][1]) * clamp(t, 0, 1);
      }
    }
    return a[a.length - 1][1];
  }

  // ---------------------------------------------------------------- WebGL sky
  const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uScale, uTime, uCam, uVh, uTop, uW, uFlash;
uniform vec4 uStops;
uniform vec3 uBandY, uType, uPrev, uMix;
uniform vec2 uSun;

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a*noise(p); p = ROT*p + 3.1; a *= .5; } return s / .96875; }
float fbm3(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 3; i++){ s += a*noise(p); p = ROT*p + 1.7; a *= .5; } return s / .875; }

// round cloudlets on a jittered grid (altocumulus / cirrocumulus)
float blobs(vec2 s, float jit, float r0, float rv){
  vec2 id = floor(s), f = fract(s);
  float best = -1.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 o = vec2(float(i), float(j));
    vec2 h = vec2(hash(id+o), hash(id+o+19.7));
    vec2 c = o + .5 + (h - .5)*jit;
    float r = r0 + rv*hash(id+o+7.3);
    best = max(best, 1. - length(f - c)/r);
  }
  return best;
}

// ---- density fields. p.x in viewport heights from the left, p.y in viewport heights from band centre (up +)

float dCumulus(vec2 p, float t){
  float period = uW + 1.4;
  float d = -1.;
  for (int k = 0; k < 4; k++){
    float fk = float(k);
    float sz = .15 + .09*fract(fk*.618 + .2);
    float cx = mod(fk*period*.25 + .35 + t*.010*(1. + .25*fk), period) - .7;
    float cy = -.2 + .17*fract(fk*.37 + .1);
    vec2 q = p - vec2(cx, cy);
    float c = -1.;
    for (int j = 0; j < 5; j++){
      float fj = float(j) - 2.;
      vec2 o = vec2(fj*.55*sz, (1. - fj*fj*.2)*.6*sz);
      float r = sz*(.78 - abs(fj)*.1);
      c = max(c, 1. - length(q - o)/r);
    }
    c = min(c, q.y*9.);                       // flat base
    d = max(d, c);
  }
  float n = fbm(p*6. + vec2(-t*.03, t*.012));
  return d + (n - .5)*.6;
}

float dStratocu(vec2 p, float t){
  vec2 q = p + vec2(t*.012, 0.);
  float n = fbm(q*vec2(1.6, 3.));
  float top = .1 + (n - .5)*.25, bot = -.22 + (n - .5)*.1;
  float b = min(p.y - bot, top - p.y)*6.;
  float cells = fbm(q*vec2(4.5, 6.5) + 11.);
  return min(b, 1.)*.55 + (cells - .45)*1.0 + (n - .5)*.35;
}

float dStratus(vec2 p, float t){
  vec2 q = p + vec2(t*.006, 0.);
  float n = fbm(q*vec2(1., 3.5));
  float top = .04 + (n - .5)*.14;
  float b = min((top - p.y)*5., (p.y + 1.15)*3.);
  return min(b, .8)*.6 + (fbm(q*vec2(2.5, 8.) + 5.) - .5)*.25;
}

float dCb(vec2 p, float t){
  vec2 q = (p - vec2(uW*.6, 0.))*1.85;
  float y = q.y;
  vec2 w = q + (vec2(fbm3(q*2. + vec2(t*.02, 0.)), fbm3(q*2. + 4.)) - .5)*.2;
  float base = (y + .4 + (fbm3(q*vec2(6., 2.) + t*.05) - .5)*.06)*8.;
  float wT = .3 + .08*smoothstep(-.4, .7, w.y);
  float tower = min((wT - abs(w.x))*2.5, (.74 - w.y)*3.);
  float crown = (1. - length((w - vec2(.02, .6))/vec2(.36, .2)))*.8;
  tower = min(max(tower, crown), base);
  float ax = w.x - .3;
  float aw = 1.05;
  float ath = .045 + .085*(1. - abs(ax)/aw);
  float anvil = min((aw - abs(ax))*2., (ath - abs(w.y - .74 - .03*ax))*8.);
  float d = max(tower, anvil);
  float n = fbm(q*5. + vec2(t*.02, -t*.035));
  return d + (n - .5)*.55;
}

float dNs(vec2 p, float t){
  vec2 q = p + vec2(t*.015, 0.);
  float n = fbm(q*vec2(1.4, 2.6));
  float bot = -.1 + (n - .5)*.16;
  float b = min((p.y - bot)*2.5, (.75 - p.y)*3.);
  float d = min(b, 1.)*.8 + (fbm(q*vec2(3., 5.) + 7.) - .5)*.5;
  float pan = (fbm(q*vec2(3., 6.) + 3.) - .62)*2. - abs(p.y - bot + .08)*6.;
  return max(d, pan);
}

float dAc(vec2 p, float t){
  vec2 q = p + vec2(t*.02, 0.);
  vec2 s = q*vec2(8., 12.);
  s.y += sin(s.x*.35)*.6;
  float b = blobs(s, .6, .3, .3);
  float m = fbm(q*vec2(1.2, 1.8) + 2.);
  float mask = (m - .45)*4.;
  mask = min(mask, min((p.y + .3)*6., (.3 - p.y)*6.));
  return min(b*.55 + (m - .5)*.4 + (fbm(q*16.) - .5)*.55, mask);
}

float dAs(vec2 p, float t){
  vec2 q = p + vec2(t*.008, 0.);
  float n = fbm(q*vec2(.7, 5.));
  float edge = min((p.y + .45 + (n - .5)*.15)*4., (.48 - p.y + (n - .5)*.2)*4.);
  return min(edge, .55 + (n - .5)*.5);
}

float dCi(vec2 p, float t){
  vec2 q = p + vec2(t*.03, 0.);
  q.x += q.y*1.1;
  vec2 w = vec2(fbm3(q*1.6), fbm3(q*1.6 + 5.2));
  float strands = fbm(vec2(q.x*2.2 + w.x*1.4, q.y*30. + w.y*10.));
  float body = fbm3(q*vec2(1.4, 3.) + 9.);
  float mask = (fbm3(p*vec2(.8, 1.6) + vec2(t*.01, 3.)) - .46)*3.;
  float bandv = min((p.y + .4)*4., (.42 - p.y)*4.);
  float d = (strands - .5)*1.3 + (body - .5)*.9;
  return min(min(d, mask), bandv)*.7;
}

float dCs(vec2 p, float t){
  float n = fbm(vec2(p.x*1.5 + t*.01, p.y*16.));
  float bandv = min((p.y + .5)*3., (.5 - p.y)*3.);
  return min(bandv, .25 + (n - .5)*.35);
}

float dCc(vec2 p, float t){
  vec2 q = p + vec2(t*.025, 0.);
  vec2 s = q*vec2(38., 46.);
  s.y += sin(s.x*.22 + q.y*8.)*1.4;
  float b = blobs(s, .55, .28, .2);
  float m = fbm3(q*vec2(1.5, 2.2) + 6.);
  float bandv = min((p.y + .3)*5., (.3 - p.y)*5.);
  float grains = b*.5 + (fbm(q*24.) - .5)*.5;
  return min(grains + (m - .64)*1.8, bandv)*.8;
}

float dens(float ty, vec2 p, float t){
  if (ty < .5) return dCumulus(p, t);
  if (ty < 1.5) return dStratocu(p, t);
  if (ty < 2.5) return dStratus(p, t);
  if (ty < 3.5) return dCb(p, t);
  if (ty < 4.5) return dNs(p, t);
  if (ty < 5.5) return dAc(p, t);
  if (ty < 6.5) return dAs(p, t);
  if (ty < 7.5) return dCi(p, t);
  if (ty < 8.5) return dCs(p, t);
  return dCc(p, t);
}

// lit colour, shadow colour, opacity, thickness darkening
void style(float ty, out vec3 lit, out vec3 shd, out float op, out float thick){
  lit = vec3(1.); shd = vec3(.66, .71, .8); op = 1.; thick = 0.;
  if (ty < .5)      { shd = vec3(.6, .66, .77); thick = .12; }
  else if (ty < 1.5){ lit = vec3(.94, .95, .97); shd = vec3(.5, .54, .62); op = .97; thick = .25; }
  else if (ty < 2.5){ lit = vec3(.82, .84, .87); shd = vec3(.6, .63, .68); op = .93; thick = .15; }
  else if (ty < 3.5){ lit = vec3(.98, .98, .99); shd = vec3(.3, .32, .38); thick = .15; }
  else if (ty < 4.5){ lit = vec3(.56, .58, .63); shd = vec3(.23, .25, .29); op = .98; thick = .45; }
  else if (ty < 5.5){ shd = vec3(.64, .68, .78); op = .97; thick = .08; }
  else if (ty < 6.5){ lit = vec3(.8, .84, .9); shd = vec3(.6, .65, .74); op = .84; thick = .1; }
  else if (ty < 7.5){ shd = vec3(.86, .9, .98); op = .85; }
  else if (ty < 8.5){ shd = vec3(.9, .93, .98); op = .42; }
  else              { shd = vec3(.82, .87, .96); op = .78; }
}

vec4 cloud(float ty, vec2 p, float t){
  float d = dens(ty, p, t);
  if (d <= 0.) return vec4(0.);
  float dl = dens(ty, p + vec2(.012, .022), t);   // toward the sun
  vec3 lit, shd; float op, thick;
  style(ty, lit, shd, op, thick);
  float a = smoothstep(0., .3, d)*op;
  float l = clamp(.62 + (d - dl)*3.5, 0., 1.);
  l *= 1. - thick*smoothstep(.15, .85, d);
  if (ty > 2.5 && ty < 3.5) l = mix(l*.25, min(1., l + .15), smoothstep(-.2, .2, p.y));   // storm: dark base, sunlit tower
  return vec4(mix(shd, lit, l), a);
}

vec4 tier(float bandY, float ty, float pv, float m, vec2 css, float worldY, float t){
  vec2 p = vec2(css.x/uVh, (worldY - bandY)/uVh);
  if (abs(p.y) > 1.25) return vec4(0.);
  vec4 c = cloud(ty, p, t);
  if (m < .999){
    vec4 o = cloud(pv, p, t);
    float a = mix(o.a, c.a, m);
    vec3 col = a > .001 ? (o.rgb*o.a*(1. - m) + c.rgb*c.a*m)/a : c.rgb;
    c = vec4(col, a);
  }
  return c;
}

vec3 skyCol(float h){
  vec3 c0 = vec3(.97, .87, .76), c1 = vec3(.64, .81, .94), c2 = vec3(.43, .66, .91), c3 = vec3(.15, .35, .72), c4 = vec3(.012, .025, .085);
  vec3 c = mix(c0, c1, smoothstep(0., uStops.x*.7, h));
  c = mix(c, c2, smoothstep(uStops.x, uStops.y, h));
  c = mix(c, c3, smoothstep(uStops.y, uStops.z, h));
  c = mix(c, c4, smoothstep(uStops.z, uStops.w, h));
  return c;
}

float hill(float y, float h){ return 1. - smoothstep(h - 1., h + 1., y); }

void main(){
  vec2 css = gl_FragCoord.xy / uScale;
  float worldY = uCam + css.y;
  float h = worldY / uTop;
  float t = uTime;

  vec3 col = skyCol(h);
  col = mix(col, col*1.06 + .02, (1. - css.y/uVh)*.35);   // a little brighter toward the horizon

  // stars near the top of the journey
  float starA = smoothstep(uStops.z*1.02, uStops.w, h);
  if (starA > 0.){
    vec2 sp = vec2(css.x, css.y + uCam*.08);
    vec2 cid = floor(sp/34.), cf = fract(sp/34.);
    float r = hash(cid);
    vec2 sc = vec2(hash(cid + 3.1), hash(cid + 7.7))*.8 + .1;
    float sd = length((cf - sc)*34.);
    float tw = .6 + .4*sin(t*(1.5 + r*3.) + r*40.);
    float st = step(.5, r)*smoothstep(.6 + r*1.4, 0., sd)*tw;
    col += st*starA*vec3(.9, .94, 1.);
  }

  // sun
  float sunD = length(css - uSun)/uVh;
  float space = smoothstep(uStops.z, uStops.w, h);
  vec3 sunTint = mix(vec3(1., .86, .62), vec3(1., .97, .92), space);
  col += sunTint*(exp(-sunD*7.)*.32 + exp(-sunD*28.)*.35);
  col = mix(col, vec3(1., .98, .93), smoothstep(.034, .029, sunD));

  // ground: three hill layers, nearer ones fall away faster as you rise
  if (worldY < uVh*.5){
    float hx = css.x/uVh;
    float hf = (.29 + .11*fbm3(vec2(hx*.9, 1.3)))*uVh;
    col = mix(col, mix(vec3(.6, .7, .78), col, .35), hill(worldY, hf));
    float ym = worldY + uCam*.3;
    float hm = (.19 + .08*fbm3(vec2(hx*1.6 + 4., 2.7)))*uVh;
    vec3 midC = mix(vec3(.4, .54, .52), vec3(.5, .63, .64), smoothstep(hm - uVh*.15, hm, ym));
    col = mix(col, midC, hill(ym, hm));
    float yn = worldY + uCam*.65;
    float hn = (.1 + .05*fbm3(vec2(hx*2.4, 5.1)) + .012*noise(vec2(hx*70., 0.)) + .008*noise(vec2(hx*160., 3.)))*uVh;
    vec3 nearC = mix(vec3(.2, .32, .23), vec3(.3, .42, .28), smoothstep(hn - uVh*.12, hn, yn));
    col = mix(col, nearC, hill(yn, hn));
  }

  // clouds
  vec4 lo = tier(uBandY.x, uType.x, uPrev.x, uMix.x, css, worldY, t);
  if (lo.a > 0.){
    float cbW = (abs(uType.x - 3.) < .5 ? uMix.x : 0.) + (abs(uPrev.x - 3.) < .5 ? 1. - uMix.x : 0.);
    lo.rgb += uFlash*cbW*vec3(.55, .6, .8)*(.4 + .6*noise(css*.01 + t));
    lo.rgb += sunTint*exp(-sunD*4.)*.18;
    col = mix(col, lo.rgb, lo.a);
  }
  vec4 mi = tier(uBandY.y, uType.y, uPrev.y, uMix.y, css, worldY, t);
  if (mi.a > 0.){
    mi.rgb += sunTint*exp(-sunD*4.)*.18;
    col = mix(col, mi.rgb, mi.a);
  }
  vec4 hi = tier(uBandY.z, uType.z, uPrev.z, uMix.z, css, worldY, t);
  if (hi.a > 0.){
    hi.rgb += sunTint*exp(-sunD*4.)*.2;
    col = mix(col, hi.rgb, hi.a);
    // 22-degree halo through cirrostratus
    float csW = (abs(uType.z - 8.) < .5 ? uMix.z : 0.) + (abs(uPrev.z - 8.) < .5 ? 1. - uMix.z : 0.);
    if (csW > 0.){
      float rr = sunD - .21;
      vec3 ring = vec3(1., .7, .55)*exp(-pow((rr + .004)/.004, 2.)) + vec3(.85, .92, 1.)*exp(-pow((rr - .006)/.012, 2.))*.6;
      col += ring*.24*csW*smoothstep(0., .3, hi.a/.42);
    }
  }

  // gentle vignette
  vec2 uv = gl_FragCoord.xy/uRes - .5;
  col *= 1. - dot(uv, uv)*.18;
  gl_FragColor = vec4(col, 1.);
}`;

  let gl = null, prog = null, U = {};
  function initGL() {
    gl = skyCanvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const v = sh(gl.VERTEX_SHADER, VERT), f = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!v || !f) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, v);
    gl.attachShader(prog, f);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uScale', 'uTime', 'uCam', 'uVh', 'uTop', 'uW', 'uFlash', 'uStops', 'uBandY', 'uType', 'uPrev', 'uMix', 'uSun']
      .forEach(n => (U[n] = gl.getUniformLocation(prog, n)));
    return true;
  }

  // ---------------------------------------------------------------- rain + lightning
  const rainPools = TIERS.map(() => []);
  let bolt = null;
  let flash = 0;
  let nextBolt = 2;

  // where the raining cloud's base sits (local band coords) and how wide the curtain is
  function rainGeom(id) {
    if (id === 3) return { baseY: -0.205, x0: M.vw / M.vh * 0.6 - 0.17, x1: M.vw / M.vh * 0.6 + 0.17, count: REDUCED ? 140 : 420, speed: 1500, len: 26, alpha: 0.45, haze: 0.07 };
    if (id === 4) return { baseY: -0.12, x0: -0.3, x1: M.vw / M.vh + 0.05, count: REDUCED ? 160 : 520, speed: 1100, len: 22, alpha: 0.5, haze: 0.5 };
    return null;
  }

  function drawFX(dt, t, camY, camDelta) {
    const w = M.vw, h = M.vh;
    if (REDUCED) { fctx.clearRect(0,0,fx.width,fx.height); flash=0; bolt=null; return 0; }
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.clearRect(0, 0, w, h);

    let rainLevel = 0;
    if (use3D) {
      // rain falls in the 3D scene (so nearer clouds hide it); here we only drive lightning and the rain sound
      for (const [abbr, id] of [['Cb', 3], ['Ns', 4]]) {
        const box = Scene3D.rainBox(abbr);
        if (!box) continue;
        if (box.bottom > box.top + 4) {
          const near = clamp(1 - (box.top - h * 0.2) / h, 0.3, 1);
          rainLevel = Math.max(rainLevel, near * 0.8 * clamp((h - Math.max(0, box.top)) / h, 0, 1));
        }
        if (id === 3) {
          // lightning only while you're looking at the storm (its 2D bolt can't be hidden by nearer clouds).
          // When the camera frames the tower and its base is off-screen, strike inside the visible tower.
          const top = clamp(box.top, h * 0.15, h * 0.75);
          const floor = clamp(box.bottom, top + 120, h);
          lastRainBase = top;
          if (focusAbbr === 'Cb') handleLightning(t, { ...rainGeom(3), x0: box.x0 / h, x1: box.x1 / h }, top, 1, floor);
        }
      }
    } else {
      TIERS.forEach((tr, i) => {
        const pool = rainPools[i];
        const layers = [[tr.cur, tr.mix], [tr.prev, 1 - tr.mix]];
        for (const [id, wgt] of layers) {
          const g = rainGeom(id);
          if (!g || wgt < 0.02) continue;
          const baseScreen = h - (tr.bandY + g.baseY * h - camY);  // canvas y of the cloud base
          if (baseScreen > h + 20 || baseScreen < -3 * h) continue;
          // Falling rain is temporarily disabled.
        }
      });
    }

    // lightning bolt + flash
    if (bolt) {
      const age = t - bolt.t0;
      let f = 0;
      for (const o of [0, 0.09, 0.2]) if (age > o) f += Math.exp(-(age - o) * 16);
      flash = Math.min(1.2, f);
      if (bolt.path && age < 0.32) {
        fctx.save();
        fctx.strokeStyle = `rgba(240,244,255,${0.95 * Math.min(1, f)})`;
        fctx.shadowColor = 'rgba(160,190,255,0.9)';
        fctx.shadowBlur = 18;
        fctx.lineJoin = 'round';
        for (const seg of bolt.path) {
          fctx.lineWidth = seg.wd;
          fctx.beginPath();
          seg.pts.forEach(([x, y], j) => (j ? fctx.lineTo(x, y + bolt.shift(y)) : fctx.moveTo(x, y + bolt.shift(y))));
          fctx.stroke();
        }
        fctx.restore();
      }
      if (f > 0.02) {
        fctx.fillStyle = `rgba(210,220,255,${0.1 * Math.min(1, f)})`;
        fctx.fillRect(0, 0, w, h);
      }
      if (age > 1) { bolt = null; flash = 0; }
    }
    return rainLevel;
  }

  // one rain source: soft curtain + streaks from the cloud base (canvas y) down to `floor`
  function rainShaft(pool, id, g, wgt, baseScreen, floor, dt, t) {
    const h = M.vh;
    const level = wgt * clamp((h - Math.max(0, baseScreen)) / h, 0, 1);
    const key = 'r' + id;
    if (!pool[key]) pool[key] = Array.from({ length: g.count }, () => ({ x: Math.random(), d: Math.random() * h * 1.2, s: 0.6 + Math.random() * 0.8 }));
    const drops = pool[key];
    const n = Math.round(drops.length * wgt);

    // soft grey rain curtain hanging from the base
    const yTop0 = Math.max(baseScreen - 90, 0);
    const cx0 = g.x0 * h, cx1 = g.x1 * h;
    const curtain = fctx.createLinearGradient(0, baseScreen - 90, 0, floor);
    curtain.addColorStop(0, 'rgba(85,95,112,0)');
    curtain.addColorStop(clamp(150 / Math.max(1, floor - baseScreen + 90), 0, 1), `rgba(85,95,112,${g.haze * wgt})`);
    curtain.addColorStop(1, `rgba(110,120,138,${g.haze * 0.5 * wgt})`);
    fctx.fillStyle = curtain;
    const slant = (floor - yTop0) * 0.1;
    const layers = id === 4 ? 1 : 6;    // a sheet cloud greys the whole view; a storm gets a soft-edged shaft
    for (let s = 0; s < layers; s++) {   // stacked, narrowing layers fake soft edges
      const ins = s * (cx1 - cx0) * 0.07;
      fctx.beginPath();
      fctx.moveTo(cx0 + ins, yTop0);
      fctx.lineTo(cx1 - ins, yTop0);
      fctx.lineTo(cx1 - ins + slant, floor);
      fctx.lineTo(cx0 + ins + slant, floor);
      fctx.fill();
    }
    fctx.strokeStyle = `rgba(214,224,240,${g.alpha})`;
    fctx.lineWidth = id === 3 ? 1.3 : 1;
    fctx.beginPath();
    for (let k = 0; k < drops.length; k++) {
      const dr = drops[k];
      dr.d += g.speed * dr.s * dt;
      const yTop = Math.max(baseScreen, 0);
      if (baseScreen + dr.d > floor + 40) { dr.d = Math.random() * 30; dr.x = Math.random(); }
      if (k >= n) continue;
      const y = baseScreen + dr.d;
      if (y < yTop || y > floor) continue;
      const x = (g.x0 + (g.x1 - g.x0) * dr.x) * h + dr.d * 0.1;
      const L = Math.min(g.len * dr.s, y - yTop);
      fctx.moveTo(x, y);
      fctx.lineTo(x - L * 0.1, y - L);
    }
    fctx.stroke();

    if (g.count && id === 3 && wgt > 0.5) handleLightning(t, g, baseScreen, wgt, floor);
    return level;
  }

  function handleLightning(t, g, baseScreen, wgt, floor = M.vh) {
    if (bolt || t < nextBolt || REDUCED) return;
    if (baseScreen > M.vh * 0.9) return;
    nextBolt = t + 3 + Math.random() * 5;
    const withBolt = Math.random() < 0.65 && baseScreen > -M.vh * 0.2;
    const h = M.vh;
    let path = null;
    const y0 = baseScreen;
    if (withBolt) {
      const cx = ((g.x0 + g.x1) / 2 + (Math.random() - 0.5) * 0.3) * h;
      path = [];
      const main = [[cx, y0]];
      let x = cx, y = y0;
      while (y < floor + 10) { y += 14 + Math.random() * 26; x += (Math.random() - 0.5) * 34; main.push([x, y]); }
      path.push({ pts: main, wd: 2.4 });
      for (let b = 0; b < 3; b++) {
        const from = main[2 + Math.floor(Math.random() * (main.length - 4))];
        if (!from) continue;
        const br = [from];
        let bx = from[0], by = from[1];
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let s = 0; s < 5; s++) { by += 12 + Math.random() * 18; bx += dir * (8 + Math.random() * 20); br.push([bx, by]); }
        path.push({ pts: br, wd: 1.1 });
      }
    }
    // keep the bolt attached to the cloud if the page moves while it's visible
    const startBase = baseScreen;
    bolt = { t0: t, path, shift: () => (lastRainBase - startBase) };
    thunder(withBolt ? 0.4 : 1.2);
  }
  let lastRainBase = 0;

  // ---------------------------------------------------------------- sound (synthesised, off by default)
  let audio = null;
  function initAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const wn = Math.random() * 2 - 1; d[i] = wn; }
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = brown.getChannelData(0);
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    const loop = (bf) => { const s = ctx.createBufferSource(); s.buffer = bf; s.loop = true; s.start(); return s; };

    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const wind = ctx.createGain(); wind.gain.value = 0;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500; wf.Q.value = 0.8;
    loop(brown).connect(wf); wf.connect(wind); wind.connect(master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain(); lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(wf.frequency); lfo.start();

    const rain = ctx.createGain(); rain.gain.value = 0;
    const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 2400; rf.Q.value = 0.5;
    loop(buf).connect(rf); rf.connect(rain); rain.connect(master);
    audio = { ctx, master, wind, rain, brown };
  }
  function thunder(delay) {
    if (!audio || !soundOn) return;
    const { ctx, master, brown } = audio;
    const s = ctx.createBufferSource(); s.buffer = brown; s.playbackRate.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay + Math.random() * 0.6;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1.6, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.2);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0, Math.random() * 2); s.stop(t0 + 3.4);
  }
  let thunderTimer=null;
  addEventListener('cloudthunder',()=>{
    clearTimeout(thunderTimer);
    if(REDUCED||!soundOn||document.hidden)return;
    thunderTimer=setTimeout(()=>{
      if(!REDUCED&&soundOn&&!document.hidden&&document.body.dataset.cloudType==='Cb'&&document.body.dataset.lightning!=='off')thunder(0);
    },1200+Math.random()*600);
  });
  let soundOn = false;
  const soundBtn = $('#sound');
  soundBtn.addEventListener('click', () => {
    if (!audio) initAudio();
    soundOn = !soundOn;
    if(!soundOn)clearTimeout(thunderTimer);
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    audio.master.gain.setTargetAtTime(soundOn ? 0.9 : 0, audio.ctx.currentTime, 0.3);
    soundBtn.setAttribute('aria-pressed', soundOn);
    $('span', soundBtn).textContent = soundOn ? 'Sound on' : 'Sound off';
  });

  // ---------------------------------------------------------------- HUD
  const altKmEl = $('#altKm');
  const jumpBtns = $$('[data-jump]');
  let lastAlt = -1;
  function updateHUD(alt) {
    const a = Math.round(alt / 100) * 100;         // the readout shows tenths of a kilometre
    if (a === lastAlt) return;
    lastAlt = a;
    altKmEl.textContent = (a / 1000).toFixed(1);
    document.body.classList.toggle('high-alt', alt > 6200);
    const zone = alt < 150 ? 'ground' : alt < 2700 ? 'low' : alt < 7000 ? 'mid' : 'high';
    jumpBtns.forEach(b => {
      const current=b.dataset.jump===zone;
      b.classList.toggle('on',current);
      if(current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    });
  }

  // nudge people who try to scroll down from the ground
  const nudge = $('#nudge');
  let nudgeTimer = 0;
  function showNudge() {
    nudge.classList.add('show');
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => nudge.classList.remove('show'), 1800);
  }
  addEventListener('wheel', e => { if (e.deltaY > 0 && scrollY >= M.maxScroll - 2) showNudge(); }, { passive: true });
  addEventListener('keydown', e => { if ((e.key === 'ArrowDown' || e.key === 'PageDown') && scrollY >= M.maxScroll - 2) showNudge(); });

  // A small, interruptible arrival at each altitude; never pull back from a long scroll.
  // A tier rearms only after leaving its neighbourhood, so one gesture cannot trap you.
  const altitudeStop = { active: null, visited: new Set(), intentUntil: 0, bypassUntil: 0, lastY: 0 };
  const STOP_TOTAL_MS = 1000;
  let liftoffLock=null;
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  let touchScrollUntil = 0;
  // on touch, a hold must also stop the flick's glide, or scrollTo and the glide fight (jitter)
  const setScrollHold = on => { if (TOUCH) document.documentElement.classList.toggle('scroll-hold', on); };
  addEventListener('touchend', () => { touchScrollUntil = performance.now() + 2500; }, { passive: true });
  function cancelAltitudeStop() {
    liftoffLock=null;delete document.body.dataset.liftoffLock;setScrollHold(false);
    altitudeStop.active = null;
    altitudeStop.intentUntil = 0;
    altitudeStop.bypassUntil = performance.now() + 2500;
    delete document.body.dataset.altitudeStop;
  }
  function localScrollTarget(target) {
    return target instanceof Element && target.closest('.card, dialog, input, textarea, select, [contenteditable="true"]');
  }
  function beginAltitudeStop(t, now) {
    if (Math.abs(scrollY - t.centerScroll) > 140) return;
    altitudeStop.visited.add(t.key);
    altitudeStop.active = { tier: t, from: scrollY, start: now, input: 0, settle: REDUCED ? 0 : 420 };
    document.body.dataset.altitudeStop = t.key;
    setScrollHold(true);
  }
  function nearbyAltitude(from, to) {
    const direction = Math.sign(to - from);
    if (!direction) return null;
    return TIERS.filter(t => !altitudeStop.visited.has(t.key) &&
      Math.abs(t.centerScroll - to) < 140 &&
      (t.centerScroll - from) * direction > 2 &&
      (t.centerScroll - to) * direction <= 60)
      .sort((a, b) => Math.abs(a.centerScroll - from) - Math.abs(b.centerScroll - from))[0];
  }
  function updateAltitudeStop(now) {
    const state = altitudeStop;
    if(liftoffLock){
      const stop=liftoffLock;
      if(now<stop.until){
        const p=smooth(0,stop.settle,now-stop.start);
        scrollTo({top:stop.from+(stop.y-stop.from)*p,behavior:'instant'});
        state.lastY=scrollY;return;
      }
      liftoffLock=null;delete document.body.dataset.liftoffLock;setScrollHold(false);
    }
    for (const t of TIERS) {
      if (state.active?.tier !== t && Math.abs(scrollY - t.centerScroll) > Math.max(260, innerHeight * .5)) state.visited.delete(t.key);
    }
    if (state.active) {
      const a = state.active;
      const elapsed = now - a.start;
      const p = a.settle ? Math.min(1, elapsed / a.settle) : 1;
      // Smooth acceleration and deceleration, without the abrupt initial pull.
      const eased = p * p * p * (p * (p * 6 - 15) + 10);
      scrollTo({ top: a.from + (a.tier.centerScroll - a.from) * eased, behavior: 'instant' });
      if (elapsed >= STOP_TOTAL_MS) {
        state.active = null;
        delete document.body.dataset.altitudeStop;
        setScrollHold(false);
      }
    // Not on touch: a flick keeps gliding after the finger lifts, and grabbing it mid-glide
    // to pull back to a level reads as a jolt. Titles still hold the page on touch.
    } else if (!TOUCH && now > state.bypassUntil && now < state.intentUntil) {
      const t = nearbyAltitude(state.lastY, scrollY);
      if (t) beginAltitudeStop(t, now);
    }
    state.lastY = scrollY;
  }
  addEventListener('wheel', e => {
    if(liftoffLock&&!e.ctrlKey){e.preventDefault();return;}
    if (e.ctrlKey || localScrollTarget(e.target) || document.querySelector('dialog[open]')) return;
    const now = performance.now();
    if (now < altitudeStop.bypassUntil) return;
    altitudeStop.intentUntil = now + 1200;
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    const fromAlt=altitudeAt(M.maxScroll-scrollY),toAlt=altitudeAt(M.maxScroll-scrollY-delta);
    const arrival=interludeTitles.find(title=>title.armed&&fromAlt<title.threshold()&&toAlt>=title.threshold());
    if(arrival){startInterlude(arrival,now,true);e.preventDefault();return;}
    if (altitudeStop.active) {
      const a = altitudeStop.active;
      a.input += Math.abs(delta);
      // Continued scrolling always wins over the brief settling effect.
      if (now - a.start > 180 || a.input > 90) { cancelAltitudeStop(); return; }
    } else {
      const t = nearbyAltitude(scrollY, scrollY + delta);
      if (t && Math.abs(scrollY - t.centerScroll) <= 140) beginAltitudeStop(t, now);
    }
    if (altitudeStop.active) e.preventDefault();
  }, { passive: false });
  addEventListener('touchmove', e => {
    if(liftoffLock){e.preventDefault();return;}
    if (localScrollTarget(e.target) || document.querySelector('dialog[open]')) return;
    altitudeStop.intentUntil = performance.now() + 1200;
    touchScrollUntil = performance.now() + 2500;
    if (altitudeStop.active) cancelAltitudeStop();
  }, { passive: false });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { cancelAltitudeStop(); return; }
    if(liftoffLock&&['ArrowUp','ArrowDown','PageUp','PageDown',' ','Home','End'].includes(e.key)){e.preventDefault();return;}
    if (localScrollTarget(e.target) || document.querySelector('dialog[open]')) return;
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '].includes(e.key)) {
      altitudeStop.intentUntil = performance.now() + 1200;
      if (altitudeStop.active) cancelAltitudeStop();
    }
  });

  // Decorative titles share one timed arrival; the original interludes stay in place.
  const interludeTitles=[
    {id:'liftoff-overlay',text:'Lifting off',alt:500},
    {id:'freezing-overlay',text:'Past the freezing level',section:'freezing'},
    {id:'ice-overlay',text:'Into the ice',section:'ice'}
  ].map(title=>{
    const el=$('#'+title.id);
    el.innerHTML=title.text.split(' ').map(word=>`<span class="liftoff-word">${[...word].map(letter=>`<span class="liftoff-letter">${letter}</span>`).join('')}</span>`).join('');
    title.el=el;title.letters=$$('.liftoff-letter',el);title.armed=true;title.start=null;
    // the section repeating this title; its text waits until the big title has floated away
    title.inner=$$('.interlude .inter-inner').find(inner=>$('h3',inner)?.textContent.trim()===title.text);
    title.scrollY=()=>{
      if(title.alt)return M.maxScroll-tierByKey.low.fromBottom*(title.alt/ALT.low);
      const section=$('[data-interlude="'+title.section+'"]');
      const rect=section.getBoundingClientRect();
      return rect.top+scrollY+rect.height/2-innerHeight/2;
    };
    title.height=()=>altitudeAt(M.maxScroll-title.scrollY());
    title.threshold=()=>title.height()-60;
    title.words=$$('.liftoff-word',el);
    return title;
  });
  // Shrink a title until its widest word fits the screen (phones with larger text settings or a
  // fallback font would otherwise push it past the edges). offsetWidth ignores the float transforms.
  function fitTitle(title){
    title.el.style.fontSize='';
    const room=innerWidth*.88,widest=Math.max(...title.words.map(w=>w.offsetWidth));
    if(widest>room)title.el.style.fontSize=`${(parseFloat(getComputedStyle(title.el).fontSize)*room/widest).toFixed(1)}px`;
  }
  const fitTitles=()=>interludeTitles.forEach(fitTitle);
  fitTitles();addEventListener('resize',fitTitles);
  document.fonts?.ready.then(fitTitles);
  function startInterlude(title,now,hold) {
    fitTitle(title);
    title.armed=false;title.start=now;
    if(hold){
      const y=title.scrollY();
      liftoffLock={from:scrollY,y,start:now,settle:REDUCED?0:Math.min(700,250+Math.abs(scrollY-y)*.1),until:now+(REDUCED?2100:3200)};
      document.body.dataset.liftoffLock='true';
      altitudeStop.active=null;
      setScrollHold(true);
    }
  }
  function updateLiftoffOverlay(alt) {
    const now=performance.now();
    interludeTitles.forEach(title=>{
      if(alt<title.height()-350&&!liftoffLock){title.armed=true;title.start=null;}
      // titles mark the climb, so only play them on the way up (grabbing a downward flick is a jolt)
      if(title.armed&&!liftoffLock&&alt>lastAltM&&alt>=title.threshold()&&alt<title.height()+400){
        // only a scroll you're doing yourself plays (and holds for) a title; a button jump just passes it
        const byHand=(now<altitudeStop.intentUntil||now<touchScrollUntil)&&now>altitudeStop.bypassUntil;
        if(byHand)startInterlude(title,now,true);else title.armed=false;
      }
      // the section text stays hidden while its title is still to come, so it never flashes up first
      if(title.start===null){title.el.style.opacity='0';title.inner?.classList.toggle('waiting',title.armed);return;}
      const elapsed=(now-title.start)/1000;
      title.inner?.classList.toggle('waiting',elapsed<(REDUCED?1.6:2.2));
      const enter=smooth(0,.5,elapsed);
      const complete=elapsed>(REDUCED?2.1:3.2);
      title.el.style.opacity=complete?'0':'1';
      title.el.dataset.phase=complete?'complete':elapsed<.5?'appearing':elapsed<1.1?'holding':'floating';
      title.el.dataset.elapsed=elapsed.toFixed(2);
      title.letters.forEach((letter,i)=>{
        const stagger=i/Math.max(1,title.letters.length-1)*.405;
        const exit=REDUCED?smooth(1.1,1.9,elapsed):smooth(1.1+stagger,2.6+stagger,elapsed);
        letter.style.opacity=(enter*(1-exit)).toFixed(3);
        // narrow screens spread the letters less, so they float up rather than off the sides
        const x=REDUCED?0:(i-(title.letters.length-1)/2)*6*Math.min(1,innerWidth/900)*exit;
        const y=REDUCED?0:18*(1-enter)-(160+(i%3)*28)*exit;
        const turn=REDUCED?0:((i%2?-1:1)*(3+i%4))*exit;
        letter.style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${turn.toFixed(2)}deg)`;
        letter.style.filter=REDUCED?'none':`blur(${(exit*5).toFixed(2)}px)`;
      });
    });
  }

  const crossingMist = $('#cloud-crossing');
  function updateCloudCrossing(alt) {
    if (REDUCED) { crossingMist.style.opacity = '0'; return; }
    // Short cloud banks between the learning levels, traversed in either direction.
    const banks = [[2700, 650], [7000, 850]];
    let density = 0, progress = 0;
    for (const [height, halfDepth] of banks) {
      const p = (alt - height) / halfDepth;
      if (Math.abs(p) >= 1) continue;
      const strength = Math.pow(Math.cos(p * Math.PI / 2), 2);
      if (strength > density) { density = strength; progress = p; }
    }
    crossingMist.style.opacity = (density * (document.body.classList.contains('night-sky') ? .34 : .52)).toFixed(3);
    crossingMist.style.transform = `translateY(${(progress * 22).toFixed(2)}vh) scale(${(1.04 + density * .09).toFixed(3)})`;
  }

  // ---------------------------------------------------------------- loop
  let qualityScale = 1;
  let use3D = false;         // the Blender scene (scene3d.js) takes over the sky once it has loaded
  let lastAltM = 0;
  let focusAbbr = null;      // cloud the camera is turned toward (3D mode)
  let camS = 0;
  let lastT = 0;
  let perf = { n: 0, sum: 0, done: false, good: 0 };
  const hasGL = false;
  let was3D = false;
  const skyStatus = $('#sky-status');
  document.body.classList.add('nogl');

  function frame(nowMs) {
    if (document.hidden) {lastT=0;requestAnimationFrame(frame);return;}
    document.body.dataset.reducedMotion=String(REDUCED);
    const now = nowMs / 1000;
    const rawDt = lastT ? now - lastT : 0.016;
    const dt = Math.min(0.05, rawDt);
    lastT = now;

    // adaptive resolution, checked every ~90 frames. 3D sky: slow → a step smaller; plenty of
    // headroom for a few checks in a row → a step sharper. Shader sky: a one-off check at the start.
    {
      perf.n++; perf.sum += Math.min(rawDt, 0.1);
      if (perf.n === 45) {
        const avg = perf.sum / perf.n;
        document.body.dataset.averageFps=(1/avg).toFixed(1);
        perf.n = 0; perf.sum = 0;
        if (use3D) {
          if (avg > 0.030) { Scene3D.lowerQuality(); perf.good = 0; }
          else if (avg < 0.015) { if (++perf.good >= 3 && Scene3D.raiseQuality()) perf.good = 0; }
          else perf.good = 0;
        } else if (!perf.done) {
          perf.done = true;
          if (avg > 0.024) { qualityScale = 0.7; measure(); }
        }
      }
    }

    updateAltitudeStop(nowMs);
    const target = M.maxScroll - scrollY;
    const prevCam = camS;
    camS = target; // camera, section and altimeter use the same scroll position
    const camY = camS * K;
    const camDelta = (camS - prevCam) * K;

    const viewC = scrollY + M.vh / 2;
    TIERS.forEach(t => {
      t.mix = clamp((now - t.t0) / 1.4, 0, 1);
      t.mix = t.mix * t.mix * (3 - 2 * t.mix);
      const x = Math.abs(viewC - (t.top + t.h / 2)) / M.vh;
      t.vis = 1 - smooth(0.22, 0.85, x);
      // One gentle, timed arrival for the whole card; no staggered reading.
      if(t.vis>.45&&!t.cardArrived){
        t.cardArrived=true;
        t.cardEntrance?.cancel();
        // touch: no drop-in; moving the card while a flick also moves the page looks like a wobble
        if(!REDUCED&&!TOUCH)t.cardEntrance=t.card.animate([
          {translate:'0 -18px',offset:0},
          {translate:'0 2px',offset:.78},
          {translate:'0 0',offset:1}
        ],{duration:850,easing:'cubic-bezier(.22,.61,.36,1)'});
      }
      if(t.vis<.05){t.cardArrived=false;t.cardEntrance?.cancel();}
      if(REDUCED)t.cardEntrance?.cancel();
      t.stick.style.opacity = t.vis.toFixed(3);
      t.stick.style.setProperty("--section-opacity",t.vis.toFixed(3));
      t.stick.classList.toggle('live', t.vis > 0.15);
      if (t.vis > 0.6) markSeen(t.cur);
      if (t.vis < 0.05) t.picked = false;    // leaving the section: the view eases back to facing forward
    });

    use3D = !!(window.Scene3D && Scene3D.ok);
    if(use3D!==was3D){document.body.classList.toggle('has3d',use3D);was3D=use3D;}
    document.body.dataset.skyMode = use3D ? 'clay' : window.Scene3D?.unavailable ? 'unavailable' : 'loading';
    skyStatus.hidden = use3D;
    skyStatus.textContent = window.Scene3D?.unavailable
      ? 'The illustrated sky could not load. Please reload.'
      : 'Shaping your little sky…';
    const alt = altitudeAt(camS);
    updateCloudCrossing(alt);
    updateLiftoffOverlay(alt);
    lastAltM = alt;

    if (use3D) {
      // the camera faces forward, and only turns toward a cloud after you click its chip
      const t = TIERS.reduce((a, b) => (b.vis > a.vis ? b : a));
      focusAbbr = t.vis > 0.15 && t.picked ? byId[t.cur].abbr : null;
      if(!document.querySelector('#field-dialog[open]')) Scene3D.render({ alt, flash, dt, activeId:t.vis>.15?t.cur:null, waterOpacity:t.vis, waterCard:null, selections:Object.fromEntries(TIERS.map(t=>[t.key,t.cur])), focus: REDUCED ? null : focusAbbr, focusTarget: smooth(0.05, 0.85, t.vis) });
      lookingEl.classList.toggle('on', !!focusAbbr && !REDUCED);
      drawGroundView(t);
      if (focusAbbr) lookingName.textContent = byId[t.cur].name.toLowerCase();
    } else if (hasGL) {
      const time = REDUCED ? now * 0.3 : now;
      gl.viewport(0, 0, skyCanvas.width, skyCanvas.height);
      gl.uniform2f(U.uRes, skyCanvas.width, skyCanvas.height);
      gl.uniform1f(U.uScale, skyCanvas.width / M.vw);
      gl.uniform1f(U.uTime, time % 4000);
      gl.uniform1f(U.uCam, camY);
      gl.uniform1f(U.uVh, M.vh);
      gl.uniform1f(U.uTop, M.worldTop);
      gl.uniform1f(U.uW, M.vw / M.vh);
      gl.uniform1f(U.uFlash, flash);
      const [lo, mi, hi] = TIERS;
      gl.uniform4f(U.uStops, lo.bandY / M.worldTop, mi.bandY / M.worldTop, hi.bandY / M.worldTop, 0.985);
      gl.uniform3f(U.uBandY, lo.bandY, mi.bandY, hi.bandY);
      gl.uniform3f(U.uType, lo.cur, mi.cur, hi.cur);
      gl.uniform3f(U.uPrev, lo.prev, mi.prev, hi.prev);
      gl.uniform3f(U.uMix, lo.mix, mi.mix, hi.mix);
      gl.uniform2f(U.uSun, M.vw * 0.8, M.vh * 0.78);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (!use3D) {
      const g = rainGeom(3);
      lastRainBase = M.vh - (TIERS[0].bandY + g.baseY * M.vh - camY);
    }
    const rainLevel = drawFX(dt, now, camY, camDelta);
    updateHUD(alt);

    if (audio && soundOn) {
      const ct = audio.ctx.currentTime;
      audio.wind.gain.setTargetAtTime(0.05 + 0.25 * clamp(alt / 12000, 0, 1) + Math.min(0.2, Math.abs(camDelta) * 0.01), ct, 0.4);
      audio.rain.gain.setTargetAtTime(0, ct, 0.4);
    }

    requestAnimationFrame(frame);
  }

  function start() {
    history.scrollRestoration = 'manual';
    measure();
    scrollTo(0, M.maxScroll);
    camS = M.maxScroll - scrollY;
    altitudeStop.lastY = scrollY;
    document.body.classList.remove('loading');
    requestAnimationFrame(frame);
  }

  let resizeT = 0, lastW = innerWidth, lastH = innerHeight;
  addEventListener('resize', () => {
    const toolbarOnly = TOUCH && innerWidth === lastW && Math.abs(innerHeight - lastH) < 160;
    if (toolbarOnly) return;
    lastW = innerWidth; lastH = innerHeight;
    cancelAltitudeStop();
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      // keep the same distance from the ground across resizes
      const fromBottom = M.maxScroll - scrollY;
      measure();
      scrollTo(0, M.maxScroll - fromBottom);
    }, 120);
  });

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();
