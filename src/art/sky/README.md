# Sky layers

Original transparent bitmap layers generated with the built-in ImageGen tool on 2026-10-11.
The brief requested six isolated assets in a three-column, two-row atlas: a sunlit cumulus,
wispy cloud, small cumulus, softly glowing sun, cratered moon and overcast cloud. Soft blue
shade and warm highlights match the woodland environment. No UI, text or characters.

`scripts/pack-sky.mjs` crops the generated atlas without drawing replacement artwork.
The app paints cloud layers only when the scene or viewport changes. CSS moves the cached
cloud canvases; the sun and moon retain clock positioning and the moon retains its phase mask.
The original procedural cloud painter remains a fallback while images load or fail.
