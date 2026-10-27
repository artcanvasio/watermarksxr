/* WatermarksXR — AR session
   MindAR image tracking on the app's own camera <video>, rendered with three.js.
   Each of the four souvenir panels anchors a procedural placeholder overlay. */
import * as THREE from './vendor/three.module.min.js';
import './vendor/mindar-image.prod.js';

export const TARGET_ORDER = ['towers', 'fountain', 'kanal', 'river']; // order inside targets/targets.mind

const C = { teal: 0x174f51, teal950: 0x102b2d, tealL: 0xb9d9d4, tealXL: 0xdfe9e5, orange: 0xd28a50, orangeL: 0xe9b879,
  sand: 0xf2eadc, water: 0x7ac4d6, waterD: 0x4ea3bb, green: 0x6fa36b, greenD: 0x4c7f4a, white: 0xf8faf7, red: 0xa4533b,
  stone: 0xcfdfdc, bronze: 0x91633d, mountain: 0x65718a };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, o));
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); return k; };

/* ---------- label sprite ---------- */
function labelSprite(title, sub) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = 'rgba(16,43,45,.86)'; roundRect(x, 8, 8, 624, 144, 40); x.fill();
  x.fillStyle = '#e9b879'; x.font = '700 24px "DM Sans", system-ui, sans-serif'; x.textAlign = 'center'; x.letterSpacing = '2px';
  x.fillText(sub.toUpperCase(), 320, 60);
  x.fillStyle = '#ffffff'; x.font = '600 46px "DM Sans", system-ui, sans-serif'; x.letterSpacing = '0px'; x.fillText(title, 320, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(0.62, 0.155, 1); s.renderOrder = 10; return s;
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

function hotspotDot() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.018, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe9b879 })));
  const ring = mesh(new THREE.RingGeometry(0.026, 0.034, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  g.add(ring); g.userData.ring = ring; return g;
}

/* ---------- placeholder scenes (y-up, 1 unit = panel width) ---------- */
function sceneTowers() {
  const g = new THREE.Group(); const hits = []; const st = { flow: true, level: 0 };
  g.add(mesh(new THREE.BoxGeometry(0.95, 0.04, 0.62), mat(C.sand), 0, 0.02, 0));
  g.add(mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }), 0, 0.001, 0)).rotation.x = -Math.PI / 2;
  // main tower
  const tower = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.5, 10), mat(C.tealXL), -0.16, 0.29, 0); g.add(tower);
  for (let i = 0; i < 3; i++) for (const a of [-0.6, 0.6]) { const w = mesh(new THREE.BoxGeometry(0.03, 0.05, 0.02), mat(C.teal950), -0.16 + Math.sin(a) * 0.1, 0.16 + i * 0.13, Math.cos(a) * 0.1); w.lookAt(-0.16, w.position.y, 0); g.add(w); }
  g.add(mesh(new THREE.ConeGeometry(0.14, 0.15, 10), mat(C.red), -0.16, 0.615, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 10), mat(C.stone), -0.16, 0.545, 0));
  const tank = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 12), mat(C.water, { transparent: true, opacity: 0 }), -0.16, 0.5, 0); g.add(tank);
  tank.userData.hit = { title: 'Top reservoir', text: 'Water collected high above the city, then ran down through pipes to the fountains by gravity alone.' };
  hits.push(tank);
  // second tower
  g.add(mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.32, 10), mat(C.tealXL), 0.08, 0.2, 0.1));
  g.add(mesh(new THREE.ConeGeometry(0.09, 0.1, 10), mat(C.orange), 0.08, 0.41, 0.1));
  // water column inside main tower (origin at bottom)
  const colGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 10); colGeo.translate(0, 0.5, 0);
  const column = mesh(colGeo, mat(C.water, { transparent: true, opacity: 0.9 }), -0.16, 0.04, 0); column.scale.y = 0.001; g.add(column);
  // channel + wheel
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.02, 0.07), mat(C.waterD), 0.17, 0.045, 0.2));
  const wheel = new THREE.Group(); wheel.position.set(0.34, 0.14, 0.2);
  wheel.add(mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), mat(C.bronze)));
  wheel.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), mat(C.bronze)).rotateX(Math.PI / 2));
  for (let i = 0; i < 8; i++) { const p = mesh(new THREE.BoxGeometry(0.02, 0.07, 0.09), mat(C.orangeL)); const a = i / 8 * Math.PI * 2; p.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0); p.rotation.z = a; wheel.add(p); }
  wheel.userData.hit = { title: 'Water wheel', text: 'The river turned wheels like this one. They powered the pumps and Archimedes screws that lifted water to the top of the towers — and your souvenir.' };
  g.add(wheel); hits.push(wheel);
  const d1 = hotspotDot(); d1.position.set(-0.16, 0.57, 0.13); g.add(d1);
  const d2 = hotspotDot(); d2.position.set(0.34, 0.26, 0.22); g.add(d2);
  const label = labelSprite('Water Towers', 'Placeholder 3D · final content coming'); label.position.set(0, 0.86, 0); g.add(label);
  const update = (dt, t) => {
    if (st.flow) wheel.rotation.z -= dt * 1.4;
    st.level += (st.flow ? 0.35 : -0.5) * dt; st.level = Math.max(0, Math.min(1, st.level));
    column.scale.y = 0.001 + st.level * 0.44; tank.material.opacity = Math.max(0, st.level - 0.6) / 0.4 * 0.9;
    [d1, d2].forEach(d => d.userData.ring.scale.setScalar(1 + 0.25 * Math.sin(t * 3)));
  };
  return { group: g, hits, state: st, update, setFlow: v => { st.flow = v; } };
}

function sceneFountain() {
  const g = new THREE.Group(); const hits = []; const st = { paused: false };
  g.add(mesh(new THREE.CircleGeometry(0.46, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 }), 0, 0.001, 0)).rotation.x = -Math.PI / 2;
  const spin = new THREE.Group(); g.add(spin);
  spin.add(mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 28), mat(C.stone), 0, 0.025, 0));
  spin.add(mesh(new THREE.TorusGeometry(0.34, 0.02, 8, 36), mat(C.tealXL), 0, 0.05, 0)).rotation.x = Math.PI / 2;
  spin.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.012, 28), mat(C.water, { transparent: true, opacity: 0.85 }), 0, 0.055, 0));
  spin.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 10), mat(C.stone), 0, 0.09, 0));
  spin.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.36, 12), mat(C.stone), 0, 0.3, 0));
  spin.add(mesh(new THREE.CylinderGeometry(0.075, 0.04, 0.04, 12), mat(C.stone), 0, 0.5, 0));
  const fig = new THREE.Group(); fig.position.y = 0.52; spin.add(fig);
  fig.add(mesh(new THREE.CapsuleGeometry(0.045, 0.13, 4, 10), mat(C.bronze), 0, 0.12, 0));
  fig.add(mesh(new THREE.SphereGeometry(0.035, 12, 12), mat(C.bronze), 0, 0.245, 0));
  const arm = mesh(new THREE.BoxGeometry(0.15, 0.028, 0.028), mat(C.bronze), 0.08, 0.19, 0); arm.rotation.z = 0.35; fig.add(arm);
  fig.userData.hit = { title: 'Augustus statue', text: 'The Roman emperor Augustus, namesake of the city, raises his arm above the column of the fountain in front of the Town Hall.' };
  hits.push(fig);
  const jets = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2; const r = 0.26;
    const rf = new THREE.Group(); rf.position.set(Math.cos(a) * r, 0.065, Math.sin(a) * r); spin.add(rf);
    rf.add(mesh(new THREE.SphereGeometry(0.05, 12, 12), mat(C.bronze), 0, 0.04, 0));
    rf.add(mesh(new THREE.BoxGeometry(0.11, 0.035, 0.06), mat(C.bronze), 0, 0.012, 0)).rotation.y = -a;
    if (i === 0) { rf.userData.hit = { title: 'River figures', text: 'Four reclining bronze figures around the basin stand for Augsburg’s waters: the Lech, the Wertach, the Singold and the Brunnenbach.' }; hits.push(rf); }
    const jg = new THREE.CylinderGeometry(0.006, 0.004, 0.3, 6); jg.translate(0, 0.15, 0);
    const j = mesh(jg, mat(C.water, { transparent: true, opacity: 0.8 }), 0, 0.08, 0); j.lookAt(0, 0.65, 0); j.rotateX(Math.PI / 2); rf.add(j); jets.push(j);
  }
  const d1 = hotspotDot(); d1.position.set(0.1, 0.85, 0); g.add(d1);
  const d2 = hotspotDot(); d2.position.set(0.3, 0.17, 0.3); g.add(d2);
  const label = labelSprite('Augustus Fountain', 'Placeholder 3D · final content coming'); label.position.set(0, 1.02, 0); g.add(label);
  const update = (dt, t) => {
    if (!st.paused) spin.rotation.y += dt * 0.4;
    jets.forEach((j, i) => { j.scale.y = 0.85 + 0.15 * Math.sin(t * 4 + i); });
    d2.position.set(Math.cos(spin.rotation.y + Math.PI / 4) * 0.3, 0.17, -Math.sin(spin.rotation.y + Math.PI / 4) * 0.3);
    [d1, d2].forEach(d => d.userData.ring.scale.setScalar(1 + 0.25 * Math.sin(t * 3)));
  };
  return { group: g, hits, state: st, update, setPaused: v => { st.paused = v; } };
}

function sceneKanal() {
  const g = new THREE.Group(); const hits = []; const st = { progress: 0, riding: false, outcome: null, lean: 0 };
  g.add(mesh(new THREE.BoxGeometry(1.02, 0.03, 0.66), mat(C.green), 0, 0.015, 0));
  g.add(mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 }), 0, 0.001, 0)).rotation.x = -Math.PI / 2;
  const pts = []; for (let i = 0; i <= 12; i++) { const x = -0.46 + i * 0.92 / 12; pts.push(new THREE.Vector3(x, 0.04, 0.14 * Math.sin(x * 5.2) + 0.03 * Math.sin(x * 11))); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const bank = mesh(new THREE.TubeGeometry(curve, 60, 0.085, 10, false), mat(C.stone)); bank.scale.y = 0.4; g.add(bank);
  const water = mesh(new THREE.TubeGeometry(curve, 60, 0.07, 10, false), mat(C.water)); water.scale.y = 0.38; water.position.y = 0.004; g.add(water);
  // gates
  const gates = [];
  [0.22, 0.42, 0.62, 0.82].forEach((t, i) => {
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t), n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const col = i % 2 ? C.red : C.greenD; const gt = new THREE.Group(); gt.position.copy(p); gt.position.y = 0.03; g.add(gt);
    for (const s of [-1, 1]) { const pole = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mat(col)); pole.position.copy(n.clone().multiplyScalar(0.09 * s)); pole.position.y = 0.08; gt.add(pole); }
    const bar = mesh(new THREE.BoxGeometry(0.19, 0.012, 0.012), mat(col), 0, 0.165, 0); bar.rotation.y = Math.atan2(n.x, n.z) + Math.PI / 2; gt.add(bar);
    if (i === 1) { gt.userData.hit = { title: 'Slalom gate', text: 'Green gates are passed downstream, red gates upstream — against the current. The 1972 Olympic course still hosts world-class canoe slalom.' }; hits.push(gt); }
    gates.push(gt);
  });
  const canoe = new THREE.Group(); g.add(canoe);
  canoe.add(mesh(new THREE.BoxGeometry(0.12, 0.028, 0.045), mat(C.orange), 0, 0.02, 0));
  canoe.add(mesh(new THREE.SphereGeometry(0.02, 10, 10), mat(C.teal), 0, 0.05, 0));
  const paddle = mesh(new THREE.BoxGeometry(0.12, 0.008, 0.008), mat(C.bronze), 0, 0.055, 0); paddle.rotation.y = Math.PI / 2; canoe.add(paddle);
  canoe.userData.hit = { title: 'Your canoe', text: 'You ride first-person down the Eiskanal. Stay with the flow — and lean into the turn when a gate asks for a decision.' }; hits.push(canoe);
  const d1 = hotspotDot(); d1.position.copy(gates[1].position).add(new THREE.Vector3(0, 0.22, 0)); g.add(d1);
  const label = labelSprite('Ice Kanal', 'Placeholder 3D · final content coming'); label.position.set(0, 0.7, 0); g.add(label);
  let wobble = 0;
  const place = () => { const t = Math.min(0.999, Math.max(0, st.progress)); const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    canoe.position.set(p.x, 0.03, p.z); canoe.rotation.set(0, Math.atan2(-tan.z, tan.x), 0);
    canoe.rotation.x = st.lean * 0.5 + wobble; paddle.rotation.z = Math.sin(st.progress * 40) * 0.3; };
  const update = (dt, t) => {
    if (st.outcome === 'chaotic') wobble = Math.sin(t * 18) * 0.35; else wobble *= 0.9;
    st.lean *= 0.96; place(); d1.userData.ring.scale.setScalar(1 + 0.25 * Math.sin(t * 3));
    water.position.y = 0.004 + Math.sin(t * 2) * 0.002;
  };
  place();
  return { group: g, hits, state: st, update,
    setProgress: p => { st.progress = p; }, lean: () => { st.lean = -1; }, setOutcome: o => { st.outcome = o; } };
}

function sceneRiver() {
  const g = new THREE.Group(); const hits = []; const st = {};
  g.add(mesh(new THREE.CircleGeometry(0.58, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 }), 0, 0.001, 0)).rotation.x = -Math.PI / 2;
  const ter = new THREE.PlaneGeometry(1.1, 0.8, 28, 20); const pos = ter.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, 0.03 + 0.035 * Math.sin(x * 4 + 1) * Math.cos(y * 5) + 0.02 * Math.sin(y * 7)); }
  ter.computeVertexNormals(); const terrain = mesh(ter, mat(C.green)); terrain.rotation.x = -Math.PI / 2; g.add(terrain);
  // mountains
  [[-0.35, 0.16], [0, 0.22], [0.36, 0.17]].forEach(([x, h]) => g.add(mesh(new THREE.ConeGeometry(0.22, h, 6), mat(C.mountain), x, h / 2 + 0.03, -0.44)));
  // river
  const rp = []; for (let i = 0; i <= 8; i++) { const z = 0.42 - i * 0.84 / 8; rp.push(new THREE.Vector3(0.1 * Math.sin(z * 6) + 0.08, 0.055, z)); }
  const curve = new THREE.CatmullRomCurve3(rp);
  const river = mesh(new THREE.TubeGeometry(curve, 50, 0.07, 8, false), mat(C.water)); river.scale.y = 0.25; g.add(river);
  // trees
  const treePos = [[-0.42, 0.25], [-0.3, -0.05], [-0.44, -0.2], [0.38, 0.28], [0.44, -0.08], [0.3, -0.3], [-0.15, -0.33]];
  treePos.forEach(([x, z], i) => { const h = 0.1 + (i % 3) * 0.03; const t = new THREE.Group(); t.position.set(x, 0.05, z);
    t.add(mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.05, 6), mat(C.bronze), 0, 0.025, 0)); t.add(mesh(new THREE.ConeGeometry(0.045, h, 8), mat(i % 2 ? C.greenD : C.green), 0, 0.05 + h / 2, 0)); g.add(t); });
  // animals
  const animals = {};
  const swan = new THREE.Group(); swan.add(mesh(new THREE.SphereGeometry(0.03, 12, 12), mat(C.white), 0, 0.02, 0)); const neck = mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.06, 6), mat(C.white), 0.025, 0.05, 0); neck.rotation.z = -0.3; swan.add(neck); swan.add(mesh(new THREE.SphereGeometry(0.011, 8, 8), mat(C.orange), 0.035, 0.08, 0));
  swan.userData.hit = { key: 'swan', title: 'Mute swan', text: 'Swans pair for life and often return to the same stretch of river every year.' }; g.add(swan); animals.swan = swan;
  const bird = new THREE.Group(); for (const s of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(0.05, 0.005, 0.012), mat(C.teal950), s * 0.022, 0, 0); w.rotation.z = s * 0.4; bird.add(w); }
  bird.userData.hit = { key: 'gull', title: 'Black-headed gull', text: 'In winter their “black head” fades to a small dark spot behind the eye.' }; g.add(bird); animals.gull = bird;
  const fish = mesh(new THREE.SphereGeometry(0.018, 10, 10), mat(C.orangeL)); fish.scale.set(1.8, 0.8, 0.8);
  fish.userData.hit = { key: 'fish', title: 'Grayling', text: 'The Lech’s clean, cold water suits grayling and trout. Look for the ripples.' }; g.add(fish); animals.fish = fish;
  const deer = new THREE.Group(); deer.add(mesh(new THREE.BoxGeometry(0.07, 0.035, 0.03), mat(C.bronze), 0, 0.06, 0)); deer.add(mesh(new THREE.SphereGeometry(0.016, 8, 8), mat(C.bronze), 0.04, 0.085, 0));
  for (const [x, z] of [[-0.025, -0.01], [-0.025, 0.01], [0.025, -0.01], [0.025, 0.01]]) deer.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.045, 5), mat(C.bronze), x, 0.022, z));
  deer.position.set(-0.3, 0.05, -0.2); deer.userData.hit = { key: 'deer', title: 'Roe deer', text: 'Roe deer come down to the riverbank at dusk. Keep still and you may spot one.' }; g.add(deer); animals.deer = deer;
  hits.push(swan, bird, fish, deer);
  const dots = Object.values(animals).map(a => { const d = hotspotDot(); d.scale.setScalar(0.8); g.add(d); return [a, d]; });
  const label = labelSprite('Riverside Nature', 'Placeholder 3D · final content coming'); label.position.set(0, 0.62, 0); g.add(label);
  const update = (dt, t) => {
    const sp = curve.getPointAt((Math.sin(t * 0.25) + 1) / 2 * 0.6 + 0.2); swan.position.set(sp.x, 0.06 + Math.sin(t * 2) * 0.004, sp.z);
    bird.position.set(Math.cos(t * 0.9) * 0.3, 0.32 + Math.sin(t * 1.8) * 0.03, Math.sin(t * 0.9) * 0.2 - 0.1); bird.rotation.y = -t * 0.9; bird.children.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.4 + Math.sin(t * 9) * 0.35); });
    const fp = curve.getPointAt(0.75); const jump = Math.max(0, Math.sin(t * 1.5)); fish.position.set(fp.x, 0.03 + jump * 0.12, fp.z); fish.rotation.z = (Math.cos(t * 1.5)) * 0.8; fish.visible = jump > 0.05;
    deer.position.x = -0.3 + Math.sin(t * 0.3) * 0.04;
    dots.forEach(([a, d]) => { d.position.copy(a.position); d.position.y += 0.09; d.userData.ring.scale.setScalar(1 + 0.25 * Math.sin(t * 3)); d.visible = !a.userData.found; });
  };
  return { group: g, hits, state: st, update, markFound: k => { animals[k] && (animals[k].userData.found = true); } };
}

const BUILDERS = { towers: sceneTowers, fountain: sceneFountain, kanal: sceneKanal, river: sceneRiver };

/* ---------- session ---------- */
export class ARSession {
  constructor({ video, host, targetSrc, onFound, onLost, onPose, onTap, onReady }) {
    Object.assign(this, { video, host, targetSrc, onFound, onLost, onPose, onTap, onReady });
    this.scenes = {}; this.anchors = []; this.visible = null; this.lostAt = 0; this.running = false; this.started = false;
    this._raf = null; this._clock = new THREE.Clock(); this._onResize = () => this.resize();
  }

  async start() {
    if (this.started) { this.resume(); return; }
    const { video, host } = this;
    if (!video.videoWidth) await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = this.renderer.domElement; canvas.id = 'arcanvas'; canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;'; host.appendChild(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a4a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(0.5, 1.2, 1); this.scene.add(sun);
    TARGET_ORDER.forEach((id, i) => {
      const anchor = new THREE.Group(); anchor.matrixAutoUpdate = false; anchor.visible = false; this.scene.add(anchor); this.anchors[i] = anchor;
      const sc = BUILDERS[id](); sc.group.rotation.x = Math.PI / 2; sc.group.scale.setScalar(0.72); anchor.add(sc.group); this.scenes[id] = sc;
    });
    // frames are copied into a canvas first: identical on every GPU/driver, and avoids video-texture quirks
    this.feed = document.createElement('canvas'); this.feed.width = video.videoWidth; this.feed.height = video.videoHeight;
    this.feedCtx = this.feed.getContext('2d', { willReadFrequently: false }); this._grab();
    this.controller = new window.MINDAR.IMAGE.Controller({
      inputWidth: video.videoWidth, inputHeight: video.videoHeight, maxTrack: 1, warmupTolerance: 3, missTolerance: 10,
      onUpdate: d => { if (d.type === 'updateMatrix') this._onMatrix(d.targetIndex, d.worldMatrix); else if (d.type === 'processDone') { this.frames = (this.frames || 0) + 1; this._grab(); } }
    });
    const { dimensions } = await this.controller.addImageTargets(this.targetSrc);
    this.post = dimensions.map(([w, h]) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(w / 2, w / 2 + (h - w) / 2, 0), new THREE.Quaternion(), new THREE.Vector3(w, w, w)); return m; });
    this.dims = dimensions;
    await this.controller.dummyRun(this.feed);
    this.resize(); window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointerup', e => this._tap(e));
    this.started = true; this.resume(); this.onReady && this.onReady();
  }

  _grab() { try { this.feedCtx.drawImage(this.video, 0, 0, this.feed.width, this.feed.height); } catch (e) {} }
  resume() { if (this.running || !this.started) return; this.running = true; this._grab(); this.controller.processVideo(this.feed); this._clock.start(); this._loop(); }
  pause() { if (!this.running) return; this.running = false; this.controller.stopProcessVideo(); cancelAnimationFrame(this._raf); }
  stop() { this.pause(); window.removeEventListener('resize', this._onResize); if (this.renderer) { this.renderer.dispose(); this.renderer.domElement.remove(); } this.started = false; this.visible = null; }
  get active() { return this.visible === null ? null : TARGET_ORDER[this.visible]; }

  _onMatrix(i, wm) {
    const anchor = this.anchors[i];
    if (wm === null) { if (this.visible === i && !this.lostAt) this.lostAt = performance.now(); return; }
    const m = new THREE.Matrix4(); m.elements = [...wm]; m.multiply(this.post[i]); anchor.matrix.copy(m); anchor.visible = true;
    this.lostAt = 0;
    if (this.visible !== i) { if (this.visible !== null) this.anchors[this.visible].visible = false; this.visible = i; this.onFound && this.onFound(TARGET_ORDER[i]); }
    this.onPose && this.onPose({ id: TARGET_ORDER[i], frac: this._frac(i, m) });
  }

  // apparent width of the panel as a fraction of the camera frame width (0..1)
  _frac(i, m) {
    const [w, h] = this.dims[i]; const hw = 0.5, hh = h / w / 2; const proj = this.controller.getProjectionMatrix();
    const P = new THREE.Matrix4(); P.elements = [...proj]; let minx = 1e9, maxx = -1e9;
    for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) { const v = new THREE.Vector3(x, y, 0).applyMatrix4(m).applyMatrix4(P); minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x); }
    return Math.max(0, Math.min(1.5, (maxx - minx) / 2));
  }

  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this._clock.getDelta()), t = this._clock.elapsedTime;
    if (this.visible !== null) {
      const id = TARGET_ORDER[this.visible]; this.scenes[id].update(dt, t);
      if (this.lostAt && performance.now() - this.lostAt > 1500) { this.anchors[this.visible].visible = false; const lost = id; this.visible = null; this.lostAt = 0; this.onLost && this.onLost(lost); }
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const { video, host, camera, renderer, controller } = this; if (!controller) return;
    const cw = host.clientWidth, ch = host.clientHeight; const vr = video.videoWidth / video.videoHeight, cr = cw / ch;
    let vw, vh; if (vr > cr) { vh = ch; vw = vh * vr; } else { vw = cw; vh = vw / vr; }
    const proj = controller.getProjectionMatrix(); const fovAdjust = ch / vh;
    camera.fov = 2 * Math.atan(1 / proj[5] * fovAdjust) * 180 / Math.PI; camera.near = proj[14] / (proj[10] - 1); camera.far = proj[14] / (proj[10] + 1);
    camera.aspect = cw / ch; camera.updateProjectionMatrix(); renderer.setSize(cw, ch, false);
    if (this.started && (video.videoWidth !== controller.inputWidth)) this._restart();
  }
  async _restart() { // camera orientation changed: rebuild the controller for the new frame size
    const was = this.running; this.pause(); this.started = false; this.renderer.domElement.remove(); this.renderer.dispose(); this.anchors = []; this.scenes = {}; this.visible = null;
    await this.start(); if (!was) this.pause();
  }

  _tap(e) {
    if (this.visible === null || !this.onTap) return;
    const r = this.renderer.domElement.getBoundingClientRect(); const nd = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(nd, this.camera);
    const sc = this.scenes[TARGET_ORDER[this.visible]]; const hit = rc.intersectObjects(sc.hits, true)[0];
    if (!hit) return; let o = hit.object; while (o && !o.userData.hit) o = o.parent; if (o) this.onTap(o.userData.hit, o);
  }

  // composite the current camera frame + overlay into a canvas
  snapshot(W = 1080) {
    const { video, renderer, host } = this; const cw = host.clientWidth, ch = host.clientHeight; const H = Math.round(W * ch / cw);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const vr = video.videoWidth / video.videoHeight, cr = W / H; let sw, sh, sx, sy;
    if (vr > cr) { sh = video.videoHeight; sw = sh * cr; sx = (video.videoWidth - sw) / 2; sy = 0; } else { sw = video.videoWidth; sh = sw / cr; sx = 0; sy = (video.videoHeight - sh) / 2; }
    x.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
    renderer.render(this.scene, this.camera); x.drawImage(renderer.domElement, 0, 0, W, H);
    return c;
  }
}
