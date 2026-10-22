// Transporter beam, shared with the Fiction Factory cantina teleporter (fiction-factory-showroom showroom/beam.js; keep the two in step).
// One open column of rising, twinkling sparkles with light streaks running up it, glowing emitter pads on the floor and up top, and a
// shimmer/hum made live in Web Audio (no sound files). It is ONE ShaderMaterial mesh (+1 draw) and it is hidden (0 draws) whenever the
// level is 0, so it costs nothing until someone stands on the pad. World-locked, never head-locked: in VR it stays put around you.
// Edit BEAM below. Page overrides: ?beam=0 turns it off (old plain fade), ?beam=0.5 halves it, ?beam=1.5 is the most it goes.

export const BEAM = {
  intensity: 1.0,     // 0 = off (plain fade, the old behaviour) .. 1 = full beam .. 1.5 max. Scales brightness and sparkle count.
  sound: true,        // shimmer + hum (Web Audio). Silent until the page has had a tap, click or key.
  volume: 0.22,       // master volume of that sound at full beam
  energize: 1.7,      // seconds of beam-out after the jump starts, before the page leaves (desktop / phone)
  xrEnergize: 1.3,    // seconds in VR before the session ends (shorter: no screen fade in a headset)
  fade: 0.45,         // seconds of white-out at the end (desktop / phone only), inside `energize`
  charge: 0.45,       // beam level while you stand on the pad and the ring fills (it shimmers up, then goes to 1 on the jump)
  radius: 0.5, height: 2.35, // column size in metres (radius must clear a standing person; the eye sits inside it)
  core: 0x8fd0ff,     // column glow: transporter blue
  spark: 0xfff0c4,    // sparkles: warm gold-white
  tint: 0xff7fb6,     // emitter pads: Land Yacht pink, so it still reads as the Tiki Nest's
  fadeColor: '#eef6ff',
  arrive: true,       // add #beamin to the destination so Land Yacht Hangar plays the rematerialise on arrival
};

export function beamSettings() { // applies ?beam= and prefers-reduced-motion once
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('beam') : null;
  let k = BEAM.intensity; if (q !== null && q !== '') { const v = parseFloat(q); if (Number.isFinite(v)) k = v; else if (/^(off|no|false)$/i.test(q)) k = 0; }
  const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { k: Math.max(0, Math.min(1.5, k)), calm };
}

const VERT = `attribute float layer; varying vec2 vUv; varying float vLayer;
void main() { vUv = uv; vLayer = layer; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform float uTime, uLevel, uGain, uCalm, uCirc; uniform vec3 uCore, uSpark, uTint; varying vec2 vUv; varying float vLayer;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// rising sparkles: one candidate per ~8 cm cell; more cells light up as the level rises; each twinkles on its own clock
float sparkles(vec2 m, float cell, float speed, float seed) {
  vec2 g = m / cell; g.y -= uTime * speed;
  vec2 id = floor(g), f = fract(g); float h = h21(id + seed);
  vec2 c = vec2(0.2 + 0.6 * h21(id + seed + 7.1), 0.2 + 0.6 * h21(id + seed + 3.7));
  float s = smoothstep(0.16, 0.0, length(f - c)); s += 0.35 * smoothstep(0.05, 0.0, abs(f.x - c.x)) * smoothstep(0.42, 0.0, abs(f.y - c.y)); // dot + vertical glint
  float tw = 0.5 + 0.5 * sin(uTime * (5.0 + 9.0 * h) * (1.0 - 0.85 * uCalm) + h * 40.0);
  return s * tw * tw * step(1.0 - min(1.0, uLevel * 0.9), h);
}
void main() {
  vec3 col; float L = uLevel;
  if (vLayer < 1.5) { // the column: outer (0) and inner (1) shell, so there is depth when you stand inside it
    float circ = vLayer < 0.5 ? uCirc : uCirc * 0.62; vec2 m = vec2(vUv.x * circ, vUv.y * 2.35); float y = vUv.y;
    float speed = mix(0.55, 0.12, uCalm);
    float sp = sparkles(m, 0.085, speed, vLayer * 17.0) + 0.7 * sparkles(m + 0.031, 0.055, speed * 1.6, 5.0 + vLayer * 11.0);
    float sx = m.x / 0.11, sh = h21(vec2(floor(sx), 9.0 + vLayer));
    float line = smoothstep(0.12, 0.0, abs(fract(sx) - 0.5));
    float run = fract(y * 0.7 - uTime * mix(0.35 + 0.5 * sh, 0.08, uCalm) + sh * 5.0);
    float streak = line * smoothstep(0.0, 0.25, run) * smoothstep(1.0, 0.55, run) * step(0.5, sh);
    float base = exp(-y * 5.0) * 0.65 + exp(-(1.0 - y) * 7.0) * 0.45, haze = 0.18 + 0.05 * sin(uTime * 1.3 + y * 6.0);
    float env = smoothstep(0.0, 0.05, y) * smoothstep(1.0, 0.86, y);
    col = uCore * (haze + base * 0.6) * L * 0.75 + uSpark * sp * (0.4 + 0.8 * L) + mix(uCore, uSpark, 0.5) * streak * 0.55 * L + uTint * exp(-y * 9.0) * 0.25 * L;
    col *= env * (vLayer < 0.5 ? 1.0 : 0.6);
  } else { // emitter pads: floor (2) and ceiling (3); a pink ring, blue glow and a slow sweep
    vec2 q = vUv * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard;
    float a = atan(q.y, q.x), sweep = 0.5 + 0.5 * sin(a * 6.0 + uTime * mix(3.0, 0.6, uCalm));
    float ring = smoothstep(0.80, 0.88, r) * smoothstep(1.0, 0.92, r), core = smoothstep(1.0, 0.0, r);
    col = uTint * ring * (0.6 + 0.4 * sweep) + uCore * core * core * 0.7 + uSpark * smoothstep(0.25, 0.0, r) * 0.3;
    col *= L * (vLayer < 2.5 ? 1.0 : 0.8);
  }
  gl_FragColor = vec4(col * uGain, 1.0);
}`;

function withLayer(THREE, g, k) { g = g.index ? g.toNonIndexed() : g; for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'uv') g.deleteAttribute(n);
  g.setAttribute('layer', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1)); return g; }
function concat(THREE, gs) { const out = new THREE.BufferGeometry();
  for (const name of ['position', 'uv', 'layer']) { const size = gs[0].attributes[name].itemSize, n = gs.reduce((s, g) => s + g.attributes[name].array.length, 0), arr = new Float32Array(n); let o = 0;
    for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, size)); }
  return out; }

// The beam mesh. Put it in a group whose local y = 0 is the floor; move it with setAt(x, z). set(level 0..1) each frame; tick(t) for time.
export function createBeam(THREE, opts = {}) {
  const S = beamSettings(), R = opts.radius ?? BEAM.radius, H = opts.height ?? BEAM.height;
  const outer = new THREE.CylinderGeometry(R, R, H, 32, 1, true).translate(0, H / 2, 0);
  const inner = new THREE.CylinderGeometry(R * 0.62, R * 0.62, H, 24, 1, true).translate(0, H / 2, 0);
  const floor = new THREE.CircleGeometry(R * 1.15, 32).rotateX(-Math.PI / 2).translate(0, 0.016, 0);
  const top = new THREE.CircleGeometry(R * 1.05, 32).rotateX(Math.PI / 2).translate(0, H, 0);
  const geo = concat(THREE, [withLayer(THREE, outer, 0), withLayer(THREE, inner, 1), withLayer(THREE, floor, 2), withLayer(THREE, top, 3)]);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H / 2, 0), Math.hypot(R * 1.15, H / 2));
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uGain: { value: Math.min(1.25, S.k) }, uCalm: { value: S.calm ? 1 : 0 }, uCirc: { value: 2 * Math.PI * R },
      uCore: { value: new THREE.Color(BEAM.core) }, uSpark: { value: new THREE.Color(BEAM.spark) }, uTint: { value: new THREE.Color(BEAM.tint) } } });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'teleporter-beam'; mesh.renderOrder = 3; mesh.visible = false; mesh.userData.noMerge = true; mesh.raycast = () => {}; // never pickable, never blocks a tap
  return { mesh, on: S.k > 0, calm: S.calm, k: S.k,
    setAt(x, z) { mesh.position.x = x; mesh.position.z = z; },
    set(level) { const l = S.k > 0 ? Math.max(0, Math.min(1, level)) : 0; mat.uniforms.uLevel.value = l; mesh.visible = l > 0.002; return l; },
    tick(t) { mat.uniforms.uTime.value = t; },
    get level() { return mat.uniforms.uLevel.value; } };
}

// Shimmer + hum, synthesised (no assets). unlock() from a user gesture; set(level 0..1) each frame. Tears its nodes down after ~1 s of silence.
export function createBeamSound(volume = BEAM.volume) {
  const S = beamSettings(); let ctx = null, out = null, nodes = null, quiet = 0, lastT = 0;
  const enabled = BEAM.sound && S.k > 0;
  function unlock() { if (!enabled) return; try { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); } if (ctx.state === 'suspended') ctx.resume().catch(() => {}); } catch (e) { /* no audio: the beam still runs */ } }
  function build() {
    out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination); const srcs = [];
    const sh = ctx.createGain(); sh.gain.value = 0.06; sh.connect(out); // shimmer: high partials, each warbling on its own LFO
    for (const f of [1318.5, 1568, 1975.5, 2349.3, 2637, 3136, 3951]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.006); g.gain.value = 0.5; l.frequency.value = 6 + Math.random() * 9; lg.gain.value = 0.5;
      l.connect(lg).connect(g.gain); o.connect(g).connect(sh); o.start(); l.start(); srcs.push(o, l); }
    const n = ctx.createBufferSource(), b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); // air: band-passed noise that sweeps up
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2; bp.frequency.value = 800; const ng = ctx.createGain(); ng.gain.value = 0.3; n.connect(bp).connect(ng).connect(out); n.start(); srcs.push(n);
    const hm = ctx.createOscillator(); hm.type = 'triangle'; hm.frequency.value = 100; const hg = ctx.createGain(); hg.gain.value = 0.14; hm.connect(hg).connect(out); hm.start(); srcs.push(hm); // hum
    nodes = { bp, hm, srcs }; }
  function teardown() { if (!nodes) return; for (const s of nodes.srcs) { try { s.stop(); } catch (e) {} } try { out.disconnect(); } catch (e) {} nodes = null; out = null; }
  function set(level) {
    if (!enabled || !ctx || ctx.state !== 'running') return; const now = ctx.currentTime, dt = lastT ? now - lastT : 0; lastT = now;
    if (level <= 0.002) { if (nodes) { out.gain.setTargetAtTime(0, now, 0.06); quiet += dt; if (quiet > 1) teardown(); } return; }
    quiet = 0; if (!nodes) build();
    const v = volume * Math.min(1.25, S.k) * level; out.gain.setTargetAtTime(v, now, 0.08);
    nodes.bp.frequency.setTargetAtTime(700 + 2600 * level, now, 0.1); nodes.hm.frequency.setTargetAtTime(95 + 70 * level, now, 0.15); }
  return { unlock, set, get state() { return ctx ? ctx.state : 'none'; }, get playing() { return !!nodes; } };
}
