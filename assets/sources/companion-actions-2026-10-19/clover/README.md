# Clover action originals

The built-in image generation tool produced these four accepted transparent source
atlases on 2026-10-19, using the approved Clover identity sheet and the digging
atlas as continuity references. `provenance.json` records source and export hashes.
These are accepted originals, not reproducible generation output.

Each plan keeps one shared scale per source, explicit crop rectangles, measured
foot anchors and frame durations. Crops follow reviewed gutters rather than
assuming the generator obeyed a mathematically exact grid. No frame is stretched
independently. Tiny RGB noise under nearly transparent pixels is retained; it is
not painted over or mistaken for a visible backdrop.

Repack from the repository root, for example:

```sh
npm run companions:pack -- assets/sources/companion-actions-2026-10-19/clover/dig-plan.json src/art/companions/clover/dig.png
```

Use the matching plant, fish and discover plans for the other three exports.
The JSON report contains the runtime frame rectangles and hashes. The registry
in `src/content/companion-actions.json` owns action grouping, contact times and
season availability. Cast uses fish frames 0–5, wait uses 6–7, and reel uses 8–11.
The patient frame lasts 3.2 seconds; the brief closed-eye frame lasts 0.2 seconds.

The base outfit is valid in spring, summer and autumn. Winter has a different
beanie, scarf and coat and retains the original outfit and standard actions.
Imported pets do not consume these app-owned clips.

## Generation prompt set

All four prompts requested a three-column, four-row transparent RGBA sheet,
fixed three-quarter right-facing camera, stable character proportions and scale,
full-body figures, clear gutters, planted feet, no labels, no backdrop, no glow,
no external shadow and no loose particles. The identity is an orange tabby with
cream muzzle and paws, green eyes, straw hat with teal ribbon, teal short
overalls and a white daisy with yellow center. Fine warm outlines, matte painted
planes and readability at 100 pixels are preserved.

- Dig: ready, knee anticipation, lift, ground contact, push, crouched push, lever,
  lift, tip the blade, return hands, lower tool, recover. Both paws maintain
  contact with the same small wooden-handled metal garden spade. The app adds
  soil at contact and one dirt scatter at the lift.
- Plant: rest, soften knees, reach down, squat, guide a small two-leaf seedling,
  steady it, press with each paw, release, rise, dust paws, rest. No shovel,
  pot or ground patch. The app supplies the actual planted item.
- Fish: ready rod, prepare, raise rod, extend, settle, patient hold, patient head
  tilt, brief closed eyes, brace, reel, ease forward, settle. The same short
  wooden rod and reel stay in the paws. No line, float or caught fish is painted;
  the app connects the measured rod tip to its interactive float.
- Discover: rest, look down, curious surprise, small round-mouth surprise,
  open paws, delighted smile, paws near cheeks, lower paws, proud smile,
  settle, lower arms, rest. No drawn reward, hearts or particles. The actual
  discovery is displayed separately.
