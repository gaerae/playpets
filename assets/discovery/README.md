# Discovery artwork

- Accepted generated originals for planted trees, found keepsakes and the
  digging shovel live here.
- Runtime exports: `src/art/trees/` and `src/art/discovery/`. The app does not
  load this source directory.

Recreate the atlas copies and SVG viewports from the repository root:

```sh
node scripts/pack-discovery.mjs
```

- `ART-SOURCES.json` records exact built-in ImageGen prompts, style references,
  source hashes and dimensions, reviewed crop rectangles and logical display
  sizes.
- The packer validates source hashes and crop geometry, copies the accepted
  pixels unchanged, and writes clipped viewports.
- It does not draw or stretch trees or modify their transparency.
- Its source atlas crops were reviewed one by one; they are not inferred from
  equal atlas cells.

## Geometry

Trees:
- All tree wrappers use a bottom-center ground anchor.

| Stage | Viewport (logical pixels) |
| --- | --- |
| Seedling | 35 by 40 |
| Young tree | 70 by 95 |
| Mature tree | 160 by 170 |

- Broad mature canopies keep their natural proportions inside this box; they
  do not stretch to fill it.
- Tree trunks share the centerline of their species' source crop.
- Use the bottom-center point for the persistent world position and depth
  ordering; collision roots are smaller than canopies.

Keepsakes and shovel:
- Keepsakes use 40 by 40 viewports, keeping their material silhouettes.
- The shovel is 24 by 72, upright, handle at the top and steel blade at the
  bottom. Its bottom-center anchor is the spade tip.
- Handle center is about `(12, 5)` and shaft center about `(12, 36)` in the
  viewport.
- Place and rotate this separate prop around the hand instead of deforming a
  friend. It has no baked ground shadow.
- Ordinary discoveries: the first six keepsakes, bottle cap and toy robot.
  Uncommon: quartz, amber, tiny crown and star fragment.
- Appearance does not encode odds.
- The leaf fossil is a fern impression, without a commercial game's fossil
  symbol.

Seasonal trees:
- Base mature trees: cherry shows spring blossoms, maple has summer leaves,
  pine stays evergreen.
- Six accepted variants: cherry summer, autumn and winter; maple spring, autumn
  and winter.
- Their filenames append `-spring`, `-summer`, `-autumn` or `-winter` to the
  mature tree name.
- The summer cherry uses its own accepted transparent source with oval green
  leaves and no blossoms or fruit.
- The seasonal atlas repeated spring blossoms in its first cell; that cell and
  repeated pine cells are not exported.
- Seasonal records add a `frame` rectangle around the exact `crop` mask. The
  frame keeps a shared native scale and baseline; the crop clips every
  neighboring tree out of that frame.
- Source pixels stay unchanged.
- Winter trees keep a small root rosette from the accepted style reference;
  their canopies are bare.

Oak, birch and willow:
- Each uses one six-tree sheet. First row: seedling, young tree, mature summer
  tree. Second row: mature spring, autumn and winter.
- Oak has rounded lobed leaves and acorns; birch has pale marked bark; willow
  has hanging narrow leaves and twigs.
- Spring foliage is pale green, autumn turns copper or gold, winter branches
  are bare.
- Mature seasonal frames keep a shared scale and ground anchor within each
  species.
- Reviewed masks follow the actual silhouettes, not equal cells; oak and
  willow summer crowns extend slightly left of their nominal cells.
- All existing tree artwork stays intact.

Whimsical finds:
- `whimsical-finds-source.png` holds the bottle cap, toy robot, tiny crown and
  star fragment in reading order.
- Their catalog records make them available year-round.
- The source sheets keep their original alpha and metadata; colored RGB under
  zero-alpha pixels is invisible when the app draws it.
- An image viewer that ignores alpha can show a colored halo that is not part
  of the visible sprite.

## Provenance and review

- The built-in `image_gen.imagegen` tool created these assets on 2026-10-19.
- Existing PlayPets props and collection art were style references; Clover's
  accepted sheet was inspected for the yard's illustration direction.
- No character sheet was replaced.
- Transparent backgrounds are genuine alpha, with no drawn checkerboard.
- Fully transparent pixels form most of the growth and find sheets; soft edge
  alpha is kept.
- Runtime art and source originals are intentional tracked copies: originals
  establish provenance; runtime paths are app inputs.
- Review captures and rejected variants belong in ignored `scratch/`; they are
  not packer inputs.
- Compact-size inspection confirms distinct keepsake shapes, readable shovel
  structure and growth silhouettes.
- Review the final scene's scale and occlusion separately before release.
