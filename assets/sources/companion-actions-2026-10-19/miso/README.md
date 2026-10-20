# Miso action originals

The built-in image generation tool made these accepted action poses on 2026-10-19. Original generated images, deterministic isolation records, packing plans and hashes are retained here. The source images are accepted artwork, not reproducible generation output.

The baseline wears the lavender cable-knit vest, ivory collared short-sleeve shirt and warm-grey shorts. Summer uses the lighter lavender vest and linen shorts. Winter uses a buttoned lavender cardigan and full-length grey trousers. The white-petal, golden-centred chest daisy is retained.

`base-source.png`, `summer-source.png` and `winter-source.png` contain six columns and four action rows: digging, planting, fishing and discovery. Dedicated replacements contain two columns and three rows. The combined baseline original is accepted only for digging, planting and discovery. Its fifth fishing pose lacks the rod shaft; the separate baseline fishing original replaces the whole fishing row and includes an image-tool repair of the signature daisy.

Each action has six authored frames. Fishing uses frames 0-1 for casting, 2-3 for its patient wait, and 4-5 for reeling. The patient wait lasts 3.2 seconds and the brief closed-eye hold lasts 0.2 seconds. Digging and planting each last 2 seconds; discovery lasts 1.6 seconds. `timing.json` records ground contact, dirt toss and planting completion events.

## Deterministic assembly

A rectangular crop is used when the authored gutters permit it. Overlapping horizontal extents use the existing `atlasPoses` and `isolatePose` helpers, with one whole-image column and 24 components. Components are grouped by vertical centre, ordered left to right within each six-pose row and copied with their two-pixel anti-alias fringe into 384x320 canonical tiles. There is no resizing during isolation. The raw image and each canonical row retain separate hashes.

To reproduce canonical rows, run the following from the repository root, replacing the outfit and temporary destination as needed:

```sh
node assets/sources/companion-actions-2026-10-19/miso/isolate-source.mjs assets/sources/companion-actions-2026-10-19/miso/winter-source.png scratch/miso-winter-isolated
```

Only the accepted action rows listed in `provenance.json` are inputs. The packing plans already reference the retained canonical rows or the reviewed raw crops. Repack an export with:

```sh
npm run companions:pack -- assets/sources/companion-actions-2026-10-19/miso/winter-fish-plan.json src/art/companions/miso/winter/fish.png
```

Every action uses one shared source scale for all six frames. Feet are measured separately so crouches keep their authored posture without bobbing along a nominal grid. Fishing retains measured rod tips on every frame and uses an expanded canvas where the complete rod needs room. The canvas offset brings its foot anchor back to the canonical [96,199] ground. Runtime grouping and season selection are owned by `src/content/companion-actions.json`. Spring and autumn share the baseline artwork. Imported pets do not use these app-owned clips.

Use a Python installation with Pillow available. Set `PLAYPETS_PYTHON` if that interpreter is not `python3`; no ignored local virtual environment is required.
