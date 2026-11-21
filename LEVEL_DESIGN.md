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
- **A liquid can come to rest inside a grate cell.** If the floor below that cell is warm, a liquid Sol then turns solid while still inside the grate (see the report).

## Workflow
Edit `src3d/levels.js`, then open `tools/solve3d.html` and check every level says it can be solved. Replay the path with
`3d.html?level=N&shot&play=<path>` and check the screenshot from the default view.
