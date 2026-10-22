// Walking and looking around outside VR.
// Phone: left stick walks, right stick looks, or drag anywhere else to look.
// Desktop: WASD walks, arrow keys or mouse drag look.
// In VR the headset drives the camera, so all of this switches off.
import * as THREE from 'three';

const MOVE_SPEED = 2.0; // m/s at full stick
const LOOK_SPEED = 2.4; // rad/s yaw at full stick
const PITCH_SPEED = 1.7;
const DRAG_LOOK = 0.0055; // rad per pixel of drag
const PITCH_LIMIT = 1.25; // about 72 degrees up or down
const DEADZONE = 0.14;
const EYE_HEIGHT = 1.6;

function makeStick(side) {
  const base = document.createElement('div');
  base.className = `stick stick-${side}`;
  base.setAttribute('aria-label', side === 'left' ? 'Move' : 'Look');
  const knob = document.createElement('div');
  knob.className = 'knob';
  base.appendChild(knob);
  const label = document.createElement('span');
  label.className = 'stick-label';
  label.textContent = side === 'left' ? 'MOVE' : 'LOOK';
  base.appendChild(label);
  const s = { base, knob, id: null, x: 0, y: 0, rawX: 0, rawY: 0 };

  function setFrom(e) {
    const r = base.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (e.clientX - (r.left + radius)) / radius;
    let dy = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    s.rawX = dx; s.rawY = dy;
    const l = Math.min(1, len);
    // Deadzone, then rescale so the stick still reaches full speed at the rim.
    const k = l < DEADZONE ? 0 : (l - DEADZONE) / (1 - DEADZONE) / (l || 1);
    s.x = dx * k;
    s.y = dy * k;
    knob.style.transform = `translate(${dx * radius * 0.62}px, ${dy * radius * 0.62}px)`;
  }
  function reset() {
    s.id = null; s.x = 0; s.y = 0; s.rawX = 0; s.rawY = 0;
    knob.style.transform = 'translate(0px, 0px)';
    base.classList.remove('active');
  }
  base.addEventListener('pointerdown', (e) => {
    if (s.id !== null) return;
    e.preventDefault();
    s.id = e.pointerId;
    try { base.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ }
    base.classList.add('active');
    setFrom(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === s.id) { e.preventDefault(); setFrom(e); } });
  const end = (e) => { if (e.pointerId === s.id) reset(); };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
  base.addEventListener('lostpointercapture', end);
  s.reset = reset;
  return s;
}

export function createControls({ camera, renderer, canvas, bounds }) {
  const pos = new THREE.Vector3(0, EYE_HEIGHT, 2.0);
  let yaw = 0, pitch = 0;
  camera.rotation.order = 'YXZ';

  const overlay = document.createElement('div');
  overlay.id = 'touch-controls';
  const left = makeStick('left');
  const right = makeStick('right');
  overlay.append(left.base, right.base);
  document.body.appendChild(overlay);

  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const touchCapable = coarse || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let inVR = false;
  function refreshOverlay() { overlay.classList.toggle('visible', touchCapable && !inVR); }
  refreshOverlay();

  // Drag to look on the canvas itself (any finger not on a stick, or a mouse).
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (inVR || drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    yaw -= (e.clientX - drag.x) * DRAG_LOOK;
    pitch -= (e.clientY - drag.y) * DRAG_LOOK;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    keys.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  function resetInputs() {
    left.reset(); right.reset(); drag = null; keys.clear();
  }
  addEventListener('blur', resetInputs);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetInputs(); });

  renderer.xr.addEventListener('sessionstart', () => { inVR = true; resetInputs(); refreshOverlay(); });
  renderer.xr.addEventListener('sessionend', () => { inVR = false; resetInputs(); refreshOverlay(); });

  const fwd = new THREE.Vector3(), rightV = new THREE.Vector3();
  function update(dt) {
    if (renderer.xr.isPresenting) return;
    let mx = left.x, my = left.y;
    if (keys.has('KeyW')) my -= 1;
    if (keys.has('KeyS')) my += 1;
    if (keys.has('KeyA')) mx -= 1;
    if (keys.has('KeyD')) mx += 1;
    let lx = right.x, ly = right.y;
    if (keys.has('ArrowLeft')) lx -= 1;
    if (keys.has('ArrowRight')) lx += 1;
    if (keys.has('ArrowUp')) ly -= 1;
    if (keys.has('ArrowDown')) ly += 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }

    yaw -= lx * LOOK_SPEED * dt;
    pitch -= ly * PITCH_SPEED * dt;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));

    // Walk relative to where you're facing, flat on the floor.
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    rightV.set(Math.cos(yaw), 0, -Math.sin(yaw));
    pos.addScaledVector(fwd, -my * MOVE_SPEED * dt);
    pos.addScaledVector(rightV, mx * MOVE_SPEED * dt);
    pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
    pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));
    pos.y = EYE_HEIGHT;

    camera.position.copy(pos);
    camera.rotation.set(pitch, yaw, 0);
  }

  return {
    update,
    resetInputs,
    state: () => ({
      pos: pos.toArray().map((v) => +v.toFixed(3)), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3),
      left: { id: left.id, x: +left.x.toFixed(3), y: +left.y.toFixed(3) },
      right: { id: right.id, x: +right.x.toFixed(3), y: +right.y.toFixed(3) },
      overlayVisible: overlay.classList.contains('visible'), dragging: !!drag,
    }),
  };
}
