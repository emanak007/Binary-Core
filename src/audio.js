// Sound helpers. If an ElevenLabs file exists in assets/audio/<key>.mp3 it is used;
// otherwise a tiny synthesized placeholder plays so the game is never silent.

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

function synth(scene, key) {
  const ctx = scene.sound.context;
  const tones = PRESETS[key];
  if (!ctx || !tones || scene.sound.mute) return;
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
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}

export function sfx(scene, key, volume = 0.6) {
  if (scene.cache.audio.exists(key)) scene.sound.play(key, { volume });
  else synth(scene, key);
}

export function ensureMusic(scene) {
  if (scene.registry.get('music') || !scene.cache.audio.exists('music')) return;
  const music = scene.sound.add('music', { loop: true, volume: 0.35 });
  music.play();
  scene.registry.set('music', music);
}
