// Pure game rules. No Phaser, no DOM — the game, undo and the solver all use this.

export const TILE = {
  WALL: 'W', WARM: '.', COLD: 'c', HOT: 'h', GRATE: '#', GAP: '_', CRUCIBLE: 'X',
};
export const STATE = { FROZEN: 'frozen', SOLID: 'solid', LIQUID: 'liquid', GAS: 'gas' };
export const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
export const ELEMENTS = ['sol', 'cryo'];

// Temperature of floor tiles. Grates, gaps and the Crucible have none:
// an element keeps whatever state it had on the last floor tile.
const TEMP = { c: 0, '.': 1, h: 2 };
const STATE_BY_TEMP = {
  cryo: [STATE.SOLID, STATE.LIQUID, STATE.GAS],  // volatile: boils easily
  sol: [STATE.FROZEN, STATE.SOLID, STATE.LIQUID], // dense: hard to melt, freezes solid in the cold
};
const FLOORS = new Set([TILE.WARM, TILE.COLD, TILE.HOT]);

export function stateFor(kind, terrain, prev) {
  const t = TEMP[terrain];
  return t === undefined ? prev : STATE_BY_TEMP[kind][t];
}

// Map legend: terrain chars above, plus objects that sit on warm floor:
//   S = Sol start, C = Cryo start, B = block
export function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const terrain = [];
  const blocks = [];
  let sol = null, cryo = null, crucibles = 0;
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? TILE.WALL;
      if (ch === 'S') { sol = { x, y }; row.push(TILE.WARM); }
      else if (ch === 'C') { cryo = { x, y }; row.push(TILE.WARM); }
      else if (ch === 'B') { blocks.push({ id: blocks.length, x, y }); row.push(TILE.WARM); }
      else if (Object.values(TILE).includes(ch)) { row.push(ch); if (ch === TILE.CRUCIBLE) crucibles++; }
      else throw new Error(`Level "${def.name}": unknown tile '${ch}' at ${x},${y}`);
    }
    terrain.push(row);
  }
  if (!sol || !cryo) throw new Error(`Level "${def.name}" needs both S and C`);
  if (crucibles < 2) throw new Error(`Level "${def.name}" needs 2 Crucible (X) tiles`);

  const level = { ...def, w, h, terrain };
  const mk = (kind, p) => ({
    x: p.x, y: p.y, mass: def.mass, fallen: false,
    st: stateFor(kind, level.terrain[p.y][p.x], kind === 'sol' ? STATE.SOLID : STATE.LIQUID),
  });
  const state = {
    sol: mk('sol', sol), cryo: mk('cryo', cryo), blocks, filled: [],
    heat: def.heat, turn: 0, status: 'play', reason: null,
  };
  return { level, state };
}

export function terrainAt(level, s, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return TILE.WALL;
  if (s.filled.includes(`${x},${y}`)) return TILE.WARM;
  return level.terrain[y][x];
}

export const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const blockAt = (s, x, y) => s.blocks.findIndex((b) => b.x === x && b.y === y);
const elementAt = (s, x, y) => ELEMENTS.find((k) => !s[k].fallen && s[k].x === x && s[k].y === y);

// Advance one turn. Returns { state, changed, events } — events drive animation & sound.
export function step(level, prev, dirName) {
  if (prev.status !== 'play') return { state: prev, changed: false, events: [] };
  const d = DIRS[dirName];
  const s = structuredClone(prev);
  const events = [];

  // Both move the same direction. Resolve the element further along first,
  // so the one behind can follow into the tile it just left.
  const proj = (e) => e.x * d.x + e.y * d.y;
  const order = [...ELEMENTS].sort((a, b) => proj(s[b]) - proj(s[a]));
  for (const who of order) moveElement(level, s, who, d, events);

  const changed = events.some((e) => e.type === 'move');
  if (!changed) return { state: prev, changed: false, events };

  s.turn++;
  s.heat -= 1;
  const together = !s.sol.fallen && !s.cryo.fallen && adjacent(s.sol, s.cryo);
  if (!together) {
    for (const k of ELEMENTS) s[k].mass -= s[k].st === STATE.GAS ? 2 : 1;
  }
  events.push({ type: 'tether', on: together });

  if (s.status === 'play') {
    const onX = (e) => terrainAt(level, s, e.x, e.y) === TILE.CRUCIBLE;
    const evap = ELEMENTS.find((k) => s[k].mass <= 0);
    if (onX(s.sol) && onX(s.cryo)) { s.status = 'won'; events.push({ type: 'win' }); }
    else if (evap) lose(s, events, 'evaporated', evap);
    else if (s.heat <= 0) lose(s, events, 'cold');
  }
  return { state: s, changed: true, events };
}

function lose(s, events, reason, who = null) {
  s.status = 'lost';
  s.reason = { reason, who };
  events.push({ type: 'lose', reason, who });
}

function moveElement(level, s, who, d, events) {
  const e = s[who];
  if (e.fallen) return;
  if (e.st === STATE.FROZEN) { events.push({ type: 'stuck', who }); return; }

  const tx = e.x + d.x, ty = e.y + d.y;
  const ter = terrainAt(level, s, tx, ty);
  const bump = () => events.push({ type: 'bump', who, dir: d });
  const fluid = e.st === STATE.LIQUID || e.st === STATE.GAS;

  if (ter === TILE.WALL) return bump();
  if (ter === TILE.GRATE && !fluid) return bump();

  const other = elementAt(s, tx, ty);
  if (other) {
    // Symbiosis: solid Cryo can shove a frozen Sol along.
    const canShove = who === 'cryo' && e.st === STATE.SOLID && s[other].st === STATE.FROZEN;
    if (!canShove || !pushElement(level, s, other, d, events)) return bump();
  }

  const bi = blockAt(s, tx, ty);
  if (bi >= 0 && (e.st !== STATE.SOLID || !pushBlock(level, s, bi, d, events))) return bump();

  relocate(level, s, who, tx, ty, events);
}

function pushElement(level, s, who, d, events) {
  const e = s[who];
  const nx = e.x + d.x, ny = e.y + d.y;
  const ter = terrainAt(level, s, nx, ny);
  if (ter === TILE.WALL || ter === TILE.GRATE) return false;
  if (blockAt(s, nx, ny) >= 0 || elementAt(s, nx, ny)) return false;
  events.push({ type: 'shove', who });
  relocate(level, s, who, nx, ny, events);
  return true;
}

function pushBlock(level, s, bi, d, events) {
  const b = s.blocks[bi];
  const nx = b.x + d.x, ny = b.y + d.y;
  const ter = terrainAt(level, s, nx, ny);
  if (blockAt(s, nx, ny) >= 0 || elementAt(s, nx, ny)) return false;
  if (ter === TILE.GAP) {
    // Block drops in and becomes a bridge.
    s.blocks.splice(bi, 1);
    s.filled.push(`${nx},${ny}`);
    events.push({ type: 'fill', id: b.id, x: nx, y: ny });
    return true;
  }
  if (!FLOORS.has(ter)) return false;
  b.x = nx; b.y = ny;
  events.push({ type: 'push', id: b.id, x: nx, y: ny });
  return true;
}

function relocate(level, s, who, x, y, events) {
  const e = s[who];
  const from = { x: e.x, y: e.y };
  e.x = x; e.y = y;
  const ter = terrainAt(level, s, x, y);
  events.push({ type: 'move', who, from, to: { x, y }, st: e.st });
  if (ter === TILE.GAP && e.st !== STATE.GAS) {
    e.fallen = true;
    events.push({ type: 'fall', who });
    if (s.status === 'play') lose(s, events, 'fell', who);
    return;
  }
  const next = stateFor(who, ter, e.st);
  if (next !== e.st) {
    events.push({ type: 'state', who, from: e.st, to: next });
    e.st = next;
  }
}
