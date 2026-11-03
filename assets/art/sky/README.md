# Sky layers

- Original transparent bitmap layers, generated with the built-in ImageGen tool on 2026-10-11.
- Brief: six isolated assets in a three-column, two-row atlas: a sunlit cumulus, wispy cloud,
  small cumulus, softly glowing sun, cratered moon and overcast cloud.
- Soft blue shade and warm highlights match the woodland environment. No UI, text or characters.

- `scripts/pack-sky.mjs` crops the generated atlas; it draws no replacement artwork.
- The app paints cloud layers only when the scene or viewport changes; CSS moves the cached
  cloud canvases.
- The sun and moon keep clock positioning; the moon keeps its phase mask.
- The original procedural cloud painter stays as a fallback while images load or fail.

- The sun is a soft CSS light disc, which avoids crater-like detail at small sizes.
- `sun.png` stays as the reproducible atlas export for source comparison; the yard does not load it.
