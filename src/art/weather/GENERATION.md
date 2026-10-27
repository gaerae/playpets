# Seasonal particle artwork

- Generated on 2026-10-11 with the built-in image_gen tool.
- No API key, external image service, scripted leaf anatomy or recolouring was used.

- Original output: `CODEX_HOME/generated_images/01a128f9-924f-71a1-8607-c78af8edd8ff/exec-72f2c4d3-4f47-4462-b19d-76cc56e626d8.png`
- Retained original: `assets/sources/weather/seasonal-source.png`, 1536 × 1024, true alpha.
- Runtime atlas: `seasonal.png`, 384 × 256, six 128 × 128 cells.
- Upper row: amber maple, russet maple, golden birch.
- Lower row: pale cherry petal, rose cherry petal, curled ivory-pink cherry petal.

- The source was inspected at full size. Its zero-alpha fraction is 0.6646811167399088.
- Packing uses `atlasPoses(rgba, width, height, 3, 2)` from `scripts/atlas-lib.mjs`: each column's two dominant isolated silhouettes, sorted top to bottom.
- For each silhouette it:
  1. copies exact source RGBA inside a two-pixel dilation;
  2. crops its bounds with two pixels of padding;
  3. uniformly downsamples its longest dimension to 112 pixels;
  4. centers it inside its 128-pixel cell.
- This removes transparent-background RGB haze and unrelated fragments and keeps the generated material.
- No new anatomical pixels are painted.
- `seasonal.png.json` records the source and output bounds and scales of all six cells.
- The original alpha is kept for future exports.

- The runtime decoder:
  - waits for a complete image;
  - shares one decoded atlas;
  - loads only when motion is enabled in an outdoor spring/autumn scene;
  - keeps the existing vector fallback if decoding fails.
- Rain, impact ripples and snow are separate code-native cached materials in `yard/weather-art.js`.
- Rain uses tapered depth-scaled droplets; snow uses soft distant flurries and six-arm near flakes.
- Those materials are built at scene setup or weather changes, never in the paint loop.
- Indoor precipitation stays clipped to the room's transformed glass panes; the indoor floor gets no ripple.
- Reduced motion keeps precipitation static and omits falling leaves/petals.

- Actual-module browser fixtures checked all four seasons, rain and snow in woodland and studio, day and night, 1180 × 780 and mini 500 × 350, at DPR 1 and 2.
- These references do not change butterflies, dragonflies, birds, fireflies, stars or shooting-star artwork; their existing procedural painters remain.

## Exact generation prompt

```text
Production transparent particle-texture atlas for a premium cozy illustrated woodland game, matching soft dimensional warm 3D storybook artwork. EXACTLY SIX isolated individual objects in a strict THREE COLUMNS by TWO ROWS layout, canvas1536x1024 true alpha. Each object centered inside its own512x512cell with at least90pixels clear transparent gutter, each organic silhouette~280pixels across, visible delicate real veins/fine surface texture, subtle curled edges and soft material highlights, crisp clean alpha. TOP ROW left-to-right: amber-orange five-lobed serrated MAPLE leaf with short stem; warm russet/coral-red five-lobed MAPLE leaf with slightly different curl; golden-yellow BIRCH leaf, pointed heart/ovate shape, serrated fine edge and clear midrib. BOTTOM ROW left-to-right: pale blush CHERRY BLOSSOM PETAL with characteristic notched heart-shaped tip and tapered base; rose-pink CHERRY BLOSSOM PETAL with soft longitudinal vein and curved cupped edge; ivory-to-pink CHERRY BLOSSOM PETAL gently curled sideways with distinct notched tip. These are single falling leaves and SINGLE petals, never full flowers or stems with multiple leaves. Botanical anatomy believable, warm gold and delicate pastel palette, restrained illustrated shading. Object lighting upper left, no exaggerated gloss. No ground shadow, no floor, no cast glow, no haze, NO background whatsoever: pixels outside isolated silhouettes must be alpha0. No labels, panels, grids or text. No extra fragments/neighbor silhouettes. This is genuine source artwork, not tiny dots or ellipse placeholders.
```

