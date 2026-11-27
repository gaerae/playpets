# Living yard materials

- Birds were generated with the built-in imagegen tool, then inspected at full size.
- The source keeps three distinct wing states: raised, extended and lowered.
- `node scripts/pack-ambient-birds.mjs` reproduces the runtime texture and bounds audit.
- Runtime playback: raised → extended → lowered → extended, with independent flock phases.
- Playback does not deform the bird's whole body.
- Original tool output: `CODEX_HOME/generated_images/01a128f9-924f-71a1-8607-c78af8edd8ff/exec-df40a259-849b-47b9-8cf7-a520090ca8c2.png`.

## Exact generation prompt

Create a premium cozy woodland game sprite reference atlas, transparent background with true alpha, 1536x1024. Exactly THREE separate isolated small blue-gray swallow birds, in a single horizontal row of three equal cells, centered at x256,768,1280 and y512, generous transparent gutters. SAME individual bird and physical scale each: creamy ivory chest, slate blue gray back and feathered wings, dark tiny eye, short dark beak, delicate forked tail, warm soft illustrated 3D shading matching a lovingly crafted cozy desktop pet game, anatomically credible rather than V-shaped symbols. Bird flies toward viewer RIGHT in side/three-quarter profile. Cell0 wings lifted upward (upstroke), cell1 wings extended horizontally in midstroke, cell2 wings lowered downward (downstroke). Body axis horizontal consistent, head faces right in all3, long tail left. Wings must unmistakably vary, avoid copy-pasted same posture. Each bird fits within400x400 maximum, same body length220pixels, crisp clean silhouette and subtle feather group shapes that remain legible at20CSS pixels. No cast shadow, ground, text, lines, frame, extra birds, scenery, particles, white backdrop or checkerboard. Render only the three whole birds on actual transparent alpha.

## Packing and retained materials

- `assets/sources/ambient/birds-source.png`: the untouched 1536 × 1024 tool output.
- `birds.png`: three 128 × 128 cells.
- Packing:
  - isolates each connected alpha silhouette with two pixels of antialiasing dilation;
  - applies the same 0.17 scale to every bird;
  - keeps the source body anchor at cell-local (256, 580).
- No script draws anatomy.
- `birds.png.json` records crop bounds and scale.
- The original transparent pixel fraction is 86.28%.

- Flying insects use the existing generated `bugs/specimens.png` with the species crops in `collection.json`.
- So the living specimen matches the caught one; its color is not swapped for a generic butterfly.

- `heart.svg`, `spark.svg`, `notice.svg` and `treat.svg` are editable native vector materials for small, familiar symbolic feedback and tools.
- Their bevels, highlights and outlines are deliberate code artwork, not generated anatomy.
- Firefly light, star halos and shooting-star tails stay cached procedural materials.
- Sun, moon, clouds and seasonal weather artwork are kept.

## Swaying tufts (2026-11-24)

- `tuft-left.png` and `tuft-right.png` sway in the near corners of an outdoor place (yard/living.js, scenery.css `.living-tuft`).
- Made with Codex's built-in image tool. The reference was the lower-left corner of `environments/green.webp`, so the greens and outlines match the lawn.
- Cleaning: alpha kept above 235, a 5-pixel min and max filter, a 1.2-pixel blur, cropped to the bounds, and scaled to 512 pixels on the long side.
- The untouched outputs are in `assets/sources/living-2026-11-24/`.
- Prompts:
  - Left: a single clump of tall meadow grass blades leaning gently to the right, with two small white daisies and one tiny yellow buttercup, in the reference's watercolour style, colours and warm-brown outlines, on a transparent background, the base flat along the bottom.
  - Right: a single low clump of meadow grass and clover leaves leaning gently to the left, with one small pink clover flower and two white daisies, in the same style, on a transparent background, the base flat along the bottom.

## Desktop grass (2026-11-23)

- `desktop-grass.png` is the strip along the floor of the first screen on the desktop (overlay.css `.ground`); it repeats across the strip's width.
- `desktop-pebble.png` marks each end of the strip, where it is pulled narrower or wider.
- Both were made with Codex's built-in image tool while the desktop's first minute was tried out. The reference for the grass was the lawn of `environments/green.webp`; the pebble's were the grass strip and a planted tulip.
- The untouched outputs are in `assets/sources/desktop-grass-2026-11-23/`. Each was cut to the drawing, scaled down (the grass to 856 × 168, the pebble to 195 × 96) and its edges cleaned by hand; those steps were not kept, so the exports are the accepted originals.
- Prompts:
  - Grass: "a long, thin horizontal strip of lawn for the bottom edge of a computer desktop, in exactly the painterly storybook style and grass colors of the reference image's lawn. Wide aspect (about 4:1, e.g. 2048x512). The bottom 60% is solid lush grass; the top edge is an irregular soft fringe of individual grass blades with a few tiny clover leaves, fading into a fully TRANSPARENT background above (PNG with alpha, no sky, no scenery, no house, no pond, no flowers, no text). The strip must tile seamlessly left to right."
  - Pebble: "a small smooth round garden pebble half sunk in a little tuft of lawn grass with two clover leaves and a bit of moss on top, marking the end of a strip of lawn in a cozy desktop pet game, slightly wider than tall. in exactly the same soft painterly storybook illustration style as the attached reference images (gentle hand-painted texture, warm natural colours, soft outlines, no harsh black lines). Centered, the whole object visible, on a fully transparent background with clean edges and no glow or halo, no shadow box, no text."

## Desktop grass in each season (2026-11-24)

- The strip tiles without a seam: each lawn is drawn as itself and its mirror image (`desktop-grass.png` from the 2026-11-23 strip, `desktop-grass-winter.png`, overlay.css `.ground[data-season]`).
- A scatter of each season's small things over the lawn was made and then dropped (2026-11-26): at the strip's size a daisy was 4 or 5 px and read as a speck. Its spring and autumn sheets stay, as the source of the falling petals and leaves.
- `desktop-fall-spring.png` and `desktop-fall-autumn.png` hold four petals and four leaves for the short flurry (overlay/flurry.js); snow is drawn in CSS. `desktop-pebble-winter.png` is the snowy end pebble.
- All were made with Codex's built-in image tool. The untouched outputs are in `assets/sources/desktop-grass-seasons-2026-11-24/`:
  - `grass-winter.png`: an edit of the summer strip with `environments/winter.webp` as the second reference; cut to the drawing and scaled to 168 px high before mirroring.
  - `pebble-winter.png`: an edit of `desktop-pebble.png`; cut and scaled to 195 × 96.
  - `sheet-spring.png`, `sheet-autumn.png`: sprite sheets with the summer strip as the style reference, cut into their pieces; the falling petals and leaves are four pieces each. The scripts were in `scratch/` and not kept.
- Prompts:
  - Winter strip: "make its WINTER version matching the snowy ground of the second attached image: a soft, thick blanket of fresh snow lies over the lawn with gentle cool blue-lavender shadows like the reference, and only the tips of the grass blades and a couple of clover leaves poke up through the snow along the top fringe", keeping the strip's proportions, style, blade shapes and colours, transparent above, tiling left to right.
  - Winter pebble: "the same pebble, same shape, size, angle and soft painterly storybook style, now with a soft rounded cap of fresh snow on top and a little snow on the grass tuft, with gentle cool blue-lavender shadows like the snow in the second attached image; a bit of moss and one clover leaf may still peek out."
  - Spring sheet: "about 24 small spring things to scatter over a lawn: 6 tiny white daisies seen from above, 4 small yellow buttercups, 3 tiny pale violets, 3 clover sprigs with a white clover flower, and 8 single pale pink cherry-blossom petals in different turns."
  - Autumn sheet: "about 22 small autumn things to scatter over a lawn: 12 single fallen leaves (maple, oak and round leaves) in orange, gold, russet and a few half-green, each in a different turn, 4 acorns (two with caps off), and 3 tiny brown seed pods."
  - Each sheet asked for separate items with space around them, at one small scale, in the reference's soft painterly style, with no ground, shadows, glow or text.

## The walk pin (2026-11-27)

- `walk-pin.png` points at the spot a press on the ground sends a friend to (yard/walk-here.js, garden.css `.walk-pin`). It replaced the ring of bent grass of 2026-11-26, which read as a target painted on the ground.
- Made with Codex's built-in image tool. The references were `ui/heart.png` and `ui/book-track.png`, so the outline, texture and paw match the app's icons.
- Two candidates were made: a round pin and a downward arrow. The pin reads more clearly at its small size.
- Cleaning (`assets/sources/walk-pin-2026-11-27/pack.py`): alpha under 50 cleared (the tool's faint reddish fringe), cropped to the drawing with a 4 px margin, scaled to 120 px high.
- The untouched output is `assets/sources/walk-pin-2026-11-27/pin-a.png`.
- Prompt: "a single small game UI marker for a cozy illustrated desktop pet game, on a truly transparent background (real alpha), 1024x1024. It is a plump rounded map pin seen from the front, pointing straight DOWN to a spot on the ground: a round head on top tapering to a soft point at the bottom, in warm honey yellow with a cream highlight on its upper left, soft painted shading and a thin warm dark brown outline, and a small cream-white paw print in the middle of the round head. Same soft painted storybook style, outline and texture as the attached heart and paw print icons. Centered, filling about 70% of the height, nothing else. No shadow, no ground, no text, no frame, no sparkles, no checkerboard, no white backdrop."
