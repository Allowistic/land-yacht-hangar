import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { createScenery, TRAVEL_SPEED } from './scenery.js';
import { createControls } from './controls.js';
import { createLofi } from './lofi.js';

const PAL = {
  wall: 0xc4b6c8, wallDeep: 0xa898b0, floor: 0xb8b0c4,
  line: 0x3a3148, metal: 0x9a8ca8,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b1d4f);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
camera.position.set(0, 1.6, 2.0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const toon = (color) => new THREE.MeshToonMaterial({ color });
function edged(mesh, color = PAL.line) {
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 22),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })
  ));
  return mesh;
}
function box(w, h, d, color = PAL.wall) {
  return edged(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color)));
}

// Warm sunset light pouring in through the window.
scene.add(new THREE.HemisphereLight(0xffdce6, 0x5a4870, 1.0));
const sun = new THREE.DirectionalLight(0xffb08a, 1.0);
sun.position.set(-4, 5, -20);
scene.add(sun);
scene.add(new THREE.PointLight(0xf0e8ff, 0.5, 12).translateY(2.8));

const ROOM_W = 8.2, ROOM_D = 7.0, ROOM_H = 3.05;
const WIN_W = 6.0, WIN_H = 2.15, WIN_Y = 1.38;
const winZ = -ROOM_D / 2 + 0.1;

const cabin = new THREE.Group();
cabin.name = 'cabin';
scene.add(cabin);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), toon(PAL.floor));
floor.rotation.x = -Math.PI / 2;
cabin.add(edged(floor));
for (let x = -3; x <= 3; x++) {
  for (let z = -3; z <= 3; z++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.65), toon(0xc8c2d2));
    t.rotation.x = -Math.PI / 2;
    t.position.set(x * 2.02, 0.004, z * 1.78);
    cabin.add(edged(t, 0x4a4058));
  }
}

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), toon(0xccc0d4));
ceil.rotation.x = Math.PI / 2;
ceil.position.y = ROOM_H;
cabin.add(edged(ceil));
for (let x = -3; x <= 3; x++) {
  for (let z = -3; z <= 3; z++) {
    const tile = box(1.85, 0.07, 1.6, 0xc8bcd0);
    tile.position.set(x * 2.02, ROOM_H - 0.04, z * 1.78);
    cabin.add(tile);
    if ((x + z) % 2 === 0) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.04, 0.14),
        new THREE.MeshToonMaterial({ color: 0xe8f0ff, emissive: 0xb8d0ff, emissiveIntensity: 0.65 })
      );
      strip.position.set(x * 2.02, ROOM_H - 0.11, z * 1.78);
      cabin.add(strip);
    }
  }
}

function wall(w, h, pos, rotY, color = PAL.wall) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(color));
  m.position.copy(pos);
  m.rotation.y = rotY;
  cabin.add(edged(m));
}
// Front wall built around a real opening, so the scenery shows through.
const sideW = (ROOM_W - WIN_W) / 2;
const winBottom = WIN_Y - WIN_H / 2, winTop = WIN_Y + WIN_H / 2;
const frontZ = -ROOM_D / 2;
wall(sideW, ROOM_H, new THREE.Vector3(-(WIN_W + sideW) / 2, ROOM_H / 2, frontZ), 0, PAL.wallDeep);
wall(sideW, ROOM_H, new THREE.Vector3((WIN_W + sideW) / 2, ROOM_H / 2, frontZ), 0, PAL.wallDeep);
wall(WIN_W, winBottom, new THREE.Vector3(0, winBottom / 2, frontZ), 0, PAL.wallDeep);
wall(WIN_W, ROOM_H - winTop, new THREE.Vector3(0, (winTop + ROOM_H) / 2, frontZ), 0, PAL.wallDeep);
wall(ROOM_W, ROOM_H, new THREE.Vector3(0, ROOM_H / 2, ROOM_D / 2), Math.PI);
wall(ROOM_D, ROOM_H, new THREE.Vector3(-ROOM_W / 2, ROOM_H / 2, 0), Math.PI / 2);
wall(ROOM_D, ROOM_H, new THREE.Vector3(ROOM_W / 2, ROOM_H / 2, 0), -Math.PI / 2);

// Window frame bars and a faint pane of glass.
const bar = 0.14;
[[0, winTop + bar / 2, WIN_W + 2 * bar, bar], [0, winBottom - bar / 2, WIN_W + 2 * bar, bar],
  [-WIN_W / 2 - bar / 2, WIN_Y, bar, WIN_H], [WIN_W / 2 + bar / 2, WIN_Y, bar, WIN_H],
  [-WIN_W / 6, WIN_Y, 0.05, WIN_H], [WIN_W / 6, WIN_Y, 0.05, WIN_H]].forEach(([x, y, w, h]) => {
  const b = box(w, h, 0.2, PAL.metal);
  b.position.set(x, y, winZ);
  cabin.add(b);
});
const glass = new THREE.Mesh(
  new THREE.PlaneGeometry(WIN_W, WIN_H),
  new THREE.MeshBasicMaterial({ color: 0xffd8e8, transparent: true, opacity: 0.07, depthWrite: false })
);
glass.position.set(0, WIN_Y, winZ - 0.02);
cabin.add(glass);
const sill = box(WIN_W + 0.4, 0.5, 0.5, PAL.metal);
sill.position.set(0, 0.26, winZ + 0.18);
cabin.add(sill);
const door = box(1.3, 2.4, 0.14, 0xd0c4d6);
door.position.set(-ROOM_W / 2 + 0.1, 1.2, 1.05);
cabin.add(door);

// The yacht under and around the cabin. It rolls toward -x (left as you look
// out the window), so the scenery slides past to the right.
const hull = new THREE.Group();
hull.rotation.y = Math.PI / 2;
scene.add(hull);
const keel = box(9.4, 0.35, 11.5, 0x8a7a94);
keel.position.set(0, -0.28, 0.4);
hull.add(keel);
[-4.4, 4.4].forEach((x) => {
  const pontoon = box(0.7, 0.55, 11.2, 0x7a6a86);
  pontoon.position.set(x, -0.55, 0.3);
  hull.add(pontoon);
});
const wheels = [];
[[-4.6, -2.6], [-4.6, 2.8], [4.6, -2.6], [4.6, 2.8], [-4.6, 0.2], [4.6, 0.2]].forEach(([x, z]) => {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.55, 18), toon(0x4a4058));
  w.rotation.z = Math.PI / 2;
  w.position.set(x, -1.15, z);
  edged(w, 0x2a2434);
  hull.add(w);
  wheels.push(w);
});
const prow = box(3.2, 1.1, 3.4, 0x9a8aa8);
prow.position.set(0, 0.4, -6.4); // ahead of the cabin's left wall, outside it
hull.add(prow);
const mast = box(0.12, 4.2, 0.12, PAL.metal);
mast.position.set(0, ROOM_H + 0.15 + 2.1, 1.6); // stands on the roof
hull.add(mast);
const sail = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, 3.2),
  new THREE.MeshToonMaterial({ color: 0xd8c8e0, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
);
sail.position.set(1.2, ROOM_H + 0.3 + 1.6, 1.6);
hull.add(sail);

const bay = box(3.4, 2.4, 0.18, PAL.wall);
bay.position.set(0, 1.4, ROOM_D / 2 - 0.12);
cabin.add(bay);
const fan = new THREE.Group();
fan.position.set(0, 1.65, ROOM_D / 2 - 0.2);
cabin.add(fan);
fan.add(edged(new THREE.Mesh(new THREE.RingGeometry(0.4, 0.58, 24), toon(PAL.metal))));
const blades = new THREE.Group();
for (let i = 0; i < 10; i++) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 0.02), toon(0x1a1822));
  b.position.y = 0.2;
  const g = new THREE.Group();
  g.rotation.z = (i / 10) * Math.PI * 2;
  g.add(b);
  blades.add(g);
}
fan.add(blades);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const gridC = makeCanvas(128, 128);
const waveC = makeCanvas(256, 128);
let audioLevel = 0;
function drawGrid(c, t) {
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#121820';
  ctx.fillRect(0, 0, c.width, c.height);
  const n = 10, cell = c.width / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = Math.sin(x * 0.7 + t * 0.8) * Math.cos(y * 0.5 + t * 0.55);
      ctx.fillStyle = v > 0.72 ? '#ff6aa8' : v > 0.32 ? '#d8d0dc' : '#2a3340';
      ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
    }
  }
}
function drawWave(c, t) {
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#10161e';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#7dffc2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const amp = 6 + Math.min(1, audioLevel * 9) * 34; // the scope moves with the music
  for (let x = 0; x < c.width; x++) {
    const y = c.height / 2 + Math.sin(x * 0.07 + t * 2) * amp * 0.75 + Math.sin(x * 0.14 + t) * amp * 0.3;
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}
function screen(canvas, w, h, pos, rotY = 0) {
  const tex = new THREE.CanvasTexture(canvas);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.copy(pos); m.rotation.y = rotY; m.userData.tex = tex;
  cabin.add(m);
  const bezel = box(w + 0.08, h + 0.08, 0.05, 0x2a2434);
  bezel.position.copy(pos); bezel.rotation.y = rotY;
  bezel.position.z += rotY ? 0.03 : -0.03;
  cabin.add(bezel);
  return m;
}
// The two front screens hang on the wall pillars beside the window.
const pillarX = (WIN_W + sideW) / 2;
const screens = [
  screen(gridC, 0.5, 0.5, new THREE.Vector3(-pillarX, 1.8, frontZ + 0.08)),
  screen(waveC, 0.55, 0.26, new THREE.Vector3(-0.55, 0.88, ROOM_D / 2 - 0.22), Math.PI),
  screen(waveC, 0.55, 0.26, new THREE.Vector3(0.55, 0.88, ROOM_D / 2 - 0.22), Math.PI),
  screen(gridC, 0.42, 0.42, new THREE.Vector3(pillarX, 1.65, frontZ + 0.08)),
];
const labelC = makeCanvas(512, 64);
{
  const ctx = labelC.getContext('2d');
  ctx.fillStyle = '#c4b6c8'; ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#3a3148'; ctx.font = '26px monospace';
  ctx.fillText('LAND YACHT  /  BAY  04', 48, 42);
}
const label = new THREE.Mesh(
  new THREE.PlaneGeometry(1.7, 0.18),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(labelC) })
);
label.position.set(0, 2.48, ROOM_D / 2 - 0.22);
label.rotation.y = Math.PI;
cabin.add(label);

// Sand motes drifting inside the cabin: they stay put and only float gently.
const dustN = 220;
const dustPos = new Float32Array(dustN * 3);
for (let i = 0; i < dustN; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * (ROOM_W - 0.4);
  dustPos[i * 3 + 1] = Math.random() * ROOM_H;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * (ROOM_D - 0.4);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe0d0, size: 0.014, transparent: true, opacity: 0.3 }));
cabin.add(dust);

// Painted sunset layers outside the window.
const scenery = createScenery(scene);

// ---------- Music ----------
const musicBtn = document.getElementById('music');
const hint = document.getElementById('hint');
const lofi = createLofi({ onChange: (s) => updateMusicUI(s) });
function updateMusicUI(s) {
  if (!musicBtn) return;
  const text = { on: '♪ Music on', starting: '♪ Starting…', paused: '♪ Music off', off: '♪ Tap for music', blocked: '♪ No audio' }[s] || '♪ Music';
  musicBtn.textContent = text;
  musicBtn.classList.toggle('on', s === 'on');
  musicBtn.setAttribute('aria-pressed', s === 'on' ? 'true' : 'false');
}
updateMusicUI(lofi.status);
if (musicBtn) {
  musicBtn.addEventListener('click', (e) => { e.stopPropagation(); lofi.toggle(); });
  // Keep the button's own taps from also counting as the "tap anywhere" start.
  ['pointerup', 'touchend'].forEach((ev) => musicBtn.addEventListener(ev, (e) => e.stopPropagation()));
}
// Phones only unlock sound on a finger lifting (or a click / key), never on
// the finger going down, so listen for those. Lifting a stick counts too.
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => addEventListener(ev, () => lofi.onGesture(), { passive: true }));

const factory = new XRControllerModelFactory();
function hook(i) {
  const c = renderer.xr.getController(i);
  c.addEventListener('selectstart', () => lofi.onGesture());
  scene.add(c);
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(factory.createControllerModel(grip));
  scene.add(grip);
  c.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.4)]),
    new THREE.LineBasicMaterial({ color: 0xd8c8e8 })
  ));
}
hook(0); hook(1);

// ---------- Moving around ----------
// Stop iPhone pinch-zoom and page bounce from fighting the sticks.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

// Keep the eye inside the cabin: clear of the side walls, the window sill and
// the screen bay at the back.
const controls = createControls({
  camera, renderer, canvas: renderer.domElement,
  bounds: { minX: -ROOM_W / 2 + 0.45, maxX: ROOM_W / 2 - 0.45, minZ: winZ + 0.18 + 0.25 + 0.25, maxZ: ROOM_D / 2 - 0.55 },
});

const touch = document.getElementById('touch-controls')?.classList.contains('visible');
if (hint) {
  hint.textContent = touch
    ? 'Left stick: walk · Right stick or drag: look · Tap anywhere for lofi'
    : 'WASD: walk · Drag or arrow keys: look · Click for lofi · ENTER VR on a headset';
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Small read-only hook for testing in a browser console.
window.__lyh = {
  controls: () => controls.state(),
  music: () => ({ status: lofi.status, context: lofi.contextState, level: +lofi.level().toFixed(4) }),
  scene, camera,
};

const WHEEL_R = 1.15;
let last = 0;
renderer.setAnimationLoop((time) => {
  const t = time * 0.001;
  const dt = last ? Math.min(0.05, (time - last) * 0.001) : 0.016;
  last = time;
  controls.update(dt);
  scenery.update(dt);
  wheels.forEach((w) => { w.rotation.x -= dt * TRAVEL_SPEED / WHEEL_R; });
  blades.rotation.z = t * 0.4;
  const dp = dust.geometry.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    let y = dp.getY(i) + 0.002;
    if (y > ROOM_H - 0.1) y = 0.08;
    dp.setY(i, y);
  }
  dp.needsUpdate = true;
  if (((time / 16) | 0) % 4 === 0) {
    audioLevel = lofi.status === 'on' ? lofi.level() : 0;
    drawGrid(gridC, t); drawWave(waveC, t);
    screens.forEach((s) => { if (s.userData.tex) s.userData.tex.needsUpdate = true; });
  }
  renderer.render(scene, camera);
});
