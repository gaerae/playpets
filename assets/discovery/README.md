# Discovery artwork

Accepted generated originals for planted trees, found keepsakes and the digging
shovel live here. Runtime exports live in `src/art/trees/` and
`src/art/discovery/`. The app does not load this source directory.

Recreate the atlas copies and SVG viewports from the repository root:

```sh
node scripts/pack-discovery.mjs
```

`ART-SOURCES.json` records exact built-in ImageGen prompts, style references,
source hashes and dimensions, reviewed crop rectangles and logical display sizes.
The packer validates source hashes and crop geometry, copies the accepted pixels
unchanged, and writes clipped viewports. It does not draw or stretch trees or
modify their transparency. Its source atlas crops were reviewed individually;
they are not inferred from equal atlas cells.

## Geometry

All tree wrappers use a bottom-center ground anchor. Seedling viewports are
35 by 40, young trees 70 by 95, and mature trees 160 by 170 logical pixels.
The broad mature canopies preserve their natural proportions inside this box;
they do not stretch to fill it. Tree trunks share the centerline of their
species' source crop. Use the bottom-center point for the persistent world
position and depth ordering; collision roots should be smaller than canopies.

Keepsakes use 40 by 40 viewports, preserving their material silhouettes.
The shovel is 24 by 72, upright with its handle at the top and steel blade at
the bottom. Its bottom-center anchor is the spade tip. The handle center is
approximately `(12, 5)` and the shaft center around `(12, 36)` in the viewport;
place and rotate this separate prop around the hand rather than deforming a
friend. It contains no baked ground shadow.

The first six keepsakes, bottle cap and toy robot are ordinary discoveries;
quartz, amber, tiny crown and star fragment are uncommon.
Their appearance does not encode odds. The leaf fossil is a fern impression,
without a commercial game's fossil symbol.

The base cherry mature tree shows spring blossoms; the base maple mature tree
has summer leaves, and pine remains evergreen. Six accepted variants provide
cherry summer, autumn and winter, and maple spring, autumn and winter. Their
filenames append `-spring`, `-summer`, `-autumn` or `-winter` to the mature tree
name. The summer cherry uses its own accepted transparent source with oval
green leaves and no blossoms or fruit. The seasonal atlas repeated spring
blossoms in its first cell; that cell and repeated pine cells are not exported.

Seasonal records add a `frame` rectangle around the exact `crop` mask. The frame
keeps a shared native scale and baseline; the crop clips every neighboring tree
out of that frame. Source pixels remain unchanged. Winter trees keep a small
root rosette from the accepted style reference, while their canopies are bare.

Oak, birch and willow each use one six-tree sheet: seedling, young tree and mature
summer tree on the first row; mature spring, autumn and winter on the second.
Oak has rounded lobed leaves and acorns, birch has pale marked bark, and willow
has hanging narrow leaves and twigs. Spring foliage is pale green, autumn foliage
turns copper or gold, and winter branches are bare. Mature seasonal frames retain
a shared scale and ground anchor within each species. Reviewed masks follow the
actual silhouettes rather than equal cells; oak and willow summer crowns extend
slightly left of their nominal cells. All existing tree artwork remains intact.

`whimsical-finds-source.png` holds the bottle cap, toy robot, tiny crown and star
fragment in reading order. Their catalog records make them available year-round.
The source sheets preserve their original alpha and metadata; colored RGB under
zero-alpha pixels is invisible when drawn by the app. An image viewer that ignores
alpha can show a colored halo that is not part of the visible sprite.

## Provenance and review

The built-in `image_gen.imagegen` tool created these assets on 2026-10-19.
Existing PlayPets props and collection art were style references, and Clover's
accepted sheet was inspected for the yard's illustration direction. No character
sheet was replaced. Transparent backgrounds are genuine alpha, with no drawn
checkerboard. Fully transparent pixels form most of the growth and find sheets;
soft edge alpha is preserved. Runtime art and source originals are intentional
tracked copies: originals establish provenance; runtime paths are app inputs.

Review captures and rejected variants belong in ignored `scratch/`, and are not
inputs to the packer. Compact-size inspection confirms distinct keepsake shapes,
readable shovel structure and growth silhouettes. Review the final scene's
scale and occlusion separately before release.
