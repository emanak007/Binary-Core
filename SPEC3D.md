# Binary Core 3D: shared spec (contract between rules and renderer)

The 2D version stays untouched (`index.html`, `src/`). The 3D version lives in `3d.html` + `src3d/`.
Pure rules in `src3d/rules.js` (no Three.js, no DOM). Renderer in `src3d/game.js` only *reads* state + events.

## World
- Grid axes: `x` east, `y` south, `z` up. `level.w` (x), `level.d` (y), `level.h` (z).
- Each cell is either **air** or a **block**. Elements occupy air cells and rest on the block below.
- `z < 0` is the void: falling out of the world = lose. Above `z = h-1` is a solid ceiling.

## Level format (`src3d/levels.js`)
```js
{ name, intro, heat, mass,
  layers: [            // index = z, bottom layer FIRST
    ['#####', '#hhc#'],  // each layer: rows of y, chars of x; all layers same size
    ['.....', '.S.C.'],
  ] }
```

| Char | Kind | Meaning |
|---|---|---|
| `.` | air | empty |
| `^` | air | **hot vent**: any element in this cell becomes GAS (so it rises) |
| `v` | air | **cold vent**: any GAS element in this cell condenses to LIQUID (so it falls) |
| `#` | block | warm floor/wall |
| `c` | block | cold block |
| `h` | block | hot block |
| `=` | block | grate: solids stand on it / are blocked by it; liquid and gas pass through it |
| `X` | block | crucible (exactly 2 per level) |
| `B` | block | pushable crate (moves; not part of static cells) |
| `S` / `C` | air | Sol / Cryo start (cell becomes `.`) |

## States
Temperature comes from what the element **rests on** (the cell directly below):
`c` cold · `#` warm · `h` hot · `B` warm · `=` and `X` no temperature (keep current state).
**Resting on the other element**: Sol counts as hot, Cryo counts as cold (symbiosis!).

| | cold | warm | hot | hot vent `^` | cold vent `v` |
|---|---|---|---|---|---|
| Cryo | solid | liquid | gas | gas | liquid if gas |
| Sol | frozen | solid | liquid | gas | liquid if gas |

## Turn (step)
`step(level, state, dir)` where `dir` ∈ `'north' | 'south' | 'east' | 'west'` (world directions:
north = -y, south = +y, east = +x, west = -x). The renderer maps arrow keys to world dirs based on camera rotation.

1. **Horizontal move**: both elements try to move 1 cell in `dir`. Resolve the one further along `dir` first.
   - Blocked by: static blocks (grate blocks only solids), the other element (unless shove), frozen = can't move.
   - Solid element entering a crate pushes it 1 cell if the cell beyond is air (not occupied).
   - Solid Cryo can shove a frozen Sol 1 cell (same as 2D).
2. **Vertical settle** (repeat until stable, cap iterations to avoid loops):
   - Crates fall until supported.
   - GAS rises while the cell above is passable (air, vent, grate) and not occupied.
   - SOLID/FROZEN/LIQUID fall while the cell below is air/vent (LIQUID also through grates) and not occupied.
   - Entering a vent cell applies the vent; landing applies the temperature of what's below.
   - Falling below z=0 → element `fallen`, status lost (`reason: 'void'`).
3. **Timers**: if anything moved, `heat -= 1`; if the two aren't adjacent (Manhattan distance 1 in 3D),
   each loses 1 mass (gas loses 2).
4. **Win**: both elements rest directly on an `X` block → `status: 'won'`.
   **Lose**: void / mass ≤ 0 (`'evaporated'`) / heat ≤ 0 (`'cold'`).

## API (`src3d/rules.js`)
```js
export const DIRS = { north:{x:0,y:-1}, south:{x:0,y:1}, east:{x:1,y:0}, west:{x:-1,y:0} };
export const STATE = { FROZEN:'frozen', SOLID:'solid', LIQUID:'liquid', GAS:'gas' };
export const ELEMENTS = ['sol', 'cryo'];
export function parseLevel(def) -> { level, state }
//   level = { ...def, w, d, h, cells }   cells[z][y][x] = static char ('B','S','C' replaced by '.')
//   state = { sol:{x,y,z,st,mass,fallen}, cryo:{...}, blocks:[{id,x,y,z}], heat, turn, status:'play'|'won'|'lost', reason }
export function cellAt(level, x, y, z) -> char ('#' outside x/y bounds and above top, 'void' below z=0)
export function step(level, state, dir) -> { state, changed, events }   // never mutates input state
export const adjacent = (a, b) => boolean // 3D Manhattan == 1
```

### Events (in order; renderer animates them in sequence)
```
{type:'move',  who, from:{x,y,z}, to:{x,y,z}}      horizontal move
{type:'fall',  who, from, to}                       vertical drop (may span several cells)
{type:'rise',  who, from, to}                       gas rising
{type:'state', who, from, to}                       state change
{type:'push',  id, from, to}  {type:'blockfall', id, from, to}
{type:'shove', who}  {type:'bump', who, dir}  {type:'stuck', who}
{type:'void',  who}                                 fell out of the world
{type:'tether', on}  {type:'win'}  {type:'lose', reason, who}
```

## Files
- `src3d/rules.js`, `src3d/levels.js`, `src3d/solver.js`, `tools/solve3d.html`: rules agent
- `3d.html`, `src3d/game.js`, `src3d/audio.js`, `src3d/hud.css` (optional): renderer agent
- Three.js `0.160.0` via importmap from `https://cdn.jsdelivr.net/npm/three@0.160.0/` (core + `examples/jsm/` addons).
- Assets: same `assets/` folders; textures `assets/tiles/{warm,cold,hot,wall,grate,crucible}.png` used on cube faces when present.

## Addendum: Thermal Plates
New block chars: `q` cold plate, `p` warm plate, `P` hot plate (copper plates that **remember heat**).
- A plate is a normal solid block whose temperature is dynamic. Its current temperature lives in
  `state.plates`: an object `{ "x,y,z": 0|1|2 }` with an entry for every plate (0 cold, 1 warm, 2 hot).
  `level.cells` keeps the original char; renderer and rules read the live temperature from `state.plates`.
- **Trail rule:** whenever an element's position changes (horizontal move, shove, fall or rise) and the cell
  directly below its OLD position is a plate, that plate shifts one step: **Sol leaving: +1 (max 2), Cryo leaving: -1 (min 0)**.
  Apply it immediately at the moment of leaving, so a follower stepping onto the same plate later in the same turn
  (and the settle pass) sees the new temperature. That is the core puzzle: whoever walks first sets the follower's state.
- Plate temperature works exactly like `c`/`#`/`h` for states (resting on it).
- Event: `{type:'plate', x, y, z, from, to}` emitted when a plate changes (after the triggering move event).
- Solver state key must include plate temperatures.
