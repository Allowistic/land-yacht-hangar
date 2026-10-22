// A small generated lofi track: four-chord loop on soft keys, bass, a lazy
// swung beat, the odd melody note and vinyl hiss. Everything is synthesized,
// so there are no audio files to load.
//
// Phones only allow sound after a real tap (touch release or click, not a
// finger merely going down), so start() must be called from one of those, and
// it only counts as playing once the browser reports the audio as running.

const BPM = 74;
const SIXTEENTH = 60 / BPM / 4;
const SWING = 0.3; // delay on the off sixteenths, as a fraction of a sixteenth
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Fmaj9 - Em9 - Dm9 - Cmaj9, one bar each.
const CHORDS = [
  { root: 41, notes: [53, 57, 60, 64, 67] },
  { root: 40, notes: [52, 55, 59, 62, 66] },
  { root: 38, notes: [50, 53, 57, 60, 64] },
  { root: 36, notes: [48, 52, 55, 59, 62] },
];
const MELODY_NOTES = [72, 74, 76, 79, 81, 84];
// Steps (of 32, two bars) where a melody note may land.
const MELODY_STEPS = [2, 6, 11, 14, 18, 22, 26, 29];

export function createLofi({ onChange } = {}) {
  let ctx = null, bus = null, master = null, analyser = null, noise = null, crackle = null;
  let timer = null, nextTime = 0, step = 0;
  let wanted = false; // the listener asked for music
  let status = 'off'; // off | starting | on | paused | blocked
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function setStatus(s) { if (s !== status) { status = s; onChange && onChange(status); } }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { setStatus('blocked'); return false; }
    // iPhone: play through the silent switch like a music app would.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* ignore */ }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.75;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 4200; tone.Q.value = 0.4;
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(tone); tone.connect(comp); comp.connect(master); master.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Vinyl: soft hiss with sparse pops, looped under everything.
    crackle = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const cd = crackle.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      cd[i] = (Math.random() * 2 - 1) * 0.06;
      if (Math.random() < 0.00035) cd[i] += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
    }
    const vinyl = ctx.createBufferSource();
    vinyl.buffer = crackle; vinyl.loop = true;
    const vhp = ctx.createBiquadFilter(); vhp.type = 'highpass'; vhp.frequency.value = 1200;
    const vg = ctx.createGain(); vg.gain.value = 0.18;
    vinyl.connect(vhp); vhp.connect(vg); vg.connect(bus);
    vinyl.start();

    ctx.onstatechange = () => {
      if (!ctx) return;
      if (ctx.state === 'running' && wanted) { startScheduler(); setStatus('on'); }
      else if (ctx.state !== 'running' && status === 'on') { stopScheduler(); setStatus(wanted ? 'starting' : 'paused'); }
    };
    return true;
  }

  function env(gainNode, t, peak, attack, decay, sustain, end) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), t + attack + decay);
    g.exponentialRampToValueAtTime(0.0001, end);
  }

  function keyNote(m, t, dur, vel) {
    const f = mtof(m);
    const det = (rnd() - 0.5) * 12; // a little tape wobble
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f; o1.detune.value = det;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; o2.detune.value = det;
    const g = ctx.createGain(); const g2 = ctx.createGain();
    env(g, t, 0.075 * vel, 0.012, 0.35, 0.45, t + dur);
    env(g2, t, 0.03 * vel, 0.005, 0.12, 0.1, t + dur * 0.6);
    o1.connect(g); o2.connect(g2); g.connect(bus); g2.connect(bus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function bass(m, t, dur, vel) {
    const f = mtof(m);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    // The octave above is what a phone speaker can actually reproduce.
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    const g = ctx.createGain(); const g2 = ctx.createGain();
    env(g, t, 0.42 * vel, 0.01, 0.25, 0.6, t + dur);
    env(g2, t, 0.12 * vel, 0.01, 0.2, 0.5, t + dur);
    o.connect(g); o2.connect(g2); g.connect(bus); g2.connect(bus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function bell(m, t, vel) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
    const g = ctx.createGain();
    env(g, t, 0.06 * vel, 0.006, 0.6, 0.25, t + 1.6);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 1.7);
  }

  function kick(t, vel) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4);
  }

  function noiseHit(t, type, freq, q, peak, decay) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + decay + 0.02);
  }

  function snare(t, vel) {
    noiseHit(t, 'bandpass', 1900, 0.7, 0.32 * vel, 0.2);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.1);
  }

  function scheduleStep(n, t) {
    const s16 = n % 16;
    const bar = Math.floor(n / 16);
    const chord = CHORDS[bar % CHORDS.length];
    const beat = 60 / BPM;
    if (s16 === 0) chord.notes.forEach((m, i) => keyNote(m, t + i * 0.012, beat * 2.2, 0.9));
    if (s16 === 10) chord.notes.slice(1).forEach((m, i) => keyNote(m, t + i * 0.01, beat * 1.4, 0.65));
    if (s16 === 0) bass(chord.root, t, beat * 1.6, 1);
    if (s16 === 7) bass(chord.root, t, beat * 0.4, 0.6);
    if (s16 === 10) bass(chord.root + 7, t, beat * 1.1, 0.8);
    if (s16 === 0 || s16 === 10) kick(t, 1);
    if (s16 === 7 && bar % 2 === 1) kick(t, 0.55);
    if (s16 === 4 || s16 === 12) snare(t, 1);
    if (s16 % 2 === 0) noiseHit(t, 'highpass', 7200, 0.5, s16 % 4 === 0 ? 0.07 : 0.045, 0.045);
    else if (rnd() < 0.18) noiseHit(t, 'highpass', 7600, 0.5, 0.025, 0.03);
    const s32 = n % 32;
    if (MELODY_STEPS.includes(s32) && rnd() < 0.55) bell(MELODY_NOTES[Math.floor(rnd() * MELODY_NOTES.length)], t, 0.8 + rnd() * 0.2);
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const horizon = ctx.currentTime + 0.18;
    while (nextTime < horizon) {
      const swing = step % 2 === 1 ? SWING * SIXTEENTH : 0;
      scheduleStep(step, nextTime + swing);
      nextTime += SIXTEENTH;
      step++;
    }
  }
  function startScheduler() {
    if (timer) return;
    nextTime = Math.max(nextTime, ctx.currentTime + 0.06);
    tick();
    timer = setInterval(tick, 25);
  }
  function stopScheduler() { clearInterval(timer); timer = null; }

  // Call from a real tap, click, key press, or VR trigger.
  function start() {
    wanted = true;
    if (!ctx && !build()) return Promise.resolve(false);
    if (ctx.state === 'running') { startScheduler(); setStatus('on'); return Promise.resolve(true); }
    setStatus('starting');
    // A silent blip inside the tap itself helps older iPhones unlock audio.
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (_) { /* ignore */ }
    let p;
    try { p = ctx.resume(); } catch (_) { p = null; }
    return Promise.resolve(p).catch(() => {}).then(() => {
      if (ctx.state === 'running' && wanted) { startScheduler(); setStatus('on'); return true; }
      // Not allowed yet: stay ready so the next tap tries again.
      setStatus('off');
      return false;
    });
  }
  function pause() {
    wanted = false;
    stopScheduler();
    setStatus('paused');
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }
  function toggle() { return status === 'on' || status === 'starting' ? (pause(), Promise.resolve(false)) : start(); }
  // For any tap anywhere: start the first time, and recover after the phone
  // interrupted the audio (a call, the lock screen), unless the user paused it.
  function onGesture() {
    if (status === 'paused' || status === 'blocked') return;
    if (status === 'on' && ctx && ctx.state === 'running') return;
    start();
  }
  function level() {
    if (!analyser) return 0;
    const d = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(d);
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    return Math.sqrt(s / d.length);
  }
  return {
    start, pause, toggle, onGesture, level,
    get status() { return status; },
    get contextState() { return ctx ? ctx.state : 'none'; },
  };
}
