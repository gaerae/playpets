# Pip base action originals

- The built-in image generation tool created `actions-source.png` on
  2026-10-19.
- The accepted digging, planting and discovery rows keep the approved base
  outfit.
- The fishing row is excluded: its first reel pose omits the rod shaft. The
  separate accepted `fish-source.png` and its plan replace that row.

Normalization:
- `actions-normalized.png` separates complete connected silhouettes and keeps a
  two-pixel fringe of their original alpha.
- It does not redraw, recolor or resize individual poses.
- `normalization.json` records each original and normalized crop.
- The visible figures are accepted originals; generation is not reproducible.

Plans:
- Each action plan uses one shared scale, explicit foot anchors and frame
  durations.
- The digging canvas allows the complete spade below and beside the planted
  paws. The runtime anchor stays at [96, 199].
- Digging and planting last 2,000 ms; discovery lasts 1,600 ms.
- `provenance.json` records source and export hashes.

Repack from the repository root, using the corresponding action name:

```sh
npm run companions:pack -- assets/sources/companion-actions-2026-10-19/pip/base/dig-plan.json src/art/companions/pip/base/dig.png
```

Generation direction:
- Six columns and four rows: digging, planting, fishing and discovery, in that
  order.
- Genuine transparent gutters, a consistent three-quarter camera, complete
  figures and tools.
- No labels, ground, particles, rewards, fishing line or float. The app supplies
  those scene effects.

Replacement fishing original:
- Has six complete rods.
- Its connected silhouettes and original alpha fringe are recorded in
  `fish-normalization.json`.
- The [320, 256] canvas, [128, 239] anchor and [-32, -40] offset keep the
  canonical ground point and leave room for the backward cast and braced tail.
- One shared 0.5 scale keeps the upright body near 165 pixels.
- Frames 0–1 cast, 2–3 wait, and 4–5 visibly reel and recover.
- Every frame has a measured rod tip.
