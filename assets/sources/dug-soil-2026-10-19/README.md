# Excavated soil originals

- The built-in image generation tool produced `soil-source.png` on 2026-10-19.
- Its two accepted transparent illustrations show neutral excavated earth and
  the same earth with a broken winter snow rim.
- Both keep a shaded recess, visible cut soil wall, irregular near lip, roots
  and unequal clods.
- The original pixels and alpha are kept; these are accepted originals, not
  reproducible generation output.
- The generation prompt is kept with this source set.

Packing:
- `plan.json` records the original hash, reviewed crop rectangles and export
  sizes.
- Run `python3 assets/sources/dug-soil-2026-10-19/pack.py` with Pillow installed
  to reproduce `src/art/discovery/dug-soil.png` and `dug-soil-winter.png`.
- Packing only crops and uniformly resamples the accepted art to 256 by 147
  pixels. It does not paint, recolor or infer new soil geometry.
- Both exports use the same source crop size and one shared scale.

In the yard:
- The yard draws the art in a 64 by 37 pixel box at its current scene scale.
- The selected season chooses the winter rim, independent of snow weather.
- Ground contact reveals the recess, and the task owns its removal; no
  persistent hole is added to the saved garden.
- The foreground soil stays behind the friend's paws.
