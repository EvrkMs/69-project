// All sound is synthesised with the Web Audio API: no audio files, nothing to download, nothing for CSP to allow.
// Browsers keep audio locked until the first click or key press, so the context is created lazily on that gesture.
// Every call is a no-op while audio is locked or muted, so game code can call sfx() freely.

const STORE_KEY = 'arch69.muted';
let ac = null, master = null, noiseBuf = null;
let muted = readMuted();
let ambience = null;           // { gain, stop() } of the current background bed
let hold = null;               // rising tone while a hold-button is pressed

function readMuted() { try { return localStorage.getItem(STORE_KEY) === '1'; } catch { return false; } }
function writeMuted(v) { try { localStorage.setItem(STORE_KEY, v ? '1' : '0'); } catch { /* private mode: not remembered */ } }

const rand = (a, b) => a + Math.random() * (b - a);

function ready() {
  if (!ac || ac.state !== 'running' || muted) return false;
  return true;
}

/** Call once; builds the audio graph on the first user gesture. */
export function initAudio() {
  const unlock = () => {
    if (!ac) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      ac = new Ctor();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    if (pendingAmbience) setAmbience(pendingAmbience);
  };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, unlock, { capture: true });
  // every button in the UI clicks, whichever screen it lives on
  addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) sfx('click'); }, { capture: true });
}

export const isMuted = () => muted;

export function setMuted(v) {
  muted = v;
  writeMuted(v);
  if (master) master.gain.setTargetAtTime(v ? 0 : 0.6, ac.currentTime, 0.05);
}

// ---------- building blocks ----------

function tone(freq, dur, { type = 'sine', vol = 0.1, to = null, delay = 0, attack = 0.005 } = {}) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { type = 'lowpass', from = 800, to = null, vol = 0.1, delay = 0, q = 0.7, attack = 0.005 } = {}) {
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loopStart = rand(0, 1);
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, src.loopStart); src.stop(t + dur + 0.02);
}

const bell = (f, delay = 0, vol = 0.08) => {
  tone(f, 0.9, { vol, delay, attack: 0.003 });
  tone(f * 2.76, 0.5, { vol: vol * 0.3, delay });
};

// ---------- one-shot effects ----------

const effects = {
  click: () => tone(rand(780, 840), 0.05, { type: 'square', vol: 0.035, to: 520 }),
  step: () => {
    noise(0.07, { from: rand(380, 560), vol: 0.07 });
    tone(rand(80, 100), 0.06, { vol: 0.05, to: 50 });
  },
  hero: () => tone(rand(300, 350), 0.045, { type: 'triangle', vol: 0.05 }),
  npc: () => tone(rand(210, 260), 0.045, { type: 'square', vol: 0.025 }),
  next: () => tone(520, 0.05, { type: 'triangle', vol: 0.04, to: 700 }),
  fact: () => { bell(660); bell(990, 0.12, 0.06); },
  task: () => [523, 659, 784].forEach((f, i) => bell(f, i * 0.09, 0.06)),
  announce: () => { bell(880, 0, 0.07); bell(1320, 0.15, 0.05); },
  pop: () => tone(rand(560, 760), 0.06, { vol: 0.025, to: rand(900, 1100) }),
  door: () => {
    tone(140, 0.3, { type: 'sawtooth', vol: 0.04, to: 90 });
    noise(0.6, { from: 250, to: 1400, vol: 0.09, attack: 0.05 });
    bell(784, 0.35, 0.05);
  },
  whoosh: () => noise(0.55, { type: 'bandpass', from: 250, to: 2600, vol: 0.12, q: 0.9, attack: 0.12 }),
  key: () => noise(0.025, { type: 'highpass', from: rand(2200, 3400), vol: 0.05 }),
  portal: () => { tone(330, 0.25, { type: 'triangle', vol: 0.06, to: 660 }); noise(0.3, { type: 'bandpass', from: 400, to: 1800, vol: 0.05 }); },
};

/** Plays a named effect (see `effects`). */
export function sfx(name) {
  if (!ready()) return;
  const fn = effects[name];
  if (fn) fn();
}

// ---------- hold-to-confirm tone ----------

/** Rising tone while the player holds the action button; `progress` is 0..1. Call with held=false to let it fall away. */
export function holdTone(progress, held) {
  if (!ready()) { stopHold(); return; }
  if (!hold) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; g.gain.value = 0;
    o.connect(g).connect(master); o.start();
    hold = { o, g };
  }
  const t = ac.currentTime;
  hold.o.frequency.setTargetAtTime(180 + 520 * progress, t, 0.03);
  hold.g.gain.setTargetAtTime(held && progress > 0 ? 0.05 : 0, t, 0.05);
}

export function stopHold() {
  if (!hold) return;
  const { o, g } = hold;
  hold = null;
  try { g.gain.setTargetAtTime(0, ac.currentTime, 0.03); o.stop(ac.currentTime + 0.2); } catch { /* already stopped */ }
}

// ---------- ambience ----------

let pendingAmbience = null;

/** Background bed for the current scene: 'room' (hum), 'outdoor' (wind, birds) or 'dark' (drone, drips). */
export function setAmbience(kind) {
  pendingAmbience = kind;
  if (!ac || !master) return; // starts after the first gesture
  if (ambience && ambience.kind === kind) return;
  if (ambience) { const old = ambience; ambience = null; old.stop(); }
  ambience = beds[kind] ? beds[kind]() : null;
  if (ambience) ambience.kind = kind;
}

function bed(build) {
  const g = ac.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(1, ac.currentTime, 0.8);
  g.connect(master);
  const nodes = [], timers = [];
  build({ out: g, nodes, timers });
  return {
    stop() {
      timers.forEach(clearInterval);
      g.gain.setTargetAtTime(0, ac.currentTime, 0.3);
      setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* not a source */ } }); g.disconnect(); }, 1500);
    },
  };
}

function loopNoise(out, nodes, { type, freq, vol, q = 0.7 }) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(out); s.start();
  nodes.push(s);
  return { g, f };
}

function lfo(target, rate, depth) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = rate; g.gain.value = depth;
  o.connect(g).connect(target); o.start();
  return o;
}

const beds = {
  room: () => bed(({ out, nodes }) => {
    loopNoise(out, nodes, { type: 'lowpass', freq: 160, vol: 0.18 });
    const hum = ac.createOscillator(), hg = ac.createGain();
    hum.frequency.value = 50; hg.gain.value = 0.012;
    hum.connect(hg).connect(out); hum.start(); nodes.push(hum);
  }),

  outdoor: () => bed(({ out, nodes, timers }) => {
    const { g } = loopNoise(out, nodes, { type: 'bandpass', freq: 520, vol: 0.05, q: 0.5 });
    nodes.push(lfo(g.gain, 0.12, 0.03));
    timers.push(setInterval(() => { // an occasional bird
      if (!ready() || Math.random() < 0.5) return;
      const f = rand(2400, 3600), n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) tone(f * rand(0.92, 1.1), 0.07, { vol: 0.02, delay: i * 0.1, to: f * 1.25 });
    }, 2600));
  }),

  dark: () => bed(({ out, nodes, timers }) => {
    for (const [f, v] of [[55, 0.06], [82.6, 0.035], [58.3, 0.03]]) {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 220; g.gain.value = v;
      o.connect(lp).connect(g).connect(out); o.start(); nodes.push(o);
      nodes.push(lfo(g.gain, rand(0.05, 0.12), v * 0.6));
    }
    timers.push(setInterval(() => { // a drip somewhere in the dark
      if (!ready() || Math.random() < 0.6) return;
      tone(rand(900, 1300), 0.12, { vol: 0.04, to: 500 });
      tone(rand(900, 1300), 0.3, { vol: 0.015, delay: 0.18, to: 480 });
    }, 3200));
  }),
};
