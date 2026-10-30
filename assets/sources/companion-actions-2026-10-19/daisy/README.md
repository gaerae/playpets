# Daisy action originals

- The built-in image generation tool made these accepted action poses on 2026-10-19.
- Kept here: original generated images, deterministic isolation records, packing plans and hashes.
- The source images are accepted artwork, not reproducible generation output.

Outfits:

| Outfit | Look |
| --- | --- |
| Baseline | Apricot dress, sage daisy beret, brown boots and olive satchel |
| Summer | Keeps the beret, boots and satchel; ivory short sleeves and an apricot dungaree skirt |
| Winter | Adds the rust-orange coat, brown leggings and sage scarf |

Sources:
- `base-source.png`, `summer-source.png` and `winter-source.png` contain six columns and four action rows: digging, planting, fishing and discovery.
- Dedicated replacements contain two columns and three rows.
- The combined summer original is accepted only for planting and discovery. Its digging and fishing rows contain white artefacts and are replaced by the matching dedicated originals.

Timing:
- Each action has six authored frames.
- Fishing: frames 0-1 cast, 2-3 patient wait, 4-5 reel.
- The patient wait lasts 3.2 seconds; the brief closed-eye hold lasts 0.2 seconds.
- Digging and planting each last 2 seconds; discovery lasts 1.6 seconds.
- `timing.json` records ground contact, dirt toss and planting completion events.

## Deterministic assembly

- A rectangular crop is used when the authored gutters permit it.
- Overlapping horizontal extents use the existing `atlasPoses` and `isolatePose` helpers, with one whole-image column and 24 components.
- Components are grouped by vertical centre, ordered left to right within each six-pose row and copied with their two-pixel anti-alias fringe into 384x320 canonical tiles.
- No resizing during isolation.
- The raw image and each canonical row keep separate hashes.

To reproduce canonical rows, run the following from the repository root, replacing the outfit and temporary destination as needed:

```sh
node assets/sources/companion-actions-2026-10-19/daisy/isolate-source.mjs assets/sources/companion-actions-2026-10-19/daisy/winter-source.png scratch/daisy-winter-isolated
```

- Only the accepted action rows listed in `provenance.json` are inputs.
- The packing plans already reference the kept canonical rows or the reviewed raw crops.

Repack an export with:

```sh
pnpm run companions:pack assets/sources/companion-actions-2026-10-19/daisy/winter-fish-plan.json src/art/companions/daisy/winter/fish.png
```

- Every action uses one shared source scale for all six frames.
- Feet are measured separately, so crouches keep their authored posture without bobbing along a nominal grid.
- Fishing keeps measured rod tips on every frame and uses an expanded canvas where the complete rod needs room.
- The canvas offset brings its foot anchor back to the canonical [96,199] ground.
- `src/content/companion-actions.json` owns runtime grouping and season selection.
- Spring and autumn share the baseline artwork.
- Imported pets do not use these app-owned clips.
- Use a Python installation with Pillow. Set `PLAYPETS_PYTHON` if that interpreter is not `python3`; no ignored local virtual environment is needed.
