# Asset Brief

> **3D version (branch `3d`):** tile textures are wrapped onto voxel cube faces, so square,
> seamless textures matter most: `warm`, `cold`, `hot`, `wall`, `grate`, `crucible`.
> Skip `gap.png`, `bridge.png` and both backgrounds for now. Audio is unchanged.
> Hold off on voice lines: the story and levels will change.

Drop files at the exact paths below. Anything missing falls back to a code-drawn placeholder,
so you can add assets one at a time and refresh the browser to see each one land.

**Not on this list on purpose:** Sol and Cryo themselves. They're drawn in code so they can
morph smoothly between solid / liquid / gas — AI sprites can't do that consistently.

---

## 1. Style guide (paste at the start of EVERY Gemini image prompt)

> Top-down orthographic game asset, viewed straight down, no perspective, no shadows cast
> off-tile. Dark industrial sci-fi reactor interior. Base palette deep charcoal and slate
> (#14161d, #1c2029, #2b3140). Accents only: ember orange (#ff8a3d) for heat, icy cyan
> (#5ee7ff) for cold. Clean painterly style with crisp edges, subtle panel lines and rivets,
> soft rim lighting. No text, no logos, no characters.

Tips
- Generate **square 1024×1024** images; the game scales them to 64px tiles.
- For tiles, add *"seamless tileable texture, flat even lighting, fills the entire frame edge to edge"*.
- Keep tiles **low contrast** — the glowing elements must pop against them.
- If a batch looks inconsistent, regenerate rather than mixing styles. Consistency beats detail.

## 2. Images (Gemini)

| File | Prompt (after the style guide) |
|---|---|
| `assets/tiles/warm.png` | Seamless tileable metal floor plate, neutral slate grey, faint panel seams and four corner rivets, very subtle wear. |
| `assets/tiles/cold.png` | Seamless tileable metal floor plate coated in thin frost, pale icy-cyan tint, delicate crystalline frost lines, cool blue rim light. |
| `assets/tiles/hot.png` | Seamless tileable metal floor plate glowing from beneath, dark charred metal with thin ember-orange cracks of light, faint heat haze. |
| `assets/tiles/wall.png` | Seamless tileable reactor wall block seen from above, raised heavy dark metal, bevelled top edge catching light, bolted seams. Darker than the floor. |
| `assets/tiles/grate.png` | Seamless tileable floor grate, parallel metal bars over a pitch-black void below, slate frame around the edge. |
| `assets/tiles/gap.png` | Seamless tileable hull breach, broken floor opening onto deep black space with a few faint distant stars, jagged torn metal only at the very edges. |
| `assets/tiles/crucible.png` | Single circular fusion crucible socket set into the floor, heavy ring of dark metal, molten orange glow in the centre, centred in frame. |
| `assets/tiles/bridge.png` | Seamless tileable heavy metal crate sunk flush into a floor opening, forming a makeshift bridge, scuffed slate metal. |
| `assets/objects/block.png` | Single heavy reinforced cargo crate seen from directly above, slate metal with an X-brace and hazard-stripe edging, centred, on a **plain flat black background**. |
| `assets/backgrounds/reactor.png` | Wide 16:9 dark starship reactor chamber, very dim, pipes and machinery fading into darkness, faint orange core glow far away. Atmospheric, low detail, mostly dark. |
| `assets/backgrounds/title.png` | Wide 16:9 cinematic key art: dark starship reactor, two small glowing orbs (one amber, one cyan) drifting toward each other above a cooling crucible. Dark empty space in the top-centre for a title. |

For `block.png`: remove the background so it's transparent (Gemini edit: *"remove the background,
transparent PNG"*, or any background remover).

## 3. Audio (ElevenLabs)

Export everything as **MP3** to `assets/audio/<name>.mp3`. Keep sound effects short (under 1 second unless noted).

### Sound effects (Sound Effects generator)

| File | Prompt |
|---|---|
| `step_solid.mp3` | Single soft heavy metallic thud, small dense object landing on a steel floor, short, low. |
| `step_liquid.mp3` | Single small wet blip, droplet of liquid metal plopping, short and bright. |
| `step_gas.mp3` | Short soft airy whoosh, puff of hot vapour, gentle. |
| `bump.mp3` | Dull short muffled clunk, bumping into a wall, very short. |
| `push.mp3` | Heavy metal crate scraping one step across a steel floor. |
| `melt.mp3` | Sizzling crackle as metal melts into liquid, rising pitch, half a second. |
| `boil.mp3` | Quick bubbling hiss rising into a steam burst. |
| `freeze.mp3` | Crisp crackling ice forming, crystalline tinkle. |
| `fall.mp3` | Descending whistle fading into the distance, falling into a void, 1 second. |
| `tether.mp3` | Soft harmonic shimmer, two tones resonating together, gentle sci-fi energy link. |
| `fuse.mp3` | Triumphant sci-fi fusion: rising energy swell into a bright harmonic chime and deep bass impact, 2 seconds. |
| `fail.mp3` | Low descending power-down drone, sci-fi system failure, 1 second. |
| `undo.mp3` | Quick soft reversed whoosh, tape rewind blip, very short. |

### Music (Music generator)

`music.mp3` — *Dark ambient sci-fi loop, low reactor hum, slow pulsing synth bass, sparse
crystalline pads, tense but calm, puzzle-game focus music, no drums, seamless loop, 90 seconds.*

### Voice: the ship's AI (Text to Speech)

Pick a calm, slightly synthetic voice (female or male, measured delivery). Lines match the on-screen intros:

| File | Line |
|---|---|
| `vo_1.mp3` | "Core fracture detected. Both elements respond to the same command. Guide them into the Crucible, together." |
| `vo_2.mp3` | "Grates block solids. Cryo flows through as liquid. Sol must be melted on hot plating." |
| `vo_3.mp3` | "Hull breach. Only a gas can cross open space. Heat Cryo until it boils... but keep Sol away from the edge." |
| `vo_4.mp3` | "Sol freezes solid in the cold. Cryo hardens, and can push what Sol cannot." |
| `vo_5.mp3` | "Final chamber. Core integrity critical. Stay close. You will not survive apart." |
| `vo_end.mp3` | "Fusion complete. Core stable. ...Welcome back, ship." |

## 4. Claude

Use Claude (here) for: element visuals and effects, shaders, extra levels (always re-run the
solver), story text, and wiring in any asset that needs special handling.
