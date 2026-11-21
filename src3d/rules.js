// Pure 3D game rules (see SPEC3D.md). No Three.js, no DOM.
//
// Spec clarifications (no API changes):
//  - Win requires both elements to REST on an X block and not be GAS (gas isn't supported, it floats).
//  - GAS stays gas until it enters a cold vent or rests (blocked above) on something COLD
//    (a 'c' block or Cryo). Warm/hot floors under a ceiling don't condense it, so gas can drift
//    along ceilings and cold vents matter.
//  - Crates falling below z=0 are removed; their 'blockfall' event has to.z === -1.

export const DIRS = {
  north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 },
};
export const STATE = { FROZEN: 'frozen', SOLID: 'solid', LIQUID: 'liquid', GAS: 'gas' };
export const ELEMENTS = ['sol', 'cryo'];

const AIR = new Set(['.', '^', 'v']);
const TEMP = { c: 0, '#': 1, h: 2 };
const STATE_BY_TEMP = {
  cryo: [STATE.SOLID, STATE.LIQUID, STATE.GAS],
  sol: [STATE.FROZEN, STATE.SOLID, STATE.LIQUID],
};
const STATIC_CHARS = new Set(['.', '^', 'v', '#', 'c', 'h', '=', 'X']);

export const adjacent = (a, b) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) === 1;

export function parseLevel(def) {
  const layers = def.layers;
  const h = layers.length;
  const d = layers[0].length;
  const w = Math.max(...layers[0].map((r) => r.length));
  const cells = [];
  const blocks = [];
  let sol = null, cryo = null, crucibles = 0;
  for (let z = 0; z < h; z++) {
    const layer = [];
    for (let y = 0; y < d; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const ch = layers[z][y]?.[x] ?? '#';
        if (ch === 'S') { sol = { x, y, z }; row.push('.'); }
        else if (ch === 'C') { cryo = { x, y, z }; row.push('.'); }
        else if (ch === 'B') { blocks.push({ id: blocks.length, x, y, z }); row.push('.'); }
        else if (STATIC_CHARS.has(ch)) { row.push(ch); if (ch === 'X') crucibles++; }
        else throw new Error(`Level "${def.name}": unknown char '${ch}' at ${x},${y},${z}`);
      }
      layer.push(row);
    }
    cells.push(layer);
  }
  if (!sol || !cryo) throw new Error(`Level "${def.name}" needs both S and C`);
  if (crucibles !== 2) throw new Error(`Level "${def.name}" needs exactly 2 X blocks`);

  const level = { ...def, w, d, h, cells };
  const mk = (kind, p) => ({
    ...p, mass: def.mass, fallen: false, st: kind === 'sol' ? STATE.SOLID : STATE.LIQUID,
  });
  const state = {
    sol: mk('sol', sol), cryo: mk('cryo', cryo), blocks,
    heat: def.heat, turn: 0, status: 'play', reason: null,
  };
  settle(level, state, []); // starting states come from the floor they stand on
  return { level, state };
}

export function cellAt(level, x, y, z) {
  if (z < 0) return 'void';
  if (z >= level.h || x < 0 || y < 0 || x >= level.w || y >= level.d) return '#';
  return level.cells[z][y][x];
}

const fluid = (st) => st === STATE.LIQUID || st === STATE.GAS;
const passable = (ch, st) => ch === 'void' || AIR.has(ch) || (ch === '=' && fluid(st));
const cratePassable = (ch) => ch === 'void' || AIR.has(ch);
const same = (a, x, y, z) => a.x === x && a.y === y && a.z === z;
const blockAt = (s, x, y, z) => s.blocks.findIndex((b) => same(b, x, y, z));
const elementAt = (s, x, y, z) => ELEMENTS.find((k) => !s[k].fallen && same(s[k], x, y, z));
const occupied = (s, x, y, z) => blockAt(s, x, y, z) >= 0 || !!elementAt(s, x, y, z);
const pos = (p) => ({ x: p.x, y: p.y, z: p.z });

// Temperature (0/1/2) of whatever is directly below, or undefined if none.
function supportTemp(level, s, who) {
  const e = s[who];
  const below = elementAt(s, e.x, e.y, e.z - 1);
  if (below) return below === 'sol' ? 2 : 0;
  if (blockAt(s, e.x, e.y, e.z - 1) >= 0) return 1;
  return TEMP[cellAt(level, e.x, e.y, e.z - 1)];
}

function setState(s, who, next, events) {
  const e = s[who];
  if (next === e.st) return false;
  events.push({ type: 'state', who, from: e.st, to: next });
  e.st = next;
  return true;
}

export function step(level, prev, dirName) {
  if (prev.status !== 'play') return { state: prev, changed: false, events: [] };
  const d = DIRS[dirName];
  const s = structuredClone(prev);
  const events = [];

  const proj = (e) => e.x * d.x + e.y * d.y;
  const order = [...ELEMENTS].sort((a, b) => proj(s[b]) - proj(s[a]));
  for (const who of order) moveElement(level, s, who, d, events);

  const changed = events.some((e) => e.type === 'move');
  if (!changed) return { state: prev, changed: false, events };

  settle(level, s, events);

  s.turn++;
  s.heat -= 1;
  const together = !s.sol.fallen && !s.cryo.fallen && adjacent(s.sol, s.cryo);
  if (!together) for (const k of ELEMENTS) s[k].mass -= s[k].st === STATE.GAS ? 2 : 1;
  events.push({ type: 'tether', on: together });

  if (s.status === 'play') {
    const onX = (e) => !e.fallen && e.st !== STATE.GAS && cellAt(level, e.x, e.y, e.z - 1) === 'X';
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
  const tx = e.x + d.x, ty = e.y + d.y, tz = e.z;
  const bump = () => events.push({ type: 'bump', who, dir: d });
  if (!passable(cellAt(level, tx, ty, tz), e.st)) return bump();

  const other = elementAt(s, tx, ty, tz);
  if (other) {
    const canShove = who === 'cryo' && e.st === STATE.SOLID && s[other].st === STATE.FROZEN;
    if (!canShove) return bump();
    const o = s[other];
    const nx = o.x + d.x, ny = o.y + d.y;
    if (!cratePassable(cellAt(level, nx, ny, o.z)) || occupied(s, nx, ny, o.z)) return bump();
    events.push({ type: 'shove', who: other });
    const from = pos(o);
    o.x = nx; o.y = ny;
    events.push({ type: 'move', who: other, from, to: pos(o) });
  }

  const bi = blockAt(s, tx, ty, tz);
  if (bi >= 0) {
    const b = s.blocks[bi];
    const nx = b.x + d.x, ny = b.y + d.y;
    if (e.st !== STATE.SOLID || !cratePassable(cellAt(level, nx, ny, b.z)) || occupied(s, nx, ny, b.z)) return bump();
    const from = pos(b);
    b.x = nx; b.y = ny;
    events.push({ type: 'push', id: b.id, from, to: pos(b) });
  }

  const from = pos(e);
  e.x = tx; e.y = ty;
  events.push({ type: 'move', who, from, to: pos(e) });
}

// Gravity, buoyancy, vents and floor temperature until nothing changes.
function settle(level, s, events) {
  const runs = {}; // merge consecutive 1-cell vertical steps into one fall/rise event
  const flush = (key) => { if (runs[key]) { events.push(runs[key]); delete runs[key]; } };
  const vstep = (key, base, type, from, to) => {
    const r = runs[key];
    if (r && r.type === type) { r.to = to; return; }
    flush(key);
    runs[key] = { ...base, type, from, to };
  };

  const cap = 4 * level.h + 8;
  for (let iter = 0; iter < cap; iter++) {
    let changed = false;

    // Crates fall (lowest first so stacks settle cleanly).
    for (const b of [...s.blocks].sort((a, c) => a.z - c.z)) {
      const ch = cellAt(level, b.x, b.y, b.z - 1);
      if (!cratePassable(ch) || occupied(s, b.x, b.y, b.z - 1)) continue;
      const from = pos(b);
      b.z -= 1;
      changed = true;
      vstep(`b${b.id}`, { id: b.id }, 'blockfall', from, pos(b));
      if (b.z < 0) { flush(`b${b.id}`); s.blocks.splice(s.blocks.indexOf(b), 1); }
    }

    for (const who of ELEMENTS) {
      const e = s[who];
      if (e.fallen) continue;
      const here = cellAt(level, e.x, e.y, e.z);
      // Vents act on whatever is inside them.
      if (here === '^' && e.st !== STATE.GAS) { flush(who); changed = setState(s, who, STATE.GAS, events) || changed; }
      if (here === 'v' && e.st === STATE.GAS) { flush(who); changed = setState(s, who, STATE.LIQUID, events) || changed; }

      if (e.st === STATE.GAS) {
        const ch = cellAt(level, e.x, e.y, e.z + 1);
        if (passable(ch, e.st) && !occupied(s, e.x, e.y, e.z + 1)) {
          const from = pos(e); e.z += 1; changed = true;
          vstep(who, { who }, 'rise', from, pos(e));
          continue;
        }
      } else {
        const ch = cellAt(level, e.x, e.y, e.z - 1);
        if (passable(ch, e.st) && !occupied(s, e.x, e.y, e.z - 1)) {
          const from = pos(e); e.z -= 1; changed = true;
          vstep(who, { who }, 'fall', from, pos(e));
          if (e.z < 0) {
            flush(who);
            e.fallen = true;
            events.push({ type: 'void', who });
            if (s.status === 'play') lose(s, events, 'void', who);
          }
          continue;
        }
      }

      // Resting: take the temperature of what's below (vents override).
      // Inside a grate cell an element is "pooled in the bars": it keeps its state,
      // so a liquid can never turn solid while stuck inside a grate.
      if (here === '^' || here === 'v' || here === '=') continue;
      const t = supportTemp(level, s, who);
      if (t === undefined) continue;
      if (e.st === STATE.GAS && t !== 0) continue;
      const next = STATE_BY_TEMP[who][t];
      if (next !== e.st) { flush(who); changed = setState(s, who, next, events) || changed; }
    }
    if (!changed) break;
  }
  for (const k of Object.keys(runs)) flush(k);
}
