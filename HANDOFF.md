# HANDOFF: Binary Core (game jam project)

Everything a new assistant needs to continue. Read this first, then `SPEC3D.md` (rules contract)
and `LEVEL_DESIGN.md` (level rules). Last updated 2026-11-21.

---

## 1. What this is
**Binary Core**: a turn-based 3D voxel puzzle game for a game jam (theme: symbiosis /
thermodynamics). Tagline: *"Fuse or Fade."* Browser game, no build step, works on desktop and mobile.

**Core idea:** one input moves **both** elements, Sol (amber, dense) and Cryo (cyan, volatile).
The temperature of what each one rests on decides its state (solid / liquid / gas), and each
state obeys gravity differently. Get both onto the 2-tile Crucible at the same time.

**Pitch:** "Fireboy and Watergirl meets Sokoban, but one input moves both elements, the floor's
temperature decides whether each is solid, liquid or gas, and every step they take reheats or
refreezes the world for the other."

**Lore ("The Relay"):** the starship *Meridian*'s reactor is a chain of Crucibles, one per deck.
Each fusion relights a deck; the surge throws Sol and Cryo apart into the next. Only at the main
core (final level) does the bond hold. Win banner: "DECK N ONLINE"; final: "THE BOND HOLDS".

## 2. Owner preferences (important)
- **Never add Claude/AI attribution** to commits or PRs: no `Co-Authored-By`, no session links.
  Commits are authored as the user. Check `git log --format=%B | grep -i claude` is empty before pushing.
- The user wants it **pretty**, **readable** (no hidden/overlapping geometry), **mobile-friendly**
  and **original**. They playtest and give blunt feedback; act on it.
- The user has pro access to **Gemini** (images), **ElevenLabs** (SFX, music, voice) and Claude.
- The jam deadline was never confirmed. Ask.

## 3. Repo, branches, hosting
- GitHub: `git@github.com:emanak007/Binary-Core.git`
- **`3d` branch = the current game** (work here). `main` = the old 2D Phaser prototype plus the GitHub README merge.
- Hosting: GitHub Pages from branch `3d`, root → `https://emanak007.github.io/Binary-Core/3d.html`
  (the user must enable it in repo Settings → Pages; confirm it's on).
- TODO when the user is happy: make 3D the default page (e.g. move `3d.html` → `index.html`,
  keep 2D as `2d.html`) and merge `3d` into `main`.

## 4. Running and verifying
```bash
python3 -m http.server 8765        # from the repo root; ES modules need a server
```
- Game: `http://localhost:8765/3d.html`
- Dev URL params: `?level=N` (jump to level, 1-based) · `?shot` (skip menus/cutscene) ·
  `?play=north,east,...` (replays WORLD-direction moves; sets `<body data-status="won|lost|play">`) ·
  `?touch` (force touch UI) · `?screen=settings|chapters|credits|cutscene|end|pause` ·
  `?hint` / `?hintsync` (auto-trigger a hint; sync = main thread)
- In-game dev keys: `[` / `]` previous/next level.
- **Rule tests:** `http://localhost:8765/tools/test3d.html` (should print ALL PASS; 24 checks).
- **Level solver:** `http://localhost:8765/tools/solve3d.html` (shortest solution per level, with and without budgets).

**Environment quirks (the user's Linux machine):**
- **No Node.js.** Run JS checks with headless Chrome against the server:
  ```bash
  google-chrome --headless=new --disable-gpu --virtual-time-budget=120000 --dump-dom http://localhost:8765/tools/solve3d.html 2>/dev/null | grep "with heat"
  google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,800 --virtual-time-budget=8000 --screenshot=/path/x.png "http://localhost:8765/3d.html?level=5&shot"
  google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=20000 --dump-dom "http://localhost:8765/3d.html?level=1&shot&play=north,north,north" | grep -o 'data-status="[a-z]*"'
  ```
  Headless renders few frames: fades, tweens and celebrations may look mid-animation in screenshots.
  Use `--window-size=390,844` / `844,390` for phone checks.
- Starting a background server inside a compound shell command was blocked by the sandbox; run the server as its own command.
- Phone access over LAN failed (router-side; ufw is inactive). Use GitHub Pages for phone testing.

## 5. Architecture (3D, `src3d/`)
| File | Role |
|---|---|
| `3d.html` | Page, Three.js 0.160.0 import map (jsdelivr), HUD markup + CSS, overlays |
| `rules.js` | **Pure rules** (no DOM/Three): `parseLevel`, `step(level, state, dir)` → `{state, changed, events}`, `cellAt`, `adjacent`, `OPTIONS.plateTrails` (test hook). Never mutates input. |
| `solver.js` | BFS over `step()`; key includes positions, states, mass, crates, plate temps. `solve(level, state, {maxNodes, ignoreMass})` |
| `levels.js` | `LEVELS` array (15 levels) |
| `game.js` | Renderer/controller: camera (Q/E rotate, arrows map to world dirs by camera), event animation queue, cutaway, HUD, input (keys, swipe, D-pad), hints (worker + 8s watchdog fallback), skip deck, progress |
| `visuals.js` | Three.js meshes: blocks, grates, crucible, crates, vents, plates (code-drawn hex texture), hazard rims (red = lethal drop), edge rails (cyan = map boundary wall), elements per state, tether, particles, alloy |
| `ui.js` / `ui.css` | Main menu, chapter select, settings, credits, pause, end screen, confirm dialog, touch layout |
| `store.js` | localStorage progress + settings (all access in try/catch) |
| `audio.js` | WebAudio: loads `assets/audio/<key>.mp3`, else synth placeholders; separate master/music/sfx gains; music aliases `music` → `BGM1` → `BGM2` |
| `cutscene.js` / `cutscenes.js` | Data-driven cutscene player (letterbox, slow pan/zoom, typewriter subtitles, voice, skip) + the intro shot list |
| `hintworker.js` | Module worker running the solver for hints |

The 2D prototype lives in `index.html` + `src/` (Phaser 3.90); it's legacy and not maintained.

## 6. Rules (summary; full contract in `SPEC3D.md`)
- Grid `x` east, `y` south, `z` up; levels are layers bottom-first. Falling below z=0 = lose. Map
  x/y boundary acts as a wall (rendered as cyan rails).
- Chars: `.` air · `^` hot vent (→ gas) · `v` cold vent (gas → liquid) · `#` warm block · `c` cold ·
  `h` hot · `=` grate (solids stand on/are blocked; liquid and gas pass) · `X` crucible (2 per level) ·
  `B` crate · `S`/`C` starts · plates `q`/`p`/`P` (cold/warm/hot copper that **remembers heat**).
- States from what you rest on: Cryo cold/warm/hot = solid/liquid/gas; Sol = frozen/solid/liquid.
  Resting on Sol counts as hot, on Cryo as cold. Inside a grate cell an element keeps its state.
  Gas stays gas until a cold vent or a cold surface under a ceiling.
- Gravity: gas rises; solid/frozen/liquid fall (liquid also through grates). Crates fall; a crate in a hole becomes a bridge.
- Moves: both step 1 in the same world direction (leader resolved first). Frozen can't move.
  Solid pushes crates; solid Cryo shoves frozen Sol.
- **Thermal plates:** an element leaving a plate shifts it (Sol +1, Cryo -1, clamped), immediately,
  so a follower in the same turn sees the new temp. Event `{type:'plate',...}`.
- Timers: heat -1 per move; mass -1 per move (gas -2) unless the two are adjacent. Win = both resting on X and not gas.

## 7. Levels (15, all solver-verified within budgets)
| # | Name | Teaches | Par |
|---|---|---|---|
| 1 | Wake | one input moves both | 3 |
| 2 | Offset | a wall stops one, the other moves | 3 |
| 3 | Edge | align with a wall line | 5 |
| 4 | Ignition | align using wall and edge | 7 |
| 5 | Updraft | hot vent; boiling on hot plating | 10 |
| 6 | Grate Fence | liquid through grate, solid around | 10 |
| 7 | Load Bearing | crate bridge, vent | 15 |
| 8 | Condensation | liquid drips through grate balcony | 9 |
| 9 | Cold Shoulder | Sol freezes, Cryo shoves | 9 |
| 10 | Afterburn | plates: Sol leads, Cryo boils | 13 |
| 11 | Frostbite | plates: Cryo leads, Sol freezes | 9 |
| 12 | Stepping Stone | Cryo boils resting on Sol | 13 |
| 13 | Brink | crates near void edges | 13 |
| 14 | Relay | switch leaders mid-level (plates) | 23 |
| 15 | Binary Core | finale, tight mass | 25 |

Before editing levels, follow `LEVEL_DESIGN.md`: terraces rise away from the default camera
(it looks north from the south-east), nothing stacked over play areas except vent shafts, the
Crucible visible from the start, visible walls (never rely on map edges early), one idea per level.
**After any level or rules change: run test3d + solve3d, screenshot the level, and replay its path with `?play=`.**

## 8. Assets
See `ASSETS.md` for exact filenames and ready-made Gemini/ElevenLabs prompts.
- Present: `assets/tiles/{warm,cold,hot,wall}.jpeg`, `assets/audio/BGM1.mp3`, `BGM2.mp3`.
- Tile textures go on cube faces (png/jpg/jpeg). Warm texture made floors dark; consider tinting or a brighter texture.
- Missing: SFX (synth placeholders play), cutscene images `assets/cutscenes/intro_01..06.(png|jpg|jpeg|webp)`
  (code placeholders play), optional voice `assets/audio/vo_intro_01..06.mp3`, `vo_end.mp3`.
- Intro shots (in `cutscenes.js`): 1 ship drifting · 2 Binary Core · 3 core fractures ·
  4 apart, fading · 5 a chain of crucibles along the reactor spine, cooling ·
  6 title: "Relight the reactor, deck by deck. Bring them together, as many times as it takes."

## 9. Status
**Done:** 3D rules + solver + tests; Three.js renderer (bloom, shadows, particles, cutaway, Q/E camera);
menus/settings/chapter select/pause/end/credits; cutscene player; mobile touch (swipe, D-pad,
responsive HUD, perf caps, iOS audio unlock); hazard rims and edge rails; thermal plates;
onboarding levels; hints (H / 💡); skip deck; stuck tip; direction glyphs on decks 1–2; Relay lore.

**Unconfirmed in a real browser (headless can't show):** win celebration, Q/E rotation tween,
cutscene crossfades, hint worker reply (watchdog fallback exists), touch gestures on a real phone.

**Open items / known gaps:**
- Ask the user: does ↑ feel right under the diagonal camera? Option: a more frontal default yaw (`YAW0` in game.js).
- Deck 15's pit is the least obvious hazard; 1-deep pits (non-lethal) have no marker.
- Hint count is tracked but not shown; mute (M) isn't persisted; no gamepad.
- With `?shot`, winning the last level shows the old overlay instead of the End screen (for automated checks).
- Credits are placeholders (`Design & Code: TBD`). Fill in the user's name/team.
- Vent particle counts aren't reduced on mobile.
- Make 3D the default page and merge to `main` (see §3).

## 10. Idea backlog (discussed, not built)
- **Fuse/Split on demand:** when adjacent, fuse into a heavy Alloy (always solid, no evaporation,
  pushes 2 crates, breaks cracked floors), split again; costs extra heat. Good finale twist.
- **Heat conduction** through blocks between floors; **Crucible radiating heat** that fades as you play.
- Thermal lag, tether with max length, conserved shared heat pool (see the brainstorm in chat history).
- Name alternatives offered: Fuse or Fade, Meridian, Melting Point, Relight (user kept *Binary Core* so far).

## 11. Working style that worked
- Keep rules pure; put any new mechanic in `SPEC3D.md` first, then rules + tests + solver key, then visuals.
- Parallel agents worked well when split by file ownership (rules/levels vs. renderer vs. UI).
- Always verify claims with the solver and screenshots; report what was and wasn't checked.
