// Arrival from the Fiction Factory cantina teleporter. The cantina sends you to this page with #beamin; then you rematerialise:
// a white flash clears as the transporter column stands around you at full strength, holds a beat, and dissolves (about 2 s).
// The hash is removed straight away, so a reload or a shared link does not play it again. ?beam=0 on this page turns it off.
// No sound here: browsers block audio until the first tap, and this plays before you have touched anything.
import * as THREE from 'three';
import { BEAM, createBeam } from './beam.js';

const HOLD = 0.5, DISSOLVE = 1.6; // seconds at full strength after the first frame, then the fade to nothing

export function createBeamIn(scene, camera) {
  const none = { update() {}, get active() { return false; } };
  if (location.hash !== '#beamin') return none;
  history.replaceState(null, '', location.pathname + location.search);
  const beam = createBeam(THREE);
  if (!beam.on) return none;
  beam.setAt(camera.position.x, camera.position.z); beam.set(1); scene.add(beam.mesh);
  const veil = document.createElement('div'); veil.id = 'beamin-veil';
  veil.style.cssText = `position:fixed;inset:0;background:${BEAM.fadeColor};opacity:1;pointer-events:none;z-index:6;transition:opacity ${beam.calm ? 0.9 : 0.6}s`;
  document.body.append(veil);
  let t0 = null, done = false;
  return {
    get active() { return !done; },
    update(t) { // t in seconds (animation-loop time)
      if (done) return;
      if (t0 === null) { t0 = t; requestAnimationFrame(() => { veil.style.opacity = 0; }); setTimeout(() => veil.remove(), 1200); } // first frame drawn: lift the flash
      const k = t - t0, u = Math.min(1, Math.max(0, (k - HOLD) / DISSOLVE)), l = 1 - u * u * (3 - 2 * u);
      beam.tick(t); beam.set(l);
      if (u >= 1) { done = true; scene.remove(beam.mesh); beam.mesh.geometry.dispose(); beam.mesh.material.dispose(); }
    },
  };
}
