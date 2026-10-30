# Pip summer action originals

- The built-in image generation tool created `actions-source.png` on
  2026-10-19.
- Outfit: Pip's approved short-sleeve indigo denim shirt, ivory T-shirt and
  cuffed ivory shorts.
- All 24 poses keep that outfit and the white flower.

Normalization:
- The accepted original has six columns and four action rows: digging,
  planting, fishing and discovery.
- `normalization.json` records complete connected silhouette extraction with a
  two-pixel fringe of the original alpha.
- This only separates neighboring figures and crossing rods; it does not
  repaint or independently resize poses.
- `actions-normalized.png` is the deterministic packing input.

Plans:
- Each action plan uses one shared scale and measured foot anchors.
- Digging and planting last 2,000 ms; discovery lasts 1,600 ms.
- Fishing frames 0–1 cast, 2–3 wait (3,200 ms patient hold and a 200 ms blink),
  and 4–5 reel and recover.
- Every fishing frame keeps the full continuous rod and measured tip.
- The wider 232 by 224 fishing canvas keeps the extended cast at the
  established body size; its [96, 207] anchor and [0, -8] offset keep the
  canonical ground point.
- `provenance.json` records source and export hashes.

Repack from the repository root with the matching action name:

```sh
pnpm run companions:pack assets/sources/companion-actions-2026-10-19/pip/summer/dig-plan.json src/art/companions/pip/summer/dig.png
```

Generation direction:
- A fixed three-quarter camera, transparent RGBA gutters, complete figures and
  tools.
- No labels, ground patch, particles, reward objects, fishing line or float.
  The app supplies those scene effects.
