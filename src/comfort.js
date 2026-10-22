import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// VR comfort shared with the Fiction Factory showroom (same origin, same key).

const DEFAULTS = { turn: 'snap30', vignette: true, move: 'smooth', lefty: false };
const DEADZONE = 0.15;
const MOVE_SPEED = 1.6; // m/s at full stick
const SMOOTH_TURN = Math.PI / 2; // 90 deg/s at full stick
const SNAP_ON = 0.6;
const SNAP_OFF = 0.3;
const VIGNETTE_MAX = 0.75;
const VIGNETTE_EASE = 8;

export function readComfort() {
  try {
    const raw = localStorage.getItem('ff-comfort');
    if (!raw) return { ...DEFAULTS };
    const extra = JSON.parse(raw);
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return { ...DEFAULTS };
    return { ...DEFAULTS, ...extra };
  } catch {
    return { ...DEFAULTS };
  }
}

export function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Radial deadzone, remapped so the edge is 0 and full deflection is 1.
function stick2(x, y) {
  const mag = Math.hypot(x, y);
  if (mag <= DEADZONE) return { x: 0, y: 0 };
  const scaled = (Math.min(mag, 1) - DEADZONE) / (1 - DEADZONE) / mag;
  return { x: x * scaled, y: y * scaled };
}

function stickX(x) {
  const a = Math.abs(x);
  if (a <= DEADZONE) return 0;
  return Math.sign(x) * (Math.min(a, 1) - DEADZONE) / (1 - DEADZONE);
}

export function createXRLoco({ THREE, renderer, rig, camera, bounds, controllers = [] }) {
  const vignetteMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const vignette = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.9, 48), vignetteMat);
  vignette.renderOrder = 999;
  vignette.position.z = -0.3;
  vignette.visible = false;
  vignette.frustumCulled = false;
  camera.add(vignette);

  const marker = new THREE.Mesh(
    mergeGeometries([
      new THREE.RingGeometry(0.22, 0.27, 32),
      new THREE.CircleGeometry(0.06, 16),
    ]).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x7ff0e2, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  marker.renderOrder = 3;
  marker.visible = false;
  (rig.parent || rig).add(marker);
  for (let i = 0; i < controllers.length; i++) {
    const c = controllers[i];
    c.addEventListener('connected', (e) => { c.userData.handedness = e.data.handedness; });
  }

  const quat = new THREE.Quaternion();
  const head = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const yAxis = new THREE.Vector3(0, 1, 0);
  let snapArmed = true;
  let aim = null; // controller currently aiming
  let hiddenLine = null;

  function restoreLine() {
    if (!hiddenLine) return;
    hiddenLine.visible = true;
    hiddenLine = null;
  }

  // getCamera() is not parented to the rig; its pose is reference-space.
  // A camera already in the rig's hierarchy already has a world pose.
  function inRig(xrCam) {
    for (let p = xrCam.parent; p; p = p.parent) if (p === rig) return true;
    return false;
  }

  function headWorld(out) {
    const xrCam = renderer.xr.getCamera();
    rig.updateMatrixWorld(true);
    xrCam.getWorldPosition(out);
    if (!inRig(xrCam)) out.applyMatrix4(rig.matrixWorld);
    return out;
  }

  function headYaw() {
    const xrCam = renderer.xr.getCamera();
    xrCam.getWorldQuaternion(quat);
    if (!inRig(xrCam)) quat.premultiply(rig.quaternion);
    yawEuler.setFromQuaternion(quat, 'YXZ');
    return yawEuler.y;
  }

  // Yaw the rig around the head so the viewpoint stays put.
  function rotateAboutHead(angle) {
    if (!angle) return;
    headWorld(head);
    rig.position.sub(head);
    rig.position.applyAxisAngle(yAxis, angle);
    rig.position.add(head);
    rig.rotation.y += angle;
  }

  function reset() {
    snapArmed = true;
    vignetteMat.opacity = 0;
    vignette.visible = false;
    marker.visible = false;
    restoreLine();
    aim = null;
  }

  function update(dt) {
    const comfort = readComfort();
    let moving = false;
    let smoothTurning = false;

    if (renderer.xr.isPresenting) {
      const session = renderer.xr.getSession();
      const sources = session && session.inputSources ? session.inputSources : [];
      const moveHand = comfort.lefty ? 'right' : 'left';
      const turnHand = comfort.lefty ? 'left' : 'right';
      let move = null;
      let turn = null;
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const gp = source.gamepad;
        if (!gp || !gp.axes || gp.axes.length < 4) continue;
        const stick = { x: gp.axes[2] || 0, y: gp.axes[3] || 0 };
        if (source.handedness === moveHand) move = stick;
        else if (source.handedness === turnHand) turn = stick;
      }

      if (comfort.move === 'smooth' && move) {
        // axes[3] is −1 when the stick is pushed forward (same as desktop walk).
        const s = stick2(move.x, move.y);
        if (s.x || s.y) {
          moving = true;
          const yaw = headYaw();
          const sin = Math.sin(yaw);
          const cos = Math.cos(yaw);
          rig.position.x += (-sin * -s.y + cos * s.x) * MOVE_SPEED * dt;
          rig.position.z += (-cos * -s.y - sin * s.x) * MOVE_SPEED * dt;
          headWorld(head);
          if (head.x < bounds.minX) rig.position.x += bounds.minX - head.x;
          else if (head.x > bounds.maxX) rig.position.x += bounds.maxX - head.x;
          if (head.z < bounds.minZ) rig.position.z += bounds.minZ - head.z;
          else if (head.z > bounds.maxZ) rig.position.z += bounds.maxZ - head.z;
        }
      }

      if (turn) {
        if (comfort.turn === 'smooth') {
          const tx = stickX(turn.x);
          if (tx) {
            smoothTurning = true;
            rotateAboutHead(-tx * SMOOTH_TURN * dt);
          }
        } else if (comfort.turn === 'snap30' || comfort.turn === 'snap45') {
          const x = turn.x || 0;
          if (Math.abs(x) < SNAP_OFF) snapArmed = true;
          else if (snapArmed && Math.abs(x) > SNAP_ON) {
            snapArmed = false;
            const step = comfort.turn === 'snap45' ? Math.PI / 4 : Math.PI / 6;
            rotateAboutHead(-Math.sign(x) * step);
          }
        }
      }

      let aimPressed = false;
      for (let i = 0; i < controllers.length; i++) {
        const c = controllers[i];
        const hand = c.userData.handedness;
        let source = null;
        if (hand) {
          for (let j = 0; j < sources.length; j++) {
            if (sources[j].handedness === hand) {
              source = sources[j];
              break;
            }
          }
        }
        const pressed = !!source?.gamepad?.buttons?.[0]?.pressed;
        if (pressed && aim === null) aim = c;
        if (c === aim) aimPressed = pressed;
      }

      if (aim) {
        if (aimPressed) {
          aim.getWorldPosition(origin);
          dir.set(0, 0, -1).transformDirection(aim.matrixWorld);
          if (dir.y < -0.05) {
            const t = -origin.y / dir.y;
            if (t < 8) {
              let x = origin.x + dir.x * t;
              let z = origin.z + dir.z * t;
              if (x < bounds.minX) x = bounds.minX;
              else if (x > bounds.maxX) x = bounds.maxX;
              if (z < bounds.minZ) z = bounds.minZ;
              else if (z > bounds.maxZ) z = bounds.maxZ;
              marker.position.set(x, 0.01, z);
              marker.visible = true;
            } else marker.visible = false;
          } else marker.visible = false;
          if (!hiddenLine) {
            for (let i = 0; i < aim.children.length; i++) {
              if (aim.children[i].isLine) {
                hiddenLine = aim.children[i];
                break;
              }
            }
          }
          if (hiddenLine) hiddenLine.visible = false;
        } else {
          if (marker.visible) {
            headWorld(head);
            rig.position.x += marker.position.x - head.x;
            rig.position.z += marker.position.z - head.z;
          }
          marker.visible = false;
          restoreLine();
          aim = null;
        }
      }
    }

    const target = comfort.vignette && (moving || smoothTurning) ? VIGNETTE_MAX : 0;
    vignetteMat.opacity += (target - vignetteMat.opacity) * (1 - Math.exp(-VIGNETTE_EASE * dt));
    if (Math.abs(vignetteMat.opacity - target) < 0.0005) vignetteMat.opacity = target;
    vignette.visible = vignetteMat.opacity > 0.02;
  }

  return { update, reset };
}
