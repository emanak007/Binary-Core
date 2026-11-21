// Persistent settings + progress. Every storage access is guarded: private windows,
// blocked storage or previews must still work (values just won't persist).

const KEY_SETTINGS = 'binarycore.settings.v1';
const KEY_PROGRESS = 'binarycore.progress.v1';

function read(key, defaults) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === 'object' ? { ...defaults, ...v } : { ...defaults };
  } catch { return { ...defaults }; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not persisted */ }
}

// Phones/tablets default to bloom off (still toggleable) for performance.
const MOBILE = (() => {
  try { return matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch'); } catch { return false; }
})();
export const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.6, sfx: 0.8, bloom: !MOBILE, shake: true, reducedMotion: false,
};
export const settings = read(KEY_SETTINGS, DEFAULT_SETTINGS);
const listeners = new Set();

export function onSettings(fn) { listeners.add(fn); fn(settings); }
export function setSetting(key, value) {
  settings[key] = value;
  write(KEY_SETTINGS, settings);
  for (const fn of listeners) fn(settings);
}

const DEFAULT_PROGRESS = { unlocked: 1, best: {}, seenIntro: false };
export const progress = read(KEY_PROGRESS, DEFAULT_PROGRESS);
if (!progress.best || typeof progress.best !== 'object') progress.best = {};

export function recordWin(levelIndex, turns) {
  progress.unlocked = Math.max(progress.unlocked, levelIndex + 2);
  const prev = progress.best[levelIndex];
  if (prev == null || turns < prev) progress.best[levelIndex] = turns;
  write(KEY_PROGRESS, progress);
}
export function markIntroSeen() { progress.seenIntro = true; write(KEY_PROGRESS, progress); }
export function resetProgress() {
  Object.assign(progress, { unlocked: 1, best: {}, seenIntro: false });
  write(KEY_PROGRESS, progress);
}
export const hasProgress = () => progress.unlocked > 1 || Object.keys(progress.best).length > 0;
