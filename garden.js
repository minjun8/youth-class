/* 群島樂園引擎：讀 window.GARDEN（與選用的 window.BOOK），畫出 3D 群島、圖釘、角色、護照與闖關題。 */
(function(){
'use strict';
const G = window.GARDEN, BOOK = window.BOOK || null, T = G.theme;
const ISL = G.islands, N = ISL.length;
const root = document.documentElement;
root.style.setProperty('--accent', T.accent); root.style.setProperty('--ink', T.ink); root.style.setProperty('--ui-bg', T.uiBg);

/* ---------- state ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(G.key+'-'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(G.key+'-'+k, JSON.stringify(v)); }catch(e){} }
};
ISL.forEach(I => I.stations.forEach((s,i) => { s.n = i+1; s.id = I.id+'-'+(i+1); s.isl = I; }));
const ALL = ISL.flatMap(I => I.stations);
let read = new Set(store.get('read', []));
let pass = new Set(store.get('pass', []));
(G.migrate || []).forEach(fn => { try{ fn(read); }catch(e){} });
store.set('read', [...read]); store.set('total', { stations: ALL.length, islands: N });
const rCount = I => I.stations.filter(s => read.has(s.id)).length;
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $ = s => document.querySelector(s);

/* ---------- DOM shell ---------- */
const ICON = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  pass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/></svg>',
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
    <button class="tbtn" id="bHome">${ICON.home}<span class="lbl">全景</span></button>
    <button class="tbtn" id="bList">${ICON.list}<span class="lbl">島嶼清單</span></button>
    ${BOOK ? `<button class="tbtn" id="bBook">${ICON.book}<span class="lbl">全書</span></button>` : ''}
    <button class="tbtn" id="bPass">${ICON.pass}<span class="lbl">學習護照</span><span class="n" id="passN">0/${N}</span></button>
  </nav>
  <div class="timebar" role="group" aria-label="時段">
    <button data-t="dawn">晨光</button><button data-t="noon">午後</button><button data-t="dusk">黃昏</button><button data-t="night">星夜</button>
  </div>
  <div class="hint">點地面走路・拖曳旋轉・滾輪縮放・點島名或圖釘</div>
  <div class="scrim" id="scrim" hidden></div>
  <aside class="panel" id="panel" hidden aria-live="polite"></aside>
  <div class="modal" id="modal" role="dialog" aria-modal="true" hidden></div>
  <div class="book" id="book" hidden></div>
`);
const panel = $('#panel'), modal = $('#modal'), scrim = $('#scrim'), labels = $('#labels');

/* ---------- 3D ---------- */
let ok3d = !!window.THREE;
let renderer, scene, camera, controls, hemi, sun, seaMat, stars, fogCol;
const W = { islands: [], lanterns: [], pins: [], walk: [], ripples: [], clickable: [] };
let R0 = 9, D = 30;

function rnd(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const C = c => new THREE.Color(c);
const lam = (c, o={}) => new THREE.MeshLambertMaterial(Object.assign({ color: C(c) }, o));

function layout(){
  ISL.forEach(I => { I.r = Math.max(6, Math.min(9.2, 5.2 + 0.33 * I.stations.length)); });
  const rmax = Math.max(...ISL.map(I => I.r));
  D = R0 + rmax + 6;
  for(let k=0;k<40;k++){
    let okk = true;
    for(let i=0;i<N;i++){ const a = ISL[i], b = ISL[(i+1)%N]; if(2*D*Math.sin(Math.PI/N) < a.r + b.r + 3){ okk = false; } }
    if(okk) break; D += 1;
  }
  ISL.forEach((I,i) => { I.th = Math.PI/2 + i * 2*Math.PI/N; I.cx = D*Math.cos(I.th); I.cz = D*Math.sin(I.th); I.H = 0.9; });
}

function islandMesh(I, top, side, seed){
  const r = rnd(seed), seg = 40, g = new THREE.CylinderGeometry(I.r, I.r*1.06, 1.6, seg, 1);
  const pos = g.attributes.position, wob = [];
  for(let i=0;i<=seg;i++) wob.push(1 + (r()-.5)*0.07);
  for(let i=0;i<pos.count;i++){
    const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x); const k = Math.round(((a+Math.PI)/(2*Math.PI))*seg) % seg;
    const f = (wob[k] + wob[(k+1)%seg]) / 2; pos.setX(i, x*f); pos.setZ(i, z*f);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, [lam(side), lam(top), lam(side)]);
  m.position.set(I.cx, I.H - 0.8, I.cz); m.receiveShadow = true;
  return m;
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

function buildIsland(I, idx){
  const grp = new THREE.Group(); scene.add(grp);
  const m = islandMesh(I, C(T.land).offsetHSL(0, .1, -.24), T.sand, 100 + idx*13); scene.add(m); m.userData.walk = { type: 'island', I }; W.walk.push(m);
  const path = new THREE.Mesh(new THREE.RingGeometry(I.r*.5, I.r*.62, 40), lam('#f4ead6')); path.rotation.x = -Math.PI/2; path.position.set(I.cx, I.H+.01, I.cz); scene.add(path);
  const p = prop(I.prop, I.color); p.position.set(I.cx, I.H, I.cz); p.rotation.y = -I.th + Math.PI/2; scene.add(p); I.prop3 = p;
  p.traverse(o => { if(o.isMesh){ o.userData.island = I; W.clickable.push(o); } });
  // pins
  const toC = Math.atan2(-I.cz, -I.cx), n = I.stations.length, gap = .55, span = 2*Math.PI - 2*gap;
  I.stations.forEach((s, i) => {
    const a = toC + gap + span * (n === 1 ? .5 : i/(n-1)), rr = I.r * .78;
    s.x = I.cx + Math.cos(a)*rr; s.z = I.cz + Math.sin(a)*rr; s.y = I.H;
    const pin = new THREE.Group();
    const stick = cyl(.05,.05,1.1,'#666',5); stick.position.y = .55; pin.add(stick);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), new THREE.MeshLambertMaterial({ color: C('#ffffff') })); head.position.y = 1.2; pin.add(head);
    pin.position.set(s.x, s.y, s.z); scene.add(pin); s.head = head;
    head.userData.station = s; W.clickable.push(head);
  });
  // trees
  const r = rnd(500 + idx*31), pal = ['#7fb069','#9cc47a','#6aa35a', '#f2b5c6', '#f6c48b'];
  let placed = 0, tries = 0;
  while(placed < 5 + Math.floor(I.r/2) && tries++ < 200){
    const a = r()*Math.PI*2, rr = I.r*(.32 + r()*.6), x = I.cx + Math.cos(a)*rr, z = I.cz + Math.sin(a)*rr;
    if(Math.abs(Math.atan2(Math.sin(a-toC), Math.cos(a-toC))) < .45) continue;
    if(Math.hypot(x-I.cx, z-I.cz) < 2.6) continue;
    if(I.stations.some(s => Math.hypot(s.x-x, s.z-z) < 1.6)) continue;
    scene.add(tree(x, z, I.H, r, pal)); placed++;
  }
  // lanterns
  I.lan = [];
  for(let k=0;k<3;k++){ const a = toC + Math.PI + (k-1)*.9, rr = I.r*.45; const L = lantern(I.cx + Math.cos(a)*rr, I.cz + Math.sin(a)*rr, I.H); scene.add(L); I.lan.push(L); W.lanterns.push(L); }
  // ripples
  for(let k=0;k<2;k++){ const rg = new THREE.Mesh(new THREE.RingGeometry(I.r*1.08, I.r*1.12, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4 })); rg.rotation.x = -Math.PI/2; rg.position.set(I.cx, .02, I.cz); rg.userData.ph = k*.5; scene.add(rg); W.ripples.push(rg); }
  bridge(I);
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
  plazaBuild(); ISL.forEach(buildIsland);
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
    if(hit){ if(hit.object.userData.station){ openStation(hit.object.userData.station); return; } if(hit.object.userData.island){ openIsland(hit.object.userData.island); return; } }
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
function stepAvatar(dt){
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
    I.stations.forEach(s => { s.pinEl = mkPlate(String(s.n), 'pin', () => openStation(s), { x: s.x, y: s.y + 2.25, z: s.z, kind: 'pin', I }); });
  });
  meLabel = mkPlate('★ 我', 'pin me', null, { me: true, kind: 'me' });
  refreshLabels();
}
let meLabel;
function refreshLabels(){
  ISL.forEach(I => {
    const n = rCount(I);
    I.plate.innerHTML = `<span class="no" style="background:${I.color}">${I.id}</span>${esc(I.name)}<span class="pg">${n}/${I.stations.length}</span>${pass.has(I.id) ? '<span class="stamp">印</span>' : ''}`;
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
  controls.update(); stepAvatar(dt);
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
function closePanel(){ panel.hidden = true; current = null; focusIsl = null; setHash(''); viewShift(); }
function setHash(h){ try{ history.replaceState(null, '', h ? '#'+h : location.pathname + location.search); }catch(e){} }

function openIsland(I, opts={}){
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
  const I = s.isl; focusIsl = I; current = { I, s };
  if(ok3d){ const ang = Math.atan2(s.z - I.cz, s.x - I.cx); flyTo(s.x*.6 + I.cx*.4, s.z*.6 + I.cz*.4, 24, ang); walkTo(I.cx + (s.x-I.cx)*.8, I.cz + (s.z-I.cz)*.8); }
  const first = !read.has(s.id);
  read.add(s.id); store.set('read', [...read]); refreshLabels();
  const src = G.key === 'lz' ? `〈${I.name}〉原文` : '《一貫道疑問解答》原文';
  const isLast = s.n === I.stations.length, done = rCount(I) === I.stations.length;
  const links = [];
  if(s.book && BOOK) s.book.forEach(n => links.push(`<button class="chipbtn" data-book="${n}">原書第 ${n} 題全文</button>`));
  if(s.xy) links.push(`<a class="chipbtn" href="liuzu.html#i1s${s.xy}">六祖〈行由品〉第 ${s.xy} 站 →</a>`);
  if(s.ref) links.push(`<a class="chipbtn" href="${s.ref.href}">${esc(s.ref.label)}</a>`);
  showPanel(`
    <div class="p-top"><div class="crumbs"><button data-isl>${esc(I.name)}</button><span>· 第 ${s.n} / ${I.stations.length} 站</span></div><button class="x" data-x aria-label="關閉">×</button></div>
    <h2>${esc(s.t)}</h2>
    ${s.meta ? `<p class="meta">${esc(s.meta)}</p>` : ''}
    ${s.one ? `<p class="lead">${esc(s.one)}</p>` : ''}
    <p class="text">${esc(s.text)}</p>
    ${s.quote && s.quote.length ? `<blockquote class="quote">${s.quote.map(l => `<span>${esc(l)}</span>`).join('')}<small>${src}</small></blockquote>` : ''}
    ${s.point ? `<div class="box"><h4>這一站在說</h4><p>${esc(s.point)}</p></div>` : ''}
    <div class="box ask"><h4>想一想</h4><p>${esc(s.ask)}</p></div>
    ${s.xyNote ? `<p class="small">${esc(s.xyNote)}</p>` : ''}
    ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
    <nav class="pnav"><button class="btn" data-prev ${s.n === 1 ? 'disabled' : ''}>← 上一站</button>
      ${isLast || done && isLast ? `<button class="btn primary" data-isl>${done ? '回島上闖關 →' : '回到島上'}</button>` : `<button class="btn primary" data-next>下一站 →</button>`}</nav>`);
  panel.querySelectorAll('[data-isl]').forEach(b => b.onclick = () => openIsland(I, { noFly: false }));
  panel.querySelector('[data-x]').onclick = closePanel;
  const pv = panel.querySelector('[data-prev]'); if(pv) pv.onclick = () => { if(s.n > 1) openStation(I.stations[s.n-2]); };
  const nx = panel.querySelector('[data-next]'); if(nx) nx.onclick = () => openStation(I.stations[s.n]);
  panel.querySelectorAll('[data-book]').forEach(b => b.onclick = () => openBook(+b.dataset.book));
  setHash(`i${I.id}s${s.n}`);
  if(first && done) toast(`${I.name}全部讀完，可以闖關了！`);
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

/* ---------- wire up ---------- */
$('#bHome').onclick = () => { closePanel(); closeModal(); if(ok3d) home(); };
$('#bList').onclick = openList;
$('#bPass').onclick = openPassport;
if(BOOK) $('#bBook').onclick = () => openBook();
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
else if(G.legacy && (m = h.match(G.legacy.re))){ const s = G.legacy.map(+m[1]); if(s) openStation(ALL.find(x => x.id === s)); }
else if(!store.get('welcome', 0)) welcome();
else if(!ok3d) openList();
})();
