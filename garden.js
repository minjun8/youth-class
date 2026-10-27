/* 群島樂園引擎：讀 window.GARDEN（與選用的 window.BOOK），畫出 3D 群島、圖釘、角色、護照與闖關題。 */
(function(){
'use strict';
const G = window.GARDEN, BOOK = window.BOOK || null, SUTRA = window.SUTRA || null, T = G.theme;
const ISL = G.islands, N = ISL.length;
const root = document.documentElement;
root.style.setProperty('--accent', T.accent); root.style.setProperty('--ink', T.ink); root.style.setProperty('--ui-bg', T.uiBg);

/* ---------- state ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(G.key+'-'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(G.key+'-'+k, JSON.stringify(v)); }catch(e){} }
};
ISL.forEach(I => I.stations.forEach((s,i) => { s.n = i+1; s.id = I.id+'-'+(i+1); s.isl = I; s.links = []; }));
const ALL = ISL.flatMap(I => I.stations);
const LINKS = (G.links || []).map((l, i) => ({ n: i+1, t: l.t, k: l.k, why: l.why, s: l.s.map(id => ALL.find(x => x.id === id)).filter(Boolean) })).filter(L => L.s.length >= 2);
const LINKCOL = ['#e0773c', '#3f8fc0', '#c2489a', '#4d9a5b', '#c9a227', '#7a5cc4'];
LINKS.forEach(L => { L.col = LINKCOL[(L.n-1) % LINKCOL.length]; L.s.forEach(s => s.links.push(L)); });
let showLines = !!store.get('lines', 1), curLink = null;
let read = new Set(store.get('read', []));
let pass = new Set(store.get('pass', []));
(G.migrate || []).forEach(fn => { try{ fn(read); }catch(e){} });
store.set('read', [...read]); store.set('total', { stations: ALL.length, islands: N });
const rCount = I => I.stations.filter(s => read.has(s.id)).length;
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $ = s => document.querySelector(s);

/* ---------- DOM shell ---------- */
const ICON = {
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17C8 7 16 7 19 17"/><circle cx="5" cy="17" r="2.2"/><circle cx="19" cy="17" r="2.2"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  pass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/></svg>',
  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4M12 16h.01"/></svg>',
  people:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.6c2.4.2 4 1.9 4.5 4.9"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/></svg>'
};
document.body.insertAdjacentHTML('beforeend', `
  <div id="stage" aria-hidden="true"></div>
  <div id="labels"></div>
  <header class="brand">
    <div class="logo" aria-hidden="true">${G.logo[0]}<br>${G.logo[1]}</div>
    <div class="txt"><div class="kick"><a href="index.html">← 心海群島</a><span>${esc(G.kicker)}</span></div>
      <h1>${esc(G.title)}</h1><p class="tag">${esc(G.tagline)}</p></div>
  </header>
  <nav class="tools" aria-label="工具">
    <button class="tbtn" id="bHome" title="全景" aria-label="全景">${ICON.home}<span class="lbl">全景</span></button>
    <button class="tbtn" id="bList" title="島嶼清單" aria-label="島嶼清單">${ICON.list}<span class="lbl">島嶼清單</span></button>
    ${BOOK ? `<button class="tbtn" id="bBook" title="全書" aria-label="全書">${ICON.book}<span class="lbl">全書</span></button>` : ''}
    ${SUTRA ? `<button class="tbtn" id="bSutra" title="經文全文" aria-label="經文全文">${ICON.book}<span class="lbl">經文全文</span></button>` : ''}
    ${LINKS.length ? `<button class="tbtn" id="bLink" title="相通線" aria-label="相通線">${ICON.link}<span class="lbl">相通線</span><span class="n">${LINKS.length}</span></button>` : ''}
    <button class="tbtn" id="bQA" title="提問與回答" aria-label="提問與回答">${ICON.chat}<span class="lbl">問答</span><span class="n" id="qaN" hidden>0</span></button>
    <button class="tbtn" id="bWho" title="同修在線" aria-label="同修在線">${ICON.people}<span class="lbl">在線</span><span class="n" id="whoN">1</span></button>
    <button class="tbtn" id="bPass" title="學習護照" aria-label="學習護照">${ICON.pass}<span class="lbl">學習護照</span><span class="n" id="passN">0/${N}</span></button>
  </nav>
  <div class="timebar" role="group" aria-label="時段">
    <button data-t="dawn">晨光</button><button data-t="noon">午後</button><button data-t="dusk">黃昏</button><button data-t="night">星夜</button>
  </div>
  <div class="hint">點地面或按 WASD 走路・走進設施就開始學習・拖曳旋轉・滾輪縮放</div>
  <div class="scrim" id="scrim" hidden></div>
  <aside class="panel" id="panel" hidden aria-live="polite"></aside>
  <div class="modal" id="modal" role="dialog" aria-modal="true" hidden></div>
  <div class="book" id="book" hidden></div>
`);
const panel = $('#panel'), modal = $('#modal'), scrim = $('#scrim'), labels = $('#labels');

/* ---------- 3D ---------- */
let ok3d = !!window.THREE;
let renderer, scene, camera, controls, hemi, sun, seaMat, stars, fogCol;
const W = { islands: [], lanterns: [], pins: [], walk: [], ripples: [], clickable: [], bob: [], gems: [] };
let R0 = 9, D = 30;

function rnd(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const C = c => new THREE.Color(c);
const lam = (c, o={}) => new THREE.MeshLambertMaterial(Object.assign({ color: C(c) }, o));

function layout(){
  ISL.forEach(I => { I.r = Math.max(6, Math.min(9.2, 5.2 + 0.33 * I.stations.length)); });
  const rmax = Math.max(...ISL.map(I => I.r));
  D = R0 + rmax + 3.2;
  for(let k=0;k<40;k++){
    let okk = true;
    for(let i=0;i<N;i++){ const a = ISL[i], b = ISL[(i+1)%N]; if(2*D*Math.sin(Math.PI/N) < (a.r + b.r)*1.08 + 1.2){ okk = false; } }
    if(okk) break; D += 1;
  }
  ISL.forEach((I,i) => { I.th = Math.PI/2 + i * 2*Math.PI/N; I.cx = D*Math.cos(I.th); I.cz = D*Math.sin(I.th); I.H = 0.9; });
}

function islandMesh(I, top, side, seed){
  // hexagonal terrace: grass slab on top of a stone cliff (r = inscribed radius)
  const R = I.r/0.866, g = new THREE.Group(), r = rnd(seed);
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(R*1.02, R*1.1, 2.2, 6), lam('#b8a88f', { flatShading: true }));
  cliff.position.y = -1.15; g.add(cliff);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R*1.035, R*1.035, .16, 6), lam('#d9cdb4'));
  rim.position.y = -.02; g.add(rim);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(R, R*1.01, .5, 6), lam(top, { flatShading: true }));
  slab.position.y = -.25; slab.receiveShadow = true; g.add(slab);
  g.rotation.y = -I.th;   // a flat side faces the plaza
  g.position.set(I.cx, I.H, I.cz);
  slab.userData.walk = { type: 'island', I }; W.walk.push(slab);
  return g;
}

function tree(x, z, y, r, palette){
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, .9, 6), lam('#8b6b4a'));
  trunk.position.y = .45; g.add(trunk);
  const col = palette[Math.floor(r()*palette.length)];
  if(r() < .5){
    const c = new THREE.Mesh(new THREE.ConeGeometry(.75, 1.7, 7), lam(col)); c.position.y = 1.55; g.add(c);
  } else {
    for(let i=0;i<3;i++){ const s = new THREE.Mesh(new THREE.IcosahedronGeometry(.5 + r()*.25, 0), lam(col)); s.position.set((r()-.5)*.6, 1.2 + i*.28, (r()-.5)*.6); g.add(s); }
  }
  g.position.set(x, y, z); const sc = .8 + r()*.6; g.scale.setScalar(sc); g.traverse(o => { if(o.isMesh){ o.castShadow = true; } });
  return g;
}

function lantern(x, z, y, color){
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1.5, 6), lam('#5a4a3a')); post.position.y = .75; g.add(post);
  const mat = new THREE.MeshLambertMaterial({ color: C('#e8e2d6'), emissive: C('#000000') });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.26, 12, 10), mat); lamp.position.y = 1.62; g.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.3, .22, 6), lam('#5a4a3a')); cap.position.y = 1.92; g.add(cap);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C('#ffcf73'), transparent: true, opacity: 0, depthWrite: false }));
  halo.scale.set(2.2, 2.2, 1); halo.position.y = 1.62; g.add(halo);
  g.position.set(x, y, z); g.userData = { mat, halo };
  return g;
}
let _glow;
function glowTex(){
  if(_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.35,'rgba(255,255,255,.45)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0,0,64,64); _glow = new THREE.CanvasTexture(c); return _glow;
}

function roof(w, d, h, color){ const m = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.78, h, 4), lam(color)); m.rotation.y = Math.PI/4; return m; }
function box(w, h, d, color){ return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color)); }
function cyl(rt, rb, h, color, s=12){ return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), lam(color)); }

function prop(type, color){
  const g = new THREE.Group(), add = (m, x=0, y=0, z=0) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  switch(type){
    case 'mill': { add(box(2.2,1.4,1.8,'#f3e6cf'),0,.7,0); add(roof(2.2,1.8,1,'#a0522d'),0,1.9,0); add(cyl(.45,.55,.5,'#9c8f80'),1.8,.25,.6); add(box(1.6,.12,.18,'#8b6b4a'),1.3,.6,.6).rotation.z = .25; break; }
    case 'sun': { add(cyl(1.6,1.6,.12,'#78b8d8',24),0,.06,0); for(let i=0;i<6;i++){ const p = add(new THREE.Mesh(new THREE.SphereGeometry(.35,8,6), lam('#f2a7c3')), Math.cos(i)*.5, .25, Math.sin(i)*.5); p.scale.y = .5; }
      const s = add(new THREE.Mesh(new THREE.IcosahedronGeometry(.8,1), new THREE.MeshLambertMaterial({ color: C('#ffd36b'), emissive: C('#e8a400'), emissiveIntensity: .5 })), 0, 3.4, 0); g.userData.spin = s; break; }
    case 'bell': { for(const [x,z] of [[-.8,-.8],[.8,-.8],[-.8,.8],[.8,.8]]) add(cyl(.09,.09,2.2,'#8b5a3a',6),x,1.1,z); add(roof(2,2,1.1,'#7a3b2e'),0,2.7,0); add(new THREE.Mesh(new THREE.CylinderGeometry(.35,.6,.9,12,1,true), lam('#b08d3a',{side:THREE.DoubleSide})),0,1.7,0); break; }
    case 'lamp': { add(cyl(.5,.7,.4,'#b9b0a0'),0,.2,0); add(cyl(.18,.24,2.2,'#b9b0a0'),0,1.5,0); add(box(.9,.8,.9,'#d8cfbd'),0,3,0); add(roof(1,1,.7,'#6b5a4a'),0,3.75,0);
      const l = add(new THREE.Mesh(new THREE.BoxGeometry(.5,.45,.95), new THREE.MeshLambertMaterial({ color: C('#ffe39a'), emissive: C('#ffb84d'), emissiveIntensity: .7 })),0,3,0); l.castShadow = false; break; }
    case 'cushion': { add(cyl(1.3,1.5,.35,'#a9a49a',10),0,.17,0); add(cyl(.55,.6,.25,'#c96b4b',16),0,.48,0); add(new THREE.Mesh(new THREE.SphereGeometry(.22,10,8), lam('#5b4636')),0,1.25,0); add(cyl(.28,.45,.7,'#7d6a8a',10),0,.9,0); break; }
    case 'censer': { add(cyl(.7,.5,.7,'#8a6d3b',14),0,.75,0); for(let i=0;i<3;i++){ const a = i*2.1; add(cyl(.06,.06,.5,'#8a6d3b',5),Math.cos(a)*.45,.25,Math.sin(a)*.45); }
      for(let i=0;i<3;i++){ add(cyl(.02,.02,.7,'#c44',4),(i-1)*.18,1.4,0); } const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: C('#ffffff'), transparent:true, opacity:.35, depthWrite:false })); smoke.scale.set(1.2,2.4,1); smoke.position.y = 2.6; g.add(smoke); g.userData.smoke = smoke; break; }
    case 'boats': { for(let i=0;i<3;i++){ const b = add(box(1.4,.35,.6,['#c0703a','#3a7ca5','#e0b04b'][i]), (i-1)*1.8, .2, (i%2)*.8); b.rotation.y = i*.5; } add(box(1.2,1.2,1.2,'#f1e4cc'),0,.6,-1.6); add(roof(1.2,1.2,.8,'#5a7f6a'),0,1.6,-1.6); break; }
    case 'signpost': { add(cyl(.1,.12,2.6,'#7a5a3a',6),0,1.3,0); const a = add(box(1.5,.38,.1,'#f2d7a6'),.55,2.1,0); const b = add(box(1.5,.38,.1,'#cfe0b6'),-.55,1.55,0); a.rotation.y = .2; b.rotation.y = -.2; break; }
    case 'gate': { add(cyl(.18,.2,2.8,'#b0413e',8),-1.2,1.4,0); add(cyl(.18,.2,2.8,'#b0413e',8),1.2,1.4,0); add(box(3.4,.3,.4,'#7a2e2b'),0,2.9,0); add(box(2.8,.2,.3,'#b0413e'),0,2.4,0); break; }
    case 'bodhi': { add(cyl(.35,.5,2.4,'#7a5a3a',8),0,1.2,0); const r = rnd(9); for(let i=0;i<7;i++){ add(new THREE.Mesh(new THREE.IcosahedronGeometry(1+r()*.4,0), lam(['#5e8f4a','#6fa055','#4f7d3e'][i%3])), (r()-.5)*2.4, 2.8+r()*1.2, (r()-.5)*2.4); } break; }
    case 'pagoda': { for(let i=0;i<4;i++){ const s = 1.8 - i*.35; add(box(s,.7,s,'#f1e2c6'),0,.35+i*.95,0); add(roof(s+.5,s+.5,.45,'#a5452f'),0,.95+i*.95,0); } add(cyl(.04,.04,.9,'#d4a017',4),0,4.6,0); break; }
    case 'well': { add(cyl(.8,.8,.7,'#a9a39a',14),0,.35,0); add(cyl(.62,.62,.72,'#3d6f8f',14),0,.37,0); add(cyl(.06,.06,1.8,'#6b4f37',5),-.75,1.2,0); add(cyl(.06,.06,1.8,'#6b4f37',5),.75,1.2,0); add(roof(1.8,1.2,.7,'#8b4a35'),0,2.4,0); break; }
    case 'mirror': { add(cyl(.5,.7,.4,'#8b6b4a'),0,.2,0); add(cyl(.08,.08,1.2,'#8b6b4a',6),0,1,0); const m = add(cyl(1,1,.12,'#dfe9f3',28),0,2.4,0); m.rotation.x = Math.PI/2; m.material = new THREE.MeshLambertMaterial({ color: C('#e9f2fb'), emissive: C('#8fb6dd'), emissiveIntensity: .25 }); add(new THREE.Mesh(new THREE.TorusGeometry(1.02,.09,8,28), lam('#c9a24a')),0,2.4,.0); break; }
    case 'scroll': { add(box(2.6,.06,1.6,'#f6ecd4'),0,.9,0); add(cyl(.12,.12,1.8,'#8b4a35',8),-1.35,.95,0).rotation.x = Math.PI/2; add(cyl(.12,.12,1.8,'#8b4a35',8),1.35,.95,0).rotation.x = Math.PI/2; add(box(2.2,.8,1,'#a07a52'),0,.4,0); break; }
    case 'boat': { const h = add(box(3.2,.7,1.3,'#9b5a34'),0,.5,0); add(box(2.4,.2,1.1,'#c48a5a'),0,.95,0); add(cyl(.07,.07,3,'#6b4f37',5),0,2.3,0); const s = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.9), lam('#fff6e0',{side:THREE.DoubleSide})),.05,2.5,0); s.rotation.y = Math.PI/2; break; }
    case 'hall': { add(box(3,1.5,2,'#f4e6cc'),0,.75,0); add(roof(3,2,1.2,'#8f3b2f'),0,2.1,0); add(box(.7,1,.05,'#7a4a2a'),0,.5,1.02); break; }
    default: { add(box(1.6,1.2,1.6,'#f1e2c6'),0,.6,0); add(roof(1.6,1.6,.8,color),0,1.6,0); }
  }
  return g;
}

function plazaBuild(){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0*1.05, 1.4, 48), [lam(T.sand), lam(T.plaza), lam(T.sand)]);
  base.position.y = -.1; base.receiveShadow = true; g.add(base); W.walk.push(base); base.userData.walk = { type: 'plaza' };
  const ring = new THREE.Mesh(new THREE.RingGeometry(R0*.55, R0*.7, 48), lam('#f6efe0')); ring.rotation.x = -Math.PI/2; ring.position.y = .61; g.add(ring);
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(R0*.55, 40), lam(T.land)); lawn.rotation.x = -Math.PI/2; lawn.position.y = .605; g.add(lawn);
  const tower = new THREE.Group();
  for(let i=0;i<3;i++){ const s = 2.2 - i*.45; const b = box(s, 1.2, s, i===0 ? '#e9d7b9' : '#f3e6cf'); b.position.y = 1.2 + i*1.35; b.castShadow = true; tower.add(b); const rf = roof(s+.7, s+.7, .7, '#9c3d2c'); rf.position.y = 2.1 + i*1.35; rf.castShadow = true; tower.add(rf); }
  const top = cyl(.05,.05,1.2,'#d4a017',4); top.position.y = 5.6; tower.add(top);
  g.add(tower);
  const r = rnd(77);
  for(let i=0;i<10;i++){ const a = i/10*Math.PI*2 + .3; if(ISL.some(I => Math.abs(Math.atan2(Math.sin(a-I.th), Math.cos(a-I.th))) < .25)) continue; g.add(tree(Math.cos(a)*R0*.82, Math.sin(a)*R0*.82, .6, r, ['#7fb069','#9cc47a','#f2b5c6'])); }
  for(let i=0;i<N;i++){ const a = ISL[i].th + Math.PI/N; g.add(lantern(Math.cos(a)*R0*.62, Math.sin(a)*R0*.62, .6)); }
  scene.add(g);
}

function bridge(I){
  const len = D - I.r - R0 + 1.6, mid = R0 + len/2 - .8;
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, .22, 2.2), lam('#b98a5a')); deck.position.y = .62; deck.receiveShadow = true; g.add(deck);
  deck.userData.walk = { type: 'bridge', I }; W.walk.push(deck);
  for(let k=-1;k<=1;k+=2){
    const rail = box(len, .1, .1, '#8b6440'); rail.position.set(0, 1.25, k*1.05); g.add(rail);
    for(let p=0;p<=Math.floor(len/1.6);p++){ const post = box(.12, .7, .12, '#8b6440'); post.position.set(-len/2 + p*(len/Math.floor(len/1.6)), .95, k*1.05); g.add(post); }
  }
  for(let p=0;p<=Math.floor(len/1.2);p++){ const plank = box(.08, .03, 2.2, '#9a7148'); plank.position.set(-len/2 + p*1.2, .74, 0); g.add(plank); }
  g.position.set(Math.cos(I.th)*mid, 0, Math.sin(I.th)*mid); g.rotation.y = -I.th;
  scene.add(g);
}

/* ---------- facilities (one per station) ---------- */
const WALL = ['#f6ecd8', '#f1e2c6', '#efe7da', '#f7e9d0'];
const ROOFS = ['#a5452f', '#5d7f6a', '#8a5a3c', '#3f6f8f', '#b0413e', '#6b5a8a'];
function pick(a, r){ return a[Math.floor(r()*a.length)]; }
function F_tea(c, r){ const g = new THREE.Group(), w = pick(WALL, r), rf = pick(ROOFS, r);
  const a = box(2, 1.2, 1.6, w); a.position.y = .6; g.add(a); const e = roof(2.5, 2.1, .5, rf); e.position.y = 1.4; g.add(e);
  const b = box(1.4, .9, 1.1, w); b.position.y = 2.05; g.add(b); const e2 = roof(1.9, 1.6, .6, rf); e2.position.y = 2.8; g.add(e2);
  const d = box(.5, .8, .05, '#7a4a2a'); d.position.set(0, .4, .81); g.add(d); const fl = box(.12, .5, .04, c); fl.position.set(.75, 1.05, .82); g.add(fl); return g; }
function F_books(c, r){ const g = new THREE.Group(); const a = box(1.9, 1.5, 1.5, pick(WALL, r)); a.position.y = .75; g.add(a);
  const rf = box(2.1, .18, 1.7, pick(ROOFS, r)); rf.position.y = 1.6; g.add(rf); const sign = box(1.2, .32, .06, '#3b2f25'); sign.position.set(0, 1.25, .78); g.add(sign);
  for(let k=0;k<5;k++){ const bk = box(.14, .38 + (k%2)*.08, .3, ['#c0703a','#3a7ca5','#e0b04b','#6b8f5a','#a5452f'][k]); bk.position.set(-.45 + k*.2, .3, .9); g.add(bk); }
  const sh = box(1.2, .06, .4, '#8b6b4a'); sh.position.set(0, .08, .9); g.add(sh); return g; }
function F_stall(c, r){ const g = new THREE.Group(); const t = box(1.6, .7, .9, '#c49a6c'); t.position.y = .35; g.add(t);
  for(let k=0;k<4;k++){ const f = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), lam(['#e85d3a','#f2c14e','#7fb069','#e0779a'][k])); f.position.set(-.5 + k*.33, .8, .2); g.add(f); }
  const p = cyl(.04, .04, 1.9, '#6b4f37', 5); p.position.set(0, .95, -.2); g.add(p);
  const u = new THREE.Mesh(new THREE.ConeGeometry(1.25, .55, 8), lam(c)); u.position.set(0, 2, -.2); g.add(u); return g; }
function F_pav(c, r){ const g = new THREE.Group(); const base = cyl(1.1, 1.2, .2, '#d8ccb6', 6); base.position.y = .1; g.add(base);
  for(let k=0;k<6;k++){ const a = k/6*Math.PI*2, p = cyl(.06, .06, 1.4, '#8b3b2e', 5); p.position.set(Math.cos(a)*.85, .9, Math.sin(a)*.85); g.add(p); }
  const rf = new THREE.Mesh(new THREE.ConeGeometry(1.45, .8, 6), lam(pick(ROOFS, r))); rf.position.y = 1.95; g.add(rf);
  const tb = cyl(.3, .3, .5, '#a07a52', 8); tb.position.y = .45; g.add(tb); return g; }
function F_lantern(c, r){ const g = new THREE.Group(); const a = box(1.7, 1.3, 1.4, pick(WALL, r)); a.position.y = .65; g.add(a);
  const rf = roof(2.2, 1.9, .7, pick(ROOFS, r)); rf.position.y = 1.65; g.add(rf);
  const bar = box(1.8, .05, .05, '#5a4a3a'); bar.position.set(0, 1.25, .85); g.add(bar);
  for(let k=0;k<3;k++){ const l = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshLambertMaterial({ color: C('#ff6a4d'), emissive: C('#c0391b'), emissiveIntensity: .6 })); l.scale.y = 1.25; l.position.set(-.6 + k*.6, 1.02, .87); g.add(l); } return g; }
function F_garden(c, r){ const g = new THREE.Group(); const bed = cyl(1.1, 1.15, .25, '#8a6a4a', 10); bed.position.y = .12; g.add(bed);
  const soil = cyl(1, 1, .05, '#6b8f4a', 10); soil.position.y = .27; g.add(soil);
  for(let k=0;k<9;k++){ const a = r()*Math.PI*2, rr = r()*.8, f = new THREE.Mesh(new THREE.SphereGeometry(.15, 7, 5), lam(pick(['#f4a3b8','#ffd66b','#ffffff','#b9a4f0','#ff9a6b'], r))); f.position.set(Math.cos(a)*rr, .42, Math.sin(a)*rr); g.add(f); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(.75, .06, 6, 16, Math.PI), lam('#8b6b4a')); arch.position.set(0, .3, .95); g.add(arch); return g; }
function F_bell(c, r){ const g = new THREE.Group(); const base = box(1.5, .5, 1.5, '#b9ab95'); base.position.y = .25; g.add(base);
  for(const [x,z] of [[-.55,-.55],[.55,-.55],[-.55,.55],[.55,.55]]){ const p = cyl(.07, .07, 1.7, '#8b3b2e', 5); p.position.set(x, 1.35, z); g.add(p); }
  const rf = roof(1.7, 1.7, .9, pick(ROOFS, r)); rf.position.y = 2.6; g.add(rf);
  const bl = new THREE.Mesh(new THREE.CylinderGeometry(.25, .42, .7, 12), lam('#b08d3a')); bl.position.y = 1.65; g.add(bl); return g; }
function F_well(c, r){ const g = new THREE.Group(); const w = cyl(.65, .7, .6, '#a9a39a', 12); w.position.y = .3; g.add(w); const wt = cyl(.52, .52, .62, '#3d6f8f', 12); wt.position.y = .32; g.add(wt);
  for(const x of [-.6, .6]){ const p = cyl(.05, .05, 1.5, '#6b4f37', 5); p.position.set(x, 1, 0); g.add(p); }
  const rf = roof(1.5, 1, .55, pick(ROOFS, r)); rf.position.y = 1.95; g.add(rf);
  const bk = cyl(.15, .12, .25, '#8b6b4a', 8); bk.position.set(.95, .12, .3); g.add(bk); return g; }
function F_boat(c, r){ const g = new THREE.Group(); for(const [x,z] of [[-.7,-.5],[.7,-.5],[-.7,.5],[.7,.5]]){ const p = cyl(.07, .07, .7, '#6b4f37', 5); p.position.set(x, .35, z); g.add(p); }
  const fl = box(1.8, .12, 1.4, '#a57b52'); fl.position.y = .75; g.add(fl); const h = box(1.4, .9, 1.1, pick(WALL, r)); h.position.y = 1.25; g.add(h);
  const rf = roof(1.8, 1.5, .6, pick(ROOFS, r)); rf.position.y = 2; g.add(rf);
  const oar = box(.06, .06, 1.4, '#8b6b4a'); oar.position.set(.95, .3, .2); oar.rotation.x = .5; g.add(oar); return g; }
function F_incense(c, r){ const g = new THREE.Group(); const a = box(1.6, 1.1, 1.3, pick(WALL, r)); a.position.y = .55; g.add(a);
  const rf = roof(2.1, 1.8, .6, pick(ROOFS, r)); rf.position.y = 1.4; g.add(rf);
  const pot = cyl(.3, .22, .4, '#8a6d3b', 10); pot.position.set(0, .2, 1); g.add(pot);
  for(let k=0;k<3;k++){ const st = cyl(.015, .015, .45, '#c44', 4); st.position.set(-.08 + k*.08, .6, 1); g.add(st); } return g; }
function F_noodle(c, r){ const g = new THREE.Group(); const a = box(1.8, 1.3, 1.4, pick(WALL, r)); a.position.y = .65; g.add(a);
  const aw = box(1.9, .08, .7, c); aw.position.set(0, 1.15, .95); aw.rotation.x = .35; g.add(aw);
  const rf = box(1.95, .2, 1.55, pick(ROOFS, r)); rf.position.y = 1.4; g.add(rf);
  const ch = cyl(.12, .12, .7, '#9c8f80', 6); ch.position.set(.55, 1.8, -.3); g.add(ch);
  for(const x of [-.5, .5]){ const st = cyl(.18, .18, .4, '#a07a52', 8); st.position.set(x, .2, 1.35); g.add(st); } return g; }
function F_hall(c, r){ const g = new THREE.Group(); const st = box(2.2, .25, 1.8, '#d8ccb6'); st.position.y = .12; g.add(st);
  const a = box(1.9, 1.3, 1.4, pick(WALL, r)); a.position.y = .9; g.add(a); const rf = roof(2.6, 2.1, .9, pick(ROOFS, r)); rf.position.y = 1.95; g.add(rf);
  for(const x of [-.75, .75]){ const p = cyl(.08, .08, 1.3, '#8b3b2e', 6); p.position.set(x, .9, .78); g.add(p); } return g; }
const FAC = [['茶館', F_tea], ['書坊', F_books], ['市集攤', F_stall], ['涼亭', F_pav], ['燈籠舖', F_lantern], ['花圃', F_garden],
  ['鐘樓', F_bell], ['水井', F_well], ['渡船屋', F_boat], ['香舖', F_incense], ['麵食舖', F_noodle], ['講堂', F_hall]];

function buildIsland(I, idx){
  const grp = new THREE.Group(); scene.add(grp);
  const landC = C(T.land).offsetHSL(0, .1, -.24).lerp(C(I.color), .12);
  const m = islandMesh(I, landC, T.sand, 100 + idx*13); scene.add(m);
  const path = new THREE.Mesh(new THREE.RingGeometry(I.r*.5, I.r*.62, 40), lam('#f4ead6')); path.rotation.x = -Math.PI/2; path.position.set(I.cx, I.H+.01, I.cz); scene.add(path);
  const p = prop(I.prop, I.color); p.position.set(I.cx, I.H, I.cz); p.rotation.y = -I.th + Math.PI/2; scene.add(p); I.prop3 = p;
  p.traverse(o => { if(o.isMesh){ o.userData.island = I; W.clickable.push(o); } });
  // stations = facilities around the island, each facing the centre
  const toC = Math.atan2(-I.cz, -I.cx), n = I.stations.length, gap = .5, span = 2*Math.PI - 2*gap;
  I.stations.forEach((s, i) => {
    const a = toC + gap + span * (n === 1 ? .5 : i/(n-1)), rr = I.r * .74;
    s.x = I.cx + Math.cos(a)*rr; s.z = I.cz + Math.sin(a)*rr; s.y = I.H;
    const F = FAC[(I.id*5 + i*7) % FAC.length]; s.fac = F[0];
    const g = F[1](I.color, rnd(idx*97 + i));
    g.position.set(s.x, s.y, s.z); g.rotation.y = Math.atan2(I.cx - s.x, I.cz - s.z); scene.add(g);
    const top = new THREE.Box3().setFromObject(g).max.y;
    s.door = [s.x + (I.cx - s.x)/rr*1.5, s.z + (I.cz - s.z)/rr*1.5];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), new THREE.MeshLambertMaterial({ color: C('#ffffff'), emissive: C('#3a3020') }));
    gem.position.set(s.x, top + .55, s.z); scene.add(gem); s.head = gem; W.gems.push(gem); s.labelY = top + 1.3;
    g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.userData.station = s; W.clickable.push(o); } });
    gem.userData.station = s; W.clickable.push(gem);
    // a small paved apron in front of the door
    const ap = new THREE.Mesh(new THREE.CircleGeometry(.9, 12), lam('#efe4cc')); ap.rotation.x = -Math.PI/2; ap.position.set(s.door[0], I.H + .015, s.door[1]); scene.add(ap);
  });
  // village cottages filling the gaps between facilities
  I.cot = [];
  { const rc = rnd(700 + idx*29);
    for(let t=0; t<80 && I.cot.length < 3 + Math.floor(I.r/4); t++){
      const a = rc()*Math.PI*2, rr = I.r*(.36 + rc()*.5), x = I.cx + Math.cos(a)*rr, z = I.cz + Math.sin(a)*rr;
      if(Math.abs(Math.atan2(Math.sin(a-toC), Math.cos(a-toC))) < .5 || Math.hypot(x-I.cx, z-I.cz) < 2.8) continue;
      if(I.stations.some(s => Math.hypot(s.x-x, s.z-z) < 2.3 || Math.hypot(s.door[0]-x, s.door[1]-z) < 1.5)) continue;
      if(I.cot.some(h => Math.hypot(h[0]-x, h[1]-z) < 1.6)) continue;
      const g = new THREE.Group(), w = .7 + rc()*.4;
      const b = box(w, .6, w*.8, pick(WALL, rc)); b.position.y = .3; g.add(b);
      const rf = roof(w*1.25, w, .45, pick(ROOFS, rc)); rf.position.y = .82; g.add(rf);
      g.position.set(x, I.H, z); g.rotation.y = rc()*Math.PI*2; g.traverse(o => { if(o.isMesh) o.castShadow = true; }); scene.add(g); I.cot.push([x, z]);
    } }
  // trees
  const r = rnd(500 + idx*31), pal = ['#7fb069','#9cc47a','#6aa35a', '#f2b5c6', '#f6c48b'];
  let placed = 0, tries = 0;
  while(placed < 5 + Math.floor(I.r/2) && tries++ < 200){
    const a = r()*Math.PI*2, rr = I.r*(.32 + r()*.6), x = I.cx + Math.cos(a)*rr, z = I.cz + Math.sin(a)*rr;
    if(Math.abs(Math.atan2(Math.sin(a-toC), Math.cos(a-toC))) < .45) continue;
    if(Math.hypot(x-I.cx, z-I.cz) < 2.6) continue;
    if(I.stations.some(s => Math.hypot(s.x-x, s.z-z) < 2.2 || Math.hypot(s.door[0]-x, s.door[1]-z) < 1.2)) continue;
    if((I.cot || []).some(h => Math.hypot(h[0]-x, h[1]-z) < 1.4)) continue;
    scene.add(tree(x, z, I.H, r, pal)); placed++;
  }
  // lanterns
  I.lan = [];
  for(let k=0;k<3;k++){ const a = toC + Math.PI + (k-1)*.9, rr = I.r*.45; const L = lantern(I.cx + Math.cos(a)*rr, I.cz + Math.sin(a)*rr, I.H); scene.add(L); I.lan.push(L); W.lanterns.push(L); }

  // ---- scenery: path stones, hills, bushes, flowers, rocks, dock ----
  const rs = rnd(900 + idx*17), stoneM = lam('#e9dfcc'), rockM = lam('#9a9a92'), rock2 = lam('#b7b2a6');
  const free = (x, z, pad) => Math.hypot(x-I.cx, z-I.cz) > 2.6 && !I.stations.some(s => Math.hypot(s.x-x, s.z-z) < pad) && !I.lan.some(L => Math.hypot(L.position.x-x, L.position.z-z) < 1.1);
  for(let k=0;k<5;k++){ const rr = I.r*(.66 + k*.075); const st = new THREE.Mesh(new THREE.CylinderGeometry(.42, .46, .08, 7), stoneM); st.position.set(I.cx + Math.cos(toC)*rr + (k%2 ? .25 : -.25)*Math.sin(toC), I.H + .04, I.cz + Math.sin(toC)*rr - (k%2 ? .25 : -.25)*Math.cos(toC)); st.rotation.y = rs()*3; st.receiveShadow = true; scene.add(st); }
  const hillC = landC.clone().offsetHSL(0, .02, -.05);
  for(let k=0;k<2;k++){ const a = toC + Math.PI + (k ? 1.7 : -1.7), rr = I.r*.5, x = I.cx + Math.cos(a)*rr, z = I.cz + Math.sin(a)*rr; if(!free(x, z, 2.2)) continue;
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + rs()*.6, 1), lam(hillC, { flatShading: true })); h.scale.set(1.3, .45, 1.1); h.position.set(x, I.H, z); h.rotation.y = rs()*3; h.receiveShadow = true; h.castShadow = true; scene.add(h); }
  const bushM = [lam('#5f9a4f', { flatShading: true }), lam('#79ad5c', { flatShading: true })];
  for(let k=0, t=0; k<6 && t<60; t++){ const a = rs()*Math.PI*2, rr = I.r*(.35 + rs()*.55), x = I.cx + Math.cos(a)*rr, z = I.cz + Math.sin(a)*rr; if(!free(x, z, 1.3) || Math.abs(Math.atan2(Math.sin(a-toC), Math.cos(a-toC))) < .4) continue;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.38 + rs()*.25, 0), bushM[k%2]); b.position.set(x, I.H + .25, z); b.scale.y = .75; b.castShadow = true; scene.add(b); k++; }
  const FLW = ['#f4a3b8', '#ffd66b', '#ffffff', '#b9a4f0', '#ff9a6b'], fg = new THREE.SphereGeometry(.11, 6, 5), fl = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial(), 60), mt = new THREE.Matrix4();
  let fi = 0;
  for(let p=0, t=0; p<6 && t<80; t++){ const a = rs()*Math.PI*2, rr = I.r*(.3 + rs()*.6), cx = I.cx + Math.cos(a)*rr, cz = I.cz + Math.sin(a)*rr; if(!free(cx, cz, 1.2) || Math.abs(Math.atan2(Math.sin(a-toC), Math.cos(a-toC))) < .4) continue;
    const col = C(FLW[Math.floor(rs()*FLW.length)]);
    for(let q=0;q<10 && fi<60;q++){ mt.makeTranslation(cx + (rs()-.5)*1.1, I.H + .12, cz + (rs()-.5)*1.1); fl.setMatrixAt(fi, mt); fl.setColorAt(fi, col); fi++; } p++; }
  fl.count = fi; if(fl.instanceColor) fl.instanceColor.needsUpdate = true; scene.add(fl);
  for(let k=0;k<9;k++){ const a = rs()*Math.PI*2; if(Math.abs(Math.atan2(Math.sin(a-toC), Math.cos(a-toC))) < .35) continue; const rr = I.r*(1.0 + rs()*.08);
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(.35 + rs()*.45, 0), k%3 ? rockM : rock2); rk.position.set(I.cx + Math.cos(a)*rr, I.H - .65 + rs()*.2, I.cz + Math.sin(a)*rr); rk.rotation.set(rs()*3, rs()*3, rs()*3); rk.castShadow = true; scene.add(rk); }
  if(idx % 2 === 0){ const a = toC + Math.PI + (idx % 4 ? .5 : -.5), rr = I.r*1.02, x = I.cx + Math.cos(a)*rr, z = I.cz + Math.sin(a)*rr;
    const dock = new THREE.Group(); const plank = box(2.6, .14, 1, '#a57b52'); plank.position.set(1.1, I.H - .2, 0); dock.add(plank);
    for(const px of [.2, 2.2]) for(const pz of [-.4, .4]){ const post = cyl(.07, .07, 1.2, '#6b4f37', 5); post.position.set(px, I.H - .6, pz); dock.add(post); }
    dock.position.set(x, 0, z); dock.rotation.y = -a; scene.add(dock);
    const boat = new THREE.Group(); const hull = box(1.5, .35, .6, ['#c0703a', '#3a7ca5', '#e0b04b'][idx % 3]); boat.add(hull); const seat = box(.2, .06, .5, '#f1e4cc'); seat.position.y = .2; boat.add(seat);
    const bx = x + Math.cos(a)*2.2 + Math.cos(a + Math.PI/2)*1.2, bz = z + Math.sin(a)*2.2 + Math.sin(a + Math.PI/2)*1.2; boat.position.set(bx, .15, bz); boat.rotation.y = -a + Math.PI/2; boat.userData.y0 = .15; scene.add(boat); W.bob.push(boat); }
  // ripples
  for(let k=0;k<2;k++){ const rg = new THREE.Mesh(new THREE.RingGeometry(I.r*1.2, I.r*1.24, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4 })); rg.rotation.set(-Math.PI/2, 0, -(I.th + Math.PI/6)); rg.position.set(I.cx, .02, I.cz); rg.userData.ph = k*.5; scene.add(rg); W.ripples.push(rg); }
  bridge(I);
}

/* ---------- 相通線 (3D) ---------- */
let linkGrp = null;
function buildLinks(){
  linkGrp = new THREE.Group(); scene.add(linkGrp);
  LINKS.forEach(L => {
    const col = C(L.col); L.parts = []; L.beads = [];
    for(let i=0;i<L.s.length-1;i++){
      const a = L.s[i], b = L.s[i+1];
      const A = new THREE.Vector3(a.x, a.y + 1.25, a.z), B = new THREE.Vector3(b.x, b.y + 1.25, b.z);
      const d = A.distanceTo(B), M = A.clone().lerp(B, .5); M.y += 3 + d*.32;
      const M2 = M.clone(); M2.x *= .92; M2.z *= .92;   // bow slightly toward the plaza
      const curve = new THREE.QuadraticBezierCurve3(A, M2, B);
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, depthWrite: false });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .1, 6, false), mat); linkGrp.add(tube); L.parts.push(mat);
      const bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: .95, depthWrite: false }));
      bead.scale.set(1.3, 1.3, 1); bead.userData = { curve, ph: (L.n*.37) % 1 }; linkGrp.add(bead); L.beads.push(bead);
      if(i === 0) L.mid = curve.getPoint(.5);
    }
  });
  linkGrp.visible = showLines;
}
function paintLinks(){
  if(!linkGrp) return;
  linkGrp.visible = showLines || !!curLink;
  LINKS.forEach(L => { const on = !curLink || curLink === L; L.parts.forEach(m => m.opacity = on ? (curLink ? .95 : .5) : .08); L.beads.forEach(b => { b.visible = on; b.scale.setScalar(curLink === L ? 1.8 : 1.3); }); if(L.plate) L.plate.classList.toggle('on', curLink === L); });
}
function stepLinks(now){
  if(!linkGrp || !linkGrp.visible) return;
  LINKS.forEach(L => L.beads.forEach(b => { if(!b.visible) return; const f = ((now/3200) + b.userData.ph) % 1; b.position.copy(b.userData.curve.getPoint(f)); }));
}

/* ---------- 天空與海上點綴 ---------- */
const SKY = { clouds: [], boats: [] };
function buildSky(){
  // far mountain ring with a land shelf, like a distant coast
  { const rm = rnd(77), mc = ['#9db8a8', '#8fae9d', '#a9c2b2', '#b7cbbd'];
    const shelf = new THREE.Mesh(new THREE.RingGeometry(D*2.05, D*3.4, 48, 1), lam('#c9d8c0', { side: THREE.DoubleSide })); shelf.rotation.x = -Math.PI/2; shelf.position.y = .06; scene.add(shelf);
    for(let i=0;i<34;i++){
      const a = i/34*Math.PI*2 + rm()*.12, rr = D*2.35 + rm()*D*.6, h = 10 + rm()*16;
      const m = new THREE.Mesh(new THREE.ConeGeometry(5 + rm()*6, h, 5 + Math.floor(rm()*3)), lam(mc[i%4], { flatShading: true }));
      m.position.set(Math.cos(a)*rr, h/2 - .5, Math.sin(a)*rr); m.rotation.y = rm()*3; scene.add(m);
      if(h > 20){ const cap = new THREE.Mesh(new THREE.ConeGeometry((5 + 3)*.35, h*.22, 5), lam('#f4f2ec', { flatShading: true })); cap.position.set(m.position.x, h - .5 - h*.11, m.position.z); scene.add(cap); }
    } }
  const r = rnd(321), cm = lam('#ffffff', { transparent: true, opacity: .92 });
  for(let i=0;i<9;i++){
    const g = new THREE.Group(), n = 3 + Math.floor(r()*3);
    for(let k=0;k<n;k++){ const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + r()*1.4, 1), cm); p.position.set(k*2.1 - n, r()*.8, (r()-.5)*1.6); p.scale.y = .6; g.add(p); }
    const a = r()*Math.PI*2, rr = D*1.5 + r()*D*1.6; g.position.set(Math.cos(a)*rr, 48 + r()*16, Math.sin(a)*rr); g.userData = { a, rr, sp: .006 + r()*.01 };
    scene.add(g); SKY.clouds.push(g);
  }
  for(let i=0;i<4;i++){
    const g = new THREE.Group();
    const hull = box(2.2, .5, .9, ['#b5653d','#3f7fa3','#d8a640','#8a5a8f'][i]); hull.position.y = .25; g.add(hull);
    const mast = cyl(.05, .05, 2.4, '#5b4636', 5); mast.position.y = 1.4; g.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(.9, 2, 3), lam('#fffaf0')); sail.position.set(.35, 1.55, 0); sail.scale.z = .15; g.add(sail);
    g.userData = { a: i*1.57 + .4, rr: D + 13 + i*3, sp: (i%2 ? 1 : -1) * (.02 + i*.004) };
    scene.add(g); SKY.boats.push(g);
  }
}
function stepSky(dt, now){
  SKY.clouds.forEach(g => { g.userData.a += g.userData.sp*dt; g.position.x = Math.cos(g.userData.a)*g.userData.rr; g.position.z = Math.sin(g.userData.a)*g.userData.rr; });
  SKY.boats.forEach((g, i) => { const u = g.userData; u.a += u.sp*dt; g.position.set(Math.cos(u.a)*u.rr, Math.sin(now/600 + i)*.08, Math.sin(u.a)*u.rr); g.rotation.y = -u.a + (u.sp > 0 ? 0 : Math.PI); g.rotation.z = Math.sin(now/800 + i)*.05; });
  W.bob.forEach((b, i) => { b.position.y = b.userData.y0 + Math.sin(now/700 + i)*.06; b.rotation.z = Math.sin(now/900 + i)*.05; });
}

function setLit(I, on, flash){
  I.lan.forEach((L,k) => { L.userData.on = on; L.userData.flash = flash ? performance.now() + k*180 : 0; });
}

function init3d(){
  try{
    renderer = new THREE.WebGLRenderer({ antialias: true });
  }catch(e){ ok3d = false; return; }
  const host = $('#stage');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  const mobile = Math.min(innerWidth, innerHeight) < 600;
  renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene(); fogCol = C('#bfe3ef'); scene.fog = new THREE.Fog(fogCol, 120, 320);
  camera = new THREE.PerspectiveCamera(42, host.clientWidth/host.clientHeight, .5, 600);
  hemi = new THREE.HemisphereLight(0xffffff, 0x8fb3a0, .9); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, .8); sun.position.set(40, 70, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.far = 220; scene.add(sun);
  layout();
  seaMat = new THREE.MeshLambertMaterial({ color: C(T.sea) });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 64), seaMat); sea.rotation.x = -Math.PI/2; sea.receiveShadow = true; scene.add(sea);
  const shallow = new THREE.Mesh(new THREE.CircleGeometry(D + 14, 64), new THREE.MeshLambertMaterial({ color: C(T.sea).lerp(C('#ffffff'), .18), transparent: true, opacity: .55 })); shallow.rotation.x = -Math.PI/2; shallow.position.y = .01; scene.add(shallow);
  plazaBuild(); ISL.forEach(buildIsland); buildLinks(); buildSky();
  // stars
  const sg = new THREE.BufferGeometry(), sp = []; const r = rnd(4);
  for(let i=0;i<500;i++){ const th = r()*Math.PI*2, ph = r()*Math.PI*.45; sp.push(Math.cos(th)*Math.sin(ph)*300, Math.cos(ph)*300 + 20, Math.sin(th)*Math.sin(ph)*300); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0 })); scene.add(stars);
  // avatar
  me = new THREE.Group();
  const body = cyl(.32,.42,1.1,T.accent,12); body.position.y = .55; me.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.32, 14, 12), lam('#f5d6b8')); head.position.y = 1.4; me.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.34, 14, 10, 0, Math.PI*2, 0, Math.PI/2), lam('#3a2a20')); hair.position.y = 1.45; me.add(hair);
  me.traverse(o => { if(o.isMesh) o.castShadow = true; });
  me.position.set(0, .6, R0*.6); scene.add(me);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.maxPolarAngle = Math.PI*.42; controls.minPolarAngle = Math.PI*.12;
  controls.minDistance = 14; controls.maxDistance = 230; controls.screenSpacePanning = false;
  home(true);
  ISL.forEach(I => setLit(I, pass.has(I.id), false));
  addEventListener('resize', () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth/host.clientHeight; camera.updateProjectionMatrix(); viewShift(); });
  // click vs drag
  let down = null; const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if(!down || Math.hypot(e.clientX-down.x, e.clientY-down.y) > 6){ down = null; return; } down = null;
    const rect = renderer.domElement.getBoundingClientRect(); v2.set((e.clientX-rect.left)/rect.width*2-1, -(e.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(v2, camera);
    const hit = ray.intersectObjects(W.clickable, false)[0];
    if(hit){ if(hit.object.userData.station){ goStation(hit.object.userData.station); return; } if(hit.object.userData.island){ openIsland(hit.object.userData.island); return; } }
    const g = ray.intersectObjects(W.walk, false)[0];
    if(g){ walkTo(g.point.x, g.point.z); }
  });
  loop();
}

/* ---------- avatar walking ---------- */
let me, route = [];
function regionOf(x, z){
  if(Math.hypot(x, z) <= R0) return { t: 'plaza' };
  for(const I of ISL){ if(Math.hypot(x-I.cx, z-I.cz) <= I.r*1.05) return { t: 'isl', I }; }
  for(const I of ISL){ const ang = Math.atan2(z, x); if(Math.abs(Math.atan2(Math.sin(ang-I.th), Math.cos(ang-I.th))) < .08) return { t: 'br', I }; }
  return null;
}
const edgeIsl = I => { const k = (D - I.r*.85); return [Math.cos(I.th)*k, Math.sin(I.th)*k]; };
const edgePlz = I => { const k = R0*.8; return [Math.cos(I.th)*k, Math.sin(I.th)*k]; };
function walkTo(x, z){
  const a = regionOf(me.position.x, me.position.z), b = regionOf(x, z);
  if(!b) return;
  const pts = [];
  const leave = r => { if(r && r.t !== 'plaza'){ pts.push(edgeIsl(r.I), edgePlz(r.I)); } };
  const enter = r => { if(r && r.t !== 'plaza'){ pts.push(edgePlz(r.I), edgeIsl(r.I)); } };
  const same = a && b && a.t === b.t && (a.t === 'plaza' || a.I === b.I);
  if(!same){
    if(a && a.t === 'br') pts.push(edgePlz(a.I)); else leave(a);
    if(b.t === 'br') pts.push(edgePlz(b.I)); else enter(b);
  }
  pts.push([x, z]);
  route = pts.map(([px,pz]) => new THREE.Vector3(px, 0, pz));
}
/* touch a facility -> learn */
let keyMove = false;
function goStation(s){
  if(!ok3d || !me || !s.door) return openStation(s);
  walkTo(s.door[0], s.door[1]);
  const I = s.isl; flyTo(s.x*.6 + I.cx*.4, s.z*.6 + I.cz*.4, 24, Math.atan2(s.z - I.cz, s.x - I.cx));
  toast(`走向${s.fac || ''}「${s.t}」…`);
}
function stepTouch(){
  const r = regionOf(me.position.x, me.position.z); if(!r || r.t !== 'isl') return;
  const fin = route.length ? route[route.length-1] : null;
  for(const s of r.I.stations){
    if(!s.door) continue;
    const d = Math.hypot(me.position.x - s.door[0], me.position.z - s.door[1]);
    if(d > 2.5){ s._in = false; continue; }
    if(d < 1.4 && !s._in){
      const target = fin && Math.hypot(fin.x - s.door[0], fin.z - s.door[1]) < .3;
      if(route.length && !target) continue;          // just passing by
      s._in = true;
      if(!(current && current.s === s)){ if(s.head) s.head.userData.pulse = performance.now(); openStation(s); }
    }
  }
}
const keys = new Set();
addEventListener('keydown', e => {
  if(e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  const k = e.key.toLowerCase(); if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){ keys.add(k); if(k.startsWith('arrow')) e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
function stepKeys(dt){
  if(!keys.size){ keyMove = false; return; }
  let f = 0, sd = 0;
  if(keys.has('w') || keys.has('arrowup')) f += 1; if(keys.has('s') || keys.has('arrowdown')) f -= 1;
  if(keys.has('d') || keys.has('arrowright')) sd += 1; if(keys.has('a') || keys.has('arrowleft')) sd -= 1;
  if(!f && !sd) return;
  const fw = new THREE.Vector3().subVectors(controls.target, camera.position); fw.y = 0; fw.normalize();
  const rt = new THREE.Vector3(-fw.z, 0, fw.x);
  const mv = fw.multiplyScalar(f).add(rt.multiplyScalar(sd)).normalize().multiplyScalar(7*dt);
  const nx = me.position.x + mv.x, nz = me.position.z + mv.z;
  route = []; keyMove = true;
  if(regionOf(nx, nz)){ me.position.x = nx; me.position.z = nz; }
  else if(regionOf(nx, me.position.z)) me.position.x = nx; else if(regionOf(me.position.x, nz)) me.position.z = nz;
  me.rotation.y = Math.atan2(mv.x, mv.z);
  const r = regionOf(me.position.x, me.position.z); me.position.y = (r && r.t === 'isl') ? r.I.H : .62;
  me.children[0].position.y = .55 + Math.abs(Math.sin(performance.now()/90))*.08;
  // camera follows gently
  const dx = me.position.x - controls.target.x, dz = me.position.z - controls.target.z;
  controls.target.x += dx*.06; controls.target.z += dz*.06; camera.position.x += dx*.06; camera.position.z += dz*.06;
}
function stepAvatar(dt){
  stepKeys(dt); if(me) stepTouch();
  if(!route.length) return;
  const t = route[0], dx = t.x - me.position.x, dz = t.z - me.position.z, d = Math.hypot(dx, dz), sp = 9*dt;
  if(d < sp){ me.position.x = t.x; me.position.z = t.z; route.shift(); }
  else { me.position.x += dx/d*sp; me.position.z += dz/d*sp; me.rotation.y = Math.atan2(dx, dz); }
  const r = regionOf(me.position.x, me.position.z);
  me.position.y = (r && r.t === 'isl') ? r.I.H : .62;
  me.children[0].position.y = .55 + Math.abs(Math.sin(performance.now()/90))*.08;
}

/* ---------- camera ---------- */
let fly = null;
function flyTo(tx, tz, dist, ang){
  const from = { t: controls.target.clone(), p: camera.position.clone() };
  const tgt = new THREE.Vector3(tx, 0, tz);
  const dir = ang != null ? new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)) : new THREE.Vector3(tx, 0, tz).normalize();
  if(!isFinite(dir.x) || dir.length() < .1) dir.set(0, 0, 1);
  const pos = tgt.clone().add(dir.multiplyScalar(dist*.72)).add(new THREE.Vector3(0, dist*.68, 0));
  fly = { from, to: { t: tgt, p: pos }, t0: performance.now(), dur: 900 };
}
function home(instant){
  const st = $('#stage'), asp = st.clientWidth / Math.max(1, st.clientHeight);
  const dist = (D*2.7 + 20) * Math.max(1, Math.min(1.9, .8/asp));
  if(instant){ controls.target.set(0,0,0); camera.position.set(0, dist*.68, dist*.72); controls.update(); }
  else flyTo(0, 0, dist, Math.PI/2);
}

/* ---------- labels ---------- */
const plates = [];
function mkPlate(html, cls, onClick, world){
  const b = document.createElement('button'); b.className = cls; b.innerHTML = html; b.onclick = onClick; labels.appendChild(b);
  plates.push({ el: b, world }); return b;
}
function buildLabels(){
  mkPlate(`${esc(G.plaza.name)}`, 'plate plaza', () => { closePanel(); home(); walkTo(0, R0*.5); }, { x: 0, y: 7.2, z: 0, kind: 'plaza' });
  ISL.forEach(I => {
    I.plate = mkPlate('', 'plate', () => openIsland(I), { x: I.cx, y: I.H + 5.4, z: I.cz, kind: 'isl', I });
    I.stations.forEach(s => { s.pinEl = mkPlate(String(s.n), 'pin', () => goStation(s), { x: s.x, y: s.y + (s.labelY || 2.25), z: s.z, kind: 'pin', I }); s.pinEl.title = s.fac ? `${s.fac}・${s.t}` : s.t; });
  });
  LINKS.forEach(L => { if(L.mid) L.plate = mkPlate(`<span style="background:${L.col}">${L.n}</span>`, 'lnk', () => openLink(L), { x: L.mid.x, y: L.mid.y + .6, z: L.mid.z, kind: 'link', L }); });
  meLabel = mkPlate('★ 我', 'pin me', null, { me: true, kind: 'me' });
  refreshLabels();
}
let meLabel;
function refreshLabels(){
  ISL.forEach(I => {
    const n = rCount(I);
    I.plate.innerHTML = `<span class="no" style="background:${I.color}">${String(I.id).padStart(2,"0")}</span>${esc(I.name)}<span class="pg">${n}/${I.stations.length}</span>${pass.has(I.id) ? '<span class="stamp">印</span>' : ''}`;
    I.plate.setAttribute('aria-label', `${I.name}，已讀 ${n} / ${I.stations.length}${pass.has(I.id) ? '，已過關' : ''}`);
    I.stations.forEach(s => {
      const r = read.has(s.id); s.pinEl.style.background = r ? I.color : '#8a8f8c'; s.pinEl.classList.toggle('read', r);
      s.pinEl.setAttribute('aria-label', `${I.name} 第 ${s.n} 站：${s.t}${r ? '（已讀）' : ''}`);
      if(s.head) s.head.material.color.set(r ? I.color : '#ffffff');
    });
  });
  $('#passN').textContent = `${pass.size}/${N}`;
}
const vtmp = ok3d ? new THREE.Vector3() : null;
function placeLabels(){
  const w = innerWidth, h = innerHeight, cd = camera.position.distanceTo(controls.target);
  for(const p of plates){
    const W0 = p.world;
    if(W0.me) vtmp.set(me.position.x, me.position.y + 2.2, me.position.z); else vtmp.set(W0.x, W0.y, W0.z);
    const dist = camera.position.distanceTo(vtmp);
    vtmp.project(camera);
    const vis = vtmp.z < 1 && Math.abs(vtmp.x) < 1.15 && Math.abs(vtmp.y) < 1.15;
    let dim = !vis;
    if(W0.kind === 'pin') dim = dim || dist > 78 || (cd > 70 && !(focusIsl === W0.I));
    if(W0.kind === 'me') dim = dim || dist > 110;
    if(W0.kind === 'link') dim = dim || !(curLink ? curLink === W0.L : showLines);
    p.el.dataset.dim = dim ? '1' : '0';
    if(!dim) p.el.style.transform = `translate(${(vtmp.x*.5+.5)*w}px,${(-vtmp.y*.5+.5)*h}px) translate(-50%,-100%)`;
  }
}

/* ---------- time of day ---------- */
const TIMES = {
  dawn: { bg: '#f6d9bd', sky: '#ffe8cf', gnd: '#9fc1b0', hi: .62, sun: '#ffd2a1', si: .55, sp: [60, 30, 50], sea: .96, star: 0, glow: .55 },
  noon: { bg: '#bfe3ef', sky: '#ffffff', gnd: '#8fb3a0', hi: .62, sun: '#fff6e2', si: .6, sp: [30, 80, 40], sea: 1, star: 0, glow: .45 },
  dusk: { bg: '#f2b28c', sky: '#ffcfa0', gnd: '#8a7f9a', hi: .52, sun: '#ff9a5c', si: .55, sp: [-60, 25, -20], sea: .82, star: .15, glow: .8 },
  night: { bg: '#18233f', sky: '#6b7fb8', gnd: '#1d2a3a', hi: .38, sun: '#a9b8ff', si: .28, sp: [-30, 60, -40], sea: .42, star: 1, glow: 1 }
};
let tod = store.get('tod', 'noon'); if(!TIMES[tod]) tod = 'noon';
function setTime(k){
  tod = k; store.set('tod', k);
  document.querySelectorAll('.timebar button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === k)));
  const t = TIMES[k]; document.body.style.background = t.bg;
  if(!ok3d || !scene) return;
  scene.background = C(t.bg); scene.fog.color = C(t.bg);
  hemi.color = C(t.sky); hemi.groundColor = C(t.gnd); hemi.intensity = t.hi;
  sun.color = C(t.sun); sun.intensity = t.si; sun.position.set(...t.sp);
  seaMat.color = C(T.sea).multiplyScalar(t.sea);
  stars.material.opacity = t.star;
}
document.querySelectorAll('.timebar button').forEach(b => b.onclick = () => setTime(b.dataset.t));

/* ---------- loop ---------- */
let last = performance.now(), focusIsl = null;
function loop(){
  requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(.05, (now - last)/1000); last = now;
  if(fly){
    const k = Math.min(1, (now - fly.t0)/fly.dur), e = k<.5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2;
    controls.target.lerpVectors(fly.from.t, fly.to.t, e); camera.position.lerpVectors(fly.from.p, fly.to.p, e);
    if(k >= 1) fly = null;
  }
  controls.update(); stepAvatar(dt); if(others.size) stepOthers(dt);
  for(const g of W.gems){ g.rotation.y += dt*1.2; const p = g.userData.pulse; const k = p ? Math.max(0, 1 - (now - p)/700) : 0; g.scale.setScalar(1 + k*.8); g.position.y += Math.sin(now/500 + g.id)*.002; }
  const t = TIMES[tod], night = t.glow;
  for(const L of W.lanterns){
    const u = L.userData; let on = u.on, a = on ? 1 : 0;
    if(u.flash){ const f = (now - u.flash)/600; if(f < 0) a = 0; else if(f < 1) a = f; else u.flash = 0; }
    u.mat.emissive.setRGB(1*a*night, .72*a*night, .3*a*night);
    u.mat.color.set(a ? '#fff3cf' : '#e8e2d6');
    u.halo.material.opacity = a * (.35 + .55*night);
  }
  for(const rg of W.ripples){ const f = ((now/2600) + rg.userData.ph) % 1; rg.scale.setScalar(1 + f*.18); rg.material.opacity = .45*(1-f); }
  ISL.forEach(I => { if(I.prop3.userData.spin){ I.prop3.userData.spin.rotation.y += dt*.5; I.prop3.userData.spin.position.y = 3.4 + Math.sin(now/700)*.15; } if(I.prop3.userData.smoke){ I.prop3.userData.smoke.material.opacity = .25 + Math.sin(now/500)*.1; } });
  stepLinks(now); stepSky(dt, now);
  renderer.render(scene, camera); placeLabels();
}

/* ---------- panels ---------- */
let current = null;
function viewShift(){
  if(!ok3d || !camera) return;
  const st = $('#stage'), w = st.clientWidth, h = st.clientHeight;
  if(panel.hidden){ camera.clearViewOffset(); return; }
  if(w > 760) camera.setViewOffset(w, h, panel.offsetWidth/2, 0, w, h);
  else camera.setViewOffset(w, h, 0, panel.offsetHeight*.42, w, h);
}
function showPanel(html){ panel.innerHTML = html; panel.hidden = false; panel.scrollTop = 0; viewShift(); }
function closePanel(){ panel.hidden = true; current = null; focusIsl = null; if(curLink){ curLink = null; paintLinks(); } setHash(''); viewShift(); }
function setHash(h){ try{ history.replaceState(null, '', h ? '#'+h : location.pathname + location.search); }catch(e){} }

function openIsland(I, opts={}){
  if(curLink){ curLink = null; paintLinks(); }
  focusIsl = I; current = { I };
  if(ok3d && !opts.noFly){ flyTo(I.cx, I.cz, 34, I.th); walkTo(edgeIsl(I)[0], edgeIsl(I)[1]); }
  const n = rCount(I), all = I.stations.length, done = n === all, passed = pass.has(I.id);
  showPanel(`
    <div class="p-top"><div class="crumbs"><span>第 ${I.id} 島</span></div><button class="x" data-x aria-label="關閉">×</button></div>
    <div class="isl-head"><h2>${esc(I.name)}</h2><p class="sub">${esc(I.sub)}</p></div>
    <div><div class="bar"><i style="width:${n/all*100}%;background:${I.color}"></i></div><p class="small">已讀 ${n} / ${all} 站</p></div>
    <ul class="slist">${I.stations.map(s => `<li><button data-s="${s.n}"><span class="num" style="background:${read.has(s.id) ? I.color : '#9aa19d'}">${s.n}</span><span class="tt">${esc(s.t)}<small>${esc(s.meta || '')}</small></span><span class="ck">${read.has(s.id) ? '✓ 已讀' : ''}</span></button></li>`).join('')}</ul>
    <div class="quizcta">${passed
      ? `<div class="passed"><span class="sealmini">${esc(I.name.slice(0,2))}<br>過關</span><p>這座島已經過關，護照蓋好章了。想再玩一次也可以。</p></div><button class="btn" data-quiz>再挑戰一次</button>`
      : done ? `<p><b>全部讀完了！</b>挑戰 ${I.quiz.length} 題闖關題，答對 ${passMark(I)} 題就能在護照蓋章、點亮島上的燈。</p><button class="btn primary" data-quiz>開始闖關</button>`
      : `<p>再讀 ${all - n} 站，就能挑戰這座島的闖關題。</p><button class="btn primary" data-s="${(I.stations.find(s => !read.has(s.id)) || I.stations[0]).n}">從第 ${(I.stations.find(s => !read.has(s.id)) || I.stations[0]).n} 站開始</button>`}
    </div>`);
  panel.querySelectorAll('[data-s]').forEach(b => b.onclick = () => openStation(I.stations[+b.dataset.s - 1]));
  panel.querySelector('[data-x]').onclick = closePanel;
  const q = panel.querySelector('[data-quiz]'); if(q) q.onclick = () => openQuiz(I);
  setHash('i'+I.id);
}

function openStation(s){
  if(curLink){ curLink = null; paintLinks(); }
  const I = s.isl; focusIsl = I; current = { I, s };
  if(ok3d){ const ang = Math.atan2(s.z - I.cz, s.x - I.cx); flyTo(s.x*.6 + I.cx*.4, s.z*.6 + I.cz*.4, 24, ang); if(s.door) walkTo(s.door[0], s.door[1]); else walkTo(I.cx + (s.x-I.cx)*.8, I.cz + (s.z-I.cz)*.8); }
  const first = !read.has(s.id);
  read.add(s.id); store.set('read', [...read]); refreshLabels();
  const src = G.key === 'lz' ? `〈${I.name}〉原文` : '《一貫道疑問解答》原文';
  const isLast = s.n === I.stations.length, done = rCount(I) === I.stations.length;
  const links = [];
  if(s.book && BOOK) s.book.forEach(n => links.push(`<button class="chipbtn" data-book="${n}">原書第 ${n} 題全文</button>`));
  if(s.xy) links.push(`<a class="chipbtn" href="liuzu.html#i1s${s.xy}">六祖〈行由品〉第 ${s.xy} 站 →</a>`);
  if(SUTRA && G.key === 'lz'){ links.push(`<button class="chipbtn" data-wc="${I.id}">〈${esc(I.name)}〉經文全文</button>`); const k = s.quote && s.quote.length ? sutraKey(s.quote[0]) : ''; if(k) links.push(`<button class="chipbtn" data-wq="${esc(k)}">在經文中找這段</button>`); }
  if(s.ref) links.push(`<a class="chipbtn" href="${s.ref.href}">${esc(s.ref.label)}</a>`);
  showPanel(`
    <div class="p-top"><div class="crumbs"><button data-isl>${esc(I.name)}</button><span>· 第 ${s.n} / ${I.stations.length} 站${s.fac ? `・${esc(s.fac)}` : ''}</span></div><button class="x" data-x aria-label="關閉">×</button></div>
    <h2>${esc(s.t)}</h2>
    ${s.meta ? `<p class="meta">${esc(s.meta)}</p>` : ''}
    ${s.one ? `<p class="lead">${esc(s.one)}</p>` : ''}
    <p class="text">${esc(s.text)}</p>
    ${s.quote && s.quote.length ? `<blockquote class="quote">${s.quote.map(l => `<span>${esc(l)}</span>`).join('')}<small>${src}</small></blockquote>` : ''}
    ${s.point ? `<div class="box"><h4>這一站在說</h4><p>${esc(s.point)}</p></div>` : ''}
    <div class="box ask"><h4>想一想</h4><p>${esc(s.ask)}</p></div>
    <div class="mc" data-mc></div>
    ${s.xyNote ? `<p class="small">${esc(s.xyNote)}</p>` : ''}
    ${s.links.length ? `<div class="rel"><h4>${ICON.link}相通線・和這一站相關</h4>${s.links.map(L => { const o = L.s.filter(x => x !== s); return `<button class="relb" data-lk="${L.n}"><span class="ln" style="background:${L.col || '#999'}">${L.n}</span><span><b>${esc(L.t)}</b><small>${o.map(x => `${esc(x.isl.name)}・${esc(x.t)}`).join('、')}</small></span></button>`; }).join('')}</div>` : ''}
    ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
    <div class="qa" data-qa></div>
    <nav class="pnav"><button class="btn" data-prev ${s.n === 1 ? 'disabled' : ''}>← 上一站</button>
      ${isLast || done && isLast ? `<button class="btn primary" data-isl>${done ? '回島上闖關 →' : '回到島上'}</button>` : `<button class="btn primary" data-next>下一站 →</button>`}</nav>`);
  panel.querySelectorAll('[data-isl]').forEach(b => b.onclick = () => openIsland(I, { noFly: false }));
  panel.querySelector('[data-x]').onclick = closePanel;
  const pv = panel.querySelector('[data-prev]'); if(pv) pv.onclick = () => { if(s.n > 1) openStation(I.stations[s.n-2]); };
  const nx = panel.querySelector('[data-next]'); if(nx) nx.onclick = () => openStation(I.stations[s.n]);
  mcMount(s, panel.querySelector('[data-mc]'));
  qaMount(s, panel.querySelector('[data-qa]'));
  panel.querySelectorAll('[data-book]').forEach(b => b.onclick = () => openBook(+b.dataset.book));
  panel.querySelectorAll('[data-wc]').forEach(b => b.onclick = () => openSutra({ ch: +b.dataset.wc }));
  panel.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => openLink(LINKS[+b.dataset.lk - 1], s));
  panel.querySelectorAll('[data-wq]').forEach(b => b.onclick = () => openSutra({ q: b.dataset.wq }));
  setHash(`i${I.id}s${s.n}`);
  if(first && done) toast(`${I.name}全部讀完，可以闖關了！`);
}

/* ---------- 相通線 panels ---------- */
function setLines(on){ showLines = on; store.set('lines', on ? 1 : 0); paintLinks(); const b = $('#bLink'); if(b) b.classList.toggle('on', on); }
function linkCard(L){ return `<button class="lrow" data-lk="${L.n}"><span class="ln" style="background:${L.col || '#999'}">${L.n}</span><span class="lt"><b>${esc(L.t)}</b><small>${L.s.map(x => `${esc(x.isl.name)}・${esc(x.t)}`).join(' ↔ ')}</small></span><span class="lk">${esc(L.k || '')}</span></button>`; }
function openLinks(){
  curLink = null; focusIsl = null; paintLinks();
  if(ok3d) home();
  showPanel(`
    <div class="p-top"><span class="small">${esc(G.title)}</span><button class="x" data-x aria-label="關閉">×</button></div>
    <h2>相通線</h2>
    <p class="lead">不同島上的站，常常在說同一件事。這 ${LINKS.length} 條線把它們連起來：先讀一站，再順著線去讀另一站，兩邊對照，會懂得更深。</p>
    <label class="sw"><input type="checkbox" id="swL" ${showLines ? 'checked' : ''}><span></span>在島嶼上顯示相通線</label>
    <div class="llist">${LINKS.map(linkCard).join('')}</div>`);
  panel.querySelector('[data-x]').onclick = closePanel;
  panel.querySelector('#swL').onchange = e => setLines(e.target.checked);
  panel.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => openLink(LINKS[+b.dataset.lk - 1]));
  setHash('L');
}
function openLink(L, from){
  if(!L) return;
  curLink = L; focusIsl = null; current = null; paintLinks();
  if(ok3d){ const a = L.s[0], b = L.s[L.s.length-1]; const mx = (a.x + b.x)/2, mz = (a.z + b.z)/2, d = Math.hypot(a.x - b.x, a.z - b.z); flyTo(mx, mz, Math.max(30, d*1.25 + 18), Math.atan2(mz, mx) || Math.PI/2); }
  const i = LINKS.indexOf(L), prev = LINKS[i-1], next = LINKS[i+1];
  showPanel(`
    <div class="p-top"><div class="crumbs"><button data-all>相通線</button><span>· 第 ${L.n} / ${LINKS.length} 條</span></div><button class="x" data-x aria-label="關閉">×</button></div>
    <p class="ktag" style="--c:${L.col}">${esc(L.k || '相通')}</p>
    <h2>${esc(L.t)}</h2>
    <p class="text">${esc(L.why)}</p>
    <div class="ends">${L.s.map((x, k) => `${k ? `<div class="joint" style="--c:${L.col}"></div>` : ''}<button class="endc" data-st="${x.id}">
      <span class="ei"><span class="no" style="background:${x.isl.color}">${x.isl.id}</span>${esc(x.isl.name)}・第 ${x.n} 站${read.has(x.id) ? '<em>已讀</em>' : ''}</span>
      <b>${esc(x.t)}</b>${x.quote && x.quote.length ? `<q>${esc(x.quote[0])}</q>` : ''}<small>${esc(x.point || x.one || '')}</small><span class="go">讀這一站 →</span></button>`).join('')}</div>
    ${from ? `<button class="btn" data-back>← 回到「${esc(from.t)}」</button>` : ''}
    <nav class="pnav"><button class="btn" data-pl ${prev ? '' : 'disabled'}>← 上一條</button><button class="btn" data-nl ${next ? '' : 'disabled'}>下一條 →</button></nav>`);
  panel.querySelector('[data-x]').onclick = () => { curLink = null; paintLinks(); closePanel(); };
  panel.querySelector('[data-all]').onclick = openLinks;
  panel.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { curLink = null; paintLinks(); openStation(ALL.find(x => x.id === b.dataset.st)); });
  const bk = panel.querySelector('[data-back]'); if(bk) bk.onclick = () => { curLink = null; paintLinks(); openStation(from); };
  const pl = panel.querySelector('[data-pl]'); if(pl && prev) pl.onclick = () => openLink(prev);
  const nl = panel.querySelector('[data-nl]'); if(nl && next) nl.onclick = () => openLink(next);
  setHash('L' + L.n);
}

/* ---------- modal helpers ---------- */
function openModal(html, cls=''){ modal.className = 'modal ' + cls; modal.innerHTML = html; modal.hidden = false; scrim.hidden = false; const f = modal.querySelector('button'); if(f) f.focus({ preventScroll: true }); }
function closeModal(){ modal.hidden = true; scrim.hidden = true; }
scrim.onclick = closeModal;
let toastT;
function toast(msg){ let t = $('.toast'); if(!t){ t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

/* ---------- quiz ---------- */
const passMark = I => I.quiz.length <= 3 ? 2 : I.quiz.length - 1;
function shuffle(a, r){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(r()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
function openQuiz(I){
  const r = rnd(Date.now() % 100000);
  const qs = I.quiz.map(q => { const idx = shuffle(q.opts.map((_,i) => i), r); return { q: q.q, why: q.why, opts: idx.map(i => q.opts[i]), a: idx.indexOf(q.a) }; });
  const st = { i: 0, res: [] };
  const render = () => {
    const q = qs[st.i];
    openModal(`
      <div class="qnum"><span>${esc(I.name)}・闖關 第 ${st.i+1} / ${qs.length} 題</span><span class="dots">${qs.map((_,k) => `<i class="${k < st.res.length ? (st.res[k] ? 'ok' : 'bad') : k === st.i ? 'cur' : ''}"></i>`).join('')}</span></div>
      <p class="qq">${esc(q.q)}</p>
      <div class="opts">${q.opts.map((o,k) => `<button class="opt" data-o="${k}">${'ABCD'[k]}．${esc(o)}</button>`).join('')}</div>
      <div class="why" hidden></div>
      <div class="mrow"><button class="btn" data-close>先離開</button><button class="btn primary" data-go hidden>${st.i === qs.length-1 ? '看結果' : '下一題'}</button></div>`);
    modal.querySelector('[data-close]').onclick = closeModal;
    modal.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
      const k = +b.dataset.o, right = k === q.a; st.res.push(right);
      modal.querySelectorAll('[data-o]').forEach(x => { x.disabled = true; if(+x.dataset.o === q.a) x.classList.add('ok'); });
      if(!right) b.classList.add('bad');
      const w = modal.querySelector('.why'); w.hidden = false; w.innerHTML = `<b>${right ? '答對了！' : '再想想看。'}</b>${esc(q.why)}`;
      const go = modal.querySelector('[data-go]'); go.hidden = false; go.focus();
      go.onclick = () => { st.i++; st.i < qs.length ? render() : result(); };
    });
  };
  const result = () => {
    const score = st.res.filter(Boolean).length, ok = score >= passMark(I), was = pass.has(I.id);
    if(ok){ pass.add(I.id); store.set('pass', [...pass]); refreshLabels(); if(ok3d){ setLit(I, true, !was); } }
    openModal(`<div class="result">
      ${ok ? `<div class="bigseal">${esc(I.name.slice(0,2))}<br>過關</div><h3>闖關成功！</h3><p>答對 ${score} / ${qs.length} 題。學習護照蓋章了，${esc(I.name)}的燈也亮起來了。</p>`
           : `<h3>差一點點</h3><p>答對 ${score} / ${qs.length} 題，需要答對 ${passMark(I)} 題。回島上再讀一次，等等再來挑戰！</p>`}
      <div class="mrow" style="justify-content:center">${ok ? `<button class="btn" data-pp>看學習護照</button>` : `<button class="btn" data-again>再挑戰一次</button>`}<button class="btn primary" data-close>${ok ? '繼續逛島' : '回島上複習'}</button></div></div>`);
    modal.querySelector('[data-close]').onclick = () => { closeModal(); openIsland(I, { noFly: true }); };
    const pp = modal.querySelector('[data-pp]'); if(pp) pp.onclick = openPassport;
    const ag = modal.querySelector('[data-again]'); if(ag) ag.onclick = () => openQuiz(I);
  };
  render();
}

/* ---------- passport ---------- */
function openPassport(){
  const total = ALL.length, rd = ALL.filter(s => read.has(s.id)).length;
  const note = store.get('note', ''), pick = store.get('pick', ALL[0].id);
  openModal(`
    <div class="p-top"><span>${esc(G.title)}・學習護照</span><button class="x" data-close aria-label="關閉">×</button></div>
    <h3>已蓋 ${pass.size} / ${N} 枚章</h3>
    <p class="small">已讀 ${rd} / ${total} 站。每座島讀完並通過闖關題，就會蓋一枚章。進度只存在這台裝置的瀏覽器裡。</p>
    <div class="stamps">${ISL.map(I => `<button class="stamp ${pass.has(I.id) ? 'on' : ''}" data-i="${I.id}"><span class="sl">${esc(I.name.slice(0,2))}${pass.has(I.id) ? '<br>過關' : ''}</span><b>${esc(I.name)}</b><small>${rCount(I)} / ${I.stations.length} 站</small></button>`).join('')}</div>
    <div class="task">
      <b>課前小任務</b><p class="small">選一站最有感的，寫一兩句話，按「複製」貼到班群，班會時分享。</p>
      <label for="tPick">選一站</label>
      <select id="tPick">${ISL.map(I => `<optgroup label="${esc(I.name)}">${I.stations.map(s => `<option value="${s.id}" ${s.id === pick ? 'selected' : ''}>${I.name}・${s.n} ${esc(s.t)}</option>`).join('')}</optgroup>`).join('')}</select>
      <label for="tNote">我的一句話</label>
      <textarea id="tNote" placeholder="例如：這一站讓我想到……">${esc(note)}</textarea>
      <div class="mrow" style="justify-content:flex-start;align-items:center"><button class="btn primary" data-copy>複製我的回答</button><span class="okmsg" aria-live="polite"></span></div>
    </div>`, 'wide');
  modal.querySelector('[data-close]').onclick = closeModal;
  modal.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeModal(); openIsland(ISL.find(I => I.id === +b.dataset.i)); });
  const sel = modal.querySelector('#tPick'), ta = modal.querySelector('#tNote');
  sel.onchange = () => store.set('pick', sel.value); ta.oninput = () => store.set('note', ta.value);
  modal.querySelector('[data-copy]').onclick = () => {
    const s = ALL.find(x => x.id === sel.value), msg = modal.querySelector('.okmsg');
    const out = `【${G.title}課前小任務】${s.isl.name}・第${s.n}站〈${s.t}〉：${ta.value.trim() || '（還沒寫）'}`;
    const fail = () => { ta.focus(); ta.select(); msg.textContent = '無法自動複製，請手動選取文字複製'; };
    try{ navigator.clipboard.writeText(out).then(() => msg.textContent = '已複製，可以貼到班群了', fail); }catch(e){ fail(); }
  };
}

/* ---------- list ---------- */
function openList(){
  openModal(`
    <div class="p-top"><span>${esc(G.title)}・島嶼清單</span><button class="x" data-close aria-label="關閉">×</button></div>
    <h3>${N} 座島・${ALL.length} 站</h3>
    <div class="clist">${ISL.map(I => `<section><h4><span class="plate" style="position:static;transform:none;box-shadow:none;padding:0;background:none"><span class="no" style="background:${I.color}">${I.id}</span></span>${esc(I.name)} <small>${esc(I.sub)}・${rCount(I)}/${I.stations.length}${pass.has(I.id) ? '・已過關' : ''}</small></h4>
      <ul class="slist">${I.stations.map(s => `<li><button data-s="${s.id}"><span class="num" style="background:${read.has(s.id) ? I.color : '#9aa19d'}">${s.n}</span><span class="tt">${esc(s.t)}<small>${esc(s.meta || '')}</small></span><span class="ck">${read.has(s.id) ? '✓' : ''}</span></button></li>`).join('')}</ul></section>`).join('')}</div>`, 'wide');
  modal.querySelector('[data-close]').onclick = closeModal;
  modal.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { closeModal(); openStation(ALL.find(s => s.id === b.dataset.s)); });
}

/* ---------- book (全書) ---------- */
const bookEl = $('#book');
let bIsl = null, bQ = '';
if(BOOK){ ISL.forEach(I => (I.book || []).forEach(n => { const b = BOOK.find(x => x.n === n); if(b) b.isl = I; })); BOOK.forEach(b => { b.st = ALL.find(s => s.book && s.book[0] === b.n) || ALL.find(s => s.book && s.book.includes(b.n)); }); }
function openBook(n){
  bookEl.hidden = false; bIsl = null; bQ = '';
  bookEl.innerHTML = `<div class="in">
    <div class="p-top"><span>《一貫道疑問解答》全書</span><button class="x" data-close aria-label="關閉">×</button></div>
    <h3>全書 ${BOOK.length} 題原文</h3>
    <p class="small">依原書卷上、卷下排列。可以用主題島篩選，或輸入關鍵字搜尋題目、摘要與原文。點題目展開原文。</p>
    <input class="search" id="bS" type="search" placeholder="搜尋，例如：吃素、因果、三寶" aria-label="搜尋題目或原文">
    <div class="chips" id="bC"></div><p class="small" id="bN"></p><div id="bL"></div></div>`;
  bookEl.querySelector('[data-close]').onclick = () => { bookEl.hidden = true; setHash(''); };
  bookEl.querySelector('#bS').oninput = e => { bQ = e.target.value.trim(); renderBook(); };
  renderBook();
  if(n){ const d = bookEl.querySelector('#b'+n); if(d){ d.open = true; requestAnimationFrame(() => d.scrollIntoView({ block: 'start' })); setHash('b'+n); } }
}
function renderBook(){
  const C1 = bookEl.querySelector('#bC');
  C1.innerHTML = `<button class="chip" aria-pressed="${!bIsl}" data-c="">全部 ${BOOK.length}</button>` + ISL.map(I => `<button class="chip" aria-pressed="${bIsl === I}" data-c="${I.id}">${esc(I.name)} ${(I.book || []).length}</button>`).join('');
  C1.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { bIsl = b.dataset.c ? ISL.find(I => I.id === +b.dataset.c) : null; renderBook(); });
  const hit = BOOK.filter(b => (!bIsl || b.isl === bIsl) && (!bQ || b.t.includes(bQ) || b.one.includes(bQ) || b.p.some(x => x.includes(bQ))));
  bookEl.querySelector('#bN').textContent = (bIsl || bQ) ? `找到 ${hit.length} 題` : `卷上 ${BOOK.filter(b => b.vol === '上').length} 題、卷下 ${BOOK.filter(b => b.vol === '下').length} 題`;
  const vol = v => { const a = hit.filter(b => b.vol === v); if(!a.length) return ''; return `<div style="display:grid;gap:8px;margin-bottom:20px"><h4 style="margin:0;font-family:var(--f-display);font-size:22px">卷${v}</h4>${a.map(b => `
    <details class="bq" id="b${b.n}"><summary><span class="bn">${b.n}</span><span class="bt">${esc(b.t)}${b.isl ? `<span class="tg">${esc(b.isl.name)}島</span>` : ''}</span><span class="bo">${esc(b.one)}</span></summary>
    <div class="bp">${b.p.map(x => `<p>${esc(x)}</p>`).join('')}<span class="small">《一貫道疑問解答》卷${b.vol}・原文</span>
    <div class="links">${b.st ? `<button class="chipbtn" data-st="${b.st.id}">去${esc(b.isl.name)}島讀導讀 →</button>` : b.isl ? `<button class="chipbtn" data-is="${b.isl.id}">去${esc(b.isl.name)}島 →</button>` : ''}</div></div></details>`).join('')}</div>`; };
  const L = bookEl.querySelector('#bL');
  L.innerHTML = hit.length ? vol('上') + vol('下') : '<p class="small">沒有符合的題目，換個關鍵字試試。</p>';
  L.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { bookEl.hidden = true; openStation(ALL.find(s => s.id === b.dataset.st)); });
  L.querySelectorAll('[data-is]').forEach(b => b.onclick = () => { bookEl.hidden = true; openIsland(ISL.find(I => I.id === +b.dataset.is)); });
  L.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => { if(d.open) setHash(d.id); }));
}

/* ---------- sutra (經文全文) ---------- */
const CNUM = '一二三四五六七八九十';
let wCh = 0, wQ = '';
const wTxt = p => typeof p === 'string' ? p : p.t;
function sutraKey(q){
  if(!SUTRA) return '';
  const all = SUTRA.ch.flatMap(c => c.p.map(wTxt)), has = k => all.some(t => t.includes(k));
  const parts = String(q).split(/[，。；：、！？「」『』\s]+/).filter(x => x.length >= 4).sort((a, b) => b.length - a.length);
  for(const p of parts){ if(has(p)) return p; }
  for(const p of parts){ for(let i = 0; i + 4 <= p.length; i++){ const k = p.slice(i, i + 4); if(has(k)) return k; } }
  return '';
}
function hl(t, q){ if(!q) return esc(t); return t.split(q).map(esc).join(`<mark>${esc(q)}</mark>`); }
function openSutra(o = {}){
  wCh = o.ch || 0; wQ = o.q || '';
  bookEl.hidden = false;
  bookEl.innerHTML = `<div class="in">
    <div class="p-top"><span>${esc(SUTRA.title)}・經文全文</span><button class="x" data-close aria-label="關閉">×</button></div>
    <h3>《${esc(SUTRA.title)}》</h3>
    <p class="small">${esc(SUTRA.by)}。共十品，可以按品閱讀，或輸入字詞搜尋全文。</p>
    <input class="search" id="wS" type="search" placeholder="搜尋經文，例如：本來無一物、自性、般若" aria-label="搜尋經文" value="${esc(wQ)}">
    <div class="chips" id="wC"></div><p class="small" id="wN"></p><div id="wL"></div></div>`;
  bookEl.querySelector('[data-close]').onclick = () => { bookEl.hidden = true; setHash(''); };
  bookEl.querySelector('#wS').oninput = e => { wQ = e.target.value.trim(); renderSutra(); };
  renderSutra();
  if(o.p){ const el = bookEl.querySelector(`#w${wCh}p${o.p}`); if(el){ el.classList.add('flash'); requestAnimationFrame(() => el.scrollIntoView({ block: 'center' })); } }
  else bookEl.scrollTop = 0;
}
function renderSutra(){
  const C1 = bookEl.querySelector('#wC');
  C1.innerHTML = `<button class="chip" aria-pressed="${!wCh}" data-c="0">全部十品</button>` + SUTRA.ch.map(c => `<button class="chip" aria-pressed="${wCh === c.n}" data-c="${c.n}">${c.n}・${esc(c.name)}</button>`).join('');
  C1.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { wCh = +b.dataset.c; renderSutra(); bookEl.scrollTop = 0; });
  const chs = SUTRA.ch.filter(c => !wCh || c.n === wCh);
  const L = bookEl.querySelector('#wL'), N1 = bookEl.querySelector('#wN');
  const head = c => `<div class="wh"><h4>${esc(c.name)}第${CNUM[c.n-1]}</h4><button class="chipbtn" data-is="${c.n}">去${esc(c.isl)}島 →</button></div>`;
  const para = (c, p, i, q) => { const t = wTxt(p); return `<p class="sp${typeof p === 'string' ? '' : ' verse'}" id="w${c.n}p${i+1}">${hl(t, q)}</p>`; };
  if(wQ){
    let n = 0;
    const html = chs.map(c => { const hits = c.p.map((p, i) => [p, i]).filter(([p]) => wTxt(p).includes(wQ)); n += hits.length; if(!hits.length) return '';
      return `<section class="wsec">${head(c)}${hits.map(([p, i]) => `<div class="whit">${para(c, p, i, wQ)}<button class="chipbtn" data-ctx="${c.n}:${i+1}">看前後文</button></div>`).join('')}</section>`; }).join('');
    N1.textContent = `「${wQ}」${wCh ? `在第${CNUM[wCh-1]}品` : '在全部十品'}出現在 ${n} 段經文${wCh ? '（按「全部十品」可搜全經）' : ''}`;
    L.innerHTML = n ? html : '<p class="small">經文裡沒有找到這幾個字，換個字詞試試（例如少打一兩個字）。</p>';
  } else {
    N1.textContent = wCh ? `第${CNUM[wCh-1]}品，共 ${chs[0].p.length} 段` : '';
    L.innerHTML = chs.map(c => `<section class="wsec">${head(c)}${c.p.map((p, i) => para(c, p, i, '')).join('')}</section>`).join('');
  }
  L.querySelectorAll('[data-is]').forEach(b => b.onclick = () => { bookEl.hidden = true; openIsland(ISL.find(I => I.id === +b.dataset.is)); });
  L.querySelectorAll('[data-ctx]').forEach(b => b.onclick = () => { const [c, p] = b.dataset.ctx.split(':').map(Number); openSutra({ ch: c, p }); setHash(`w${c}p${p}`); });
  setHash(wCh ? 'w'+wCh : 'w');
}

/* ---------- welcome ---------- */
function welcome(){
  openModal(`<div class="welcome" style="display:grid;gap:14px;justify-items:start">
    <div class="logo">${G.logo[0]}<br>${G.logo[1]}</div>
    <h3>歡迎來到${esc(G.title)}</h3><p>${esc(G.welcome)}</p>
    <p class="small">${ok3d ? '操作：點地面讓「我」走過去，拖曳旋轉視角，滾輪或雙指縮放。' : '這台裝置無法顯示 3D 畫面，請用「島嶼清單」閱讀，內容和闖關都一樣。'}</p>
    <div class="mrow" style="width:100%"><button class="btn" data-l>先看島嶼清單</button><button class="btn primary" data-go>開始逛島</button></div></div>`);
  modal.querySelector('[data-l]').onclick = () => { store.set('welcome', 1); openList(); };
  modal.querySelector('[data-go]').onclick = () => { store.set('welcome', 1); closeModal(); };
}

/* ---------- station mini challenge: one of six, picked at random ---------- */
let mcOk = new Set(store.get('mc', []));
function mcMount(s, box, avoid){
  if(!box) return;
  const list = (s.mc || []).filter(q => q && q.q && q.opts && q.opts.length >= 2);
  if(!list.length){ box.remove(); return; }
  let pool = list.map((q, i) => i).filter(i => i !== avoid); if(!pool.length) pool = [0];
  const qi = pool[Math.floor(Math.random()*pool.length)], q = list[qi];
  const order = q.opts.map((t, i) => i).sort(() => Math.random() - .5);
  box.innerHTML = `<div class="mch"><h4>小挑戰</h4><small>${mcOk.has(s.id) ? '這一站已經答對過 ✓' : '讀完了，試試看這一題'}</small></div>
    <p class="mcq">${esc(q.q)}</p>
    <div class="mco">${order.map(i => `<button class="mcb" data-i="${i}">${esc(q.opts[i])}</button>`).join('')}</div>
    <div class="mcr" aria-live="polite"></div>`;
  box.querySelectorAll('.mcb').forEach(b => b.onclick = () => {
    const pick = +b.dataset.i, right = pick === (q.a || 0);
    box.querySelectorAll('.mcb').forEach(x => { x.disabled = true; const i = +x.dataset.i; if(i === (q.a || 0)) x.classList.add('ok'); else if(x === b) x.classList.add('no'); });
    if(right && !mcOk.has(s.id)){ mcOk.add(s.id); store.set('mc', [...mcOk]); }
    box.querySelector('.mcr').innerHTML = `<p class="${right ? 'good' : 'bad'}"><b>${right ? '答對了！' : '再想想看。'}</b>${right ? '' : `正確答案是「${esc(q.opts[q.a || 0])}」。`}</p>
      ${q.why ? `<p class="why">${esc(q.why)}</p>` : ''}${list.length > 1 ? '<button class="linkbtn" data-again>換一題</button>' : ''}`;
    const ag = box.querySelector('[data-again]'); if(ag) ag.onclick = () => mcMount(s, box, qi);
  });
}

/* ---------- content edits saved by the admin page ---------- */
const BASE = new Map();
ALL.forEach(s => BASE.set(s.id, { t: s.t, meta: s.meta, one: s.one, text: s.text, quote: s.quote, point: s.point, ask: s.ask, mc: s.mc }));
function applyEdits(ed){
  ALL.forEach(s => {
    Object.assign(s, BASE.get(s.id));
    const e = ed && ed[s.id]; if(!e) return;
    ['t','meta','one','text','point','ask'].forEach(k => { if(typeof e[k] === 'string') s[k] = e[k]; });
    if(Array.isArray(e.quote)) s.quote = e.quote;
    if(Array.isArray(e.mc) && e.mc.length) s.mc = e.mc;
    if(s.pinEl) s.pinEl.title = s.fac ? `${s.fac}・${s.t}` : s.t;
  });
}
(function(){ try{ const c = JSON.parse(localStorage.getItem('yc-edits-' + G.key) || 'null'); if(c) applyEdits(c); }catch(e){} })();

/* ---------- together: presence + questions & answers (Google Sheet via Apps Script) ---------- */
const API = (window.YC_API || '').trim();
const myId = (() => { try{ let v = localStorage.getItem('yc-id'); if(!v){ v = Math.random().toString(36).slice(2, 10); localStorage.setItem('yc-id', v); } return v; }catch(e){ return Math.random().toString(36).slice(2, 10); } })();
const PCOL = ['#e0773c', '#3f8fc0', '#c2489a', '#4d9a5b', '#c9a227', '#7a5cc4', '#d0574f', '#2f9e9a'];
let who = (() => { try{ return JSON.parse(localStorage.getItem('yc-who') || 'null'); }catch(e){ return null; } })();
function saveWho(w){ who = w; try{ localStorage.setItem('yc-who', JSON.stringify(w)); }catch(e){} if(me && who) me.children[0].material.color.set(who.c); if(meLabel && who) meLabel.textContent = '★ ' + who.n; }
async function api(op, data = {}){
  if(!API) throw new Error('noapi');
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ op, site: G.key, uid: myId }, data)) });
  const j = await r.json(); if(!j.ok) throw new Error(j.err || 'error'); return j;
}
const ago = t => { const d = (Date.now() - t)/1000; return d < 60 ? '剛剛' : d < 3600 ? `${Math.floor(d/60)} 分鐘前` : d < 86400 ? `${Math.floor(d/3600)} 小時前` : `${Math.floor(d/86400)} 天前`; };
function askName(then){
  const cur = who || { n: '', c: PCOL[Math.floor(Math.random()*PCOL.length)] };
  openModal(`<div class="p-top"><h2>先取個暱稱</h2><button class="x" data-x aria-label="關閉">×</button></div>
    <p class="small">大家在島上看到的就是這個名字，提問和回答也會署這個名字。請不要用全名或電話。</p>
    <label class="fld"><span>暱稱</span><input id="whoN2" maxlength="12" value="${esc(cur.n)}" placeholder="例如：小明"></label>
    <div class="fld"><span>角色顏色</span><div class="swatches">${PCOL.map(c => `<button class="swc${c === cur.c ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="顏色 ${c}"></button>`).join('')}</div></div>
    <div class="mrow"><button class="btn primary" data-ok>好了</button></div>`, 'narrow');
  let col = cur.c;
  modal.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { col = b.dataset.c; modal.querySelectorAll('.swc').forEach(x => x.classList.toggle('on', x === b)); });
  modal.querySelector('[data-x]').onclick = closeModal;
  const inp = modal.querySelector('#whoN2'); setTimeout(() => inp.focus(), 50);
  const ok = () => { const n = inp.value.trim().slice(0, 12); if(!n){ inp.focus(); return; } saveWho({ n, c: col }); closeModal(); if(then) then(); };
  modal.querySelector('[data-ok]').onclick = ok; inp.onkeydown = e => { if(e.key === 'Enter') ok(); };
}
const needName = fn => () => who ? fn() : askName(fn);

/* other avatars */
const others = new Map();
function mkOther(o){
  const g = new THREE.Group();
  const body = cyl(.3, .4, 1.05, o.c || '#888', 12); body.position.y = .55; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 10), lam('#f5d6b8')); head.position.y = 1.35; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 8, 0, Math.PI*2, 0, Math.PI/2), lam('#3a2a20')); hair.position.y = 1.4; g.add(hair);
  g.position.set(o.x, .62, o.z); scene.add(g);
  const el = mkPlate(esc(o.n), 'pin who', null, { x: o.x, y: 2.1, z: o.z, kind: 'who' }); el.style.background = o.c;
  return { g, el, tx: o.x, tz: o.z, c: o.c };
}
function syncOthers(list){
  const seen = new Set();
  for(const o of list){
    if(o.id === myId) continue; seen.add(o.id);
    let a = others.get(o.id);
    if(!a){ if(!ok3d || !scene) continue; a = mkOther(o); others.set(o.id, a); }
    a.tx = o.x; a.tz = o.z; a.n = o.n; a.st = o.st; a.el.textContent = o.n; a.el.title = o.st ? `${o.n}・正在看「${o.st}」` : o.n;
    if(a.c !== o.c){ a.c = o.c; a.g.children[0].material.color.set(o.c); a.el.style.background = o.c; }
  }
  for(const [id, a] of others) if(!seen.has(id)){ scene.remove(a.g); a.el.remove(); const i = plates.findIndex(p => p.el === a.el); if(i >= 0) plates.splice(i, 1); others.delete(id); }
  online = list.filter(o => o.id !== myId);
  $('#whoN').textContent = online.length + 1;
}
let online = [];
function stepOthers(dt){
  for(const a of others.values()){
    const p = a.g.position, dx = a.tx - p.x, dz = a.tz - p.z, d = Math.hypot(dx, dz);
    if(d > .05){ const k = Math.min(1, dt*3); p.x += dx*k; p.z += dz*k; a.g.rotation.y = Math.atan2(dx, dz); a.g.children[0].position.y = .55 + Math.abs(Math.sin(performance.now()/90))*.06; }
    const r = regionOf(p.x, p.z); p.y = (r && r.t === 'isl') ? r.I.H : .62;
    const pl = plates.find(q => q.el === a.el); if(pl){ pl.world.x = p.x; pl.world.y = p.y + 2.1; pl.world.z = p.z; }
  }
}
let presT = 0, presFail = 0;
async function presence(){
  if(!API || !who || document.hidden) return;
  try{
    const p = me ? me.position : { x: 0, z: 0 };
    const j = await api('pos', { n: who.n, c: who.c, x: +p.x.toFixed(2), z: +p.z.toFixed(2), st: current ? current.s.t : '' });
    presFail = 0; syncOthers(j.list || []);
    if(j.unans != null) setUnans(j.unans);
  }catch(e){ presFail++; }
}
function setUnans(n){ const b = $('#qaN'); b.hidden = !n; b.textContent = n; }

/* station Q&A */
function qaItem(q){
  return `<li class="qi" data-q="${esc(q.id)}"><div class="qh"><span class="dot" style="background:${esc(q.c || '#999')}"></span><b>${esc(q.n)}</b><small>${ago(q.t)}</small></div>
    <p class="qt">${esc(q.text)}</p>
    <ul class="alist">${(q.ans || []).map(a => `<li><div class="qh"><span class="dot" style="background:${esc(a.c || '#999')}"></span><b>${esc(a.n)}</b><small>${ago(a.t)}</small></div><p>${esc(a.text)}</p></li>`).join('')}</ul>
    <button class="linkbtn" data-rep>回答這個問題${q.ans && q.ans.length ? `（已有 ${q.ans.length} 則）` : ''}</button>
    <div class="rep" hidden><textarea maxlength="500" rows="2" placeholder="分享您的體會或經文出處…"></textarea><button class="btn primary sm" data-send>送出回答</button></div></li>`;
}
async function qaMount(s, box){
  if(!box) return;
  const head = `<h4>${ICON.chat}提問與回答</h4>`;
  if(!API){ box.innerHTML = `${head}<p class="small">留言區還沒連上試算表，設定好後這裡就能提問，也能回答其他道親的問題。</p>`; return; }
  box.innerHTML = `${head}<ul class="qlist"><li class="small">載入中…</li></ul>
    <div class="askf"><textarea maxlength="500" rows="2" placeholder="讀到這一站有什麼疑問？寫下來，大家一起想。"></textarea><button class="btn primary sm" data-ask>提出疑問</button></div>
    <p class="small">留言大家都看得到；前賢會整理不合適的內容。</p>`;
  const load = async () => {
    try{
      const j = await api('list', { sid: s.id });
      if(!(current && current.s === s)) return;
      const ul = box.querySelector('.qlist');
      ul.innerHTML = j.qs.length ? j.qs.map(qaItem).join('') : '<li class="small">這一站還沒有人提問，您可以當第一位。</li>';
      ul.querySelectorAll('[data-rep]').forEach(b => b.onclick = needName(() => { const r = b.nextElementSibling; r.hidden = false; r.querySelector('textarea').focus(); }));
      ul.querySelectorAll('[data-send]').forEach(b => b.onclick = async () => {
        const li = b.closest('[data-q]'), ta = li.querySelector('.rep textarea'), t = ta.value.trim(); if(!t) return ta.focus();
        b.disabled = true; try{ await api('answer', { qid: li.dataset.q, n: who.n, c: who.c, text: t }); toast('回答已送出，感恩'); load(); }catch(e){ toast(/太快/.test(e.message) ? e.message : '送出失敗，請稍後再試'); b.disabled = false; }
      });
    }catch(e){ const ul = box.querySelector('.qlist'); if(ul) ul.innerHTML = '<li class="small">暫時連不上留言區，請稍後再試。</li>'; }
  };
  box.querySelector('[data-ask]').onclick = needName(async () => {
    const ta = box.querySelector('.askf textarea'), t = ta.value.trim(); if(!t) return ta.focus();
    const b = box.querySelector('[data-ask]'); b.disabled = true;
    try{ await api('ask', { sid: s.id, st: `${s.isl.name}・${s.t}`, n: who.n, c: who.c, text: t }); ta.value = ''; toast('疑問已送出，其他道親可以回答'); load(); }
    catch(e){ toast(/太快/.test(e.message) ? e.message : '送出失敗，請稍後再試'); } b.disabled = false;
  });
  load();
}
async function openQA(){
  showPanel(`<div class="p-top"><h2>${ICON.chat}提問與回答</h2><button class="x" data-x aria-label="關閉">×</button></div>
    <p class="lead">大家在各站留下的疑問。點一則就會走到那一站，可以在那裡回答。</p>
    ${API ? `<div class="seg"><button class="on" data-f="all">最新</button><button data-f="un">還沒有人回答</button></div><ul class="qlist rq"><li class="small">載入中…</li></ul>` : '<p class="small">留言區還沒連上試算表，設定好後就能使用。</p>'}`);
  panel.querySelector('[data-x]').onclick = closePanel;
  if(!API) return;
  let qs = [], f = 'all';
  const draw = () => { const ul = panel.querySelector('.rq'); if(!ul) return; const v = f === 'un' ? qs.filter(q => !q.na) : qs;
    ul.innerHTML = v.length ? v.map(q => `<li><button class="rqb" data-sid="${esc(q.sid)}"><span class="qh"><span class="dot" style="background:${esc(q.c || '#999')}"></span><b>${esc(q.n)}</b><small>${ago(q.t)}・${esc(q.st || '')}</small></span><span class="qt">${esc(q.text)}</span><span class="na${q.na ? '' : ' zero'}">${q.na ? `${q.na} 則回答` : '等待回答'}</span></button></li>`).join('') : '<li class="small">目前沒有。</li>';
    ul.querySelectorAll('[data-sid]').forEach(b => b.onclick = () => { const st = ALL.find(x => x.id === b.dataset.sid); if(st) (ok3d ? goStation : openStation)(st); if(ok3d && st) setTimeout(() => { if(!(current && current.s === st)) openStation(st); }, 6000); }); };
  panel.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { f = b.dataset.f; panel.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  try{ const j = await api('recent'); qs = j.qs; setUnans(qs.filter(q => !q.na).length); draw(); }
  catch(e){ const ul = panel.querySelector('.rq'); if(ul) ul.innerHTML = '<li class="small">暫時連不上留言區，請稍後再試。</li>'; }
}
function openWho(){
  const rows = online.map(o => `<li><span class="dot" style="background:${esc(o.c)}"></span><b>${esc(o.n)}</b><small>${o.st ? `正在看「${esc(o.st)}」` : '在島上散步'}</small></li>`).join('');
  openModal(`<div class="p-top"><h2>${ICON.people}同修在線</h2><button class="x" data-x aria-label="關閉">×</button></div>
    ${API ? `<ul class="wlist"><li><span class="dot" style="background:${esc(who ? who.c : T.accent)}"></span><b>${esc(who ? who.n : '我')}</b><small>（我）</small></li>${rows || ''}</ul>${rows ? '' : '<p class="small">現在只有您在島上。邀請班上的道親一起打開這個網址，就會看到彼此的角色。</p>'}`
      : '<p class="small">多人同遊還沒連上試算表，設定好後就能看到其他道親的角色。</p>'}
    <div class="mrow"><button class="btn" data-nm>${who ? '改暱稱或顏色' : '取個暱稱加入'}</button><button class="btn primary" data-x2>好</button></div>`, 'narrow');
  modal.querySelector('[data-x]').onclick = closeModal; modal.querySelector('[data-x2]').onclick = closeModal;
  modal.querySelector('[data-nm]').onclick = () => askName(() => presence());
}

/* ---------- wire up ---------- */
$('#bHome').onclick = () => { closePanel(); closeModal(); if(ok3d) home(); };
$('#bList').onclick = openList;
$('#bPass').onclick = openPassport;
$('#bQA').onclick = openQA;
$('#bWho').onclick = openWho;
if(BOOK) $('#bBook').onclick = () => openBook();
if(SUTRA) $('#bSutra').onclick = () => openSutra();
if(LINKS.length){ $('#bLink').onclick = openLinks; $('#bLink').classList.toggle('on', showLines); }
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ if(!bookEl.hidden){ bookEl.hidden = true; } else if(!modal.hidden) closeModal(); else if(!panel.hidden) closePanel(); } });

if(ok3d){ init3d(); }
if(ok3d && renderer){ buildLabels(); }
else { ok3d = false; document.querySelector('.hint').hidden = true; document.querySelector('.timebar').hidden = true;
  document.body.insertAdjacentHTML('beforeend', `<div class="nogl">這台裝置無法顯示 3D 畫面。請按右上角「島嶼清單」閱讀，各站內容、闖關與學習護照都能正常使用。</div>`);
  ISL.forEach(I => { I.plate = document.createElement('span'); I.stations.forEach(s => { s.pinEl = document.createElement('span'); }); });
  refreshLabels();
}
setTime(tod);

// deep links
const h = location.hash.slice(1);
let m;
if((m = h.match(/^i(\d+)s(\d+)$/))){ const I = ISL.find(x => x.id === +m[1]); if(I && I.stations[+m[2]-1]) openStation(I.stations[+m[2]-1]); }
else if((m = h.match(/^i(\d+)$/))){ const I = ISL.find(x => x.id === +m[1]); if(I) openIsland(I); }
else if(BOOK && (m = h.match(/^b(\d+)$/))){ openBook(+m[1]); }
else if(LINKS.length && (m = h.match(/^L(\d*)$/))){ if(+m[1]) openLink(LINKS[+m[1]-1]); else openLinks(); }
else if(SUTRA && (m = h.match(/^w(\d*)(?:p(\d+))?$/))){ openSutra({ ch: +m[1] || 0, p: +m[2] || 0 }); }
else if(G.legacy && (m = h.match(G.legacy.re))){ const s = G.legacy.map(+m[1]); if(s) openStation(ALL.find(x => x.id === s)); }
else if(!store.get('welcome', 0)) welcome();
else if(!ok3d) openList();
// together
if(who) saveWho(who);
if(API){
  api('edits').then(j => { const nj = JSON.stringify(j.edits || {}); let old = null; try{ old = localStorage.getItem('yc-edits-' + G.key); localStorage.setItem('yc-edits-' + G.key, nj); }catch(e){} if(old === nj) return; applyEdits(j.edits || {}); if(current && !panel.hidden) openStation(current.s); }).catch(() => {});
  presence(); setInterval(() => presence(), 3000);
  api('recent').then(j => setUnans(j.qs.filter(q => !q.na).length)).catch(() => {});
  if(!who) setTimeout(() => { if(!who && modal.hidden) askName(() => presence()); }, 5000);
} else { $('#whoN').textContent = '1'; }
})();
