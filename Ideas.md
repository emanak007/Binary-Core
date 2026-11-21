# 2 Elements
    - Two elements try to fuse together to stay alive
    - Evaporating overtime

Possible Characteristics
    - both can change state, liquid, solid, gas - but different melting/boiling points
    - Fuse together to become solid.
    - Must get to the oven/crucible before it turns cold


    - Perhaps after melting stays melted or in that state for 2 or 1 move etc


Story:
    - Two elements are decaying, they must fuse together to become an alloy before they cease to exist.
    - This could be a upcoming explosion with a time limit, such as the buliding explodes and you must become an alloy to survive it
    - Or, it could be a hidden core, or energy of an ancient or current civilisation, and it must fuse together to help the civilisation survive. Perhaps symbiosis could be introduced here too, humans try to help these elements come together, and these elements save humanity
    - It could be a hidden core that drives a spaceship, ship or any vehicle, and it will break down / won't start up unless the two join together

    - Spaceship


    - We can have a full 3D cutscene with elevenlabs audio/voice to sell the idea
# 2 Elements
    - Two elements try to fuse together to stay alive
    - Evaporating overtime

Possible Characteristics
    - both can change state, liquid, solid, gas - but different melting/boiling points
    - Fuse together to become solid.
    - Must get to the oven/crucible before it turns cold


Story:
    - Two elements are decaying, they must fuse together to become an alloy before they cease to exist.
    - This could be a upcoming explosion with a time limit, such as the buliding explodes and you must become an alloy to survive it
    - Or, it could be a hidden core, or energy of an ancient or current civilisation, and it must fuse together to help the civilisation survive. Perhaps symbiosis could be introduced here too, humans try to help these elements come together, and these elements save humanity
    - It could be a hidden core that drives a spaceship, ship or any vehicle, and it will break down / won't start up unless the two join together



# Using gravity / centre of mass
 - Orbitting planets have shared centre of mass
 - Change mass, distance









Here are copy-paste prompts for the 3D version's priority textures. Each one already includes the style guide, so paste them as they are, one per generation. **Set the aspect ratio to 1:1 (square)** before generating.

**1. `assets/tiles/warm.png`**
> Seamless tileable square texture, flat even lighting, fills the entire frame edge to edge. Top-down orthographic game texture, dark industrial sci-fi reactor floor. Metal floor plate in neutral slate grey (#1c2029, #2b3140), faint panel seams, four small corner rivets, very subtle wear. Clean painterly style, crisp edges, low contrast. No perspective, no shadows, no text, no logos.

**2. `assets/tiles/cold.png`**
> Seamless tileable square texture, flat even lighting, fills the entire frame edge to edge. Top-down orthographic game texture, dark industrial sci-fi reactor floor. Metal floor plate coated in thin frost, dark slate base with a pale icy-cyan tint (#5ee7ff accents), delicate crystalline frost lines. Clean painterly style, crisp edges, low contrast. No perspective, no shadows, no text, no logos.

**3. `assets/tiles/hot.png`**
> Seamless tileable square texture, flat even lighting, fills the entire frame edge to edge. Top-down orthographic game texture, dark industrial sci-fi reactor floor. Dark charred metal plate glowing from beneath, thin ember-orange cracks of light (#ff8a3d), faint heat shimmer. Clean painterly style, crisp edges. No perspective, no shadows, no text, no logos.

**4. `assets/tiles/wall.png`**
> Seamless tileable square texture, flat even lighting, fills the entire frame edge to edge. Top-down orthographic game texture, dark industrial sci-fi reactor. Heavy dark metal wall block surface, darker than the floor (#0b0c10 to #262a34), bolted seams, subtle bevel at the edges, slightly worn. Clean painterly style, crisp edges, low contrast. No perspective, no text, no logos.

**5. `assets/tiles/grate.png`**
> Seamless tileable square texture, flat even lighting, fills the entire frame edge to edge. Top-down orthographic game texture, dark industrial sci-fi reactor. Metal floor grate with evenly spaced parallel bars over a pitch-black void, slate grey frame around the edge (#4f5868). Clean painterly style, crisp edges. No perspective, no text, no logos.

**6. `assets/tiles/crucible.png`**
> Square game texture, top-down orthographic, centred in frame. A circular fusion crucible socket set into a dark metal floor plate: heavy ring of dark charcoal metal, molten orange glow (#ff8a3d) in the centre, faint heat haze. Dark industrial sci-fi reactor style, clean painterly, crisp edges. No perspective, no text, no logos.

**Optional: `assets/objects/block.png`**
> Square game asset, top-down orthographic, centred in frame on a plain flat pure black background. A single heavy reinforced cargo crate seen from directly above, slate grey metal with an X-shaped brace and thin hazard-stripe edging. Dark industrial sci-fi style, clean painterly, crisp edges. No perspective, no shadows, no text, no logos.

Afterwards, remove the crate's background (Gemini edit: *"remove the black background, make it transparent"*).

**Tips**
- **Generate them in one conversation, in this order.** After the first one you like, add *"in exactly the same style as the previous image"* to the rest so they stay consistent.
- **Check that tiles join cleanly** by placing 4 copies in a 2×2 grid. If there's a visible seam, regenerate with *"perfectly seamless, edges must match on all sides"*.
- **Keep the floor tiles darker and lower contrast** than you might expect. The glowing elements need to stand out against them.






Here's the final prompt: one generation for all six textures. **Set the aspect ratio to 3:2** so each cell comes out square.

> A sprite sheet of six square game textures arranged in a perfect 3×2 grid, each texture filling its own equal square cell, separated by thin pure black gutters, on a pure black background. All six share exactly the same art style, lighting and level of detail.
>
> Style: top-down orthographic view looking straight down, no perspective, flat even lighting, dark industrial sci-fi starship reactor, clean painterly with crisp edges, low contrast, subtle wear. Base palette deep charcoal and slate (#14161d, #1c2029, #2b3140). Accents only: ember orange (#ff8a3d) for heat, icy cyan (#5ee7ff) for cold. Each texture is a single framed square metal panel with a thin bevelled border around its edge.
>
> Top row, left to right:
> 1. Neutral slate-grey metal floor panel, faint seams, four small corner rivets.
> 2. Frosted floor panel: dark slate with a pale icy-cyan tint and delicate crystalline frost lines.
> 3. Hot floor panel: dark charred metal glowing from beneath, with thin ember-orange cracks of light.
>
> Bottom row, left to right:
> 4. Heavy wall panel, darker than the floor, bolted seams and a strong bevel.
> 5. Metal floor grate: evenly spaced parallel bars over a pitch-black void, inside a slate frame.
> 6. Fusion crucible: a circular socket set into a dark metal panel, with a heavy charcoal ring and a molten orange glow in the centre.
>
> No text, no labels, no numbers, no logos, no characters, no shadows extending outside the cells.

**Afterwards**
- Check that the six cells are evenly sized and the gutters are straight. If not, regenerate. It usually takes 1–3 tries.
- Keep that image, then ask in the main conversation to slice it into `warm`, `cold`, `hot`, `wall`, `grate` and `crucible` in `assets/tiles/`.
- Do the crate separately with the earlier crate prompt, since it needs its background removed.