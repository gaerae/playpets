# Clover winter action originals

The built-in image generation tool created `actions-source.png` on 2026-10-19.
The accepted digging, planting and discovery rows preserve the approved winter
outfit. The fishing row is excluded: its first reel pose omits the rod shaft.
The separate accepted `fish-source.png` and its plan replace that row.

`actions-normalized.png` separates complete connected silhouettes and keeps a
two-pixel fringe of their original alpha. It does not redraw, recolor or resize
individual poses. `normalization.json` records each original and normalized crop.
The visible figures are accepted originals; generation is not reproducible.

Each action plan uses one shared scale, explicit foot anchors and frame durations.
The digging canvas allows the complete spade below and beside the planted paws.
The runtime anchor stays at [96, 199]. Digging and planting last 2,000 ms;
discovery lasts 1,600 ms. `provenance.json` records source and export hashes.

Repack from the repository root, using the corresponding action name:

```sh
npm run companions:pack -- assets/sources/companion-actions-2026-10-19/clover/winter/dig-plan.json src/art/companions/clover/winter/dig.png
```

The generation direction requested six columns and four rows with digging,
planting, fishing and discovery in that order; genuine transparent gutters;
a consistent three-quarter camera; complete figures and tools; no labels, ground,
particles, rewards, fishing line or float. The app supplies those scene effects.

The replacement fishing original contains six complete continuous rods. Its
`fish-normalization.json` keeps full silhouettes with original alpha fringes.
The [320, 256] canvas, [112, 239] foot anchor and [-16, -40] offset preserve the
canonical ground point while keeping both the raised rod and the wide braced
tail. One shared 0.46 scale keeps the upright body near 166 pixels. Frames 0–1
cast, 2–3 wait, and 4–5 visibly reel and recover. Every frame has a measured tip.
