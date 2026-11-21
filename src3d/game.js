// Binary Core 3D: renderer, animation, input and HUD. Rules live in rules.js.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LEVELS } from './levels.js';
import { parseLevel, step, adjacent, ELEMENTS, STATE, DIRS } from './rules.js';
import {
  COL, cellToWorld, makeMaterials, buildLevel, makeCrate, createElement, createTether, createBursts, createAlloy,
} from './visuals.js';
import { sfx, toggleMute, setVolumes } from './audio.js';
import * as ui from './ui.js';
import { onSettings, recordWin, unlockLevel } from './store.js';
import { solve } from './solver.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
// Touch / mobile: ?touch forces the touch UI (handy for testing on desktop).
const FORCE_TOUCH = params.has('touch');
const COARSE = matchMedia('(pointer: coarse)').matches;
const MOBILE = COARSE || FORCE_TOUCH || Math.min(innerWidth, innerHeight) < 600;
const PFX = MOBILE ? 0.5 : 1; // particle count multiplier
const NAMES = { sol: 'SOL', cryo: 'CRYO' };
const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
$('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.bg);
scene.fog = new THREE.Fog(COL.bg, 40, 80); // camera sits ~30-35 away: fog only the far void

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0x9aaedc, 0x1a140f, 1.0));
scene.add(new THREE.AmbientLight(0x4a5470, 0.5));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.55, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const mats = makeMaterials();
const bursts = createBursts(MOBILE ? 260 : 600);
scene.add(bursts.points);
const tether = createTether();
scene.add(tether.mesh);
const alloy = createAlloy();
scene.add(alloy);
const elements = { sol: createElement('sol'), cryo: createElement('cryo') };
for (const k of ELEMENTS) scene.add(elements[k].group);

// ---------- tiny tween + scheduler ----------

let now = 0; // ms, advanced by the render loop
let tweens = [];
let timers = [];
const ease = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) * (1 - t),
  in: (t) => t * t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  bounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  back: (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  elastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};
function tween(obj, to, { delay = 0, dur = 150, e = 'out', done } = {}) {
  tweens.push({ obj, to, start: now + delay * motion, dur: dur * motion, e: ease[e], from: null, done });
}
function kick(v) { cam.shake = v * shakeScale; } // camera shake, respects settings
function after(ms, fn) { timers.push({ at: now + ms * motion, fn }); }
function clearAnims() { tweens = []; timers = []; }
function runAnims() {
  for (const tw of tweens) {
    if (now < tw.start) continue;
    if (!tw.from) { tw.from = {}; for (const k in tw.to) tw.from[k] = tw.obj[k]; }
    const f = Math.min(1, (now - tw.start) / tw.dur);
    const v = tw.e(f);
    for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * v;
    if (f >= 1) { tw.finished = true; tw.done?.(); }
  }
  tweens = tweens.filter((t) => !t.finished);
  const due = timers.filter((t) => now >= t.at);
  timers = timers.filter((t) => now < t.at);
  for (const t of due) t.fn();
}

// ---------- game state ----------

let levelIndex = Math.min(Math.max((Number(params.get('level')) || 1) - 1, 0), LEVELS.length - 1);
let level, initial, state, history, world;
let crateObjs = new Map();
const disp = { sol: new THREE.Vector3(), cryo: new THREE.Vector3() };
const fx = { sol: { scale: 1, nx: 0, nz: 0 }, cryo: { scale: 1, nx: 0, nz: 0 } };
let tetherOn = false;
let busyUntil = 0;
let queued = null;
let locked = false; // during win sequence / level transition
// mode: 'menu' (level orbits behind the menus) | 'cutscene' | 'game' | 'paused'
let mode = 'menu';
let runTurns = 0;
let motion = 1, shakeScale = 1, drift = true;
const cam = { rot: 0, angle: 0, shake: 0 }; // rot = quarter turns; angle tweens toward it
const shakeOffset = new THREE.Vector3();

function loadLevel(i) {
  levelIndex = i;
  ({ level, state: initial } = parseLevel(LEVELS[i]));
  state = initial;
  history = [];
  clearAnims();
  if (world) scene.remove(world.group); // geometries are shared between levels: don't dispose
  for (const o of crateObjs.values()) scene.remove(o);
  crateObjs = new Map();
  world = buildLevel(level, mats);
  scene.add(world.group);
  alloy.visible = false;
  locked = false;
  queued = null;
  busyUntil = 0;
  hideOverlay();
  cancelHint();
  hintsUsed = 0; stuckCount = 0; movesThisLevel = 0;
  showTip('');
  fitCamera();
  snapToState();
  $('chamber').textContent = `DECK ${i + 1} / ${LEVELS.length}`;
  $('level-name').textContent = LEVELS[i].name.toUpperCase();
  $('intro').textContent = LEVELS[i].intro ?? '';
  if (mode === 'game') sfx(`vo_${i + 1}`, 1);
}

function worldPos(p, out = new THREE.Vector3()) { return cellToWorld(level, p.x, p.y, p.z, out); }

function snapToState() {
  clearAnims();
  for (const k of ELEMENTS) {
    const e = state[k];
    worldPos(e, disp[k]);
    fx[k].scale = e.fallen ? 0 : 1;
    fx[k].nx = fx[k].nz = 0;
    elements[k].setState(e.st);
    elements[k].pop.v = 1;
  }
  const live = new Set(state.blocks.map((b) => b.id));
  for (const [id, o] of crateObjs) if (!live.has(id)) { scene.remove(o); crateObjs.delete(id); }
  for (const b of state.blocks) {
    let o = crateObjs.get(b.id);
    if (!o) { o = makeCrate(mats); crateObjs.set(b.id, o); scene.add(o); }
    o.visible = true;
    o.scale.setScalar(1);
    worldPos(b, o.position).y += 0.5;
  }
  tetherOn = !state.sol.fallen && !state.cryo.fallen && adjacent(state.sol, state.cryo);
  world.setPlateTemps(state.plates);
  alloy.visible = false;
  busyUntil = 0;
  refreshHud();
}

// ---------- camera ----------

// The level is fitted into the part of the screen not covered by HUD, menus or touch controls.
// Those rects are measured from the DOM, eased toward (so mode changes glide), and used to
// build an orthographic frustum that centres the level's projected bounds in that area.
const levelBox = new THREE.Box3();
const tmpV = new THREE.Vector3();
const boxCorners = Array.from({ length: 8 }, () => new THREE.Vector3());
const insets = { l: 0, t: 0, r: 0, b: 0 };
const insetTarget = { l: 0, t: 0, r: 0, b: 0 };
let insetSnap = true;

function fitCamera() {
  // Bounds of the solid cells + starting elements (not the starfield, which lives in world.group).
  levelBox.makeEmpty();
  const AIR = new Set(['.', '^', 'v']);
  const c = new THREE.Vector3();
  level.cells.forEach((layer, z) => layer.forEach((row, y) => [...row].forEach((ch, x) => {
    if (AIR.has(ch)) return;
    worldPos({ x, y, z }, c);
    levelBox.expandByPoint(tmpV.set(c.x - 0.5, c.y - 1, c.z - 0.5));
    levelBox.expandByPoint(tmpV.set(c.x + 0.5, c.y, c.z + 0.5));
  })));
  for (const k of ELEMENTS) {
    worldPos(state[k], c);
    levelBox.expandByPoint(tmpV.set(c.x, c.y + 0.9, c.z));
  }
  if (levelBox.isEmpty()) levelBox.set(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 2, 3));
  const span = Math.max(level.w, level.d);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -span;
  sun.shadow.camera.right = sun.shadow.camera.top = span;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.updateProjectionMatrix();
  insetSnap = true;
  resize();
}

function visibleRect(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? r : null;
}

function measureInsets() {
  const W = innerWidth, H = innerHeight;
  const pad = Math.max(10, Math.min(W, H) * 0.035);
  const t = { l: pad, t: pad, r: pad, b: pad };
  const portrait = H > W * 1.05;
  if (mode === 'menu') {
    const wrap = visibleRect('.screen-main.active .main-wrap');
    if (wrap && W >= 760) t.l = Math.max(t.l, wrap.right + 24);       // board beside the menu
    else if (wrap) t.t = Math.max(t.t, Math.min(wrap.bottom + 12, H * 0.72)); // portrait: below the buttons
  } else {
    for (const sel of ['#hud-left', '#hud-right', '#hud-bottom', '#tpause']) {
      const r = visibleRect(sel);
      if (!r) continue;
      if (r.top + r.height / 2 < H / 2) t.t = Math.max(t.t, r.bottom + 8);
      else t.b = Math.max(t.b, H - r.top + 8);
    }
    for (const sel of ['#dpad', '#tactions']) {
      const r = visibleRect(sel);
      if (!r) continue;
      if (portrait) t.b = Math.max(t.b, H - r.top + 6);
      else if (r.left + r.width / 2 < W / 2) t.l = Math.max(t.l, r.right + 6);
      else t.r = Math.max(t.r, W - r.left + 6);
    }
  }
  Object.assign(insetTarget, t);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  const pr = renderer.getPixelRatio();
  if (MOBILE) bloom.setSize(innerWidth * pr * 0.5, innerHeight * pr * 0.5); // half-res bloom on phones
  else bloom.setSize(innerWidth * pr, innerHeight * pr);
  measureInsets();
  insetSnap = true;
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 120));

function applyProjection(dt) {
  const W = innerWidth, H = innerHeight;
  const f = insetSnap ? 1 : 1 - Math.exp(-dt * 6);
  for (const k of ['l', 't', 'r', 'b']) insets[k] += (insetTarget[k] - insets[k]) * f;
  insetSnap = false;
  const { min, max } = levelBox;
  let i = 0;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) boxCorners[i++].set(x, y, z);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of boxCorners) {
    tmpV.copy(c).applyMatrix4(camera.matrixWorldInverse);
    x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x); y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y);
  }
  const aw = Math.max(60, W - insets.l - insets.r), ah = Math.max(60, H - insets.t - insets.b);
  const k = Math.max((x1 - x0) / aw, (y1 - y0) / ah) * 1.04; // world units per pixel
  const ax = insets.l + aw / 2, ay = insets.t + ah / 2;
  camera.left = (x0 + x1) / 2 - ax * k; camera.right = camera.left + W * k;
  camera.top = (y0 + y1) / 2 + ay * k; camera.bottom = camera.top - H * k;
  camera.updateProjectionMatrix();
}

let dtFrame = 0;
const YAW0 = THREE.MathUtils.degToRad(32); // off-diagonal so "forward" is unambiguous
function updateCamera(t) {
  const yaw = YAW0 + cam.angle * Math.PI / 2;
  const target = new THREE.Vector3(0, level.h * 0.38, 0);
  const dist = 30;
  camera.position.set(target.x + Math.sin(yaw) * dist, target.y + dist * 0.82, target.z + Math.cos(yaw) * dist);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  applyProjection(dtFrame);
  if (cam.shake > 0) {
    shakeOffset.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(cam.shake);
    camera.position.add(shakeOffset);
  }
  if (drift) camera.position.y += Math.sin(t * 0.4) * 0.15; // gentle drift so the scene feels alive
  sun.position.set(target.x + Math.sin(yaw + 0.9) * 14, 22, target.z + Math.cos(yaw + 0.9) * 14);
  sun.target.position.copy(target);
}

// Screen direction -> world direction, based on current camera yaw.
function worldDir(screen) {
  const yaw = YAW0 + cam.rot * Math.PI / 2;
  const fwd = { x: -Math.sin(yaw), y: -Math.cos(yaw) };   // away from viewer, in cell (x, y)
  const right = { x: Math.cos(yaw), y: -Math.sin(yaw) };
  const v = { up: fwd, down: { x: -fwd.x, y: -fwd.y }, right, left: { x: -right.x, y: -right.y } }[screen];
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'east' : 'west';
  return v.y > 0 ? 'south' : 'north';
}

function rotate(delta) {
  cam.rot += delta;
  tween(cam, { angle: cam.rot }, { dur: 420, e: 'inOut' });
  if (hintDir) setHintMsg(hintText(hintDir), 'good'); // screen arrow changes with the camera
}

// ---------- turns ----------

function tryMove(screenDir) { tryMoveWorld(worldDir(screenDir)); }

function tryMoveWorld(dir) {
  if (mode !== 'game' || ui.isOpen() || locked || state.status !== 'play') return;
  if (now < busyUntil) { queued = dir; return; }
  const { state: next, changed, events } = step(level, state, dir);
  if (!changed) {
    for (const e of events) {
      if (e.type === 'bump') nudge(e.who, e.dir);
      if (e.type === 'stuck') shiver(e.who);
    }
    sfx('bump', 0.4);
    return;
  }
  history.push(state);
  state = next;
  movesThisLevel++;
  cancelHint();
  animate(events);
}

function nudge(who, d) {
  const f = fx[who];
  tween(f, { nx: d.x * 0.12, nz: d.y * 0.12 }, { dur: 55 });
  tween(f, { nx: 0, nz: 0 }, { delay: 55, dur: 90 });
}
function shiver(who) {
  const f = fx[who];
  for (let i = 0; i < 4; i++) tween(f, { nx: i % 2 ? -0.05 : 0.05 }, { delay: i * 45, dur: 45 });
  tween(f, { nx: 0 }, { delay: 180, dur: 45 });
}

// Play the event list in order. Each actor has its own clock so moves chain into falls.
function animate(events) {
  const clock = { sol: 0, cryo: 0 };
  const crateClock = {};
  let stepSound = false;
  let end = 0;
  let lastLeave = 0; // when the most recent element started leaving a cell (plates react then)
  const target = new THREE.Vector3();

  for (const ev of events) {
    switch (ev.type) {
      case 'move': {
        const t0 = clock[ev.who];
        lastLeave = t0;
        worldPos(ev.to, target);
        tween(disp[ev.who], { x: target.x, y: target.y, z: target.z }, { delay: t0, dur: 140, e: 'out' });
        clock[ev.who] = t0 + 140;
        if (!stepSound) { stepSound = true; const st = elements[ev.who].state; sfx(`step_${st === 'frozen' ? 'solid' : st}`, 0.5); }
        break;
      }
      case 'fall':
      case 'rise': {
        const t0 = clock[ev.who];
        lastLeave = t0;
        const dist = Math.abs(ev.to.z - ev.from.z);
        const dur = ev.type === 'fall' ? 110 + 90 * dist : 220 + 180 * dist;
        worldPos(ev.to, target);
        const isVoid = ev.to.z < 0;
        if (isVoid) target.y = -8;
        tween(disp[ev.who], { y: target.y }, { delay: t0, dur: isVoid ? 700 : dur, e: ev.type === 'fall' ? (isVoid ? 'in' : 'bounce') : 'inOut' });
        if (ev.type === 'fall' && !isVoid) after(t0 + dur * 0.6, () => sfx('step_solid', 0.35));
        clock[ev.who] = t0 + (isVoid ? 700 : dur);
        break;
      }
      case 'state': {
        const t0 = clock[ev.who];
        after(t0, () => {
          elements[ev.who].setState(ev.to);
          const p = elements[ev.who].group.position.clone(); p.y += 0.35;
          bursts.burst(p, COL[ev.who], Math.round((ev.to === STATE.GAS ? 30 : 16) * PFX), ev.to === STATE.GAS ? 1.3 : 1.8);
          if (ev.to === STATE.FROZEN) bursts.burst(p, 0xdff6ff, Math.round(14 * PFX), 1.2);
          elements[ev.who].pop.v = 1.4;
          tween(elements[ev.who].pop, { v: 1 }, { dur: 320, e: 'back' });
          sfx(ev.to === STATE.GAS ? 'boil' : ev.to === STATE.LIQUID ? 'melt' : 'freeze', 0.5);
        });
        clock[ev.who] = t0 + 60;
        break;
      }
      case 'push': {
        const o = crateObjs.get(ev.id);
        if (!o) break;
        worldPos(ev.to, target); target.y += 0.5;
        tween(o.position, { x: target.x, z: target.z }, { dur: 140 });
        crateClock[ev.id] = 140;
        sfx('push', 0.5);
        break;
      }
      case 'blockfall': {
        const o = crateObjs.get(ev.id);
        if (!o) break;
        const t0 = crateClock[ev.id] ?? 0;
        const dist = Math.abs(ev.to.z - ev.from.z);
        const gone = ev.to.z < 0;
        worldPos(ev.to, target); target.y += 0.5;
        tween(o.position, { y: gone ? -8 : target.y }, { delay: t0, dur: gone ? 700 : 110 + 90 * dist, e: gone ? 'in' : 'bounce' });
        if (gone) after(t0 + 700, () => { scene.remove(o); crateObjs.delete(ev.id); });
        else after(t0 + 60 + 70 * dist, () => { kick(0.08); tween(cam, { shake: 0 }, { dur: 160 }); sfx('push', 0.4); });
        crateClock[ev.id] = t0 + 110 + 90 * dist;
        end = Math.max(end, crateClock[ev.id]);
        break;
      }
      case 'shove': sfx('push', 0.5); break;
      case 'plate': {
        // A plate remembers heat: Sol leaving warms it, Cryo leaving chills it.
        const key = `${ev.x},${ev.y},${ev.z}`;
        const heating = ev.to > ev.from;
        after(lastLeave + 70, () => {
          if (!world.animatePlate(key, ev.to)) return;
          const p = cellToWorld(level, ev.x, ev.y, ev.z, new THREE.Vector3());
          p.y = ev.z + 1.02;
          bursts.burst(p, heating ? 0xff8a3d : 0xcff6ff, Math.round(14 * PFX), heating ? 1.1 : 0.9);
          sfx(heating ? 'melt' : 'freeze', 0.22);
        });
        break;
      }
      case 'void': {
        const t0 = clock[ev.who];
        tween(fx[ev.who], { scale: 0 }, { delay: Math.max(0, t0 - 400), dur: 450, e: 'in' });
        after(Math.max(0, t0 - 600), () => sfx('fall', 0.6));
        break;
      }
      case 'bump': nudge(ev.who, ev.dir); break;
      case 'stuck': shiver(ev.who); break;
      case 'tether': {
        const at = Math.max(clock.sol, clock.cryo);
        after(at, () => { if (ev.on && !tetherOn) sfx('tether', 0.4); tetherOn = ev.on; });
        break;
      }
      case 'win': {
        locked = true;
        recordWin(levelIndex, state.turn);
        runTurns += state.turn;
        const at = Math.max(clock.sol, clock.cryo, end) + 80;
        after(at, celebrate);
        break;
      }
      case 'lose': {
        const at = Math.max(clock.sol, clock.cryo, end) + 200;
        after(at, () => showLose(ev));
        break;
      }
    }
  }
  end = Math.max(end, clock.sol, clock.cryo);
  busyUntil = now + Math.min(end, 260); // let the next input start once the move itself is done
  after(Math.min(end, 260), () => { if (queued) { const q = queued; queued = null; tryMoveWorld(q); } });
  refreshHud();
}

function undo() {
  if (!history.length || locked) return;
  cancelHint();
  state = history.pop();
  hideOverlay();
  snapToState();
  sfx('undo', 0.5);
}

function restart() {
  if (locked || state === initial) return;
  cancelHint();
  noteStuck();
  history.push(state); // restart is undoable
  state = initial;
  hideOverlay();
  snapToState();
  sfx('undo', 0.5);
}

function gotoLevel(i) {
  if (i < 0 || i >= LEVELS.length) return;
  loadLevel(i);
}

// ---------- outcomes ----------

function flash(color, ms = 260, peak = 0.55) {
  const el = $('flash');
  el.style.transition = 'none';
  el.style.background = color;
  el.style.opacity = peak;
  requestAnimationFrame(() => { el.style.transition = `opacity ${ms}ms ease-out`; el.style.opacity = 0; });
}

function showOverlay(title, sub, color) {
  $('overlay-title').textContent = title;
  $('overlay-title').style.color = color;
  $('overlay-sub').textContent = sub;
  $('overlay').classList.add('show');
}
function hideOverlay() { $('overlay').classList.remove('show'); }

function showLose(ev) {
  if (state.status !== 'lost') return;
  noteStuck();
  const name = NAMES[ev.who];
  const title = ev.reason === 'void' ? `${name} FELL INTO THE VOID`
    : ev.reason === 'evaporated' ? `${name} EVAPORATED` : 'THE CRUCIBLE WENT COLD';
  flash('rgba(255,60,80,0.7)', 400, 0.4);
  kick(0.12); tween(cam, { shake: 0 }, { dur: 300 });
  sfx('fail', 0.6);
  showOverlay(title, isTouch() ? 'TAP UNDO OR RESTART' : 'Z  UNDO          R  RESTART', 'var(--danger)');
}

function celebrate() {
  const a = disp.sol, b = disp.cryo;
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  tetherOn = false;
  const lift = mid.y + 0.9;
  for (const k of ELEMENTS) {
    tween(disp[k], { x: mid.x, y: lift, z: mid.z }, { dur: 520, e: 'inOut' });
    tween(fx[k], { scale: 0.35 }, { dur: 520, e: 'in' });
  }
  after(520, () => {
    fx.sol.scale = fx.cryo.scale = 0;
    alloy.visible = true;
    alloy.position.set(mid.x, lift, mid.z);
    alloy.scale.setScalar(0.01);
    tween(alloy.scale, { x: 1, y: 1, z: 1 }, { dur: 900, e: 'elastic' });
    tween(alloy.position, { y: mid.y + 0.35 }, { delay: 300, dur: 700, e: 'bounce' });
    const p = new THREE.Vector3(mid.x, lift, mid.z);
    bursts.burst(p, COL.sol, Math.round(60 * PFX), 3.2);
    bursts.burst(p, COL.cryo, Math.round(60 * PFX), 3.2);
    bursts.burst(p, COL.alloy, Math.round(40 * PFX), 2.2);
    kick(0.35); tween(cam, { shake: 0 }, { dur: 500 });
    flash('rgba(255,236,190,0.9)', 500, 0.7);
    sfx('fuse', 0.8);
  });
  const last = levelIndex === LEVELS.length - 1;
  after(1600, () => {
    if (last) {
      sfx('vo_end', 1);
      if (!SHOT) { ui.showEnd({ chambers: LEVELS.length, turns: runTurns }); return; }
    }
    // Lore: each chamber's Crucible relights one deck; the surge throws them into the next.
    showOverlay(last ? 'THE BOND HOLDS' : `DECK ${levelIndex + 1} ONLINE`,
      last ? 'THANKS FOR PLAYING'
        : `THE SURGE THROWS THEM APART  ·  ${isTouch() ? 'TAP TO CONTINUE' : 'ENTER: NEXT DECK'}`, 'var(--gold)');
  });
}

function nextLevel() {
  if (state.status !== 'won' || !$('overlay').classList.contains('show')) return;
  if (levelIndex < LEVELS.length - 1) loadLevel(levelIndex + 1);
}

// ---------- HUD ----------

function refreshHud() {
  const heatFrac = Math.max(0, state.heat / level.heat);
  const low = heatFrac <= 0.25;
  $('heat-num').textContent = Math.max(0, state.heat);
  $('heat-num').style.color = low ? 'var(--danger)' : 'var(--text)';
  $('heat-fill').style.width = `${heatFrac * 100}%`;
  $('heat-fill').style.background = low ? 'var(--danger)' : 'var(--heat)';
  for (const k of ELEMENTS) {
    const e = state[k];
    $(`${k}-text`).textContent = `${NAMES[k]} · ${e.fallen ? 'LOST' : e.st.toUpperCase()}  ${Math.max(0, e.mass)}`;
    $(`${k}-fill`).style.width = `${Math.max(0, e.mass / level.mass) * 100}%`;
  }
}

// ---------- input ----------

const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

addEventListener('keydown', (ev) => {
  if (mode !== 'game' || ui.isOpen()) return; // menus consume their own keys
  if (KEYS[ev.code]) { ev.preventDefault(); tryMove(KEYS[ev.code]); return; }
  switch (ev.code) {
    case 'Escape': if (!SHOT) ui.openPause(); break;
    case 'KeyQ': rotate(-1); break;
    case 'KeyE': rotate(1); break;
    case 'KeyZ': case 'Backspace': undo(); break;
    case 'KeyR': restart(); break;
    case 'KeyM': toggleMute(); break;
    case 'KeyH': requestHint(); break;
    case 'Enter': case 'Space': nextLevel(); break;
    case 'BracketRight': gotoLevel(levelIndex + 1); break;
    case 'BracketLeft': gotoLevel(levelIndex - 1); break;
  }
});

// ---------- touch ----------

const isTouch = () => document.body.classList.contains('touch');
if (COARSE || FORCE_TOUCH) document.body.classList.add('touch');
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') document.body.classList.add('touch'); }, true);
addEventListener('keydown', () => { if (!FORCE_TOUCH) document.body.classList.remove('touch'); }, true);

// Swipe: pick the world direction whose on-screen projection best matches the swipe.
const SWIPE_MIN = 22;
function swipeToWorld(dx, dy) {
  const o = new THREE.Vector3(0, 0, 0).project(camera);
  let best = 'north', bestDot = -Infinity;
  for (const [name, d] of Object.entries(DIRS)) {
    const p = new THREE.Vector3(d.x, 0, d.y).project(camera);
    const sx = p.x - o.x, sy = -(p.y - o.y) * (innerHeight / innerWidth);
    const len = Math.hypot(sx, sy) || 1;
    const dot = (sx * dx + sy * dy) / len;
    if (dot > bestDot) { bestDot = dot; best = name; }
  }
  return best;
}
let swipe = null;
const view = $('view');
view.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, fired: false };
});
view.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.fired || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) < SWIPE_MIN * 1.6) return;
  swipe.fired = true; // move as soon as the swipe is clear, no need to lift the finger
  if (mode === 'game' && !ui.isOpen()) tryMoveWorld(swipeToWorld(dx, dy));
});
view.addEventListener('pointerup', (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  const s0 = swipe; swipe = null;
  if (s0.fired || mode !== 'game' || ui.isOpen()) return;
  if (Math.hypot(dx, dy) >= SWIPE_MIN) tryMoveWorld(swipeToWorld(dx, dy));
  else nextLevel(); // tap: advances after a win
});
view.addEventListener('pointercancel', () => { swipe = null; });
$('overlay').addEventListener('pointerdown', () => { if (mode === 'game') nextLevel(); });

// On-screen D-pad (screen directions, like the arrow keys) + action buttons. Holding repeats.
let repeatTimer = 0;
function touchAct(act) {
  if (mode !== 'game' || ui.isOpen()) return;
  switch (act) {
    case 'up': case 'down': case 'left': case 'right': tryMove(act); break;
    case 'undo': undo(); break;
    case 'restart': restart(); break;
    case 'rotl': rotate(-1); break;
    case 'rotr': rotate(1); break;
    case 'pause': ui.openPause(); break;
    case 'hint': requestHint(); break;
  }
}
for (const btn of document.querySelectorAll('#touch [data-act]')) {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.classList.add('down');
    const act = btn.dataset.act;
    touchAct(act);
    clearInterval(repeatTimer);
    if (['up', 'down', 'left', 'right', 'undo'].includes(act)) {
      repeatTimer = setTimeout(() => { repeatTimer = setInterval(() => touchAct(act), 190); }, 380);
    }
  });
  const up = () => { btn.classList.remove('down'); clearTimeout(repeatTimer); clearInterval(repeatTimer); };
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
}
$('intro').addEventListener('click', () => $('intro').classList.toggle('expanded'));
$('hint-btn').addEventListener('click', (e) => { e.currentTarget.blur(); requestHint(); });

// ---------- helpers: hints, stuck tip, skip, direction glyphs ----------

let hintWorker = null, hintId = 0, hintDir = null;
let hintsUsed = 0, stuckCount = 0, movesThisLevel = 0;
const SCREEN_DIRS = ['up', 'down', 'left', 'right'];
const ARROW = { up: '↑', down: '↓', left: '←', right: '→' };
const KEYCAP = { up: 'W', down: 'S', left: 'A', right: 'D' };
const screenFor = (wd) => SCREEN_DIRS.find((sd) => worldDir(sd) === wd) ?? 'up';

function setHintMsg(text, kind = '') {
  const el = $('hint-msg');
  el.textContent = text;
  el.className = text ? `show ${kind}` : '';
}
function hintText(wd) {
  const sd = screenFor(wd);
  return isTouch() ? `HINT · SWIPE ${ARROW[sd]}` : `HINT · PRESS ${ARROW[sd]}  OR  ${KEYCAP[sd]}`;
}
function cancelHint() {
  hintId++;
  if (hintWorker) { hintWorker.terminate(); hintWorker = null; }
  hintDir = null;
  hintArrows.visible = false;
  setHintMsg('');
}
function noWayMsg() {
  setHintMsg(isTouch() ? 'NO WAY FORWARD FROM HERE · TAP UNDO OR RESTART' : 'NO WAY FORWARD FROM HERE · UNDO (Z) OR RESTART (R)', 'bad');
}
function requestHint() {
  if (mode !== 'game' || ui.isOpen() || locked) return;
  cancelHint();
  if (state.status === 'lost') { noWayMsg(); return; }
  if (state.status !== 'play') return;
  hintsUsed++;
  showTip('');
  setHintMsg('THINKING…', 'thinking');
  const id = hintId;
  const deliver = (solved, next) => {
    if (id !== hintId) return; // a move/undo happened meanwhile
    if (!solved) { noWayMsg(); return; }
    hintDir = next;
    hintArrows.visible = true;
    setHintMsg(hintText(hintDir), 'good');
    sfx('tether', 0.3);
  };
  // Main-thread fallback (smaller search) if module workers are unavailable; ?hintsync forces it (dev/headless).
  const syncSolve = () => setTimeout(() => {
    const r = solve(level, state, { maxNodes: 120000 });
    deliver(r.solved, r.solved ? r.path[0] : null);
  }, 30);
  if (params.has('hintsync')) { syncSolve(); return; }
  try {
    hintWorker = new Worker(new URL('./hintworker.js', import.meta.url), { type: 'module' });
  } catch { syncSolve(); return; }
  // Watchdog: if the worker never answers (blocked module workers, silent failure),
  // fall back to the main-thread solve instead of sitting on "THINKING…" forever.
  const worker = hintWorker;
  const watchdog = setTimeout(() => {
    if (hintWorker !== worker || id !== hintId) return;
    hintWorker.terminate(); hintWorker = null;
    syncSolve();
  }, 8000);
  hintWorker.onmessage = (e) => {
    if (e.data.id !== id) return;
    clearTimeout(watchdog);
    hintWorker.terminate(); hintWorker = null;
    deliver(e.data.solved, e.data.next);
  };
  hintWorker.onerror = () => {
    clearTimeout(watchdog);
    if (hintWorker) { hintWorker.terminate(); hintWorker = null; }
    syncSolve();
  };
  hintWorker.postMessage({ id, level, state, maxNodes: 300000 });
}

function showTip(text) {
  const el = $('tip');
  el.textContent = text;
  el.classList.toggle('show', !!text);
}
function noteStuck() {
  stuckCount++;
  if (stuckCount >= 3 && !hintDir) showTip(isTouch() ? 'Stuck? Tap 💡 for a hint' : 'Stuck? Press H for a hint');
}

function skipDeck() {
  if (levelIndex >= LEVELS.length - 1) return;
  unlockLevel(levelIndex + 1);
  startLevel(levelIndex + 1);
}

// Glowing floor arrows showing the hinted move, one in front of each element.
function makeArrowMesh() {
  const sh = new THREE.Shape();
  sh.moveTo(-0.17, -0.07); sh.lineTo(0.04, -0.07); sh.lineTo(0.04, -0.16); sh.lineTo(0.24, 0);
  sh.lineTo(0.04, 0.16); sh.lineTo(0.04, 0.07); sh.lineTo(-0.17, 0.07); sh.closePath();
  const geo = new THREE.ShapeGeometry(sh);
  geo.rotateX(-Math.PI / 2); // lie flat, still pointing +x
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffd88a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
}
const hintArrows = new THREE.Group();
const hintArrowFor = { sol: makeArrowMesh(), cryo: makeArrowMesh() };
hintArrowFor.sol.scale.setScalar(1.6); hintArrowFor.cryo.scale.setScalar(1.6);
hintArrows.add(hintArrowFor.sol, hintArrowFor.cryo);
hintArrows.visible = false;
scene.add(hintArrows);
function updateHintArrows(t) {
  if (!hintArrows.visible || !hintDir) return;
  const d = DIRS[hintDir];
  const bob = 0.78 + 0.08 * Math.sin(t * 6);
  for (const k of ELEMENTS) {
    const a = hintArrowFor[k];
    a.visible = !state[k].fallen;
    a.position.set(disp[k].x + d.x * bob, disp[k].y + 0.03, disp[k].z + d.y * bob); // element origin = floor top
    a.rotation.y = Math.atan2(-d.y, d.x);
    a.material.opacity = 0.65 + 0.3 * Math.sin(t * 6);
  }
}

// First two decks only: one set of direction keys around the pair, so players learn which
// key moves which way under the angled camera. They fade after the first few moves.
const glyphs = {};
const glyphGroup = new THREE.Group();
scene.add(glyphGroup);
let glyphTouch = null;
function glyphTexture(sd, touch) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,216,138,0.9)'; g.shadowBlur = 12;
  g.fillStyle = '#ffe9c2';
  if (touch) {
    g.font = '700 76px Rajdhani, sans-serif';
    g.fillText(ARROW[sd], 64, 64);
  } else {
    g.font = '700 64px Rajdhani, sans-serif';
    g.fillText(KEYCAP[sd], 64, 50);
    g.font = '700 38px Rajdhani, sans-serif';
    g.fillText(ARROW[sd], 64, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function buildGlyphs(touch) {
  glyphTouch = touch;
  for (const o of [...glyphGroup.children]) { o.material.map?.dispose(); o.material.dispose(); glyphGroup.remove(o); }
  for (const sd of SCREEN_DIRS) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(sd, touch), transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.setScalar(0.62);
    sp.renderOrder = 5;
    glyphs[sd] = sp;
    glyphGroup.add(sp);
  }
}
let glyphFade = 0;
function updateGlyphs(dt) {
  const want = mode === 'game' && levelIndex < 2 && state.status === 'play' && movesThisLevel < 4 && !locked ? 1 : 0;
  glyphFade += (want - glyphFade) * Math.min(1, dt * 4);
  glyphGroup.visible = glyphFade > 0.02;
  if (!glyphGroup.visible) return;
  if (glyphTouch !== isTouch()) buildGlyphs(isTouch());
  const a = disp.sol, b = disp.cryo;
  const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y), cz = (a.z + b.z) / 2;
  for (const sd of SCREEN_DIRS) {
    const sp = glyphs[sd];
    const d = DIRS[worldDir(sd)];
    // Sit just outside the pair along that axis.
    const half = d.x !== 0 ? Math.abs(a.x - b.x) / 2 : Math.abs(a.z - b.z) / 2;
    const r = half + 1.05;
    sp.position.set(cx + d.x * r, cy + 0.05, cz + d.y * r);
    sp.material.opacity = 0.85 * glyphFade;
  }
}

// ---------- modes (called by ui.js) ----------

function setMode(m) {
  mode = m;
  document.body.dataset.mode = m;
  requestAnimationFrame(measureInsets);
  if (m === 'game') hideOverlayIfPlaying();
}
function hideOverlayIfPlaying() { if (state.status === 'play') hideOverlay(); }

function startLevel(i) {
  setMode('game');
  cam.rot = 0; cam.angle = 0;
  loadLevel(Math.max(0, Math.min(i, LEVELS.length - 1)));
}

function showMenuBackground() {
  setMode('menu');
  if (!level || levelIndex !== 0 || state !== initial) loadLevel(0);
}

onSettings((s) => {
  bloom.enabled = !!s.bloom;
  shakeScale = s.shake ? 1 : 0;
  motion = s.reducedMotion ? 0.55 : 1;
  drift = !s.reducedMotion;
  setVolumes(s);
});

// ---------- loop ----------

const clock = new THREE.Clock();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpD = new THREE.Vector3(), viewDir = new THREE.Vector3();
let frameNo = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  now += dt * 1000;
  const t = now / 1000;
  runAnims();
  if (mode === 'menu') cam.angle += dt * (drift ? 0.07 : 0.02); // slow orbit behind the menus
  dtFrame = dt;
  if ((frameNo++ & 15) === 0) measureInsets(); // HUD/menu layout can change; cheap to re-measure
  updateCamera(t);

  const heatFrac = Math.max(0, Math.min(1, state.heat / level.heat));
  world.update(t, heatFrac, state);
  let maxZ = -Infinity;
  for (const k of ELEMENTS) {
    const e = state[k];
    const el = elements[k];
    el.group.position.set(disp[k].x + fx[k].nx, disp[k].y, disp[k].z + fx[k].nz);
    el.group.scale.setScalar(fx[k].scale);
    el.group.visible = fx[k].scale > 0.01;
    el.update(t, Math.max(0, Math.min(1, e.mass / level.mass)));
    if (!e.fallen) maxZ = Math.max(maxZ, e.z);
  }
  // Cutaway: fade floors above the highest element, plus anything between the camera and an element.
  camera.getWorldDirection(viewDir);
  const live = ELEMENTS.filter((k) => !state[k].fallen).map((k) => ({ z: state[k].z, p: elements[k].group.position }));
  const topZ = maxZ === -Infinity ? level.h : maxZ;
  world.setCutaway((b) => {
    if (b.z > topZ) return true;
    for (const e of live) {
      if (b.z < e.z) continue; // floors under an element never hide it
      tmpD.subVectors(b.obj.position, e.p);
      const depth = tmpD.dot(viewDir);
      if (depth > -0.4) continue; // block is behind the element
      if (tmpD.addScaledVector(viewDir, -depth).length() < 1.15) return true;
    }
    return false;
  });

  const showTether = tetherOn && elements.sol.group.visible && elements.cryo.group.visible;
  tmpA.copy(elements.sol.group.position).y += 0.32;
  tmpB.copy(elements.cryo.group.position).y += 0.32;
  tether.update(tmpA, tmpB, showTether, t);

  updateHintArrows(t);
  updateGlyphs(dt);
  if (alloy.visible) alloy.rotation.y = t * 0.9;
  bursts.update(dt);
  composer.render();
  requestAnimationFrame(frame);
}

// ---------- boot ----------

ui.initUI({
  startLevel, showMenuBackground, setMode, restart, skipDeck,
  resetRun: () => { runTurns = 0; },
  levelInfo: () => ({ index: levelIndex, name: LEVELS[levelIndex].name, last: levelIndex === LEVELS.length - 1 }),
});
loadLevel(levelIndex);
// ?shot or ?level=N go straight to gameplay; ?screen=... opens a menu screen (dev); otherwise main menu.
if (SHOT || params.has('level') || params.has('play')) startLevel(levelIndex);
else if (params.has('screen')) ui.openDevScreen(params.get('screen'));
else ui.showMainMenu();
cam.angle = cam.rot;
requestAnimationFrame(frame);
window.__game = { get state() { return state; }, tryMove, tryMoveWorld, undo, restart, rotate, loadLevel, startLevel, requestHint, skipDeck };
// Dev: ?hint asks for a hint shortly after the level starts (for screenshots).
if (params.has('hint') || params.has('hintsync')) setTimeout(requestHint, 900);

// Dev: ?play=south,east,...  replays world-direction moves (e.g. a solver path), one every 450ms.
if (params.has('play')) {
  const moves = params.get('play').split(',').filter(Boolean);
  moves.forEach((m, i) => setTimeout(() => { busyUntil = 0; tryMoveWorld(m); }, 600 + i * 450));
  setTimeout(() => { document.body.dataset.status = state.status; }, 900 + moves.length * 450); // for headless checks
}
