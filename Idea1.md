# PROJECT CONTEXT: "BINARY CORE" (Working Title)

Genre: 2D Top-Down Grid Puzzle

Scope: 5-Hour Game Jam Prototype (Single-file HTML5/Canvas + JS or lightweight web engine)

Theme: Symbiosis, Thermodynamics, Mutual Survival



---



## 1. HIGH-LEVEL CONCEPT & STORY

- **Setting:** Inside the darkened, failing Reactor Chamber of a drifting starship.

- **Premise:** The ship's primary engine core—composed of two symbiotic elements (**Sol** and **Cryo**)—has fractured. Separated, both elements are thermodynamically unstable and slowly evaporating into nothingness. Meanwhile, the ship's central **Crucible** (fusion oven) is rapidly cooling down.

- **Objective:** Guide both elements into the **Crucible** before they evaporate or the Crucible goes cold. Reuniting inside the hot Crucible fuses them into a permanent, stable **Solid Alloy**, saving both elements and restarting the ship's core.



---



## 2. CORE MECHANICS & RULESET



### A. Controls & Turn Structure

- **Turn-Based Grid:** Small rooms (`8x8` to `12x12` tiles).

- **Simultaneous Movement:** `WASD` or `Arrow Keys` moves **BOTH** elements by 1 tile on the same turn.

  - *Asymmetry Option (Recommended):* **Sol** moves normally (`Left` = `Left`); **Cryo** mirrors the horizontal axis (`Left` = `Right`, `Up` = `Up`), or moves normally depending on level constraints.

- **Essential Quality-of-Life:**

  - `Z`: Undo last move (full state stack—mandatory for puzzle playability).

  - `R`: Instant level restart.



### B. Asymmetric Matter States (Temperature Grid)

Every floor tile has one of three temperature states: **Cold (`0`)**, **Warm (`1`)**, or **Hot (`2`)**.

Because the two elements have different melting and boiling points, standing on the same tile puts them in different physical states:



| Element | Cold Tile (`0`) | Warm Tile (`1`) | Hot Tile (`2`) |

| :--- | :--- | :--- | :--- |

| **Element A: Volatile (Low Boiling Point)** | **SOLID** (Can push blocks, presses switches) | **LIQUID** (Passes through Grates `#`) | **GAS** (Floats over Pits/Gaps, loses 2x mass per turn) |

| **Element B: Dense (High Melting Point)** | **SOLID** (Too heavy/frozen to move on Cold tiles unless pushed/pulled) | **SOLID** (Normal movement, pushes blocks, presses switches) | **LIQUID** (Passes through Grates `#`) |



### C. Evaporation, Cooling Timer & Symbiosis

- **Move/Heat Budget (No stressful real-time timer):**

  - Each level starts with a **Crucible Heat / Mass Counter** (e.g., `25` turns).

  - Every move reduces the Crucible's temperature and shrinks both elements slightly (visually shown by shrinking sprite radius and dimming the Crucible's orange glow).

  - **Fail State:** Either element reaches `0` mass (evaporates) OR the Crucible hits `0` heat before both elements enter it.

- **Symbiotic Stabilization (Adjacent Bonus):**

  - Whenever Sol and Cryo end a turn **orthogonally adjacent (Manhattan Distance == 1)** outside the Crucible, they share thermal equilibrium—**pausing evaporation for that turn** and emitting a glowing energy tether between them.



### D. Win Condition (The Crucible)

- The **Crucible (`X`)** occupies 1 or 2 tiles.

- Both elements must enter/occupy the Crucible simultaneously while its heat is `> 0`.

- On contact inside the Crucible, both fuse into a single glowing **Solid Alloy** block, triggering a screen-shake, chime, and advancing to the next level.



---



## 3. ASCII LEVEL FORMAT (FOR RAPID LEVEL GENERATION)

Levels should be defined as arrays of strings using standard tile codes:

- `W` = Wall (impassable to all states)

- `.` = Warm Floor (Default)

- `c` = Cold Floor (Freezes Element B; turns Element A Solid)

- `h` = Hot Floor (Turns Element A into Gas; turns Element B into Liquid)

- `#` = Grate (Passable ONLY in **Liquid** or **Gas** state; blocks **Solid**)

- `_` = Abyss / Gap (Passable ONLY in **Gas** state; fatal to Solid/Liquid)

- `B` = Pushable Block (Can only be pushed by an element in **Solid** state)

- `S` = Element A (Volatile / Amber) Start

- `C` = Element B (Dense / Cyan) Start

- `X` = Crucible (Win Goal)



---



## 4. VISUAL & AUDIO DIRECTION (5-HOUR JAM SCOPE)

- **Aesthetic:** Crisp dark-mode industrial sci-fi / pixel-grid look on HTML5 Canvas.

  - Background: Deep charcoal/slate reactor floor (`#14161d`) with subtle grid lines.

  - Temperature cues: Cold tiles tinted icy blue, Warm tiles neutral slate, Hot tiles glowing ember orange.

  - Characters: Distinct silhouettes that morph cleanly by state—crisp square/diamond (**Solid**), wobbling rounded blob (**Liquid**), translucent pulsing ring with particles (**Gas**).

- **Audio (Web Audio API procedural synths—zero external assets needed):**

  - Soft low thud for Solid steps, watery blip for Liquid, airy hiss for Gas, harmonic chord chime when adjacent (symbiotic tether) or fusing in the Crucible.



---



## 5. IMPLEMENTATION GUIDELINES FOR AI ASSISTANT

1. Keep the entire prototype in a **single self-contained HTML file** (HTML + CSS + Vanilla JS) so it runs immediately in any browser with zero build steps.

2. Implement a clean **Undo stack** storing deep copies of positions, block positions, and remaining heat/mass on every valid move.

3. Render clear visual indicators on each element showing its current state (`SOLID` / `LIQUID` / `GAS`) and draw a visible glowing tether whenever Manhattan distance `== 1`.

4. Include at least **5 progressive, verified-solvable levels** introducing:

   - Level 1: Simultaneous movement + Crucible timer.

   - Level 2: Liquid state passing through Grates (`#`) using Warm/Hot tiles.

   - Level 3: Gas state floating over Gaps (`_`) using Hot tiles.

   - Level 4: Solid state pushing Blocks (`B`) + Cold tile constraints.

   - Level 5: Full combination requiring adjacent symbiotic turns to conserve heat/mass.