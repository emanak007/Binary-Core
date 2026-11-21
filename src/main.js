import { GameScene, W, H, FONT, COL } from './game.js';
import { IMAGES, makeFallbackTextures } from './textures.js';
import { SOUND_KEYS, sfx, ensureMusic } from './audio.js';
import { LEVELS } from './levels.js';

class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // Missing files are fine — they fail quietly and placeholders are used instead.
    this.load.on('loaderror', () => {});
    for (const [key, path] of Object.entries(IMAGES)) this.load.image(key, path);
    for (const key of SOUND_KEYS) this.load.audio(key, `assets/audio/${key}.mp3`);
  }
  create() {
    makeFallbackTextures(this);
    // ?level=3 jumps straight into a chamber (handy while building levels).
    const lvl = Number(new URLSearchParams(location.search).get('level'));
    if (lvl >= 1 && lvl <= LEVELS.length) this.scene.start('Game', { level: lvl - 1 });
    else this.scene.start('Title');
  }
}

function drawPair(g, t, cx, cy, radius) {
  g.clear();
  const pos = (off) => ({ x: cx + Math.cos(t + off) * radius, y: cy + Math.sin(t + off) * radius * 0.45 });
  const a = pos(0), b = pos(Math.PI);
  const r = 22;
  g.lineStyle(2, 0xffffff, 0.35).lineBetween(a.x, a.y, b.x, b.y);
  g.fillStyle(COL.sol).fillRoundedRect(a.x - r, a.y - r, r * 2, r * 2, 7);
  const R = r * 1.3;
  g.fillStyle(COL.cryo).fillPoints([{ x: b.x, y: b.y - R }, { x: b.x + R, y: b.y }, { x: b.x, y: b.y + R }, { x: b.x - R, y: b.y }], true);
}

class Title extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    this.cameras.main.setBackgroundColor(COL.bg);
    const webgl = this.game.renderer.type === Phaser.WEBGL;
    if (this.textures.exists('bg_title')) {
      const bg = this.add.image(W / 2, H / 2, 'bg_title');
      bg.setScale(Math.max(W / bg.width, H / bg.height));
    }
    const title = this.add.text(W / 2, H * 0.3, 'BINARY CORE', {
      fontFamily: FONT, fontSize: '110px', fontStyle: '700', color: '#ffffff',
    }).setOrigin(0.5).setLetterSpacing(14);
    if (webgl) title.preFX.addGlow(0xff9a4d, 3, 0, false, 0.1, 14);
    this.add.text(W / 2, H * 0.3 + 78, 'TWO ELEMENTS.  ONE CRUCIBLE.  FUSE OR FADE.', {
      fontFamily: FONT, fontSize: '22px', fontStyle: '600', color: '#7c8496',
    }).setOrigin(0.5).setLetterSpacing(5);

    this.pair = this.add.graphics();
    if (webgl) this.pair.postFX.addGlow(0xffffff, 3, 0, false, 0.1, 10);

    const prompt = this.add.text(W / 2, H * 0.8, 'PRESS ENTER', {
      fontFamily: FONT, fontSize: '26px', fontStyle: '700', color: '#ffd88a',
    }).setOrigin(0.5).setLetterSpacing(6);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 800, yoyo: true, repeat: -1 });
    this.add.text(W / 2, H - 34, 'ARROWS / WASD  move both elements     Z  undo     R  restart', {
      fontFamily: FONT, fontSize: '15px', fontStyle: '700', color: '#555d6e',
    }).setOrigin(0.5).setLetterSpacing(2);

    const start = () => {
      ensureMusic(this);
      sfx(this, 'tether', 0.5);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { level: 0 }));
    };
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }
  update(time) { drawPair(this.pair, time / 900, W / 2, H * 0.58, 110); }
}

class End extends Phaser.Scene {
  constructor() { super('End'); }
  create() {
    this.cameras.main.setBackgroundColor(COL.bg).fadeIn(800, 0, 0, 0);
    sfx(this, 'vo_end', 1);
    this.add.text(W / 2, H * 0.38, 'THE SHIP AWAKENS', {
      fontFamily: FONT, fontSize: '84px', fontStyle: '700', color: '#ffd88a',
    }).setOrigin(0.5).setLetterSpacing(10);
    this.add.text(W / 2, H * 0.38 + 70, 'Sol and Cryo are one. The core burns again.', {
      fontFamily: FONT, fontSize: '24px', fontStyle: '500', color: '#a3abbc',
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.75, 'THANKS FOR PLAYING  ·  ENTER TO RETURN', {
      fontFamily: FONT, fontSize: '18px', fontStyle: '700', color: '#555d6e',
    }).setOrigin(0.5).setLetterSpacing(4);
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Title'));
  }
}

async function boot() {
  // Wait briefly for the web font so canvas text doesn't render in a fallback font.
  try { await Promise.race([Promise.all(['500', '600', '700'].map((w) => document.fonts.load(`${w} 20px Rajdhani`))), new Promise((r) => setTimeout(r, 1500))]); } catch {}
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: COL.bg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Boot, Title, GameScene, End],
  });
}
boot();
