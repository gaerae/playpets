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
