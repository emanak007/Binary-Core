// Plain WebAudio sound for the 3D version (no Phaser).
// If assets/audio/<key>.mp3 exists it plays that; otherwise a tiny synth placeholder.
// Mixer: master <- music bus, sfx bus (voice lines play on the sfx bus).

export const SOUND_KEYS = [
  'step_solid', 'step_liquid', 'step_gas', 'bump', 'push', 'melt', 'boil', 'freeze',
  'fall', 'tether', 'fuse', 'fail', 'undo', 'music', 'ui_move', 'ui_select', 'ui_back',
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
const ALIASES = { music: ['music', 'BGM1', 'BGM2'] };
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
  duckGain.gain.setTargetAtTime(on ? 0.45 : 1, ctx.currentTime, 0.4);
}

// Voice lines: load on demand (cutscene keys aren't in SOUND_KEYS). Returns a buffer or null.
export async function loadVoice(key) {
  if (!key || !ensureCtx()) return null;
  if (buffers.has(key)) return buffers.get(key);
  const buf = await fetchBuffer([key]);
  if (buf) buffers.set(key, buf);
  return buf;
}
// Plays a loaded voice buffer, stopping any previous line. Returns its duration in seconds.
export function startVoice(buf) {
  stopVoice();
  if (!buf || !ensureCtx()) return 0;
  voiceSrc = ctx.createBufferSource();
  voiceSrc.buffer = buf;
  voiceSrc.connect(sfxBus);
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
