// Hint solver, off the main thread. Receives the current level + state, runs the same BFS
// the level checker uses (real heat/mass limits), and replies with the first move of the
// shortest solution from here — or { solved: false } if there's no way forward.
import { solve } from './solver.js';

self.onmessage = (e) => {
  const { id, level, state, maxNodes } = e.data;
  let res;
  try { res = solve(level, state, { maxNodes }); } catch (err) { res = { solved: false, error: String(err) }; }
  self.postMessage({ id, solved: res.solved, exhausted: res.exhausted, next: res.solved ? res.path[0] : null, moves: res.moves ?? null });
};
