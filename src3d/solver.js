// BFS over 3D game states (same idea as src/solver.js). Uses the exact same step() as the game.
import { step, DIRS } from './rules.js';

const DIR_NAMES = Object.keys(DIRS);

function key(s, ignoreMass) {
  const e = (p) => `${p.x},${p.y},${p.z},${p.st},${ignoreMass ? '' : p.mass},${p.fallen ? 1 : 0}`;
  const blocks = s.blocks.map((b) => `${b.x},${b.y},${b.z}`).sort().join(';');
  return `${e(s.sol)}|${e(s.cryo)}|${blocks}`;
}

// ignoreMass: only safe when mass can't run out (used for the 'true minimum' check).
export function solve(level, initial, { maxNodes = 400000, ignoreMass = false } = {}) {
  const seen = new Set([key(initial, ignoreMass)]);
  const nodes = [{ state: initial, parent: -1, dir: null }];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes.length > maxNodes) return { solved: false, exhausted: false, explored: nodes.length };
    const cur = nodes[i].state;
    for (const dir of DIR_NAMES) {
      const { state, changed } = step(level, cur, dir);
      if (!changed || state.status === 'lost') continue;
      const k = key(state, ignoreMass);
      if (seen.has(k)) continue;
      seen.add(k);
      nodes.push({ state, parent: i, dir });
      if (state.status === 'won') {
        const path = [];
        for (let n = nodes.length - 1; n > 0; n = nodes[n].parent) path.unshift(nodes[n].dir);
        return { solved: true, moves: path.length, path, explored: nodes.length };
      }
    }
  }
  return { solved: false, exhausted: true, explored: nodes.length };
}
