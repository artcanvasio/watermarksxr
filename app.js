/* WatermarksXR — mobile app
   Screens follow the Figma page "03 · Mobile UI". Recognition + overlays live in ar.js. */
import { ARSession, TARGET_ORDER } from './ar.js';

const VERSION = '1.0.0';
const DEV = new URLSearchParams(location.search).has('dev');

/* ---------------- data ---------------- */
const LM = {
  towers: { id:'towers', name:'Water Towers', eyebrow:'Explore in 3D', sub:'Engineering water upward', bg:'#dcebdc', fg:'#376a4e', icon:'castle',
    place:'Wasserwerk am Roten Tor', addr:'Am Roten Tor, Augsburg', lat:48.3599136, lng:10.9034697, maps:'https://maps.app.goo.gl/2UNcC8hiNBaSYs799', pin:[0.36,0.45],
    intro:'Water wheels once drove pumps and Archimedes screws that lifted river water to the top of these towers. From there, gravity carried it to the city’s fountains.' },
  fountain: { id:'fountain', name:'Augustus Fountain', eyebrow:'360° view', sub:'A monument, up close', bg:'#dce9f5', fg:'#25597c', icon:'landmark',
    place:'Augustusbrunnen', addr:'Rathausplatz, Augsburg', lat:48.3690536, lng:10.8979332, maps:'https://maps.app.goo.gl/NUD3z5P5gvJmfu9fA', pin:[0.6,0.32],
    intro:'The Augustus Fountain stands in front of the Town Hall. Four bronze figures around the basin stand for Augsburg’s waters.' },
  kanal: { id:'kanal', name:'Ice Kanal', eyebrow:'First-person ride', sub:'Flow vs control', bg:'#d7e9ec', fg:'#176574', icon:'waves',
    place:'Augsburg Eiskanal', addr:'Am Eiskanal, Augsburg', lat:48.3477386, lng:10.9363605, maps:'https://maps.app.goo.gl/VRpriZ8Syw6AvMq39', pin:[0.84,0.24],
    intro:'You glide down the Eiskanal, built for the 1972 Olympic canoe slalom. Stay with the flow until one gate asks for a decision.' },
  river: { id:'river', name:'Riverside Nature', eyebrow:'Storybook', sub:'Life along the Lech', bg:'#ece7d5', fg:'#65713e', icon:'leaf',
    place:'Hochablass', addr:'Lech weir, Augsburg', lat:48.3439827, lng:10.9367596, maps:'https://maps.app.goo.gl/QWmHVdSsa2V3KjdZA', pin:[0.22,0.78],
    intro:'A calm riverbank opens like a storybook. Move your phone and look closely: animals are hiding along the Lech.' }
};
const ORDER = ['towers','fountain','kanal','river'];
const CENTRE = { lat:48.3689, lng:10.8985, label:'from Rathausplatz' };

const HINTS = {
  towers: [['hand','Tap the glowing dots'],['droplet','Stop and start the water'],['rotate-cw','Turn the wheel for the next landmark']],
  fountain: [['pause','Pause to inspect'],['smartphone','Move around the fountain'],['rotate-cw','Turn the wheel for the next landmark']],
  river: [['smartphone','Move your phone to look around'],['hand','Tap an animal'],['rotate-cw','Turn the wheel for the next landmark']],
  kanal: [['play','Start the ride'],['arrow-left','Tilt left at the gate'],['rotate-cw','Turn the wheel for the next landmark']]
};
const ANIMALS = { swan:['Mute swan','Swans pair for life and often return to the same stretch of river every year.'], gull:['Black-headed gull','In winter their “black head” fades to a small dark spot behind the eye.'], fish:['Grayling','The Lech’s clean, cold water suits grayling and trout. Look for the ripples.'], deer:['Roe deer','Roe deer come down to the riverbank at dusk. Keep still and you may spot one.'],
  blackbird:['Blackbird','Blackbirds sing from rooftops along the canals from late winter onward.'], daisies:['Daisies','The name comes from “day’s eye”: the flower opens at sunrise and closes at dusk.'] };

/* ---------------- state ---------------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem('wxr.'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('wxr.'+k, JSON.stringify(v)); }catch(e){} }
};
const S = {
  screen:null, opts:{}, history:[],
  seenWelcome: store.get('seenWelcome', false),
  settings: Object.assign({ narration:true, captions:true, reduceMotion:false }, store.get('settings', {})),
  explored: new Set(), hintsSeen: new Set(), photos: [], startedAt: null,
  stream: null, ar: null, arReady: false, arError: null, pos: null, lastShot: null
};

/* ---------------- helpers ---------------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const app = $('#app'), screens = $('#screens'), video = $('#cam');
const ic = (n, cls='') => `<i data-lucide="${n}" class="${cls}"></i>`;
const icons = () => { if (window.lucide) lucide.createIcons({ attrs:{ 'stroke-width':1.85 } }); };
let timers = [];
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
const every = (fn, ms) => { const t = setInterval(fn, ms); cleanups.push(() => clearInterval(t)); return t; };
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
let cleanups = [];
const onLeave = fn => cleanups.push(fn);
const km = (a, b) => { const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180; const h=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
const fmtDist = d => d < 0.95 ? `${Math.max(1,Math.round(d*10))*100} m` : `${d.toFixed(1)} km`;
const walk = d => { const m = Math.round(d*12); return m <= 25 ? `${m} min walk` : `${Math.round(d*4)} min by bike`; };
const distances = () => { const ref = S.pos || CENTRE; return ORDER.map(id => ({ id, d: km(ref, LM[id]) })).sort((a,b)=>a.d-b.d); };

function toast(msg, ms=2200){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true, ms); }
function vibrate(p){ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }
function speak(text){
  if (!S.settings.narration || !('speechSynthesis' in window)) return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='en-GB'; u.rate=1; speechSynthesis.speak(u); }catch(e){}
}
function stopSpeech(){ try{ speechSynthesis.cancel(); }catch(e){} }
function applySettings(){ app.classList.toggle('reduce-motion', !!S.settings.reduceMotion); store.set('settings', S.settings); }

/* ---------------- router ---------------- */
const R = {};
function go(name, opts={}, replace=false){
  clearTimers(); cleanups.forEach(f=>{try{f()}catch(e){}}); cleanups=[]; stopSpeech();
  if (!replace && S.screen) S.history.push([S.screen, S.opts]);
  S.screen = name; S.opts = opts;
  screens.innerHTML = R[name](opts);
  const el = screens.firstElementChild;
  const cam = !!(el && el.dataset.cam==='1' && S.stream);
  app.classList.toggle('show-cam', cam);
  app.classList.toggle('ar-on', !!(el && el.dataset.ar==='1'));
  icons();
  if (R[name].mount) R[name].mount(el, opts);
  screens.scrollTop = 0;
  try{ history.replaceState(null,'','#'+name); }catch(e){}
}
function back(fallback='home'){
  const prev = S.history.pop();
  if (prev) go(prev[0], prev[1], true); else go(fallback,{},true);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b){ e.preventDefault(); const n=b.dataset.go; const o=b.dataset.opt?JSON.parse(b.dataset.opt):{}; go(n,o); return; }
  if (e.target.closest('[data-back]')){ e.preventDefault(); back(); }
});

/* ---------------- camera + AR ---------------- */
async function cameraState(){
  try{ if (navigator.permissions){ const p = await navigator.permissions.query({name:'camera'}); return p.state; } }catch(e){}
  return 'prompt';
}
async function startCamera(){
  if (S.stream) return S.stream;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { const er=new Error('unsupported'); er.name='NotSupportedError'; throw er; }
  const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720} }, audio:false });
  S.stream = stream; video.srcObject = stream;
  try{ await video.play(); }catch(e){}
  if (!video.videoWidth) await new Promise(r => video.addEventListener('loadedmetadata', r, { once:true }));
  return stream;
}
function stopCamera(){
  if (S.ar) { S.ar.pause(); }
  if (S.stream){ S.stream.getTracks().forEach(t=>t.stop()); S.stream=null; video.srcObject=null; }
  app.classList.remove('show-cam','ar-on');
}
const H = { found:null, lost:null, pose:null, tap:null }; // live AR handlers, swapped per screen
async function ensureAR(){
  if (S.ar && S.ar.started) { S.ar.resume(); return S.ar; }
  if (!S.ar) {
    S.ar = new ARSession({ video, host: app, targetSrc: 'targets/targets.mind',
      onFound: id => H.found && H.found(id), onLost: id => H.lost && H.lost(id), onPose: p => H.pose && H.pose(p), onTap: (h, o) => H.tap && H.tap(h, o),
      onReady: () => { S.arReady = true; H.ready && H.ready(); } });
  }
  try { await S.ar.start(); S.arError = null; }
  catch (e) { console.error('AR start failed', e); S.arError = e; S.arReady = false; }
  return S.ar;
}
async function openCamera(){
  const st = await cameraState();
  if (st !== 'granted') go('permission', {}, false);
  try{ await startCamera(); go('scanning', {}, st!=='granted'); ensureAR(); }
  catch(err){ go('denied', { reason: err && err.name }, st!=='granted'); }
}
function lightLevel(){ // 0..255 mean luminance of the current frame
  try{ const c = lightLevel.c || (lightLevel.c = document.createElement('canvas')); c.width = 24; c.height = 24; const x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(video, 0, 0, 24, 24); const d = x.getImageData(0,0,24,24).data; let s=0; for (let i=0;i<d.length;i+=4) s += d[i]*.3+d[i+1]*.59+d[i+2]*.11; return s/(d.length/4); }catch(e){ return 128; }
}
const coach = frac => frac < 0.17 ? ['closer','Move a little closer'] : frac > 0.62 ? ['back','A little further away'] : ['ok','Perfect distance — hold steady'];

/* ---------------- shared bits ---------------- */
const logo = `<span class="logo">${ic('activity')}</span>`;
const brand = `<div class="brand">${logo}<span>Watermarks<span class="xr">XR</span></span></div>`;
const topbar = (title, right='') => `<div class="topbar pad">
  <button class="icon-btn glass" data-back aria-label="Back">${ic('chevron-left')}</button>
  <div class="t">${title}</div>${right}</div>`;
const row = (icon, title, sub, attrs='', accent=false, trail=ic('chevron-right','chev')) =>
  `<button class="row" ${attrs}><span class="ic ${accent?'accent':''}">${ic(icon)}</span><span class="tx"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</span>${trail}</button>`;
const lmDot = l => `<span class="lm-dot" style="background:${l.bg};color:${l.fg}">${ic(l.icon)}</span>`;
const nextOf = id => { const i = ORDER.indexOf(id); for (let k=1;k<=4;k++){ const n=ORDER[(i+k)%4]; if(!S.explored.has(n)) return LM[n]; } return LM[ORDER[(i+1)%4]]; };
const pinsHTML = () => ORDER.map((id,i)=>{ const l=LM[id]; return `<span class="pin" style="left:${l.pin[0]*100}%;top:${l.pin[1]*100}%;background:${l.fg}">${i+1}</span>`; }).join('');

/* ================= 01 Splash ================= */
R.splash = () => `<section class="screen splash">
  <div class="rings"><i style="width:340px;height:340px"></i><i style="width:220px;height:220px"></i><i style="width:470px;height:470px"></i></div>
  <div style="position:relative">
    <div class="mark">${ic('activity')}</div>
    <h1>Watermarks<span>XR</span></h1>
    <p>A mixed reality souvenir of Augsburg’s water heritage</p>
    <div class="loadbar"><i></i></div>
  </div>
  <div class="foot"><b>UNESCO WORLD HERITAGE</b><span>Augsburg Water Management System</span></div>
</section>`;
R.splash.mount = () => later(() => go(S.seenWelcome ? 'home' : 'welcome', {}, true), 1700);

/* ================= 02 Welcome ================= */
R.welcome = () => `<section class="screen light">
  <div class="scroll stack">
    <div class="hero-art safe-top">
      <i class="orb" style="width:300px;height:300px"></i><i class="orb" style="width:200px;height:200px"></i><i class="orb" style="width:390px;height:390px;opacity:.6"></i>
      <img class="souv" src="assets/souvenir.png" alt="The WatermarksXR souvenir: a small water wheel with four landmark panels">
      <span class="chip" style="top:16%;left:6%">${lmDot(LM.towers)} Water Towers</span>
      <span class="chip" style="top:30%;right:4%">${lmDot(LM.fountain)} Augustus Fountain</span>
      <span class="chip" style="bottom:18%;left:4%">${lmDot(LM.river)} Riverside Nature</span>
      <span class="chip" style="bottom:8%;right:10%">${lmDot(LM.kanal)} Ice Kanal</span>
    </div>
    <div class="pad stack g12" style="padding-bottom:8px">
      <div class="dots"><i class="on"></i><i></i></div>
      <p class="eyebrow accent mt8">Welcome to WatermarksXR</p>
      <h1 class="display">Your souvenir is a portal.</h1>
      <p class="body-l">Hold it, scan it — and four of Augsburg’s water landmarks come to life on your phone.</p>
    </div>
  </div>
  <div class="pad safe-bottom stack g4" style="padding-top:12px">
    <button class="btn btn-primary" data-go="how">Get started ${ic('arrow-right')}</button>
    <button class="btn btn-ghost" id="skip">Skip for now</button>
  </div>
</section>`;
R.welcome.mount = el => { $('#skip',el).onclick = () => { S.seenWelcome=true; store.set('seenWelcome',true); S.history=[]; go('home',{},true); }; };

/* ================= 03 How it works ================= */
R.how = () => `<section class="screen light">
  ${topbar('')}
  <div class="scroll pad stack g16" style="padding-bottom:16px">
    <div class="dots"><i class="done"></i><i class="on"></i></div>
    <h1 class="title-l">Three steps to explore</h1>
    <div class="steps">
      <div class="step"><span class="num">${ic('scan-line')}</span><div><b>1. Scan a panel</b><p class="body">Point your camera at one of the four landmark drawings on the wheel.</p></div></div>
      <div class="step"><span class="num">${ic('hand')}</span><div><b>2. Explore the layer</b><p class="body">The landmark appears on your souvenir. Tap the glowing dots and move around it.</p></div></div>
      <div class="step"><span class="num">${ic('rotate-cw')}</span><div><b>3. Turn to discover</b><p class="body">Spin the wheel to the next drawing and the next landmark takes over.</p></div></div>
    </div>
    <div class="note">${ic('info')}<span>All you need is the souvenir and your phone’s camera. You can revisit this anytime from Home → “How does it work?”.</span></div>
  </div>
  <div class="pad safe-bottom" style="padding-top:12px"><button class="btn btn-primary" id="start">Start exploring ${ic('arrow-right')}</button></div>
</section>`;
R.how.mount = el => { $('#start',el).onclick = () => { S.seenWelcome=true; store.set('seenWelcome',true); S.history=[]; go('home',{},true); }; };

/* ================= 04 Home ================= */
R.home = () => {
  const cards = ORDER.map(id => { const l=LM[id]; const done=S.explored.has(id);
    return `<button class="lmcard" style="background:${l.bg};color:${l.fg}" data-go="layer" data-opt='{"id":"${id}","manual":true}' aria-label="${l.name}${done?', explored':''}">
      <i class="ring"></i><span class="ib">${ic(l.icon)}</span>${done?`<span class="done">${ic('check')}</span>`:'<span class="new" aria-hidden="true"></span>'}
      <span class="eyebrow" style="color:${l.fg}">${l.eyebrow}</span><b style="color:var(--teal-950)">${l.name}</b><span class="s" style="color:var(--teal-700)">${l.sub}</span></button>`; }).join('');
  const near = distances()[0]; const nl = LM[near.id];
  return `<section class="screen light">
  <div class="topbar pad">${brand}<span style="flex:1"></span><button class="icon-btn glass" data-go="settings" aria-label="Settings and help">${ic('settings')}</button></div>
  <div class="scroll pad" style="padding-bottom:28px">
    <div class="home-hero mt8">
      <i class="ring" style="width:220px;height:220px;right:-70px;top:-60px"></i><i class="ring" style="width:140px;height:140px;right:-30px;top:-20px"></i>
      <p class="eyebrow">Your water story starts here</p>
      <h1 class="display">Your souvenir is a portal.</h1>
      <p>Point your camera at a landmark drawing on the wheel to unlock Augsburg’s water stories.</p>
      <button class="btn btn-primary" data-go="find">${ic('scan-line')} Scan your souvenir</button>
      <button class="link" data-go="guidelines">How does it work?</button>
    </div>
    <div class="sec-head"><div><p class="eyebrow">Visit the real sites</p><h2 class="h2">Find them in Augsburg</h2></div></div>
    <div class="card mapcard">
      <button class="mapimg" data-go="locations" aria-label="Open the map of the real locations" style="display:block;width:100%">
        <img src="assets/map.png" alt="">${pinsHTML()}<span class="me" style="left:16%;top:30%"></span></button>
      ${row('map',`Nearest: ${nl.name}`,`${fmtDist(near.d)} · ${walk(near.d)} · ${S.pos?'from your location':CENTRE.label}`,'data-go="locations"',true)}
    </div>
    <div class="sec-head"><div><p class="eyebrow">Explore the collection</p><h2 class="h2">Four stories, one city</h2></div><span class="chip">${S.explored.size} / 4</span></div>
    <div class="grid2">${cards}</div>
    <div class="card list mt16">${row('book-open','The Augsburg water story','UNESCO World Heritage','data-go="story"')}</div>
  </div>
  <nav class="bottomnav" aria-label="Main">
    <button class="on" aria-current="page">${ic('house')}Home</button>
    <button class="fab" data-go="find" aria-label="Scan your souvenir">${ic('scan-line')}</button>
    <button data-go="saved">${ic('bookmark')}Saved</button>
  </nav>
</section>`; };
R.home.mount = () => { stopCamera(); };

/* ================= 05 Settings & Help ================= */
const sw = (k,label,sub,icon) => `<div class="row" role="group"><span class="ic">${ic(icon)}</span><span class="tx"><b>${label}</b><span>${sub}</span></span>
  <button class="switch" role="switch" aria-checked="${!!S.settings[k]}" aria-label="${label}" data-k="${k}"></button></div>`;
R.settings = () => `<section class="screen light">
  ${topbar('Settings & Help')}
  <div class="scroll pad stack g12 safe-bottom">
    <p class="eyebrow mt8">Preferences</p>
    <div class="card list">${sw('narration','Audio narration','Spoken stories in each layer','volume-2')}${sw('captions','Captions','Subtitles for narration','captions')}${sw('reduceMotion','Reduce motion','Calmer transitions in the layers','sparkles')}</div>
    <p class="eyebrow mt16">Help</p>
    <div class="card list">${row('book-open','How it works','Guidelines for the digital layers','data-go="guidelines"')}${row('shield','Camera, motion & privacy','What the app uses and why','data-go="privacy"')}${row('rotate-ccw','Show the intro again','Welcome and the three steps','id="replay"')}</div>
    <p class="small center mt16">WatermarksXR ${VERSION} · Made in Augsburg</p>
  </div>
</section>`;
R.settings.mount = el => {
  $$('.switch',el).forEach(b => b.onclick = () => { const k=b.dataset.k; S.settings[k]=!S.settings[k]; b.setAttribute('aria-checked', S.settings[k]); applySettings(); });
  $('#replay',el).onclick = () => { S.seenWelcome=false; store.set('seenWelcome',false); S.history=[]; go('welcome',{},true); };
};
R.privacy = () => `<section class="screen light">
  ${topbar('Camera, motion & privacy')}
  <div class="scroll pad stack g16 safe-bottom">
    <h1 class="title-l mt8">Everything stays on your phone.</h1>
    <div class="card list">
      ${row('camera','Camera','Recognises the souvenir panels. Frames are processed on the device and never uploaded.','',false,'')}
      ${row('smartphone','Motion sensors','Let you look around the riverbank and lean into the canoe turn. Asked for only when a layer needs them.','',false,'')}
      ${row('map-pin','Location','Optional. Shows how far the real sites are from you on the map screen.','',false,'')}
      ${row('image','Photos','Only kept when you tap Save or Share.','',false,'')}
      ${row('shield','Turn anything off','In your browser’s site settings, at any time.','',false,'')}
    </div>
  </div>
</section>`;

/* ================= 06 Guidelines ================= */
R.guidelines = () => `<section class="screen light">
  ${topbar('How it works')}
  <div class="scroll pad stack g12" style="padding-bottom:16px">
    <div class="card list mt8">
      ${row('sun','1. Find good light','Even light, no strong shadows on the drawing','',false,'')}
      ${row('scan-line','2. Fill the frame','Hold the phone 10–20 cm away, one drawing in the frame','',false,'')}
      ${row('hand','3. Interact','Tap the glowing dots, move around the landmark','',false,'')}
      ${row('rotate-cw','4. Turn to switch','Spin the wheel to the next drawing','',false,'')}
    </div>
    <div class="note">${ic('lightbulb')}<span>Lost? Tap “?” inside a layer for a hint.</span></div>
  </div>
  <div class="pad safe-bottom" style="padding-top:12px"><button class="btn btn-primary" data-go="find">${ic('scan-line')} Try it now</button></div>
</section>`;

/* ================= 07 Visit the Real Locations ================= */
R.locations = (o) => { const mode=o.mode||'map'; const ds = distances();
  const rows = ds.map(({id,d},i)=>{ const l=LM[id];
    return `<a class="row" href="${l.maps}" target="_blank" rel="noopener"><span class="ic" style="background:${l.bg};color:${l.fg}">${ic(l.icon)}</span><span class="tx"><b>${ORDER.indexOf(id)+1}  ${l.name}</b><span>${l.place} · ${fmtDist(d)} · ${walk(d)}</span></span>${ic('navigation','chev')}</a>`; }).join('');
  return `<section class="screen light">
  ${topbar('Visit the real sites')}
  <div class="scroll pad stack g16 safe-bottom">
    <div class="seg mt8" role="tablist"><button role="tab" class="${mode==='map'?'on':''}" data-m="map">Map</button><button role="tab" class="${mode==='list'?'on':''}" data-m="list">List</button></div>
    ${mode==='map'?`<div class="bigmap"><img src="assets/map.png" alt="Map of Augsburg with the four landmark sites">${pinsHTML()}<span class="me" style="left:16%;top:30%"></span></div>`:''}
    <div class="card list">${rows}</div>
    <button class="btn btn-secondary sm" id="loc" style="align-self:flex-start">${ic('locate')} ${S.pos?'Update my location':'Use my location'}</button>
    <p class="small">Distances ${S.pos?'from your location':CENTRE.label}. Tapping a site opens it in Google Maps.</p>
  </div>
</section>`; };
R.locations.mount = el => {
  $$('[data-m]',el).forEach(b => b.onclick = () => go('locations',{mode:b.dataset.m},true));
  $('#loc',el).onclick = () => { if (!navigator.geolocation) { toast('Location is not available on this device'); return; }
    const b=$('#loc',el); b.disabled=true; b.textContent='Locating…';
    navigator.geolocation.getCurrentPosition(p => { S.pos = { lat:p.coords.latitude, lng:p.coords.longitude }; go('locations', S.opts, true); toast('Distances updated from your location'); },
      () => { b.disabled=false; b.innerHTML=`${ic('locate')} Use my location`; icons(); toast('Location is off — showing distances from the city centre'); }, { enableHighAccuracy:false, timeout:8000, maximumAge:60000 }); };
};

/* ================= 08 The Augsburg Water Story ================= */
R.story = () => `<section class="screen light">
  ${topbar('The water story')}
  <div class="scroll pad stack g20" style="padding-bottom:16px">
    <div class="story-hero mt8"><p class="eyebrow">5 min read</p><h1 class="title-l">A city built on water.</h1><p style="color:rgba(255,255,255,.78);line-height:1.5;font-size:14.5px">How Augsburg tamed two rivers and became a World Heritage Site.</p></div>
    <p class="body-l">For centuries Augsburg channelled the Lech and Wertach rivers into canals, water towers and fountains. Clean drinking water and process water were kept apart, and water power drove the city’s mills and crafts.</p>
    <div class="timeline">
      <div><b>MIDDLE AGES</b><p class="body">Canals bring river water into the city.</p></div>
      <div><b>15TH–17TH CENTURY</b><p class="body">Water towers lift water for the fountains.</p></div>
      <div><b>2019</b><p class="body">The water management system is listed as UNESCO World Heritage.</p></div>
    </div>
  </div>
  <div class="pad safe-bottom sticky-foot"><button class="btn btn-primary" data-go="find">${ic('scan-line')} See it on your souvenir</button></div>
</section>`;

/* ================= 09 Find your Souvenir ================= */
R.find = () => `<section class="screen light">
  ${topbar('Scan your souvenir')}
  <div class="scroll pad stack g16" style="padding-bottom:12px">
    <div class="find-hero mt8"><div class="frame"><i></i><i></i><i></i><i></i></div><img src="assets/souvenir-front.png" alt="The souvenir’s front landmark panel inside a scan frame"></div>
    <div class="stack g8"><h1 class="title-l">Find your souvenir</h1>
    <p class="body-l">Point your phone at one landmark drawing on the wheel. The app recognises it and the landmark appears on top.</p></div>
    <div class="card list">
      ${row('sun','Find even light','Avoid strong backlight or shadows','',false,'')}
      <div class="distance"><b class="h3">Hold it 10–20 cm away</b>
        <div class="dist-diagram">${ic('smartphone')}<span class="line"><span>10–20 cm</span></span><img src="assets/souvenir-front.png" alt=""></div>
        <div class="range"><span><i></i>Too close</span><span class="ok"><i></i>Just right</span><span><i></i>Too far</span></div>
      </div>
    </div>
    <p class="small">Next, your browser asks for camera access. The image stays on your phone.</p>
  </div>
  <div class="pad safe-bottom stack g4" style="padding-top:12px">
    <button class="btn btn-primary" id="open">${ic('camera')} Open camera</button>
    <button class="btn btn-ghost" data-go="manual">${ic('layout-grid')} Choose landmark manually</button>
  </div>
</section>`;
R.find.mount = el => { $('#open',el).onclick = openCamera; };

/* ================= 10 Camera Permission (waiting for the real prompt) ================= */
R.permission = () => `<section class="screen dark solid">
  <div class="scroll pad stack g16 safe-top" style="justify-content:center;text-align:center;align-items:center">
    <span class="icon-btn l accent" style="width:72px;height:72px">${ic('camera')}</span>
    <h1 class="title-l" style="color:#fff">Allow camera access</h1>
    <p class="body-l" style="max-width:300px">Your browser is asking now. Tap <b style="color:#fff">Allow</b> so WatermarksXR can recognise your souvenir.</p>
  </div>
</section>`;

/* ================= 11 Permission Denied ================= */
R.denied = (o) => { const unsupported = o.reason==='NotSupportedError' || o.reason==='NotFoundError';
  return `<section class="screen light">
  ${topbar('')}
  <div class="scroll pad stack g16" style="padding-bottom:12px">
    <span class="alert-ic" style="width:64px;height:64px">${ic(unsupported?'video-off':'camera-off')}</span>
    <h1 class="title-l">${unsupported?'No camera available here':'Camera access is off'}</h1>
    <p class="body-l">${unsupported?'This browser or device can’t open a camera. Open the link on your phone in Safari or Chrome, or choose the landmark manually.':'WatermarksXR needs the camera only to recognise the landmark drawings on your souvenir.'}</p>
    <div class="card list">${row('eye','Recognition stays on your phone','Nothing is uploaded','',false,'')}${row('image','No photos without you','Only when you tap Save','',false,'')}${row('shield','Turn it off anytime','In your browser settings','',false,'')}</div>
    ${unsupported?'':`<div class="note">${ic('info')}<span><b>To allow it:</b> iPhone — tap “aA” in Safari’s address bar → Website Settings → Camera → Allow. Android — tap the lock icon next to the address → Permissions → Camera → Allow. Then tap Try again.</span></div>`}
  </div>
  <div class="pad safe-bottom stack g4" style="padding-top:12px">
    ${unsupported?'':`<button class="btn btn-primary" id="retry">${ic('rotate-cw')} Try again</button>`}
    <button class="btn btn-ghost" data-go="manual">${ic('layout-grid')} Choose landmark manually</button>
  </div>
</section>`; };
R.denied.mount = el => { const r=$('#retry',el); if(r) r.onclick = async () => { try{ await startCamera(); go('scanning',{},true); ensureAR(); }catch(e){ toast('Camera is still blocked. Change it in your browser settings.'); } }; };

/* ================= 12 Scanning + 13 Scan Failed ================= */
R.scanning = () => `<section class="screen dark ar" data-cam="1" data-ar="1">
  ${S.stream?'':`<div class="nocam"><img src="assets/souvenir-front.png" alt=""></div>`}
  <div class="cam-shade"></div>
  <div class="layer-top pad">
    <button class="icon-btn overlay" id="sback" aria-label="Back">${ic('chevron-left')}</button>
    <div class="lhead"><div style="padding-left:14px"><b id="sstatus">${S.arReady?'Looking for a drawing…':'Preparing recognition…'}</b></div></div>
    <button class="icon-btn overlay" data-go="guidelines" aria-label="Help">${ic('circle-help')}</button>
  </div>
  <div class="scanbox" id="box"><div class="frame"><i></i><i></i><i></i><i></i></div><span class="scanline" id="line"></span></div>
  <div class="scan-ui">
    <div class="stack g4"><h2 id="sh">Fit one drawing in the frame</h2><p class="body" id="ssub">Hold the phone 10–20 cm from the panel</p></div>
    <div class="meter" aria-label="Distance to the souvenir"><span><i></i>Too close</span><span class="ok"><i></i>Just right</span><span><i></i>Too far</span><b class="dot" id="mdot" hidden></b></div>
    <div class="chips"><span class="chip overlay" id="clight">${ic('sun')} Good light</span><span class="chip overlay">${ic('hand')} Hold steady</span></div>
    ${DEV?`<div class="proto" id="proto"><p>Dev · simulate recognition</p><div class="opts">${ORDER.map(id=>`<button data-sim="${id}">${LM[id].name}</button>`).join('')}<button class="no" data-sim="none">No match</button></div></div>`:''}
    <button class="btn btn-secondary sm" data-go="manual">${ic('layout-grid')} Choose manually</button>
  </div>
</section>`;
R.scanning.mount = el => {
  $('#sback',el).onclick = () => { stopCamera(); S.history=[]; go('find',{},true); };
  const status=$('#sstatus',el), sh=$('#sh',el), sub=$('#ssub',el), dot=$('#mdot',el), box=$('#box',el), light=$('#clight',el);
  let locked=false; const t0 = performance.now();
  const stage = () => { if (locked) return; const s=(performance.now()-t0)/1000;
    if (!S.arReady) { status.textContent = S.arError ? 'Recognition unavailable' : 'Preparing recognition…'; if (S.arError){ sh.textContent='Recognition can’t start on this browser'; sub.textContent='Choose the landmark manually below'; } return; }
    status.textContent='Looking for a drawing…';
    if (s < 6) { sh.textContent='Fit one drawing in the frame'; sub.textContent='Hold the phone 10–20 cm from the panel'; }
    else if (s < 12) { sh.textContent='Move a little closer'; sub.textContent='The drawing should fill about a third of the screen'; }
    else { sh.textContent='Hold steady in good light'; sub.textContent='Try tilting the phone to avoid glare'; } };
  every(stage, 500); stage();
  every(() => { const l = lightLevel(); const dark = l < 55; light.classList.toggle('warn', dark); light.innerHTML = `${ic(dark?'sun-dim':'sun')} ${dark?'More light needed':'Good light'}`; icons(); }, 1200);
  H.ready = () => stage();
  H.pose = ({frac}) => { const [k,txt] = coach(frac); dot.hidden=false; dot.style.left = (Math.min(1, frac/0.8)*100)+'%'; if (!locked) sub.textContent = txt; };
  H.found = id => { if (locked) return; locked=true; clearTimers();
    box.classList.add('match'); const ln=$('#line',el); if (ln) ln.remove(); vibrate(30);
    status.textContent='Drawing recognised'; sh.textContent=LM[id].name; sub.textContent='Opening the layer…';
    const sheet=$('.sheet-wrap',el); if (sheet) sheet.remove();
    later(()=>go('layer',{id, ar:true},true), 700); };
  H.lost = () => {}; H.tap = null;
  if (DEV) $$('[data-sim]',el).forEach(b => b.onclick = () => b.dataset.sim==='none' ? showFailed(el) : (S.ar && S.ar.pause(), go('layer',{id:b.dataset.sim, manual:true},true)));
  later(()=>{ if(!locked) showFailed(el); }, 18000);
  onLeave(() => { H.ready=null; H.pose=null; H.found=null; });
};
function showFailed(el){
  if ($('.sheet-wrap',el)) return;
  el.insertAdjacentHTML('beforeend', `<div class="sheet-wrap"><div class="sheet" role="dialog" aria-label="We couldn’t recognise it">
    <div class="handle"></div>
    <div style="display:flex;gap:14px;align-items:center"><span class="alert-ic">${ic('triangle-alert')}</span><div><h2 class="h2">We couldn’t recognise it yet</h2><p class="body">No problem — try one of these:</p></div></div>
    <div class="card list mt16">${row('move','Move closer','About 10–20 cm, one drawing filling the frame','',false,'')}${row('sun','Find better light','Avoid glare and strong shadows','',false,'')}${row('rotate-cw','Try another panel','Each drawing shows one landmark','',false,'')}</div>
    <div class="stack g8 mt16"><button class="btn btn-primary" id="again">${ic('scan-line')} Keep scanning</button><button class="btn btn-secondary" data-go="manual">${ic('layout-grid')} Choose landmark manually</button></div>
  </div></div>`);
  icons(); vibrate([20,40,20]);
  $('#again',el).onclick = () => go('scanning',{},true);
}

/* ================= 14 Manual Selection ================= */
R.manual = (o) => { const sel=o.sel||null;
  const cards = ORDER.map(id=>{ const l=LM[id]; const on=sel===id;
    return `<button class="lmcard panel" style="background:${l.bg};color:${l.fg};${on?'box-shadow:0 0 0 3px var(--orange-500)':''}" data-sel="${id}" aria-pressed="${on}">
      <img src="assets/panel-${id}.jpg" alt="">${on?`<span class="done" style="background:var(--orange-500);color:#fff">${ic('check')}</span>`:''}
      <span class="eyebrow" style="color:${l.fg}">${l.eyebrow}</span><b style="color:var(--teal-950)">${l.name}</b></button>`; }).join('');
  return `<section class="screen light">
  ${topbar('Choose a landmark')}
  <div class="scroll pad stack g16" style="padding-bottom:12px">
    <p class="body-l mt8">Select the drawing on the panel facing you.</p>
    <div class="grid2">${cards}</div>
    <div class="note">${ic('info')}<span>In manual mode the layer appears on screen instead of on the souvenir.</span></div>
  </div>
  <div class="pad safe-bottom" style="padding-top:12px"><button class="btn btn-primary" id="enter" ${sel?'':'disabled style="opacity:.45"'}>Enter layer ${ic('arrow-right')}</button></div>
</section>`; };
R.manual.mount = (el,o) => {
  stopCamera();
  $$('[data-sel]',el).forEach(b => b.onclick = () => go('manual',{sel:b.dataset.sel},true));
  $('#enter',el).onclick = () => { if (o.sel) go('layer',{id:o.sel, manual:true}); };
};

/* ================= 15–18 Digital layers ================= */
const towerSVG = `<svg class="tower" viewBox="0 0 280 380" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" role="img" aria-label="Translucent model of the water towers">
  <rect x="40" y="350" width="200" height="14" rx="4" fill="rgba(122,196,214,.45)" stroke="rgba(255,255,255,.8)"/>
  <rect x="70" y="120" width="96" height="232" fill="rgba(255,255,255,.08)"/>
  <path d="M60 120h116l-12-20H72z" fill="rgba(255,255,255,.12)"/>
  <rect x="84" y="40" width="70" height="60" fill="rgba(255,255,255,.1)"/>
  <rect x="88" y="48" width="62" height="16" rx="3" class="water" fill="rgba(122,196,214,.85)" stroke="none"/>
  <g stroke-width="2"><line x1="90" y1="40" x2="90" y2="26"/><line x1="106" y1="40" x2="106" y2="26"/><line x1="122" y1="40" x2="122" y2="26"/><line x1="138" y1="40" x2="138" y2="26"/><line x1="152" y1="40" x2="152" y2="26"/></g>
  <g fill="#fff"><circle cx="90" cy="24" r="4"/><circle cx="106" cy="24" r="4"/><circle cx="122" cy="24" r="4"/><circle cx="138" cy="24" r="4"/><circle cx="152" cy="24" r="4"/></g>
  <rect x="112" y="64" width="16" height="286" rx="8" class="water" fill="rgba(90,170,200,.8)" stroke="none"/>
  <path class="flow water" d="M120 346V70" stroke="#e8f7fb" stroke-width="3" stroke-linecap="round"/>
  <g stroke-width="1.6"><rect x="80" y="150" width="14" height="22"/><rect x="142" y="150" width="14" height="22"/><rect x="80" y="210" width="14" height="22"/><rect x="142" y="210" width="14" height="22"/><rect x="80" y="270" width="14" height="22"/><rect x="142" y="270" width="14" height="22"/></g>
  <path d="M166 220h56v130h-56z" fill="rgba(255,255,255,.06)"/><path d="M162 222l32-30 32 30" fill="rgba(255,255,255,.06)"/>
  <g stroke-width="1.6"><rect x="178" y="250" width="12" height="18"/><rect x="200" y="250" width="12" height="18"/></g>
</svg>`;

R.layer = (o) => {
  const l = LM[o.id]; S.current = o.id; S.explored.add(o.id); if (!S.startedAt) S.startedAt = Date.now();
  const ar = !!o.ar; const lightBg = !ar && o.id==='fountain';
  const dots = ORDER.map(id=>`<i class="${id===o.id?'on':S.explored.has(id)?'done':''}"></i>`).join('');
  const nxt = nextOf(o.id);
  let stage='', main='';
  if (o.id==='towers') main = `<button class="main" id="mainbtn" aria-pressed="true">${ic('droplet')}<span>Water flowing</span></button>`;
  if (o.id==='fountain') main = `<button class="main" id="mainbtn" aria-pressed="false">${ic('pause')}<span>Pause rotation</span></button>`;
  if (o.id==='river') main = `<button class="main off" id="mainbtn">${ic('eye')}<span id="found">0 of 4 found</span></button>`;
  if (o.id==='kanal') main = `<button class="main" id="mainbtn">${ic('play')}<span>Start ride</span></button>`;
  if (!ar) {
    if (o.id==='towers') stage = `<div class="stagearea" id="stage">${towerSVG}
      <button class="hotspot" style="left:58%;top:24%" data-info="Top reservoir|Water collected up here, high above the city, then ran down through pipes to the fountains by gravity."><span class="d"></span><span>Top reservoir</span></button>
      <button class="hotspot" style="left:52%;top:55%" data-info="Archimedes screw|A turning screw inside a pipe lifts water step by step — powered by a water wheel, like the one on your souvenir."><span class="d"></span><span>Archimedes screw</span></button></div>`;
    if (o.id==='fountain') stage = `<div class="focus-bg"></div><div class="stagearea" id="stage"><div class="fountain-wrap" id="zoomable"><img class="fountain" id="fimg" src="assets/fountain.png" alt="Model of the Augustus Fountain"></div>
      <button class="hotspot" style="left:56%;top:24%" data-info="Augustus statue|The Roman emperor Augustus, namesake of the city, raises his arm above the column."><span class="d"></span><span>Augustus statue</span></button>
      <button class="hotspot" style="left:18%;top:62%" data-info="River figures|Four reclining bronze figures around the basin stand for Augsburg’s waters: Lech, Wertach, Singold and Brunnenbach."><span class="d"></span><span>River figures</span></button></div>`;
    if (o.id==='river') stage = `<div class="stagearea" id="stage"><div class="portal" id="portal"><img id="pimg" src="assets/riverside.png" alt="Storybook riverbank on the Lech">
      ${[['swan',53,68],['blackbird',86,53],['gull',80,19],['daisies',15,89]].map(([a,x,y])=>`<button class="animal" style="left:${x}%;top:${y}%" data-animal="${a}" aria-label="Animal"></button>`).join('')}</div></div>`;
    if (o.id==='kanal') stage = `<div class="stagearea" id="stage"><div class="portal ride calm" id="ride"><img src="assets/icekanal.png" alt="First-person view down the Eiskanal in a canoe"><div id="rideui"></div></div></div>`;
  } else if (o.id==='kanal') stage = `<div class="rideui-ar" id="rideui"></div>`;
  return `<section class="screen dark ${ar?'ar':''} ${lightBg?'light-layer':''} ${!ar && !lightBg?'solid':''}" data-cam="${ar?1:0}" data-ar="${ar?1:0}">
  ${ar?'<div class="cam-shade"></div>':''}
  ${stage}
  <div class="layer-top pad">
    <button class="icon-btn overlay" id="lback" aria-label="Back to Home">${ic('chevron-left')}</button>
    <div class="lhead"><div><span class="lic" style="background:${l.bg};color:${l.fg}">${ic(l.icon)}</span><b>${l.name}</b><span class="dots">${dots}</span></div></div>
    <button class="icon-btn overlay" id="lhelp" aria-label="Show hint">${ic('circle-help')}</button>
  </div>
  ${ar?`<div class="track-chip" id="track" hidden>${ic('scan-line')}<span>Point the camera back at the drawing</span></div>`:''}
  <div class="dock-wrap">
    ${S.settings.captions?`<p class="caption" id="cap">${l.intro}</p>`:''}
    <button class="wheel-cue" id="cue">${ic('rotate-cw')} Turn the wheel → ${nxt.name}</button>
    <div class="dock">${main}
      <button class="icon-btn" id="hintbtn" aria-label="Hints">${ic('lightbulb')}</button>
      <button class="icon-btn" id="capbtn" aria-label="Take a photo">${ic('camera')}</button>
      <button class="icon-btn" id="layersbtn" aria-label="Explore another layer">${ic('layers')}</button></div>
  </div>
</section>`; };
R.layer.mount = (el,o) => {
  const l = LM[o.id]; const ar = !!o.ar; const sc = ar && S.ar ? S.ar.scenes[o.id] : null;
  $('#lback',el).onclick = () => { S.history=[]; go('home',{},true); };
  $('#layersbtn',el).onclick = () => showLayers(el,o.id);
  $('#cue',el).onclick = () => showLayers(el,o.id);
  $('#capbtn',el).onclick = () => capture(o.id, ar);
  let hintIdx = 0;
  const showHint = () => { const h=HINTS[o.id][hintIdx%3]; hintIdx++; const old=$('.hint',el); if(old) old.remove();
    el.insertAdjacentHTML('beforeend', `<div class="hint" role="status"><span class="gv">${ic(h[0])}</span><b><small>HINT ${((hintIdx-1)%3)+1} OF 3</small>${h[1]}</b><button class="icon-btn" aria-label="Dismiss hint" style="color:#fff">${ic('x')}</button></div>`);
    icons(); $('#hintbtn',el).classList.add('on'); const hh=$('.hint',el);
    hh.querySelector('button').onclick = () => { hh.remove(); $('#hintbtn',el).classList.remove('on'); };
    later(()=>{ if(hh.isConnected){ hh.remove(); $('#hintbtn',el).classList.remove('on'); } }, 6000); };
  $('#hintbtn',el).onclick = showHint; $('#lhelp',el).onclick = showHint;
  if (!S.hintsSeen.has(o.id)) { S.hintsSeen.add(o.id); later(showHint, 900); }
  speak(l.intro);
  $$('[data-info]',el).forEach(b => b.onclick = () => { const [t,d]=b.dataset.info.split('|'); infoCard(el,t,d); });

  if (ar) {
    // live tracking: coaching chip, re-acquire, and automatic switch when the wheel is turned
    const track = $('#track',el);
    H.found = id => { if (id !== o.id) { toast(`${LM[id].name} recognised`); go('layer',{id, ar:true},true); } else { track.hidden = true; } };
    H.lost = () => { track.hidden = false; track.innerHTML = `${ic('scan-line')}<span>Point the camera back at the drawing</span>`; icons(); };
    H.pose = ({frac}) => { const [k,txt] = coach(frac); if (k==='ok') { if (!track.hidden) track.hidden = true; } else { track.hidden = false; track.innerHTML = `${ic(k==='closer'?'zoom-in':'zoom-out')}<span>${txt}</span>`; icons(); } };
    H.tap = (hit) => { infoCard(el, hit.title, hit.text); if (o.id==='river' && hit.key) riverFound(hit.key); };
    if (S.ar && S.ar.active && S.ar.active !== o.id) { /* different panel already in view */ }
    if (S.ar && !S.ar.active) track.hidden = false;
    onLeave(() => { H.found=null; H.lost=null; H.pose=null; H.tap=null; });
  }

  // layer-specific behaviour
  if (o.id==='towers'){ const btn=$('#mainbtn',el); let flow = true;
    btn.onclick = () => { flow = !flow; btn.classList.toggle('off', !flow); btn.setAttribute('aria-pressed', flow); btn.querySelector('span').textContent = flow ? 'Water flowing' : 'Water stopped'; vibrate(15);
      if (sc) sc.setFlow(flow); const svg=$('.tower',el); if (svg) svg.classList.toggle('off', !flow); };
    if (!ar) pinchZoom($('#stage',el), $('.tower',el)); }
  if (o.id==='fountain'){ const btn=$('#mainbtn',el); let paused=false;
    btn.onclick = () => { paused=!paused; btn.setAttribute('aria-pressed',paused); btn.innerHTML = paused ? `${ic('play')}<span>Resume rotation</span>` : `${ic('pause')}<span>Pause rotation</span>`; icons();
      if (sc) sc.setPaused(paused); const img=$('#fimg',el); if (img) img.classList.toggle('paused', paused); };
    if (!ar) pinchZoom($('#stage',el), $('#zoomable',el)); }
  const found = new Set();
  const riverFound = key => { if (found.has(key)) return; found.add(key); const f=$('#found',el); if (f) f.textContent = `${found.size} of 4 found`; vibrate(15); if (sc) sc.markFound(key); if (found.size===4) toast('You found every animal!'); };
  if (o.id==='river') { if (ar) { $('#mainbtn',el).onclick = () => toast('Tap the glowing dots on the riverbank'); } else riverLayer(el, riverFound); }
  if (o.id==='kanal') kanalLayer(el, sc, ar);
};

function infoCard(el, title, text){
  const old=$('.infocard',el); if(old) old.remove();
  el.insertAdjacentHTML('beforeend', `<div class="infocard" role="dialog" aria-label="${title}"><button class="icon-btn x" aria-label="Close">${ic('x')}</button><p class="eyebrow accent">Hotspot</p><h3 class="h2 mt8" style="padding-right:36px">${title}</h3><p class="body mt8">${text}</p></div>`);
  icons(); const c=$('.infocard',el); c.querySelector('.x').onclick=()=>c.remove(); speak(title+'. '+text);
}

function pinchZoom(area, target){
  if (!area || !target) return;
  let s=1, start=0, base=1;
  const d = t => Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY);
  area.addEventListener('touchstart', e => { if (e.touches.length===2){ start=d(e.touches); base=s; } }, {passive:true});
  area.addEventListener('touchmove', e => { if (e.touches.length===2 && start){ e.preventDefault(); s=Math.min(2.4,Math.max(.8, base*d(e.touches)/start)); target.style.transform=`scale(${s})`; } }, {passive:false});
  area.addEventListener('touchend', () => { start=0; });
  let last=0; area.addEventListener('click', e => { if (e.target.closest('button')) return; const n=Date.now(); if (n-last<300){ s = s>1.1?1:1.8; target.style.transition='transform .25s'; target.style.transform=`scale(${s})`; later(()=>target.style.transition='',260); } last=n; });
}

/* motion: device orientation (asks permission on iOS) */
async function enableMotion(){
  try{ if (typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){ const r = await DeviceOrientationEvent.requestPermission(); return r==='granted'; } }catch(e){ return false; }
  return 'DeviceOrientationEvent' in window;
}

function riverLayer(el, riverFound){
  const img=$('#pimg',el), portal=$('#portal',el);
  $$('[data-animal]',el).forEach(b => b.onclick = () => { const a=b.dataset.animal; b.classList.add('found'); const [t,d]=ANIMALS[a]; infoCard(el,t,d); riverFound(a); });
  const move=(x,y)=>{ img.style.transform=`translate(${x*-4}%,${y*-3}%)`; };
  portal.addEventListener('pointermove', e => { const r=portal.getBoundingClientRect(); move((e.clientX-r.left)/r.width-.5,(e.clientY-r.top)/r.height-.5); });
  const or = e => { if (e.gamma==null) return; move(Math.max(-1,Math.min(1,e.gamma/30))*.5, Math.max(-1,Math.min(1,(e.beta-45)/30))*.5); };
  $('#mainbtn',el).onclick = async () => { if (await enableMotion()){ window.addEventListener('deviceorientation', or); toast('Move your phone to look around'); } };
  if (typeof DeviceOrientationEvent==='undefined' || typeof DeviceOrientationEvent.requestPermission!=='function') window.addEventListener('deviceorientation', or);
  onLeave(()=>window.removeEventListener('deviceorientation', or));
}

function kanalLayer(el, sc, ar){
  const ride=$('#ride',el), ui=$('#rideui',el), btn=$('#mainbtn',el);
  const PH=['Start','Flow','Approach','Decision','Recovery','Final'];
  let phase=-1, decided=false, running=false, prog=0, progTimer=null;
  const bar = () => `<div class="phasebar"><span class="phases">${PH.map((p,i)=>`<i class="${i<phase?'done':i===phase?'on':''}"></i>`).join('')}</span><span class="chip overlay">${PH[Math.max(0,phase)]}</span></div>`;
  const setProg = p => { prog=p; if (sc) sc.setProgress(p); };
  const animateTo = (target, ms) => { if (progTimer) clearInterval(progTimer); const from=prog, t0=performance.now(); progTimer=setInterval(()=>{ const k=Math.min(1,(performance.now()-t0)/ms); setProg(from+(target-from)*k); if(k>=1){ clearInterval(progTimer); progTimer=null; } }, 40); };
  onLeave(()=>{ if (progTimer) clearInterval(progTimer); });
  const lean = () => { if (phase!==3 || decided) return; decided=true; if (sc) sc.lean(); outcome(true); };
  const or = e => { if (e.gamma!=null && e.gamma < -14) lean(); };
  const outcome = clean => { if (sc) sc.setOutcome(clean?'clean':'chaotic');
    ui.innerHTML = bar() + `<div class="decision"><div class="stack g8 center" style="color:#fff;padding:20px"><span class="icon-btn l accent" style="margin:0 auto">${ic(clean?'check':'waves')}</span><b style="font-size:20px">${clean?'Clean turn!':'Chaotic turn!'}</b><span class="small">${clean?'Perfect timing through the upstream gate.':'A little late — the current took over, but you made it.'}</span></div></div>`;
    icons(); vibrate(clean?30:[30,40,30]); speak(clean?'Clean turn! Perfect timing.':'Chaotic turn. The current took over, but you made it.'); later(()=>step(4),2600); };
  const step = p => { phase=p; if (ride) ride.classList.toggle('calm', p<2||p>=4);
    if (p===0) animateTo(0.15, 1500); if (p===1) animateTo(0.38, 2600); if (p===2) animateTo(0.5, 2600); if (p===4) { if (sc) sc.setOutcome(null); animateTo(0.78, 2200); } if (p===5) animateTo(1, 1600);
    if (p===3){ ui.innerHTML = bar() + `<div class="decision"><div class="ring"></div><button class="btn btn-primary sm lean" id="leanbtn">${ic('arrow-left')} Lean left now!</button></div>`; icons(); $('#leanbtn',el).onclick=lean; vibrate(60); later(()=>{ if(!decided){ decided=true; outcome(false); } },3000); return; }
    ui.innerHTML = bar(); if (p<3) later(()=>step(p+1), p===0?1500:2600);
    if (p===4) later(()=>step(5),2200);
    if (p===5){ later(()=>{ ui.innerHTML = bar()+`<div class="decision"><div class="stack g8 center" style="color:#fff"><b style="font-size:20px">Ride complete</b><span class="small">Turn the wheel for the next landmark</span></div></div>`; running=false; btn.innerHTML=`${ic('rotate-ccw')}<span>Ride again</span>`; icons(); },1600); } };
  btn.onclick = async () => { if (running) return; running=true; decided=false; setProg(0); btn.innerHTML=`${ic('wind')}<span>Riding…</span>`; icons(); if (await enableMotion()) window.addEventListener('deviceorientation', or); step(0); };
  onLeave(()=>window.removeEventListener('deviceorientation', or));
}

/* ================= 20 Explore another layer (sheet) ================= */
function showLayers(el, cur){
  const rows = ORDER.map(id=>{ const l=LM[id]; const st = id===cur?'Current':S.explored.has(id)?'Explored':'New';
    return `<button class="row" data-pick="${id}"><span class="ic" style="background:${l.bg};color:${l.fg}">${ic(l.icon)}</span><span class="tx"><b>${l.name}</b><span>${st}</span></span>${id===cur?`<span class="chip accent">Now</span>`:S.explored.has(id)?ic('circle-check','chev'):ic('chevron-right','chev')}</button>`; }).join('');
  el.insertAdjacentHTML('beforeend', `<div class="sheet-wrap" id="lsheet"><div class="sheet" role="dialog" aria-label="Explore another layer"><div class="handle"></div>
    <p class="eyebrow">${S.explored.size} of 4 explored</p><h2 class="h2 mt8">Explore another layer</h2>
    <div class="note mt16">${ic('rotate-cw')}<span><b>Turn the wheel</b> on your souvenir to the next drawing — the app switches by itself. Or pick a landmark below.</span></div>
    <div class="card list mt16">${rows}</div>
    <div class="stack g4 mt16"><button class="btn btn-primary" id="rescan">${ic('scan-line')} Scan the next drawing</button><button class="btn btn-ghost" id="endx">End the experience</button></div>
  </div></div>`);
  icons(); const sh=$('#lsheet',el);
  sh.addEventListener('click', e => { if (e.target===sh) sh.remove(); });
  $$('[data-pick]',sh).forEach(b => b.onclick = () => { if (b.dataset.pick===cur){ sh.remove(); return; } const arNow = !!S.opts.ar && S.ar && S.ar.started; go('layer',{id:b.dataset.pick, ar:arNow, manual:!arNow},true); });
  $('#rescan',sh).onclick = async () => { try{ await startCamera(); go('scanning',{},true); ensureAR(); }catch(e){ go('denied',{reason:e&&e.name}); } };
  $('#endx',sh).onclick = () => go('end',{},true);
}

/* ================= 21 Capture & Share ================= */
function loadImg(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }
async function capture(id, ar){
  const l=LM[id]; let c, x;
  if (ar && S.ar && S.ar.started) { c = S.ar.snapshot(1080); x = c.getContext('2d'); }
  else {
    const W=1080, H=1440; c=document.createElement('canvas'); c.width=W; c.height=H; x=c.getContext('2d');
    const g=x.createRadialGradient(W/2,H*.42,50,W/2,H*.5,H*.8); if(id==='fountain'){g.addColorStop(0,'#ffffff');g.addColorStop(1,'#dfe8e4');}else{g.addColorStop(0,'#1c4b4d');g.addColorStop(1,'#0b1f21');} x.fillStyle=g; x.fillRect(0,0,W,H);
    try{
      if (id==='towers'){ const svg=$('.tower'); const s=new XMLSerializer().serializeToString(svg); const im=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)); x.drawImage(im, W*.18, H*.12, W*.64, W*.64*380/280); }
      else { const src={fountain:'assets/fountain.png',river:'assets/riverside.png',kanal:'assets/icekanal.png'}[id]; const im=await loadImg(src);
        if (id==='fountain') x.drawImage(im, W*.15, H*.2, W*.7, W*.7*im.height/im.width);
        else { const w=W*.76, h=w*4/3, px=(W-w)/2, py=H*.12; x.save(); rr(x,px,py,w,h,48); x.clip(); const s=Math.max(w/im.width,h/im.height); x.drawImage(im, px+(w-im.width*s)/2, py+(h-im.height*s)/2, im.width*s, im.height*s); x.restore(); x.lineWidth=8; x.strokeStyle='rgba(255,255,255,.7)'; rr(x,px,py,w,h,48); x.stroke(); } }
    }catch(e){}
  }
  const W=c.width, H=c.height;
  x.fillStyle='rgba(16,43,45,.78)'; rr(x,48,H-170,W-96,112,32); x.fill();
  x.fillStyle='#e9b879'; x.font='700 26px "DM Sans", sans-serif'; x.fillText('WATERMARKSXR · AUGSBURG', 88, H-118);
  x.fillStyle='#fff'; x.font='600 40px "DM Sans", sans-serif'; x.fillText(l.name, 88, H-76);
  vibrate(20);
  const url=c.toDataURL('image/jpeg',.9);
  c.toBlob(b=>{ S.lastShot={url, blob:b, id, ar}; go('shot',{id, ar}); }, 'image/jpeg', .9);
}
function rr(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }
R.shot = (o) => `<section class="screen light">
  ${topbar('Photo')}
  <div class="scroll pad stack g16" style="padding-bottom:12px">
    <div class="shot mt8"><img src="${S.lastShot.url}" alt="Your photo with the ${LM[o.id].name} layer"></div>
  </div>
  <div class="pad safe-bottom stack g8" style="padding-top:12px">
    <div class="btn-row"><button class="btn btn-secondary" id="save">${ic('download')} Save</button><button class="btn btn-primary" id="share">${ic('share')} Share</button></div>
    <button class="btn btn-ghost" id="retake">${ic('camera')} Back to the layer</button>
  </div>
</section>`;
R.shot.mount = (el,o) => {
  if (S.ar) S.ar.pause();
  const name = `watermarksxr-${o.id}.jpg`;
  const save = () => { if (!S.photos.includes(S.lastShot.url)) S.photos.push(S.lastShot.url); const a=document.createElement('a'); a.href=S.lastShot.url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); toast('Saved to Saved and your downloads'); };
  $('#save',el).onclick = save;
  $('#share',el).onclick = async () => { if (!S.photos.includes(S.lastShot.url)) S.photos.push(S.lastShot.url);
    try{ const f=new File([S.lastShot.blob], name, {type:'image/jpeg'}); if (navigator.canShare && navigator.canShare({files:[f]})){ await navigator.share({files:[f], title:'WatermarksXR', text:LM[o.id].name+' · WatermarksXR'}); return; } }catch(e){ if (e && e.name==='AbortError') return; }
    save(); };
  $('#retake',el).onclick = () => { go('layer',{id:o.id, ar:!!o.ar, manual:!o.ar},true); if (o.ar && S.ar) S.ar.resume(); };
};

/* ================= Saved ================= */
R.saved = () => `<section class="screen light">
  ${topbar('Saved')}
  <div class="scroll pad stack g16 safe-bottom">
    ${S.photos.length?`<div class="gallery mt8">${S.photos.map(u=>`<img src="${u}" alt="Saved photo">`).join('')}</div>`:
    `<div class="stack g12 center mt32" style="align-items:center"><span class="icon-btn l glass">${ic('image')}</span><h2 class="h2">No photos yet</h2><p class="body" style="max-width:260px">Tap the camera button inside a layer to take a photo with the landmark.</p><button class="btn btn-primary sm mt8" data-go="find">${ic('scan-line')} Scan your souvenir</button></div>`}
  </div>
</section>`;

/* ================= 22 End the Experience ================= */
R.end = () => { stopCamera(); const mins=S.startedAt?Math.max(1,Math.round((Date.now()-S.startedAt)/60000)):0; const left=ORDER.filter(id=>!S.explored.has(id));
  return `<section class="screen dark solid">
  <div class="scroll pad stack g20 safe-top" style="padding-bottom:12px">
    <div class="stack g12 mt24"><span class="icon-btn l accent">${ic('sparkles')}</span><p class="eyebrow accent">Beautifully explored</p>
    <h1 class="display" style="color:#fff">You brought ${S.explored.size===1?'one landmark':S.explored.size+' landmarks'} to life.</h1></div>
    <div class="stats"><div class="stat"><b>${S.explored.size}/4</b><span>layers</span></div><div class="stat"><b>${mins} min</b><span>explored</span></div><div class="stat"><b>${S.photos.length}</b><span>photos</span></div></div>
    ${left.length?`<div class="stack g8"><p class="eyebrow">Still waiting for you</p><div class="card list" style="background:rgba(255,255,255,.96)">${left.map(id=>row(LM[id].icon,LM[id].name,LM[id].sub,`data-go="find"`)).join('')}</div></div>`:''}
    <button class="link" data-go="locations" style="align-self:center">Visit the real locations in Augsburg</button>
  </div>
  <div class="pad safe-bottom" style="padding-top:12px"><button class="btn btn-primary" id="home">${ic('house')} Back to Home</button></div>
</section>`; };
R.end.mount = el => { $('#home',el).onclick = () => { S.history=[]; go('home',{},true); }; };

/* ---------------- boot ---------------- */
if (DEV) window.__wxr = S;
applySettings();
const u = location.origin + location.pathname; const a=$('#aside-url'); if (a) a.textContent = u.replace(/^https?:\/\//,'');
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopSpeech(); if (S.ar) S.ar.pause(); } else if (S.ar && app.classList.contains('ar-on')) S.ar.resume(); });
if ('serviceWorker' in navigator && !DEV && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(()=>{}); }
go('splash', {}, true);
