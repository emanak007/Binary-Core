// Image assets + code-drawn placeholders.
// Put a PNG at any path below and it replaces the placeholder automatically.
// Any size works — tiles are scaled to fit their grid square.

export const TS = 64; // world units per grid tile

export const IMAGES = {
  tile_warm: 'assets/tiles/warm.png',
  tile_cold: 'assets/tiles/cold.png',
  tile_hot: 'assets/tiles/hot.png',
  tile_wall: 'assets/tiles/wall.png',
  tile_grate: 'assets/tiles/grate.png',
  tile_gap: 'assets/tiles/gap.png',
  tile_crucible: 'assets/tiles/crucible.png',
  tile_bridge: 'assets/tiles/bridge.png',
  block: 'assets/objects/block.png',
  bg_reactor: 'assets/backgrounds/reactor.png',
  bg_title: 'assets/backgrounds/title.png',
};

export const TERRAIN_TEX = {
  '.': 'tile_warm', c: 'tile_cold', h: 'tile_hot', W: 'tile_wall',
  '#': 'tile_grate', _: 'tile_gap', X: 'tile_crucible',
};

export function makeFallbackTextures(scene) {
  const make = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const panel = (g, base, inner, edge) => {
    g.fillStyle(base); g.fillRect(0, 0, TS, TS);
    g.fillStyle(inner); g.fillRect(2, 2, TS - 4, TS - 4);
    g.lineStyle(1, edge, 1); g.strokeRect(0.5, 0.5, TS - 1, TS - 1);
  };
  const rivets = (g, color) => {
    g.fillStyle(color);
    for (const [x, y] of [[7, 7], [TS - 7, 7], [7, TS - 7], [TS - 7, TS - 7]]) g.fillCircle(x, y, 1.6);
  };

  make('tile_warm', TS, TS, (g) => { panel(g, 0x1a1e27, 0x20242f, 0x2b3140); rivets(g, 0x323949); });

  make('tile_cold', TS, TS, (g) => {
    panel(g, 0x132130, 0x172a3b, 0x2a4b66);
    g.lineStyle(1, 0x5d9cc4, 0.45);
    for (const [x1, y1, x2, y2] of [[10, 18, 26, 10], [30, 50, 52, 36], [14, 44, 22, 52], [40, 14, 54, 22]]) g.lineBetween(x1, y1, x2, y2);
    rivets(g, 0x2f5470);
  });

  make('tile_hot', TS, TS, (g) => {
    panel(g, 0x261009, 0x30150d, 0x5a2412);
    g.lineStyle(2, 0xff6a2b, 0.55);
    g.beginPath(); g.moveTo(8, 20); g.lineTo(22, 26); g.lineTo(30, 18); g.lineTo(44, 30); g.lineTo(56, 24); g.strokePath();
    g.beginPath(); g.moveTo(12, 48); g.lineTo(26, 40); g.lineTo(38, 50); g.lineTo(54, 44); g.strokePath();
    rivets(g, 0x6b2c16);
  });

  make('tile_wall', TS, TS, (g) => {
    g.fillStyle(0x0b0c10); g.fillRect(0, 0, TS, TS);
    g.fillStyle(0x262a34); g.fillRect(0, 0, TS, 5);
    g.fillStyle(0x14161c); g.fillRect(3, 8, TS - 6, TS - 11);
    g.lineStyle(1, 0x1d2028, 1); g.lineBetween(3, TS / 2, TS - 3, TS / 2);
    rivets(g, 0x2a2e38);
  });

  make('tile_grate', TS, TS, (g) => {
    panel(g, 0x1a1e27, 0x0c0e12, 0x2b3140);
    g.fillStyle(0x4f5868);
    for (let x = 6; x < TS - 4; x += 9) g.fillRect(x, 5, 4, TS - 10);
    g.fillStyle(0x6b7588); g.fillRect(4, 5, TS - 8, 3); g.fillRect(4, TS - 8, TS - 8, 3);
  });

  make('tile_gap', TS, TS, (g) => {
    g.fillStyle(0x020203); g.fillRect(0, 0, TS, TS);
    g.lineStyle(6, 0x0a0b0f, 1); g.strokeRect(3, 3, TS - 6, TS - 6);
    g.fillStyle(0x3a4256, 0.8);
    for (const [x, y] of [[14, 20], [44, 12], [34, 40], [52, 50], [18, 52]]) g.fillCircle(x, y, 0.9);
  });

  make('tile_crucible', TS, TS, (g) => {
    panel(g, 0x1a0d07, 0x22110a, 0x4a1f0d);
    g.fillStyle(0x3a1909); g.fillCircle(TS / 2, TS / 2, TS * 0.42);
    g.lineStyle(3, 0xff8a3d, 0.9); g.strokeCircle(TS / 2, TS / 2, TS * 0.38);
    g.fillStyle(0xff5a1f, 0.35); g.fillCircle(TS / 2, TS / 2, TS * 0.28);
  });

  make('tile_bridge', TS, TS, (g) => {
    g.fillStyle(0x020203); g.fillRect(0, 0, TS, TS);
    g.fillStyle(0x2e333d); g.fillRect(5, 5, TS - 10, TS - 10);
    g.lineStyle(2, 0x4a5262, 1); g.strokeRect(5, 5, TS - 10, TS - 10);
  });

  make('block', TS, TS, (g) => {
    g.fillStyle(0x363b46); g.fillRoundedRect(3, 3, TS - 6, TS - 6, 6);
    g.lineStyle(3, 0x8a93a6, 1); g.strokeRoundedRect(3, 3, TS - 6, TS - 6, 6);
    g.lineStyle(3, 0x555c6b, 1); g.lineBetween(12, 12, TS - 12, TS - 12); g.lineBetween(TS - 12, 12, 12, TS - 12);
  });

  make('spark', 8, 8, (g) => { g.fillStyle(0xffffff); g.fillCircle(4, 4, 4); });
}
