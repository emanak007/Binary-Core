# Binary Core

**Play now:** https://emanak007.github.io/Binary-Core/

A turn-based 3D voxel puzzle game spanning 15 decks aboard the starship *Meridian*. Guide two elements — **Sol** (amber, dense) and **Cryo** (cyan, volatile) — onto the Crucible together before their mass fades or the Crucible cools. Works on desktop and mobile touchscreens.

## Controls

- **Move:** `Arrows` / `WASD` (both elements step together in camera-relative directions)
- **Rotate Camera:** `Q` / `E`
- **Undo / Restart / Hint / Pause:** `Z` / `R` / `H` / `Esc`
- **Mobile:** On-screen D-pad and action buttons

## Run Locally

ES modules require a local HTTP server (opening `index.html` directly from disk won't work):

```bash
python3 -m http.server 8765
```

- Game: http://localhost:8765
- Jump to a deck: http://localhost:8765/?level=3
- Rule tests: http://localhost:8765/tools/test3d.html
- Level solver: http://localhost:8765/tools/solve3d.html
- Legacy 2D prototype: http://localhost:8765/2d.html

In-game dev keys: `[` / `]` for previous / next deck.

## Rules

| | Cold `c` | Warm `.` | Hot `h` |
|---|---|---|---|
| **Cryo** (volatile, cyan) | Solid | Liquid | Gas |
| **Sol** (dense, amber) | Frozen (can't move) | Solid | Liquid |

- One input moves **both**. If one is blocked, the other still moves — use walls and crates to align them.
- **Gravity:** Solids and liquids fall; **gas** rises. **Grates `=`** block solids but let liquid and gas pass.
- **Vents:** Hot vents `^` turn elements to gas; cold vents `v` condense gas back to liquid.
- **Crates `B`:** Pushed by solids (including solid Cryo pushing frozen Sol); falling into a pit bridges it.
- **Thermal plates `q`/`p`/`P`:** Stepping off shifts plate temperature (Sol heats, Cryo cools).
- **Timers:** Crucible heat drops 1 per turn; element mass drops 1 per turn (2 as gas) unless Sol and Cryo are adjacent.
- **Win:** Both elements resting on the 2-tile Crucible `X` at the same time (not as gas).

## Layout

```
index.html        3D game entry point + Three.js 0.160.0 import map + HUD
src3d/            3D rules engine, solver, levels, Three.js renderer, UI, audio, cutscenes
assets/           audio (BGM, SFX, voice-overs) and textures
tools/            test3d.html (rule tests) and solve3d.html (BFS level solver)
2d.html           legacy 2D Phaser prototype (preserved)
```
