# Level design rules (3D)

The camera looks **north**, from the south-east (`YAW0 = 32°`). In `src3d/levels.js`, row 0 is the
**back** and the last row is the **front**. Higher x is slightly nearer the camera.

## Readability
1. **Terraces rise toward the back.** Higher ground goes in low row numbers. Nothing in front should ever hide anything behind it.
2. **No floor directly above playable space**, except the air column over a vent. Two stacked rooms = unreadable.
3. **Height steps of at most 2 layers** between neighbours. Prefer open edges over walls. The map boundary already blocks movement (out of bounds counts as solid), so walls are rarely needed.
4. **Put fences and grates beside or behind the starting spots, not in front.** The cutaway fades any block between the camera and an element, so a fence in front of the elements fades out exactly when the player needs to read it.
5. **Keep vents, drops and trenches at the side or back,** so you can see their full height.
6. **The Crucible is visible from the first frame.**
7. **Small footprint:** at most 7×7, and at most 4 layers.

## Puzzle shape
- **One new idea per level.** Combine ideas only after each has been taught alone.
- Aim for **8–25 moves**. Set heat and mass to the shortest solution plus about 40%. Gas burns 2 mass per turn, so give floaty levels more mass.
- Give each element its own route when they must cross the same obstacle. One bridge can't carry both across a trench where they move together.
- Check the solver's route actually uses the idea. If a shortcut skips it, close the shortcut.

## Rule gotchas
- **Gas only rises.** It floats at the top layer until it enters a cold vent `v`, or rests on something cold (a `c` block or Cryo). A gas element over a warm floor stays gas, and gas can't win.
- **The top standing layer is where gas drifts.** Put terraces you want gas to reach at that height, with `v` cells on them.
- **Pits need a floor under them**, or a crate pushed in falls out of the world.
- **Resting on the other element changes temperature:** Sol counts as hot, Cryo as cold. Sol on top of Cryo freezes, and on a grate or Crucible (which have no temperature) it stays frozen.
- **A liquid can come to rest inside a grate cell.** It keeps its state there (grates have no temperature), so it can't turn solid inside the bars.
- **Stacking boils or freezes within a single turn.** Cryo landing on Sol becomes gas and floats off in the same move, so the stacked position never shows up in a saved state. Check for the boil event, not the position.
- **Single-file crossings need a way to line up.** Two elements moving together only change their relative position when something blocks one of them (a pillar, a wall, the map edge, a frozen Sol, a crate). Give every level at least one such blocker where alignment matters.

## Thermal plates (`q` / `p` / `P`)
- A plate remembers heat. **Sol leaving** a plate heats it one step; **Cryo leaving** cools it one step. Falling, rising and being shoved off a plate count too.
- **Order is the puzzle.** Sol leading leaves hot plates, so Cryo following boils. Cryo leading leaves cold plates, so Sol following freezes.
- **A follower doesn't need to be directly behind.** A plate keeps its temperature until someone leaves it, so stepping on it any later turn works too. You can boil Cryo in any open room; plates don't line the elements up.
- **To force a freeze or shove, remove every other way to line them up:** ring the area with void, and make the only way in one-way (a vent up to a void-ringed deck).
- **Cryo standing directly on a cold plate turns solid** and can cross a grate. Keep plates away from grate approaches unless that's the trick.
- To prove a level needs plates, solve it with `OPTIONS.plateTrails = false` (or `'sol'` / `'cryo'` for one element's trail only) from `src3d/rules.js`.

## Workflow
Edit `src3d/levels.js`, then open `tools/solve3d.html` and check every level says it can be solved. Replay the path with
`3d.html?level=N&shot&play=<path>` and check the screenshot from the default view.
