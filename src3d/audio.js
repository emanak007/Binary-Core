// Plain WebAudio sound for the 3D version (no Phaser).
// If assets/audio/<key>.mp3 exists it plays that; otherwise a tiny synth placeholder.

export const SOUND_KEYS = [
  'step_solid', 'step_liquid', 'step_gas', 'bump', 'push', 'melt', 'boil', 'freeze',
  'fall', 'tether', 'fuse', 'fail', 'undo', 'music',
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
};

let ctx = null;
let master = null;
let muted = false;
let music = null;
let musicWanted = false;
// Alternative filenames tried in order (e.g. the BGM tracks you exported).
const ALIASES = { music: ['music', 'BGM1', 'BGM2'] };
const buffers = new Map();

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Call once after the first user gesture.
export async function initAudio() {
  if (!ensureCtx()) return;
  await Promise.all(SOUND_KEYS.map(async (key) => {
    try {
      for (const name of ALIASES[key] ?? [key]) {
        const res = await fetch(`assets/audio/${name}.mp3`);
        if (!res.ok) continue;
        buffers.set(key, await ctx.decodeAudioData(await res.arrayBuffer()));
        break;
      }
    } catch { /* missing or undecodable: synth fallback */ }
  }));
  if (musicWanted) startMusic(); // music was requested before it finished loading
}

function synth(key) {
  const tones = PRESETS[key];
  if (!tones) return;
  const now = ctx.currentTime;
  for (const [f0, f1, dur, type, vol, delay = 0] of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = now + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
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
  src.connect(gain).connect(master);
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
  music.connect(gain).connect(master);
  music.start();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  return muted;
}
