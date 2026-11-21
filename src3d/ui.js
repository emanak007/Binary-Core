// Menus: main menu, chapter select, settings, credits, pause, end screen, confirm dialog.
// Keyboard (arrows/WASD, Enter, Esc) and mouse. While any screen or cutscene is open,
// this module consumes all key events so gameplay input is disabled.
import { LEVELS } from './levels.js';
import { settings, setSetting, progress, resetProgress, markIntroSeen, hasProgress } from './store.js';
import { sfx, initAudio, startMusic, unlockAudio } from './audio.js';
import { playCutscene } from './cutscene.js';
import { renderShipStatus } from './shipstatus.js';

let api = null; // set by initUI (game.js)
const root = document.getElementById('ui');
const stack = [];
let cutscene = null;

export const isOpen = () => stack.length > 0 || !!cutscene;
const top = () => stack[stack.length - 1];
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const pad = (n) => String(n).padStart(2, '0');

function sync() {
  document.body.classList.toggle('ui-open', isOpen());
  document.body.classList.toggle('menu-dim', stack.some((s) => s.dim));
}

// ---------- generic screen / navigation ----------

function makeScreen(cls, html, opts = {}) {
  const el = h(`<section class="screen ${cls}">${html}</section>`);
  root.appendChild(el);
  const s = { el, index: 0, ...opts };
  s.items = () => [...el.querySelectorAll('[data-nav]')];
  el.addEventListener('pointerover', (e) => {
    const it = e.target.closest('[data-nav]');
    if (!it || top() !== s) return;
    const i = s.items().indexOf(it);
    if (i >= 0 && i !== s.index) focus(s, i);
  });
  el.querySelector('.back-chip')?.addEventListener('click', () => { if (top() === s) s.onBack?.(); });
  el.addEventListener('click', (e) => {
    const it = e.target.closest('[data-nav]');
    if (it && top() === s && !e.target.closest('.track')) activate(it);
  });
  return s;
}

function focus(s, i, sound = true) {
  const items = s.items();
  if (!items.length) return;
  i = s.grid ? Math.max(0, Math.min(items.length - 1, i)) : (i + items.length) % items.length;
  if (sound && i !== s.index) sfx('ui_move', 0.5);
  s.index = i;
  items.forEach((it, k) => it.classList.toggle('focus', k === i));
  items[i].scrollIntoView?.({ block: 'nearest' });
  s.onFocus?.(items[i], i);
}

function activate(it) {
  if (it.classList.contains('disabled')) {
    sfx('bump', 0.4);
    it.classList.remove('nope'); void it.offsetWidth; it.classList.add('nope');
    return;
  }
  if (it.onActivate) { sfx('ui_select', 0.55); it.onActivate(); }
}

function gridCols(s) {
  const items = s.items();
  if (!items.length) return 1;
  const y0 = items[0].offsetTop;
  return Math.max(1, items.filter((it) => it.offsetTop === y0).length);
}

function open(s) {
  top()?.el.classList.remove('active');
  stack.push(s);
  s.onOpen?.();
  s.el.classList.add('active');
  const items = s.items();
  const first = items.findIndex((it) => !it.classList.contains('disabled'));
  focus(s, s.keepIndex ? s.index : Math.max(0, first), false);
  sync();
}
function close(sound = true) {
  const s = stack.pop();
  if (!s) return;
  s.el.classList.remove('active');
  top()?.el.classList.add('active');
  if (sound) sfx('ui_back', 0.5);
  sync();
}
function closeAll() {
  while (stack.length) close(false);
}

// Audio needs a user gesture; any key or click unlocks it and starts the music (idempotent).
let gestured = false;
function gesture() {
  unlockAudio(); // every gesture, until the context is actually running (iOS)
  if (gestured) return;
  gestured = true;
  initAudio();
  startMusic();
}
for (const type of ['pointerdown', 'touchend', 'click']) addEventListener(type, gesture, true);

addEventListener('keydown', (ev) => {
  gesture();
  if (cutscene) { ev.stopImmediatePropagation(); ev.preventDefault(); cutscene.key(ev, true); return; }
  const s = top();
  if (!s) return;
  ev.stopImmediatePropagation();
  const items = s.items();
  const it = items[s.index];
  const cols = s.grid ? gridCols(s) : 1;
  switch (ev.code) {
    case 'ArrowUp': case 'KeyW': focus(s, s.index - cols); break;
    case 'ArrowDown': case 'KeyS': focus(s, s.index + cols); break;
    case 'ArrowLeft': case 'KeyA': if (it?.onAdjust) it.onAdjust(-1); else if (s.grid) focus(s, s.index - 1); break;
    case 'ArrowRight': case 'KeyD': if (it?.onAdjust) it.onAdjust(1); else if (s.grid) focus(s, s.index + 1); break;
    case 'Enter': case 'Space': if (it && !ev.repeat) activate(it); break;
    case 'Escape': case 'Backspace': if (!ev.repeat) s.onBack?.(); break;
    default: return;
  }
  ev.preventDefault();
}, true);
addEventListener('keyup', (ev) => { if (cutscene) cutscene.key(ev, false); }, true);

// ---------- widgets ----------

function button(label, onActivate, { sub = '', disabled = false, cls = '' } = {}) {
  const el = h(`<div class="menu-btn ${cls}${disabled ? ' disabled' : ''}" role="button" data-nav>
    <span class="lbl">${label}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`);
  el.onActivate = onActivate;
  return el;
}

function slider(label, key) {
  const el = h(`<div class="opt" data-nav><span class="opt-label">${label}</span>
    <div class="opt-ctl"><span class="arrow">‹</span><div class="track"><div class="fill"></div><div class="knob"></div></div>
    <span class="arrow">›</span><span class="val"></span></div></div>`);
  const fill = el.querySelector('.fill'), knob = el.querySelector('.knob'), val = el.querySelector('.val');
  const render = () => {
    const v = settings[key];
    fill.style.width = `${v * 100}%`;
    knob.style.left = `${v * 100}%`;
    val.textContent = `${Math.round(v * 100)}`;
  };
  const set = (v) => { setSetting(key, Math.round(Math.max(0, Math.min(1, v)) * 20) / 20); render(); };
  el.onAdjust = (d) => { set(settings[key] + d * 0.1); sfx('ui_move', 0.6); };
  el.onActivate = null;
  const track = el.querySelector('.track');
  const fromPointer = (e) => { const r = track.getBoundingClientRect(); set((e.clientX - r.left) / r.width); };
  track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); fromPointer(e); });
  track.addEventListener('pointermove', (e) => { if (track.hasPointerCapture(e.pointerId)) fromPointer(e); });
  el.querySelectorAll('.arrow').forEach((a, i) => a.addEventListener('click', (e) => { e.stopPropagation(); el.onAdjust(i ? 1 : -1); }));
  el.render = render;
  render();
  return el;
}

function toggle(label, get, set) {
  const el = h(`<div class="opt" data-nav><span class="opt-label">${label}</span>
    <div class="opt-ctl"><div class="pill"><span class="off">OFF</span><span class="on">ON</span></div></div></div>`);
  const render = () => el.classList.toggle('is-on', !!get());
  el.onActivate = () => { set(!get()); setTimeout(render, 60); render(); };
  el.onAdjust = (d) => { if ((d > 0) !== !!get()) { set(d > 0); sfx('ui_move', 0.6); render(); setTimeout(render, 60); } };
  el.render = render;
  render();
  return el;
}

// ---------- screens ----------

let main, chapters, settingsScreen, credits, pause, end, confirm;

function buildMain() {
  main = makeScreen('screen-main', `
    <div class="menu-shade"></div>
    <div class="main-wrap">
      <div class="eyebrow"><span class="dot"></span>STARSHIP MERIDIAN · REACTOR CONTROL</div>
      <h1 class="logo"><span class="l1">BINARY</span><span class="l2">CORE</span></h1>
      <div class="tagline">TWO ELEMENTS. ONE CRUCIBLE. FUSE OR FADE.</div>
      <nav class="menu-list"></nav>
    </div>
    <div class="corner corner-left">JAM BUILD 0.1</div>
    <div class="corner corner-right"><b>↑↓</b> SELECT &nbsp;&nbsp; <b>ENTER</b> CONFIRM</div>`, {
    onBack: () => {},
    onOpen: () => {
      const list = main.el.querySelector('.menu-list');
      list.innerHTML = '';
      const cont = Math.min(progress.unlocked, LEVELS.length) - 1;
      list.append(
        button('CONTINUE', () => startLevel(cont), {
          disabled: !hasProgress(), sub: hasProgress() ? `DECK ${pad(cont + 1)} · ${LEVELS[cont].name.toUpperCase()}` : '',
        }),
        button('NEW GAME', newGame),
        button('CHAPTER SELECT', () => open(chapters)),
        button('SETTINGS', () => open(settingsScreen)),
        button('CREDITS', () => open(credits)),
      );
      api.showMenuBackground();
    },
  });
}

let shipHandle = null;
function buildChapters() {
  chapters = makeScreen('screen-chapters panel-screen', `
    <div class="menu-shade full"></div>
    <div class="back-chip" role="button">‹ BACK</div>
    <header class="screen-head chapters-head">
      <div><div class="eyebrow">SELECT A DECK</div><h2>CHAPTER SELECT</h2></div>
      <div class="chapters-ship"></div>
    </header>
    <div class="cards"></div>
    <div class="corner corner-right"><b>ARROWS</b> SELECT &nbsp;&nbsp; <b>ENTER</b> PLAY &nbsp;&nbsp; <b>ESC</b> BACK</div>`, {
    grid: true, dim: true,
    onBack: () => close(),
    onFocus: (it) => { const d = it?.dataset.deck; shipHandle?.setHighlight(d != null ? Number(d) : -1); },
    onOpen: () => {
      const solved = new Set(Object.keys(progress.best).map(Number));
      shipHandle = renderShipStatus(chapters.el.querySelector('.chapters-ship'), { total: LEVELS.length, solved, compact: true });
      const wrap = chapters.el.querySelector('.cards');
      wrap.innerHTML = '';
      const prologue = h(`<div class="card prologue" data-nav>
        <div class="card-num">00</div><div class="card-kicker">PROLOGUE</div><div class="card-name">The Fracture</div>
        <div class="card-foot"><span class="play">▶</span> WATCH INTRO</div></div>`);
      prologue.onActivate = () => watchIntro();
      wrap.append(prologue);
      LEVELS.forEach((lv, i) => {
        const locked = i + 1 > progress.unlocked;
        const best = progress.best[i];
        const card = h(`<div class="card${locked ? ' disabled locked' : ''}${best != null ? ' solved' : ''}" data-deck="${i}" data-nav>
          <div class="card-num">${pad(i + 1)}</div><div class="card-kicker">DECK</div>
          <div class="card-name">${locked ? '— — —' : lv.name}</div>
          <div class="card-foot">${locked ? '<span class="lock"></span> LOCKED' : best != null ? `BEST <b>${best}</b> TURNS` : 'UNSOLVED'}</div></div>`);
        card.onActivate = () => startLevel(i);
        wrap.append(card);
      });
      if (progress.best[LEVELS.length - 1] != null) {
        const epilogue = h(`<div class="card prologue" data-nav>
          <div class="card-num">★</div><div class="card-kicker">EPILOGUE</div><div class="card-name">The Bond Holds</div>
          <div class="card-foot"><span class="play">▶</span> WATCH ENDING</div></div>`);
        epilogue.onActivate = () => {
          api.setMode('cutscene');
          runCutscene('ending', () => api.setMode('menu'));
        };
        wrap.append(epilogue);
      }
    },
  });
}

function buildSettings() {
  settingsScreen = makeScreen('screen-settings panel-screen', `
    <div class="menu-shade full"></div>
    <div class="back-chip" role="button">‹ BACK</div>
    <header class="screen-head"><div class="eyebrow">SYSTEM CONFIGURATION</div><h2>SETTINGS</h2></header>
    <div class="settings-grid">
      <div class="panel opts"></div>
      <div class="panel controls-ref">
        <div class="panel-title">CONTROLS</div>
        <dl>
          <dt>ARROWS / WASD</dt><dd>Move both elements</dd>
          <dt>Q &nbsp;/&nbsp; E</dt><dd>Rotate camera</dd>
          <dt>Z</dt><dd>Undo</dd>
          <dt>R</dt><dd>Restart deck</dd>
          <dt>M</dt><dd>Mute</dd>
          <dt>ESC</dt><dd>Pause</dd>
          <dt>ENTER</dt><dd>Next deck / confirm</dd>
        </dl>
      </div>
    </div>
    <div class="corner corner-right"><b>↑↓</b> SELECT &nbsp;&nbsp; <b>←→</b> ADJUST &nbsp;&nbsp; <b>ESC</b> BACK</div>`, {
    dim: true, keepIndex: true,
    onBack: () => close(),
    onOpen: () => settingsScreen.el.querySelectorAll('[data-nav]').forEach((o) => o.render?.()),
  });
  const opts = settingsScreen.el.querySelector('.opts');
  const group = (t) => h(`<div class="group-title">${t}</div>`);
  const fs = () => !!document.fullscreenElement;
  opts.append(
    group('AUDIO'),
    slider('MASTER VOLUME', 'master'),
    slider('MUSIC', 'music'),
    slider('EFFECTS', 'sfx'),
    group('VIDEO'),
    toggle('BLOOM', () => settings.bloom, (v) => setSetting('bloom', v)),
    toggle('SCREEN SHAKE', () => settings.shake, (v) => setSetting('shake', v)),
    toggle('REDUCED MOTION', () => settings.reducedMotion, (v) => setSetting('reducedMotion', v)),
    toggle('FULLSCREEN', fs, (v) => {
      try { if (v && !fs()) document.documentElement.requestFullscreen?.(); else if (!v && fs()) document.exitFullscreen?.(); } catch { /* blocked */ }
    }),
    group('DATA'),
    button('RESET PROGRESS', () => askConfirm('RESET ALL PROGRESS?', 'Unlocked decks and best turns will be erased.', 'RESET', () => {
      resetProgress();
    }), { cls: 'danger small' }),
    button('BACK', () => close(), { cls: 'small' }),
  );
  document.addEventListener('fullscreenchange', () => opts.querySelectorAll('[data-nav]').forEach((o) => o.render?.()));
}

function buildCredits() {
  credits = makeScreen('screen-credits panel-screen', `
    <div class="menu-shade full"></div>
    <div class="credits-roll">
      <h2>BINARY CORE</h2>
      <div class="cr"><span>DESIGN &amp; CODE</span><b>Emanak + Claude</b></div>
      <div class="cr"><span>ART</span><b>Gemini</b></div>
      <div class="cr"><span>AUDIO</span><b>ElevenLabs</b></div>
      <div class="cr"><span>BUILT WITH</span><b>Three.js</b></div>
      <div class="cr-note">Made in five hours for a game jam.</div>
      <nav class="menu-list center"></nav>
    </div>`, { dim: true, onBack: () => close() });
  credits.el.querySelector('.menu-list').append(button('BACK', () => close(), { cls: 'small' }));
}

function buildPause() {
  pause = makeScreen('screen-pause panel-screen', `
    <div class="menu-shade blur"></div>
    <div class="pause-wrap">
      <div class="eyebrow pause-chamber"></div>
      <h2>PAUSED</h2>
      <nav class="menu-list center"></nav>
    </div>`, {
    onBack: () => resume(),
    onOpen: () => {
      const info = api.levelInfo();
      pause.el.querySelector('.pause-chamber').textContent = `DECK ${pad(info.index + 1)} · ${info.name.toUpperCase()}`;
      pause.el.querySelector('.skip-btn')?.classList.toggle('disabled', !!info.last);
    },
  });
  pause.el.querySelector('.menu-list').append(
    button('RESUME', () => resume()),
    button('RESTART DECK', () => { close(false); api.restart(); }),
    button('SKIP DECK', () => askConfirm('SKIP THIS DECK?',
      'The next deck unlocks now. You can come back to this one any time from Chapter Select.', 'SKIP',
      () => { closeAll(); api.skipDeck(); }), { cls: 'skip-btn' }),
    button('SETTINGS', () => open(settingsScreen)),
    button('MAIN MENU', () => showMainMenu()),
  );
}

function buildEnd() {
  end = makeScreen('screen-end panel-screen', `
    <div class="menu-shade full warm"></div>
    <div class="end-wrap">
      <div class="eyebrow">ALL DECKS ONLINE</div>
      <h2 class="end-title">THE BOND HOLDS</h2>
      <p class="end-text">At the heart of the ship, Sol and Cryo fuse, and this time they stay as one.<br>The reactor roars back to life, and the Meridian wakes.</p>
      <div class="end-ship"></div>
      <div class="stats"><div><b class="st-ch"></b><span>DECKS RELIT</span></div><div><b class="st-turns"></b><span>TOTAL TURNS</span></div></div>
      <nav class="menu-list center"></nav>
    </div>`, { onBack: () => showMainMenu() });
  end.el.querySelector('.menu-list').append(button('MAIN MENU', () => showMainMenu()));
}

function buildConfirm() {
  confirm = makeScreen('screen-confirm', `
    <div class="menu-shade blur"></div>
    <div class="dialog panel"><h3></h3><p></p><nav class="menu-list row"></nav></div>`, { onBack: () => close() });
}

function askConfirm(title, text, okLabel, onOk) {
  confirm.el.querySelector('h3').textContent = title;
  confirm.el.querySelector('p').textContent = text;
  const nav = confirm.el.querySelector('.menu-list');
  nav.innerHTML = '';
  nav.append(button('CANCEL', () => close(), { cls: 'small' }), button(okLabel, () => { onOk(); close(); }, { cls: 'small danger' }));
  confirm.index = 0;
  open(confirm);
}

// ---------- flow ----------

function startLevel(i) {
  closeAll();
  api.startLevel(i);
}

function newGame() {
  closeAll();
  api.resetRun();
  api.setMode('cutscene');
  runCutscene('intro', () => { markIntroSeen(); api.startLevel(0); });
}

function watchIntro() {
  api.setMode('cutscene');
  runCutscene('intro', () => { markIntroSeen(); api.setMode('menu'); });
}

function runCutscene(id, onDone) {
  root.classList.add('hidden');
  cutscene = playCutscene(id, {
    setCutscene3D: api.setCutscene3D,
    onDone: () => { cutscene = null; root.classList.remove('hidden'); sync(); onDone?.(); },
  });
  sync();
}

function resume() {
  close();
  api.setMode('game');
}

export function showMainMenu() {
  closeAll();
  open(main);
}

export function openPause() {
  if (isOpen()) return;
  api.setMode('paused');
  sfx('ui_select', 0.4);
  open(pause);
}

export function showEnd(stats) {
  closeAll();
  api.setMode('menu');
  sfx('vo_end', 1);
  end.el.querySelector('.st-ch').textContent = stats.chambers;
  end.el.querySelector('.st-turns').textContent = stats.turns;
  renderShipStatus(end.el.querySelector('.end-ship'), {
    total: LEVELS.length,
    solved: new Set(LEVELS.map((_, i) => i)),
  });
  open(end);
}

export function playEnding(stats) {
  closeAll();
  api.setMode('cutscene');
  runCutscene('ending', () => showEnd(stats));
}

// Dev: ?screen=settings|chapters|credits|cutscene|ending|end|pause
export function openDevScreen(name) {
  if (name === 'cutscene') { api.setMode('cutscene'); runCutscene('intro', () => showMainMenu()); return; }
  if (name === 'ending') { playEnding({ chambers: LEVELS.length, turns: 42 }); return; }
  if (name === 'end') { showEnd({ chambers: LEVELS.length, turns: 42 }); return; }
  if (name === 'pause') { api.startLevel(0); openPause(); return; }
  showMainMenu();
  const s = { settings: settingsScreen, chapters, credits }[name];
  if (s) open(s);
}

export function initUI(gameApi) {
  api = gameApi;
  buildMain(); buildChapters(); buildSettings(); buildCredits(); buildPause(); buildEnd(); buildConfirm();
}
