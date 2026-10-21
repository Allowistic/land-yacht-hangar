// Sunset backdrop for the observation window, built like an old cartoon
// background: flat painted layers at fixed heights that slide sideways at
// different speeds. Nothing here rises or falls over time, and every piece
// sits outside the cabin (window wall is at z = -3.5, the floor at y = 0).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
export const GROUND_Y = -2.3; // where the wheels touch
export const TRAVEL_SPEED = 7; // metres per second the yacht rolls along -x

const SKY = {
  zenith: new THREE.Color(0x2b1d4f),
  high: new THREE.Color(0x6a3f7e),
  mid: new THREE.Color(0xd8678f),
  low: new THREE.Color(0xff9a6b),
  horizon: new THREE.Color(0xffc98a),
  below: new THREE.Color(0xe39a9e),
};
const SUN_DIR = new THREE.Vector3(-0.22, 0.06, -1).normalize();

// Repeating silhouettes. Every term uses a whole number of cycles per period,
// so the strip tiles with no seam and can wrap forever.
function ridgeProfile(u, seed) {
  let v = 0, amp = 1, norm = 0;
  const ks = [1, 2, 3, 5, 8, 13];
  for (let i = 0; i < ks.length; i++) {
    v += amp * Math.sin(TAU * ks[i] * u + seed * (i + 1) * 1.7);
    norm += amp;
    amp *= 0.58;
  }
  v /= norm; // -1..1
  return Math.pow(1 - Math.abs(v), 1.8); // sharp peaks
}
function mesaProfile(u, seed) {
  const v = (Math.sin(TAU * 2 * u + seed) + 0.55 * Math.sin(TAU * 5 * u + seed * 2.3) +
    0.25 * Math.sin(TAU * 11 * u + seed * 4.1)) / 1.8;
  const t = Math.min(1, Math.max(0, (v + 0.15) * 3.2));
  const plateau = t * t * (3 - 2 * t); // flat tops, steep sides
  return 0.18 + 0.82 * plateau + 0.03 * Math.sin(TAU * 23 * u + seed);
}
function duneProfile(u, seed) {
  let v = 0;
  const ks = [3, 4, 7, 9];
  for (let i = 0; i < ks.length; i++) {
    const p = (ks[i] * u + seed * 0.37 * (i + 1)) % 1;
    v += (1 / (i + 1)) * Math.pow(Math.sin(Math.PI * p), 2.2) * (0.6 + 0.4 * Math.sin(TAU * (i + 2) * u + seed));
  }
  return Math.min(1, Math.max(0, v / 1.4));
}

const LAYERS = [
  // distance, base, height, period, colour, rim, profile, seed
  { z: -175, base: -9, height: 27, period: 420, color: 0xc493b8, rim: 0xffd0c8, fn: ridgeProfile, seed: 1.3, samples: 260 },
  { z: -120, base: -8, height: 17, period: 300, color: 0xa36b9f, rim: 0xf6b0b8, fn: ridgeProfile, seed: 4.2, samples: 220 },
  { z: -78, base: -6, height: 10, period: 210, color: 0x7f4f87, rim: 0xe89aa8, fn: mesaProfile, seed: 2.6, samples: 260 },
  { z: -44, base: GROUND_Y - 0.5, height: 4.2, period: 130, color: 0x5d3a6d, rim: 0xd88a9c, fn: duneProfile, seed: 0.8, samples: 220 },
  { z: -22, base: GROUND_Y - 0.5, height: 1.9, period: 70, color: 0x432a55, rim: 0xb87390, fn: duneProfile, seed: 5.9, samples: 180 },
];

function buildStrip(layer) {
  const { z, base, height, period, fn, seed, samples } = layer;
  // Wide enough that the strip still fills the view when you press your face
  // to the glass and look along it at a steep angle.
  const half = Math.max(4.5 * Math.abs(z), 160);
  const periods = Math.ceil((2 * half) / period) + 2;
  const x0 = -Math.ceil(half / period + 1) * period;
  const n = periods * samples;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const top = new Float32Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (i / samples) * period;
    const u = (i % samples) / samples;
    const y = base + height * fn(u, seed);
    pos.set([x, y, 0, x, base, 0], i * 6);
    top.set([x, y, 0.01], i * 3);
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: layer.color, fog: false }));
  const rimGeo = new THREE.BufferGeometry();
  rimGeo.setAttribute('position', new THREE.BufferAttribute(top, 3));
  const rim = new THREE.Line(rimGeo, new THREE.LineBasicMaterial({ color: layer.rim, fog: false }));
  const group = new THREE.Group();
  group.add(mesh, rim);
  group.position.z = z;
  return group;
}

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: SKY.zenith }, high: { value: SKY.high }, mid: { value: SKY.mid },
      low: { value: SKY.low }, horizon: { value: SKY.horizon }, below: { value: SKY.below },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 zenith, high, mid, low, horizon, below, sunDir; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = mix(horizon, below, smoothstep(0.0, -0.25, h));
        c = mix(c, low, smoothstep(0.0, 0.06, h));
        c = mix(c, mid, smoothstep(0.05, 0.2, h));
        c = mix(c, high, smoothstep(0.18, 0.45, h));
        c = mix(c, zenith, smoothstep(0.4, 0.9, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += vec3(1.0, 0.62, 0.38) * (pow(s, 18.0) * 0.45 + pow(s, 4.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 40, 20), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  return dome;
}

function sunDisc() {
  const g = new THREE.Group();
  const p = SUN_DIR.clone().multiplyScalar(290);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshBasicMaterial({ color: 0xffe0a8, fog: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(15, 21, 48), new THREE.MeshBasicMaterial({ color: 0xffb27a, fog: false, transparent: true, opacity: 0.35, depthWrite: false }));
  // Cartoon sunset bands across the lower half of the sun.
  // Each band is a little narrower than the disc at its height, so none pokes out.
  const bands = [];
  const bandMat = new THREE.Matrix4();
  const bandPos = new THREE.Vector3();
  const bandQuat = new THREE.Quaternion();
  const bandScale = new THREE.Vector3();
  const bandWidths = [0.86, 0.7, 0.48];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(34, 1.1 + i * 0.5);
    geo.applyMatrix4(bandMat.compose(
      bandPos.set(0, -4 - i * 3.6, 0.05), bandQuat, bandScale.set(bandWidths[i], 1, 1)));
    bands.push(geo);
  }
  g.add(new THREE.Mesh(mergeGeometries(bands), new THREE.MeshBasicMaterial({ color: 0xff8f6a, fog: false })));
  g.add(disc, ring);
  disc.position.z = -0.05; ring.position.z = -0.1;
  g.position.copy(p);
  g.lookAt(0, 1.6, 0);
  return g;
}

function groundPlane() {
  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { near: { value: new THREE.Color(0x3e2a4d) }, far: { value: new THREE.Color(0xd99aa6) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 near, far; varying vec3 vW;
      void main(){ float d = length(vW.xz); vec3 c = mix(near, far, smoothstep(8.0, 190.0, d)); gl_FragColor = vec4(c,1.0);
      #include <colorspace_fragment>
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 420), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y, -190);
  return ground;
}

// Long low streaks of wind-blown sand on the ground, flat on the floor of the
// desert, sliding past fastest because they are closest.
function sandStreaks() {
  const period = 90;
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x6b4a73, fog: false });
  const matLight = new THREE.MeshBasicMaterial({ color: 0x8a5e86, fog: false });
  const dark = [];
  const light = [];
  const baked = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const v = new THREE.Vector3();
  const unit = new THREE.Vector3(1, 1, 1);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let rep = -3; rep <= 3; rep++) {
    for (let i = 0; i < 22; i++) {
      const len = 2 + rnd() * 7;
      const geo = new THREE.PlaneGeometry(len, 0.12 + rnd() * 0.2);
      const bucket = rnd() > 0.5 ? dark : light;
      // Same pattern in every repeat, so the wrap is invisible.
      geo.applyMatrix4(baked.compose(
        v.set(rep * period + rnd() * period - period / 2, GROUND_Y + 0.01, -8 - rnd() * 13),
        q, unit));
      bucket.push(geo);
    }
    s = 7; // restart the sequence for the next repeat
  }
  g.add(new THREE.Mesh(mergeGeometries(dark), mat));
  g.add(new THREE.Mesh(mergeGeometries(light), matLight));
  return { group: g, period };
}

function clouds() {
  const period = 520;
  const g = new THREE.Group();
  const top = new THREE.MeshBasicMaterial({ color: 0xf6b3c2, fog: false });
  const under = new THREE.MeshBasicMaterial({ color: 0xff9f7e, fog: false });
  const shapes = [[-180, 30, 46], [-60, 37, 34], [70, 26, 52], [190, 33, 38]];
  const topGeos = [];
  const underGeos = [];
  const baked = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  for (let rep = -2; rep <= 2; rep++) {
    shapes.forEach(([x, y, w]) => {
      const cx = rep * period + x;
      // Puff sits behind the body and the belly in front; the z offsets keep that order.
      const puff = new THREE.CircleGeometry(1, 24);
      puff.applyMatrix4(baked.compose(pos.set(cx - w * 0.12, y + 2.2, -0.1), quat, scl.set(w / 5, 3.4, 1)));
      const body = new THREE.CircleGeometry(1, 32);
      body.applyMatrix4(baked.compose(pos.set(cx, y, 0), quat, scl.set(w / 2, 3.2, 1)));
      const belly = new THREE.CircleGeometry(1, 32);
      belly.applyMatrix4(baked.compose(pos.set(cx + w * 0.06, y - 2.4, 0.1), quat, scl.set(w / 2.4, 1.6, 1)));
      topGeos.push(puff, body);
      underGeos.push(belly);
    });
  }
  g.add(new THREE.Mesh(mergeGeometries(topGeos), top));
  g.add(new THREE.Mesh(mergeGeometries(underGeos), under));
  g.position.z = -230;
  return { group: g, period };
}

export function createScenery(scene) {
  const root = new THREE.Group();
  root.name = 'scenery';
  scene.add(root);
  const dome = skyDome();
  root.add(dome);
  root.add(sunDisc());
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshBasicMaterial({ color: 0xf4e2ee, fog: false }));
  moon.position.set(140, 40, -250);
  moon.lookAt(0, 1.6, 0);
  root.add(moon);
  root.add(groundPlane());

  // Each sliding piece: a group, the length after which it repeats, and how
  // fast it slides. Real perspective already makes far layers crawl and near
  // ones race, so they all move with the yacht; clouds drift on their own wind.
  const sliders = [];
  const cl = clouds();
  root.add(cl.group);
  sliders.push({ group: cl.group, period: cl.period, speed: 2.2, offset: 0 });
  LAYERS.forEach((layer) => {
    const strip = buildStrip(layer);
    root.add(strip);
    sliders.push({ group: strip, period: layer.period, speed: TRAVEL_SPEED, offset: 0 });
  });
  const st = sandStreaks();
  root.add(st.group);
  sliders.push({ group: st.group, period: st.period, speed: TRAVEL_SPEED, offset: 0 });

  function update(dt) {
    for (const s of sliders) {
      s.offset = (s.offset + s.speed * dt) % s.period;
      s.group.position.x = s.offset; // slides toward +x; height never changes
    }
  }
  return { root, dome, update, sliders, sunDir: SUN_DIR };
}
