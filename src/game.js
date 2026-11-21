import { LEVELS } from './levels.js';
import { parseLevel, step, terrainAt, adjacent, STATE, TILE, ELEMENTS } from './rules.js';
import { TS, TERRAIN_TEX } from './textures.js';
import { sfx, ensureMusic } from './audio.js';

export const W = 1280, H = 800;
export const FONT = 'Rajdhani, sans-serif';
export const COL = { sol: 0xffa94d, cryo: 0x5ee7ff, alloy: 0xfff0c2, bg: '#0d0f14' };
const CSS = { sol: '#ffa94d', cryo: '#5ee7ff', text: '#e3e7ef', dim: '#7c8496', heat: '#ff8a3d', danger: '#ff4d5e' };
const NAMES = { sol: 'SOL', cryo: 'CRYO' };
const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const lighten = (c, amt) => Phaser.Display.Color.IntegerToColor(c).lighten(amt).color;

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) { this.levelIndex = data.level ?? 0; }

  create() {
    const { level, state } = parseLevel(LEVELS[this.levelIndex]);
    Object.assign(this, {
      level, initial: state, state, history: [], tetherOn: adjacent(state.sol, state.cryo),
      webgl: this.game.renderer.type === Phaser.WEBGL, busy: false, alloy: null,
    });
    this.crucibles = [];
    level.terrain.forEach((row, y) => row.forEach((t, x) => { if (t === TILE.CRUCIBLE) this.crucibles.push({ x, y }); }));

    this.setupCameras();
    this.buildWorld();
    this.buildHud();
    this.setupInput();
    this.syncAll(true);

    ensureMusic(this);
    sfx(this, `vo_${this.levelIndex + 1}`, 1);
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ---------- setup ----------

  setupCameras() {
    const bw = this.level.w * TS, bh = this.level.h * TS;
    const zoom = Math.min((W - 80) / bw, (H - 220) / bh, 1.5);
    const cam = this.cameras.main;
    cam.setBackgroundColor(COL.bg).setZoom(zoom).centerOn(bw / 2, bh / 2 - 12 / zoom);
    this.uiCam = this.cameras.add(0, 0, W, H);
    if (this.webgl) {
      cam.postFX.addBloom(0xffffff, 1, 1, 1, 0.9, 4);
      this.vignette = cam.postFX.addVignette(0.5, 0.5, 0.9, 0.35);
    }
  }

  // Objects visible only to the world camera or only to the HUD camera.
  w(obj) { this.uiCam.ignore(obj); return obj; }
  u(obj) { this.cameras.main.ignore(obj); return obj; }

  buildWorld() {
    const { w, h } = this.level;
    if (this.textures.exists('bg_reactor')) {
      const cam = this.cameras.main;
      const bg = this.w(this.add.image(w * TS / 2, h * TS / 2, 'bg_reactor').setDepth(-10).setAlpha(0.45));
      bg.setScale(Math.max(W / cam.zoom / bg.width, H / cam.zoom / bg.height));
    }
    this.tiles = [];
    for (let y = 0; y < h; y++) {
      this.tiles.push([]);
      for (let x = 0; x < w; x++) {
        const img = this.w(this.add.image(x * TS + TS / 2, y * TS + TS / 2, 'tile_warm').setDisplaySize(TS, TS));
        this.tiles[y].push(img);
      }
    }
    this.fx = this.w(this.add.graphics().setBlendMode(Phaser.BlendModes.ADD));
    this.blockSprites = new Map();
    this.tether = this.w(this.add.graphics());
    this.gfx = {}; this.disp = {}; this.nudge = {}; this.pop = {}; this.labels = {}; this.bursts = {};
    for (const k of ELEMENTS) {
      this.gfx[k] = this.w(this.add.graphics());
      if (this.webgl) this.gfx[k].postFX.addGlow(COL[k], 5, 0, false, 0.1, 12);
      this.disp[k] = { x: 0, y: 0, scale: 1, alpha: 1 };
      this.nudge[k] = { x: 0, y: 0 };
      this.pop[k] = { v: 1 };
      this.labels[k] = this.w(this.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '13px', fontStyle: '700', color: CSS[k],
      }).setOrigin(0.5, 0).setLetterSpacing(2).setAlpha(0.85));
      this.bursts[k] = this.w(this.add.particles(0, 0, 'spark', {
        speed: { min: 40, max: 160 }, lifespan: 550, scale: { start: 0.7, end: 0 },
        alpha: { start: 1, end: 0 }, tint: COL[k], blendMode: 'ADD', emitting: false,
      }));
    }
    if (this.webgl) this.tether.postFX.addGlow(0xffffff, 4, 0, false, 0.1, 10);
    this.alloyG = this.w(this.add.graphics());
    if (this.webgl) this.alloyG.postFX.addGlow(0xffd27a, 8, 1, false, 0.1, 16);
    this.bursts.alloy = this.w(this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 380 }, lifespan: 1100, scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [COL.sol, COL.cryo, COL.alloy], blendMode: 'ADD', emitting: false,
    }));
  }

  buildHud() {
    const def = LEVELS[this.levelIndex];
    const txt = (x, y, s, size, color, weight = '600') => this.u(this.add.text(x, y, s, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color,
    }));
    txt(40, 26, `CHAMBER ${this.levelIndex + 1} / ${LEVELS.length}`, 16, CSS.dim).setLetterSpacing(3);
    txt(40, 44, def.name.toUpperCase(), 36, CSS.text, '700').setLetterSpacing(2);
    txt(W - 40, 26, 'CRUCIBLE HEAT', 15, CSS.heat, '700').setOrigin(1, 0).setLetterSpacing(3);
    this.heatText = txt(W - 40, 44, '', 22, CSS.text, '700').setOrigin(1, 0);
    this.massText = {
      sol: txt(W - 380, 82, '', 14, CSS.sol, '700').setLetterSpacing(2),
      cryo: txt(W - 200, 82, '', 14, CSS.cryo, '700').setLetterSpacing(2),
    };
    this.hudG = this.u(this.add.graphics());
    txt(W / 2, H - 70, def.intro, 19, CSS.dim, '500').setOrigin(0.5, 0.5).setAlign('center').setWordWrapWidth(1000);
    txt(W / 2, H - 30, 'ARROWS / WASD  move     Z  undo     R  restart     M  mute', 14, '#555d6e', '700')
      .setOrigin(0.5).setLetterSpacing(2);

    this.overlay = this.u(this.add.container(0, 0).setVisible(false).setDepth(100));
    this.overlay.add([
      this.add.rectangle(W / 2, H / 2, W, H, 0x05060a, 0.62),
      this.add.text(W / 2, H / 2 - 30, '', { fontFamily: FONT, fontSize: '64px', fontStyle: '700', color: CSS.text })
        .setOrigin(0.5).setLetterSpacing(6),
      this.add.text(W / 2, H / 2 + 34, '', { fontFamily: FONT, fontSize: '20px', fontStyle: '600', color: CSS.dim })
        .setOrigin(0.5).setLetterSpacing(3),
    ]);
  }

  setupInput() {
    this.input.keyboard.on('keydown', (ev) => {
      if (KEYS[ev.code]) return this.tryMove(KEYS[ev.code]);
      switch (ev.code) {
        case 'KeyZ': case 'Backspace': this.undo(); break;
        case 'KeyR': this.restart(); break;
        case 'Enter': case 'Space': if (this.state.status === 'won' && this.overlay.visible) this.nextLevel(); break;
        case 'KeyM': this.sound.mute = !this.sound.mute; break;
        case 'BracketRight': this.gotoLevel(this.levelIndex + 1); break; // dev shortcut
        case 'BracketLeft': this.gotoLevel(this.levelIndex - 1); break;
      }
    });
  }

  // ---------- turn handling ----------

  tryMove(dir) {
    if (this.state.status !== 'play' || this.busy) return;
    const { state, changed, events } = step(this.level, this.state, dir);
    if (!changed) {
      for (const e of events) this.react(e);
      sfx(this, 'bump', 0.4);
      return;
    }
    this.history.push(this.state);
    this.state = state;
    this.syncAll(false, events);
    let stepped = false;
    for (const e of events) {
      if (e.type === 'move' && !stepped) { stepped = true; sfx(this, `step_${e.st === STATE.FROZEN ? 'solid' : e.st}`, 0.5); }
      this.react(e);
    }
    this.refreshHud();
  }

  react(e) {
    switch (e.type) {
      case 'bump': this.doNudge(e.who, e.dir.x * 7, e.dir.y * 7); break;
      case 'stuck': this.doNudge(e.who, 3, 0, 3); break;
      case 'state':
        this.time.delayedCall(110, () => {
          const d = this.disp[e.who];
          this.bursts[e.who].explode(e.to === STATE.GAS ? 22 : 12, d.x, d.y);
          this.pop[e.who].v = 1.35;
          this.tweens.add({ targets: this.pop[e.who], v: 1, duration: 260, ease: 'Back.easeOut' });
          sfx(this, e.to === STATE.GAS ? 'boil' : e.to === STATE.LIQUID ? 'melt' : 'freeze', 0.5);
        });
        break;
      case 'push': case 'shove': sfx(this, 'push', 0.5); break;
      case 'fill': this.time.delayedCall(140, () => { this.refreshTiles(); this.cameras.main.shake(90, 0.004); }); break;
      case 'fall': this.time.delayedCall(120, () => sfx(this, 'fall', 0.6)); break;
      case 'tether':
        if (e.on && !this.tetherOn) sfx(this, 'tether', 0.4);
        this.tetherOn = e.on;
        break;
      case 'win': this.busy = true; this.time.delayedCall(170, () => this.celebrate()); break;
      case 'lose': this.time.delayedCall(320, () => this.showLose(e)); break;
    }
  }

  doNudge(who, dx, dy, repeat = 0) {
    const n = this.nudge[who];
    this.tweens.killTweensOf(n);
    n.x = 0; n.y = 0;
    this.tweens.add({ targets: n, x: dx, y: dy, duration: 55, yoyo: true, repeat, ease: 'Sine.easeOut' });
  }

  undo() {
    if (!this.history.length || this.busy) return;
    this.state = this.history.pop();
    this.afterRewind();
    sfx(this, 'undo', 0.5);
  }

  restart() {
    if (this.busy || this.state === this.initial) return;
    this.history.push(this.state); // restart itself can be undone
    this.state = this.initial;
    this.afterRewind();
    sfx(this, 'undo', 0.5);
  }

  afterRewind() {
    this.overlay.setVisible(false);
    this.tetherOn = !this.state.sol.fallen && !this.state.cryo.fallen && adjacent(this.state.sol, this.state.cryo);
    this.syncAll(true);
  }

  gotoLevel(i) {
    if (i < 0 || i >= LEVELS.length) return;
    this.scene.restart({ level: i });
  }

  nextLevel() {
    this.busy = true;
    const last = this.levelIndex === LEVELS.length - 1;
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.uiCam.fadeOut(450, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (last) this.scene.start('End');
      else this.scene.restart({ level: this.levelIndex + 1 });
    });
  }

  // ---------- syncing visuals to state ----------

  syncAll(instant, events = []) {
    const s = this.state;
    for (const k of ELEMENTS) {
      const e = s[k], d = this.disp[k];
      const tx = e.x * TS + TS / 2, ty = e.y * TS + TS / 2;
      this.tweens.killTweensOf(d);
      if (instant) Object.assign(d, { x: tx, y: ty, scale: e.fallen ? 0 : 1, alpha: e.fallen ? 0 : 1 });
      else {
        this.tweens.add({ targets: d, x: tx, y: ty, duration: 130, ease: 'Quad.easeOut' });
        if (e.fallen) this.tweens.add({ targets: d, scale: 0, alpha: 0, delay: 110, duration: 380, ease: 'Back.easeIn' });
      }
    }

    const live = new Set(s.blocks.map((b) => b.id));
    for (const b of s.blocks) {
      let spr = this.blockSprites.get(b.id);
      const tx = b.x * TS + TS / 2, ty = b.y * TS + TS / 2;
      if (!spr) {
        spr = this.w(this.add.image(tx, ty, 'block').setDisplaySize(TS * 0.88, TS * 0.88));
        this.blockSprites.set(b.id, spr);
      }
      this.tweens.killTweensOf(spr);
      if (instant) spr.setPosition(tx, ty);
      else this.tweens.add({ targets: spr, x: tx, y: ty, duration: 130, ease: 'Quad.easeOut' });
    }
    for (const [id, spr] of this.blockSprites) {
      if (live.has(id)) continue;
      this.blockSprites.delete(id);
      const fill = events.find((e) => e.type === 'fill' && e.id === id);
      if (instant || !fill) { spr.destroy(); continue; }
      this.tweens.add({
        targets: spr, x: fill.x * TS + TS / 2, y: fill.y * TS + TS / 2,
        scaleX: spr.scaleX * 0.8, scaleY: spr.scaleY * 0.8, duration: 160, ease: 'Quad.easeIn',
        onComplete: () => spr.destroy(),
      });
    }

    if (instant) this.refreshTiles();
    this.refreshHud();
  }

  refreshTiles() {
    const { w, h } = this.level;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const filled = this.state.filled.includes(`${x},${y}`);
      this.tiles[y][x].setTexture(filled ? 'tile_bridge' : TERRAIN_TEX[this.level.terrain[y][x]]).setDisplaySize(TS, TS);
    }
  }

  refreshHud() {
    const s = this.state, lv = this.level;
    const g = this.hudG.clear();
    const bar = (x, y, wdt, hgt, frac, color) => {
      g.fillStyle(0x1b1f28).fillRect(x, y, wdt, hgt);
      g.fillStyle(color).fillRect(x, y, Math.max(0, wdt * Phaser.Math.Clamp(frac, 0, 1)), hgt);
    };
    const heatFrac = s.heat / lv.heat;
    const low = heatFrac <= 0.25;
    bar(W - 380, 72, 340, 6, heatFrac, low ? 0xff4d5e : 0xff8a3d);
    this.heatText.setText(`${Math.max(0, s.heat)}`).setColor(low ? CSS.danger : CSS.text);
    const xs = { sol: W - 380, cryo: W - 200 };
    for (const k of ELEMENTS) {
      const e = s[k];
      bar(xs[k], 104, 160, 4, e.mass / lv.mass, COL[k]);
      this.massText[k].setText(`${NAMES[k]} · ${e.fallen ? 'LOST' : e.st.toUpperCase()}  ${Math.max(0, e.mass)}`);
      this.labels[k].setText(e.st.toUpperCase());
    }
  }

  // ---------- outcomes ----------

  showOverlay(title, sub, color) {
    const [, t, st] = this.overlay.list;
    t.setText(title).setColor(color);
    st.setText(sub);
    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300 });
  }

  showLose(e) {
    if (this.state.status !== 'lost') return; // undone before the message appeared
    const name = NAMES[e.who];
    const title = e.reason === 'fell' ? `${name} FELL INTO THE VOID`
      : e.reason === 'evaporated' ? `${name} EVAPORATED` : 'THE CRUCIBLE WENT COLD';
    this.cameras.main.flash(220, 110, 20, 30);
    sfx(this, 'fail', 0.6);
    this.showOverlay(title, 'Z  UNDO          R  RESTART', CSS.danger);
  }

  celebrate() {
    const a = this.disp.sol, b = this.disp.cryo;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    this.tetherOn = false;
    this.tweens.add({ targets: [a, b], x: mx, y: my, scale: 0.4, duration: 380, ease: 'Cubic.easeIn' });
    this.time.delayedCall(380, () => {
      a.alpha = b.alpha = 0;
      this.alloy = { x: mx, y: my, scale: 0 };
      this.tweens.add({ targets: this.alloy, scale: 1, duration: 600, ease: 'Elastic.easeOut' });
      this.bursts.alloy.explode(70, mx, my);
      this.cameras.main.shake(320, 0.012);
      this.cameras.main.flash(260, 255, 230, 180);
      sfx(this, 'fuse', 0.8);
    });
    const last = this.levelIndex === LEVELS.length - 1;
    this.time.delayedCall(1300, () => {
      this.showOverlay('CORE STABILISED', last ? 'PRESS ENTER' : 'PRESS ENTER FOR NEXT CHAMBER', '#ffd88a');
      this.busy = false;
    });
  }

  // ---------- per-frame drawing ----------

  update(time) {
    const t = time / 1000;
    for (const k of ELEMENTS) this.drawElement(k, t);
    this.drawTether(t);
    this.drawFx(t);
    this.drawAlloy(t);
    if (this.vignette) {
      const heatFrac = Phaser.Math.Clamp(this.state.heat / this.level.heat, 0, 1);
      this.vignette.radius = 0.55 + 0.35 * heatFrac;
      this.vignette.strength = 0.35 + 0.25 * (1 - heatFrac);
    }
  }

  drawElement(k, t) {
    const g = this.gfx[k].clear();
    const e = this.state[k], d = this.disp[k], n = this.nudge[k];
    const label = this.labels[k];
    if (d.alpha <= 0.01) { label.setVisible(false); return; }
    const phase = k === 'sol' ? 0 : 2;
    const x = d.x + n.x;
    const y = d.y + n.y + Math.sin(t * 2.2 + phase) * 1.5;
    const mass = Phaser.Math.Clamp(e.mass / this.level.mass, 0, 1);
    const r = TS * 0.25 * (0.6 + 0.4 * mass) * d.scale * this.pop[k].v;
    const c = COL[k];
    g.setAlpha(d.alpha);
    label.setVisible(true).setPosition(x, d.y + TS * 0.36);

    switch (e.st) {
      case STATE.SOLID:
      case STATE.FROZEN: {
        if (k === 'sol') {
          g.fillStyle(c, e.st === STATE.FROZEN ? 0.55 : 1).fillRoundedRect(x - r, y - r, r * 2, r * 2, r * 0.3);
          g.fillStyle(lighten(c, 18), 0.9).fillRoundedRect(x - r * 0.55, y - r * 0.55, r * 1.1, r * 1.1, r * 0.2);
        } else {
          const R = r * 1.3, R2 = R * 0.55;
          g.fillStyle(c, 1).fillPoints([{ x, y: y - R }, { x: x + R, y }, { x, y: y + R }, { x: x - R, y }], true);
          g.fillStyle(lighten(c, 18), 0.9).fillPoints([{ x, y: y - R2 }, { x: x + R2, y }, { x, y: y + R2 }, { x: x - R2, y }], true);
        }
        if (e.st === STATE.FROZEN) {
          g.fillStyle(0xd8f3ff, 0.3).fillRoundedRect(x - r * 1.15, y - r * 1.15, r * 2.3, r * 2.3, r * 0.3);
          g.lineStyle(2.5, 0xeafaff, 0.95).strokeRoundedRect(x - r * 1.15, y - r * 1.15, r * 2.3, r * 2.3, r * 0.3);
          g.lineStyle(1.5, 0xeafaff, 0.7).lineBetween(x - r * 0.8, y - r * 0.2, x - r * 0.1, y + r * 0.3)
            .lineBetween(x - r * 0.1, y + r * 0.3, x + r * 0.6, y - r * 0.5);
        }
        break;
      }
      case STATE.LIQUID: {
        const pts = [];
        for (let i = 0; i < 28; i++) {
          const ang = (i / 28) * Math.PI * 2;
          const rr = r * 1.15 * (1 + 0.08 * Math.sin(3 * ang + t * 5 + phase) + 0.05 * Math.sin(5 * ang - t * 3.4));
          pts.push({ x: x + Math.cos(ang) * rr, y: y + Math.sin(ang) * rr * 0.92 });
        }
        g.fillStyle(c, 0.92).fillPoints(pts, true);
        g.fillStyle(0xffffff, 0.35).fillEllipse(x - r * 0.35, y - r * 0.4, r * 0.6, r * 0.35);
        break;
      }
      case STATE.GAS: {
        g.fillStyle(c, 0.14).fillCircle(x, y, r * 1.4);
        g.lineStyle(2.5, c, 0.85).strokeCircle(x, y, r * (1.25 + 0.08 * Math.sin(t * 4)));
        for (let i = 0; i < 7; i++) {
          const ang = t * 1.6 + (i / 7) * Math.PI * 2;
          const rr = r * (0.55 + 0.3 * Math.sin(t * 3 + i));
          g.fillStyle(lighten(c, 20), 0.85).fillCircle(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 2.6);
        }
        break;
      }
    }
  }

  drawTether(t) {
    const g = this.tether.clear();
    if (!this.tetherOn) return;
    const a = this.disp.sol, b = this.disp.cryo;
    if (a.alpha < 0.5 || b.alpha < 0.5) return;
    const segs = 8;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const j = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 7;
      pts.push({ x: a.x + dx * f + nx * j, y: a.y + dy * f + ny * j });
    }
    const alpha = 0.6 + 0.25 * Math.sin(t * 9);
    const half = segs / 2;
    g.lineStyle(4, COL.sol, alpha * 0.7).strokePoints(pts.slice(0, half + 1));
    g.lineStyle(4, COL.cryo, alpha * 0.7).strokePoints(pts.slice(half));
    g.lineStyle(1.5, 0xffffff, alpha).strokePoints(pts);
  }

  drawFx(t) {
    const g = this.fx.clear();
    const { w, h } = this.level;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const tt = terrainAt(this.level, this.state, x, y);
      if (tt === TILE.HOT) {
        g.fillStyle(0xff5a1f, 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 2.2 + x * 1.3 + y * 0.7)));
        g.fillRect(x * TS, y * TS, TS, TS);
      } else if (tt === TILE.COLD) {
        g.fillStyle(0x5ec8ff, 0.025 + 0.03 * (0.5 + 0.5 * Math.sin(t * 1.4 + x * 0.9 - y)));
        g.fillRect(x * TS, y * TS, TS, TS);
      }
    }
    const heat = Phaser.Math.Clamp(this.state.heat / this.level.heat, 0, 1);
    if (!this.crucibles.length || heat <= 0) return;
    const cx = this.crucibles.reduce((s, p) => s + p.x, 0) / this.crucibles.length * TS + TS / 2;
    const cy = this.crucibles.reduce((s, p) => s + p.y, 0) / this.crucibles.length * TS + TS / 2;
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xff7a2f, 0.045 * heat);
      g.fillCircle(cx, cy, TS * (0.55 + i * 0.32) * (1 + 0.03 * Math.sin(t * 7 + i)));
    }
    for (const p of this.crucibles) {
      g.fillStyle(0xffb36b, (0.18 + 0.06 * Math.sin(t * 5 + p.x)) * heat);
      g.fillCircle(p.x * TS + TS / 2, p.y * TS + TS / 2, TS * 0.3);
    }
  }

  drawAlloy(t) {
    const g = this.alloyG.clear();
    if (!this.alloy) return;
    const { x, y, scale } = this.alloy;
    const r = TS * 0.32 * scale * (1 + 0.05 * Math.sin(t * 4));
    g.fillStyle(COL.alloy, 1).fillRoundedRect(x - r, y - r, r * 2, r * 2, r * 0.35);
    g.fillStyle(COL.sol, 0.8).fillRoundedRect(x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2, r * 0.25);
    g.fillStyle(COL.cryo, 0.9).fillRoundedRect(x - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56, r * 0.12);
  }
}
