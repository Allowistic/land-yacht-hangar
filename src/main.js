import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

function hash(ix, iz) {
  let n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x, z) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = x - x0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(x0, z0), b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1), d = hash(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z) {
  let v = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < 5; i++) {
    v += a * noise(x * f, z * f);
    n += a; a *= 0.52; f *= 2.03;
  }
  return v / n;
}
function heightAt(x, z) {
  const dunes = fbm(x * 0.035, z * 0.035);
  const ridges = Math.abs(fbm(x * 0.012 + 40, z * 0.012) * 2 - 1);
  const mesa = Math.pow(Math.max(0, fbm(x * 0.008, z * 0.008) - 0.58), 1.6) * 18;
  return dunes * 2.4 + ridges * 3.8 + mesa - 1.2;
}

const PAL = {
  wall: 0xc4b6c8, wallDeep: 0xa898b0, floor: 0xb8b0c4,
  line: 0x3a3148, metal: 0x9a8ca8, sky: 0xa8bce8,
  terrain: 0xe8b4c8, moon: 0xf2dce8,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.sky, 28, 90);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 160);
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

scene.add(new THREE.HemisphereLight(0xe8d8f0, 0x6a5878, 1.05));
const sun = new THREE.DirectionalLight(0xffd0e8, 0.9);
sun.position.set(8, 18, -12);
scene.add(sun);
scene.add(new THREE.PointLight(0xf0e8ff, 0.5, 12).translateY(2.8));

const ROOM_W = 8.2, ROOM_D = 7.0, ROOM_H = 3.05;
const WIN_W = 6.0, WIN_H = 2.15;
const winZ = -ROOM_D / 2 + 0.1;

const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), toon(PAL.floor));
floor.rotation.x = -Math.PI / 2;
scene.add(edged(floor));
for (let x = -3; x <= 3; x++) {
  for (let z = -3; z <= 3; z++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.65), toon(0xc8c2d2));
    t.rotation.x = -Math.PI / 2;
    t.position.set(x * 2.02, 0.004, z * 1.78);
    scene.add(edged(t, 0x4a4058));
  }
}

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), toon(0xccc0d4));
ceil.rotation.x = Math.PI / 2;
ceil.position.y = ROOM_H;
scene.add(edged(ceil));
for (let x = -3; x <= 3; x++) {
  for (let z = -3; z <= 3; z++) {
    const tile = box(1.85, 0.07, 1.6, 0xc8bcd0);
    tile.position.set(x * 2.02, ROOM_H - 0.04, z * 1.78);
    scene.add(tile);
    if ((x + z) % 2 === 0) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.04, 0.14),
        new THREE.MeshToonMaterial({ color: 0xe8f0ff, emissive: 0xb8d0ff, emissiveIntensity: 0.65 })
      );
      strip.position.set(x * 2.02, ROOM_H - 0.11, z * 1.78);
      scene.add(strip);
    }
  }
}

function wall(w, h, pos, rotY, color = PAL.wall) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(color));
  m.position.copy(pos);
  m.rotation.y = rotY;
  scene.add(edged(m));
}
wall(ROOM_W, ROOM_H, new THREE.Vector3(0, ROOM_H / 2, -ROOM_D / 2), 0, PAL.wallDeep);
wall(ROOM_W, ROOM_H, new THREE.Vector3(0, ROOM_H / 2, ROOM_D / 2), Math.PI);
wall(ROOM_D, ROOM_H, new THREE.Vector3(-ROOM_W / 2, ROOM_H / 2, 0), Math.PI / 2);
wall(ROOM_D, ROOM_H, new THREE.Vector3(ROOM_W / 2, ROOM_H / 2, 0), -Math.PI / 2);

const frame = box(WIN_W + 0.3, WIN_H + 0.3, 0.2, PAL.metal);
frame.position.set(0, 1.38, winZ);
scene.add(frame);
const skyCut = new THREE.Mesh(
  new THREE.PlaneGeometry(WIN_W - 0.06, WIN_H - 0.06),
  new THREE.MeshBasicMaterial({ color: PAL.sky })
);
skyCut.position.set(0, 1.38, winZ - 0.01);
scene.add(skyCut);
const sill = box(WIN_W + 0.4, 0.5, 0.5, PAL.metal);
sill.position.set(0, 0.26, winZ + 0.18);
scene.add(sill);
const door = box(1.3, 2.4, 0.14, 0xd0c4d6);
door.position.set(-ROOM_W / 2 + 0.1, 1.2, 1.05);
scene.add(door);

const hull = new THREE.Group();
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
prow.position.set(0, 0.4, winZ - 2.2);
hull.add(prow);
const mast = box(0.12, 4.2, 0.12, PAL.metal);
mast.position.set(0, 4.4, 1.6);
hull.add(mast);
const sail = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, 3.2),
  new THREE.MeshToonMaterial({ color: 0xd8c8e0, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
);
sail.position.set(1.2, 3.6, 1.6);
hull.add(sail);

const bay = box(3.4, 2.4, 0.18, PAL.wall);
bay.position.set(0, 1.4, ROOM_D / 2 - 0.12);
scene.add(bay);
const fan = new THREE.Group();
fan.position.set(0, 1.65, ROOM_D / 2 - 0.2);
scene.add(fan);
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
  for (let x = 0; x < c.width; x++) {
    const y = c.height / 2 + Math.sin(x * 0.07 + t * 2) * 26 + Math.sin(x * 0.14 + t) * 10;
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}
function screen(canvas, w, h, pos, rotY = 0) {
  const tex = new THREE.CanvasTexture(canvas);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.copy(pos); m.rotation.y = rotY; m.userData.tex = tex;
  scene.add(m);
  const bezel = box(w + 0.08, h + 0.08, 0.05, 0x2a2434);
  bezel.position.copy(pos); bezel.rotation.y = rotY;
  scene.add(bezel);
  return m;
}
const screens = [
  screen(gridC, 0.5, 0.5, new THREE.Vector3(-2.3, 1.8, winZ + 0.14)),
  screen(waveC, 0.55, 0.26, new THREE.Vector3(-0.55, 0.88, ROOM_D / 2 - 0.22), Math.PI),
  screen(waveC, 0.55, 0.26, new THREE.Vector3(0.55, 0.88, ROOM_D / 2 - 0.22), Math.PI),
  screen(gridC, 0.42, 0.42, new THREE.Vector3(3.05, 1.65, winZ + 0.14)),
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
scene.add(label);

const planet = new THREE.Group();
scene.add(planet);
const SEG = 72, SIZE = 110;
const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
terrainGeo.rotateX(-Math.PI / 2);
const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshToonMaterial({ color: PAL.terrain }));
planet.add(edged(terrain, 0xc48aa8));
const worldOffset = { x: 0, z: 0 };
function rebuildTerrain() {
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i) + worldOffset.x, pos.getZ(i) + worldOffset.z));
  }
  pos.needsUpdate = true;
  terrainGeo.computeVertexNormals();
}
rebuildTerrain();

const moon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshBasicMaterial({ color: PAL.moon }));
moon.position.set(10, 16, -48);
planet.add(moon);
const moon2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf8c8d8 }));
moon2.position.set(-14, 14, -40);
planet.add(moon2);

const crystals = [];
for (let i = 0; i < 28; i++) {
  const c = box(0.25 + Math.random() * 0.4, 1.2 + Math.random() * 2.2, 0.25, 0xd090c0);
  c.position.set((Math.random() - 0.5) * 70, 0, -20 - Math.random() * 50);
  planet.add(c);
  crystals.push(c);
}

const dustGeo = new THREE.BufferGeometry();
const dustN = 220;
const dustPos = new Float32Array(dustN * 3);
for (let i = 0; i < dustN; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * ROOM_W;
  dustPos[i * 3 + 1] = Math.random() * ROOM_H;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * ROOM_D;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe8d8f0, size: 0.014, transparent: true, opacity: 0.32 })));
const dust = scene.children[scene.children.length - 1];

let audioCtx, playing = false;
function startLofi() {
  if (playing) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const master = audioCtx.createGain();
  master.gain.value = 0.2;
  master.connect(audioCtx.destination);
  const pad = audioCtx.createOscillator(); pad.type = 'sine'; pad.frequency.value = 110;
  const pad2 = audioCtx.createOscillator(); pad2.type = 'triangle'; pad2.frequency.value = 164.81;
  const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 680;
  const g = audioCtx.createGain(); g.gain.value = 0.16;
  pad.connect(filter); pad2.connect(filter); filter.connect(g); g.connect(master);
  pad.start(); pad2.start();
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
  const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1900;
  const cg = audioCtx.createGain(); cg.gain.value = 0.028;
  src.connect(hp); hp.connect(cg); cg.connect(master); src.start();
  playing = true;
}
addEventListener('pointerdown', startLofi);

const factory = new XRControllerModelFactory();
function hook(i) {
  const c = renderer.xr.getController(i);
  c.addEventListener('selectstart', startLofi);
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

const hint = document.getElementById('hint');
if (hint) hint.textContent = 'Land yacht Bay 04 — ENTER VR. Trigger starts lofi. Terrain scrolls under the hull.';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const SPEED = 4.2;
let last = 0, rebuildAccum = 0;
renderer.setAnimationLoop((time) => {
  const t = time * 0.001;
  const dt = last ? Math.min(0.05, (time - last) * 0.001) : 0.016;
  last = time;
  worldOffset.z -= SPEED * dt;
  rebuildAccum += dt;
  if (rebuildAccum > 0.08) { rebuildTerrain(); rebuildAccum = 0; }
  wheels.forEach((w) => { w.rotation.x += dt * SPEED * 0.85; });
  blades.rotation.z = t * 0.4;
  moon.position.x = 10 + Math.sin(t * 0.03) * 0.8;
  crystals.forEach((c) => {
    c.position.x = ((c.position.x + worldOffset.x * 0.02 + 40) % 80) - 40;
    c.position.y = heightAt(c.position.x + worldOffset.x, c.position.z + worldOffset.z) + 0.8;
  });
  const dp = dust.geometry.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    let y = dp.getY(i) + 0.002;
    if (y > ROOM_H) y = 0.08;
    dp.setY(i, y);
  }
  dp.needsUpdate = true;
  if (((time / 16) | 0) % 4 === 0) {
    drawGrid(gridC, t); drawWave(waveC, t);
    screens.forEach((s) => { if (s.userData.tex) s.userData.tex.needsUpdate = true; });
  }
  renderer.render(scene, camera);
});
