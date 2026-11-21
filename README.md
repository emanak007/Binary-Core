# Binary Core

A turn-based puzzle game. Guide two elements, Sol and Cryo, into the Crucible together
before they evaporate or the Crucible goes cold.

## Run it

ES modules need a local server (opening `index.html` directly won't work):

```bash
python3 -m http.server 8765
```

- Game: http://localhost:8765
- Jump to a chamber: http://localhost:8765/?level=3
- Level solver: http://localhost:8765/tools/solve.html

In-game dev keys: `[` / `]` previous/next chamber.

## Rules

| | Cold `c` | Warm `.` | Hot `h` |
|---|---|---|---|
| **Cryo** (volatile, cyan) | Solid | Liquid | Gas |
| **Sol** (dense, amber) | Frozen (can't move) | Solid | Liquid |

- One input moves **both**. If one is blocked, the other still moves; that's how you line them up.
- **Grates `#`**: liquid or gas only. **Gaps `_`**: gas only; anything else falls.
- Grates, gaps and the Crucible have no temperature, so an element keeps its current state on them.
- **Blocks `B`**: pushed by solids only. Pushing one into a gap fills it and makes a bridge.
- Solid Cryo can push a **frozen** Sol.
- **Heat** drops 1 per turn. **Mass** drops 1 per turn (2 as gas) unless the two are adjacent.
- Win: both stand on the Crucible's 2 tiles at the same time.

## Layout

```
index.html        page + Phaser 3.90 from CDN
src/rules.js      pure game rules (step function), shared by game and solver
src/levels.js     level maps + heat/mass budgets
src/solver.js     BFS solver
src/game.js       Phaser gameplay scene (rendering, effects, HUD)
src/main.js       boot, title, ending scenes
src/textures.js   image paths + placeholder art
src/audio.js      sound paths + placeholder synth
assets/           drop real art/audio here (see ASSETS.md)
tools/solve.html  checks every level is solvable
```

After editing a level, open the solver page and check it still says solvable.
