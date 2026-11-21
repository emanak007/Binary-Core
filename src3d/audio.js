// Plain WebAudio sound for the 3D version (no Phaser).
// If assets/audio/<key>.mp3 exists it plays that; otherwise a tiny synth placeholder.
// Mixer: master <- music bus, sfx bus (voice lines play on the sfx bus).

export const SOUND_KEYS = [
  'step_solid', 'step_liquid', 'step_gas', 'bump', 'push', 'melt', 'boil', 'freeze',
  'fall', 'tether', 'fuse', 'deck_online', 'fail', 'undo', 'music', 'ui_move', 'ui_select', 'ui_back',
  'vo_1', 'vo_2', 'vo_3', 'vo_4', 'vo_5', 'vo_end',
];

// [startFreq, endFreq, duration, wave, volume, delay]
const PRESETS = {
  step_solid: [[120, 70, 0.08, 'sine', 0.3]],
  step_liquid: [[380, 620, 0.07, 'sine', 0.12], [620, 900, 0.05, 'sine', 0.06, 0.04]],
  step_gas: [[900, 1400, 0.12, 'triangle', 0.04]],
  bump: [[80, 60, 0.07, 'square', 0.06]],
  push: [[95, 70, 0.14, 'sawtooth', 0.06]],
  melt: [[300, 700, 0.18, 'sine', 0.1]],
  boil: [[500, 1500, 0.25, 'triangle', 0.06]],
  freeze: [[1600, 1100, 0.12, 'triangle', 0.06], [2100, 1500, 0.1, 'sine', 0.04, 0.05]],
  fall: [[500, 50, 0.6, 'sine', 0.15]],
  tether: [[523, 523, 0.35, 'sine', 0.06], [659, 659, 0.35, 'sine', 0.05, 0.05], [784, 784, 0.4, 'sine', 0.05, 0.1]],
  fuse: [[262, 262, 1.2, 'sine', 0.1], [392, 392, 1.2, 'sine', 0.08, 0.08], [523, 523, 1.2, 'sine', 0.08, 0.16], [784, 784, 1.4, 'sine', 0.07, 0.24]],
  deck_online: [[440, 440, 0.24, 'sine', 0.08, 0], [554.37, 554.37, 0.28, 'sine', 0.08, 0.06], [659.25, 659.25, 0.34, 'triangle', 0.07, 0.12], [880, 880, 0.55, 'sine', 0.09, 0.18]],
  fail: [[220, 90, 0.7, 'sawtooth', 0.06]],
  undo: [[700, 450, 0.07, 'sine', 0.06]],
  ui_move: [[1180, 1320, 0.045, 'sine', 0.035]],
  ui_select: [[520, 880, 0.12, 'triangle', 0.06], [880, 1320, 0.14, 'sine', 0.04, 0.05]],
  ui_back: [[700, 380, 0.11, 'sine', 0.05]],
};

let ctx = null;
let master = null, musicBus = null, sfxBus = null, duckGain = null;
let muted = false;
let music = null;
let musicWanted = false;
let voiceSrc = null;
const vol = { master: 0.8, music: 0.6, sfx: 0.8 };
// Alternative filenames tried in order (e.g. the BGM tracks you exported).
const ALIASES = { music: ['Open_Horizon', 'music', 'BGM1', 'BGM2'] };
const buffers = new Map();

function applyGains() {
  if (!ctx) return;
  master.gain.value = muted ? 0 : vol.master;
  musicBus.gain.value = vol.music;
  sfxBus.gain.value = vol.sfx;
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    duckGain = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(duckGain).connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
    applyGains();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// iOS Safari only lets audio start inside a user gesture: resume the context and play a
// silent buffer on every tap until it is running.
export function unlockAudio() {
  if (!ensureCtx() || ctx.state === 'running') return;
  try {
    ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* ignore */ }
}

export function setVolumes({ master: m, music: mu, sfx: s }) {
  Object.assign(vol, { master: m, music: mu, sfx: s });
  applyGains();
}

async function fetchBuffer(names) {
  for (const name of names) {
    try {
      const res = await fetch(`assets/audio/${name}.mp3`);
      if (!res.ok) continue;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch { /* try next */ }
  }
  return null;
}

// Call once after the first user gesture.
let loading = null;
export function initAudio() {
  if (!ensureCtx()) return Promise.resolve();
  loading ??= Promise.all(SOUND_KEYS.map(async (key) => {
    const buf = await fetchBuffer(ALIASES[key] ?? [key]);
    if (buf) buffers.set(key, buf);
  })).then(() => { if (musicWanted) startMusic(); });
  return loading;
}

function synth(key) {
  const tones = PRESETS[key];
  if (!tones) return;
  const now = ctx.currentTime;
  for (const [f0, f1, dur, type, v, delay = 0] of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = now + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}

export function sfx(key, volume = 0.6) {
  if (!ensureCtx() || muted) return;
  const buf = buffers.get(key);
  if (!buf) { synth(key); return; }
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain).connect(sfxBus);
  src.start();
}

export function startMusic() {
  musicWanted = true;
  if (music || !ensureCtx() || !buffers.has('music')) return;
  music = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.35;
  music.buffer = buffers.get('music');
  music.loop = true;
  music.connect(gain).connect(musicBus);
  music.start();
}

// Lower the music under cutscene voice-over.
export function duckMusic(on) {
  if (!ensureCtx()) return;
  duckGain.gain.setTargetAtTime(on ? 0.26 : 1, ctx.currentTime, 0.4);
}

// Voice lines: load on demand (cutscene keys aren't in SOUND_KEYS). Returns a buffer or null.
export async function loadVoice(key) {
  if (!key || !ensureCtx()) return null;
  if (buffers.has(key)) return buffers.get(key);
  const buf = await fetchBuffer([key, `${key}.mp3`]);
  if (buf) buffers.set(key, buf);
  return buf;
}
// Plays a loaded voice buffer, stopping any previous line. Returns its duration in seconds.
export function startVoice(buf) {
  stopVoice();
  if (!buf || !ensureCtx()) return 0;
  voiceSrc = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 1.25;
  voiceSrc.buffer = buf;
  voiceSrc.connect(gain).connect(sfxBus);
  voiceSrc.start();
  return buf.duration;
}
export function stopVoice() {
  try { voiceSrc?.stop(); } catch { /* already stopped */ }
  voiceSrc = null;
}

export function toggleMute() {
  muted = !muted;
  applyGains();
  return muted;
}

// ---------- cutscene audio cues (assets/audio/cs_*.mp3 overrides procedural synth) ----------

let cueNodes = [];
let cueScale = 1;
let noiseBuf = null;

function getNoiseBuffer() {
  if (noiseBuf || !ensureCtx()) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function stopCutsceneCue() {
  for (const n of cueNodes) {
    try { n.stop?.(); } catch { /* already stopped */ }
    try { n.disconnect?.(); } catch { /* ignore */ }
  }
  cueNodes = [];
}

function cueTone(t0, f0, f1, dur, type, peak, { attack = 0.2, filterFreq = 0 } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak * cueScale, t0 + Math.min(attack, dur * 0.4));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (filterFreq > 0) {
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(filterFreq, t0);
    osc.connect(flt).connect(gain).connect(sfxBus);
  } else {
    osc.connect(gain).connect(sfxBus);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  cueNodes.push(osc, gain);
}

function cueNoise(t0, dur, f0, f1, peak, { type = 'bandpass', q = 1.5, attack = 0.05 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer();
  src.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak * cueScale, t0 + Math.min(attack, dur * 0.4));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(flt).connect(gain).connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
  cueNodes.push(src, flt, gain);
}

export async function playCutsceneCue(key, { quiet = false, dur = 6 } = {}) {
  stopCutsceneCue();
  if (!key || !ensureCtx() || muted) return;
  cueScale = quiet ? 0.55 : 1;
  const buf = await loadVoice(key);
  if (buf) {
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = quiet ? 0.4 : 0.7;
    src.buffer = buf;
    src.connect(gain).connect(sfxBus);
    src.start();
    cueNodes.push(src, gain);
    return;
  }
  const t = ctx.currentTime;
  const d = Math.max(4.5, dur - 0.3);
  switch (key) {
    case 'cs_ship':
      cueTone(t, 68, 48, d, 'sine', 0.14, { attack: 1.0 });
      cueTone(t, 102, 72, Math.max(3.5, d - 0.3), 'triangle', 0.04, { attack: 1.1, filterFreq: 260 });
      cueNoise(t, Math.max(3.5, d - 0.2), 220, 90, 0.03, { type: 'lowpass', q: 0.7, attack: 1.2 });
      break;
    case 'cs_core':
      cueTone(t, 220, 220, d, 'sine', 0.06, { attack: 0.8 });
      cueTone(t + 0.15, 330, 330, Math.max(3.5, d - 0.2), 'sine', 0.05, { attack: 0.9 });
      cueTone(t + 0.35, 440, 442, Math.max(3.5, d - 0.4), 'triangle', 0.03, { attack: 1.0, filterFreq: 900 });
      break;
    case 'cs_fracture':
      // Rising overload build (0..1.72s) -> sub-boom + crackle impact synced to "fractured"
      cueTone(t, 90, 480, 1.7, 'sawtooth', 0.07, { attack: 1.35, filterFreq: 1200 });
      cueTone(t, 135, 700, 1.7, 'triangle', 0.05, { attack: 1.4 });
      cueTone(t + 1.68, 125, 34, 2.2, 'sine', 0.24, { attack: 0.02 });
      cueNoise(t + 1.68, 1.4, 2600, 140, 0.18, { type: 'lowpass', q: 1.2, attack: 0.01 });
      cueTone(t + 1.72, 1320, 440, 0.9, 'triangle', 0.05, { attack: 0.01 });
      break;
    case 'cs_apart':
      cueNoise(t, d, 1400, 700, 0.035, { type: 'bandpass', q: 2.5, attack: 0.8 });
      cueTone(t, 196, 174, Math.max(3.5, d - 0.2), 'sine', 0.06, { attack: 1.0 });
      cueTone(t + 0.4, 587, 523, Math.max(3.2, d - 1.0), 'sine', 0.025, { attack: 1.1 });
      break;
    case 'cs_crucible':
      cueTone(t, 110, 82, d, 'triangle', 0.08, { attack: 0.8, filterFreq: 340 });
      cueTone(t + 0.2, 165, 123, Math.max(3.5, d - 0.4), 'sine', 0.06, { attack: 0.9 });
      cueNoise(t, Math.max(3.5, d - 0.2), 480, 180, 0.03, { type: 'lowpass', q: 0.8, attack: 1.0 });
      break;
    case 'cs_title':
      cueTone(t, 130.8, 130.8, d, 'sine', 0.08, { attack: 0.9 });
      cueTone(t + 0.2, 196, 196, Math.max(3.5, d - 0.2), 'sine', 0.06, { attack: 1.0 });
      cueTone(t + 0.5, 261.6, 261.6, Math.max(3.2, d - 0.5), 'triangle', 0.04, { attack: 1.1, filterFreq: 1100 });
      cueTone(t + 0.9, 392, 392, Math.max(3.0, d - 0.9), 'sine', 0.04, { attack: 1.0 });
      break;
  }
}
