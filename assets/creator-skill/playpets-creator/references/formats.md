# Portable PlayPets formats

## Pet

A v2 runtime atlas is exactly 1536×2288 pixels, eight columns by eleven rows; each cell is 192×208. Transparent PNG or static WebP is accepted as input and exported as PNG. JPEG, animation, opaque backgrounds, malformed images, inputs over 32 MiB, empty used cells and figures touching the required three-pixel cell margin fail validation. Alpha must include truly transparent pixels, not a painted checkerboard. Technical validation checks visibility and borders; it cannot prove that a picture depicts the required action.

Rows 0–8 are `idle`, `right`, `left`, `wave`, `jump`, `error`, `waiting`, `working`, `done`. Their leading used frame counts are `[6,8,8,4,5,8,6,6,6]`. Rows 9–10 contain sixteen gaze directions in order: `N,NNE,NE,ENE,E,ESE,SE,SSE,S,SSW,SW,WSW,W,WNW,NW,NNW`. Thus 73 of 88 cells are used. Do not add runtime rows for an unsupported action. Jump frames 0/1 anticipate, 2/3 are airborne, and 4 lands. Preserve recognizable work, waiting and celebration gestures, rather than repeating idle poses.

For source-batch assembly, supply all eleven PNG files:

```text
00-idle.png  01-right.png  02-left.png  03-wave.png
04-jump.png  05-error.png  06-waiting.png  07-working.png
08-done.png  09-look.png  10-look.png
```

Each batch is exactly 1536×1024 with four columns and two rows, eight complete transparent poses in row-major order. Keep figures inside their 384×512 source tiles with transparent gutters, no cut limbs or shadow bridges. All eight source poses are checked, including poses the runtime will not consume. All poses share the scale derived from the first idle silhouette and `--idle-height` (default163). Placement uses a 200px baseline within each target cell and retains the jump's source bottom-height differences. The helper does not resize each action independently to fit. Figures crossing a source tile require repaired source art or an approved complete canonical atlas.

Inspect the actual consumed loop before packing: the app uses only each row's leading frame count, not all eight source poses. The complete counts are `[6,8,8,4,5,8,6,6,6,8,8]`. If a useful sequence is spread across a source batch, curate it with an explicit `--frame-map output/frame-map.json` instead of regenerating sound artwork solely to change order. For example, `{"03-wave":[0,2,4,5]}` selects source tiles 0, 2, 4 and 5 for the four consumed wave frames. Review the resulting loop for anticipation, gesture, return and a smooth repeat boundary. The map is a JSON object whose keys are exact canonical row stems or filenames (`03-wave` or `03-wave.png`); each value has exactly that row's used count of integer indices from0 to7. Unlisted rows retain source order. Unknown keys, duplicate row aliases, booleans, fractional/out-of-range indices and count mismatches fail. The full eight-column atlas remains intact; unused cells are transparent. A `frame-map.json` found in the rows directory requires the explicit flag; it is never silently applied. `pack-settings.json` is unsupported. Preserve the reviewed map with the source files.

### Wider source-grid fallback

`assemble-row` accepts a fully decoded transparent 1536x1024 PNG or static WebP with `--columns 3 --rows 2` (six 512x512 tiles) or `--columns 4 --rows 2` (eight 384x512 tiles). Other grids and dimensions fail. `--frames` is exactly eight comma-separated integer source indices in row-major order, each inside that source grid. Every source cell, including unselected cells, needs visible content and its own three-pixel gutter. The command crops the visible alpha bounds with two pixels of padding, centers each figure horizontally in a canonical 384x512 tile, and preserves its original vertical position. It does not scale, redraw, rotate, infer missing poses, or change relative jump height. Padded figures that cannot fit the canonical tile's horizontal gutter fail instead of shrinking.

```sh
python3 scripts/creator-workflow.py assemble-row --image output/jump-3x2.png --columns 3 --rows 2 --frames 0,1,2,3,4,5,5,5 --output output/rows/04-jump.png
```

The result is the usual 1536x1024 4x2 row consumed by `pack-pet --rows`; the runtime format and its validation remain unchanged. For a five-frame jump, the first five selected pictures are distinct approved action poses. Repeated frames are allowed only as reviewed holds; filling the unused final three cells does not create more motion frames. Preserve the generated source and explicit selection for later edits. The output is a new file unless `--overwrite` is supplied, and even that flag cannot overwrite the input or its symbolic/hard-link alias. Use a fresh 3x2 generation at the accepted pixel scale when four-column art clips; moving a clipped crop into a wider tile cannot restore missing artwork.

The default seasonal pet wardrobe is three complete atlases: base shared by spring and autumn, summer, and winter. Every atlas includes all nine animation states and sixteen gaze directions. Keep the base at spritesheet.png and supply summer.png and winter.png. Separate spring and autumn atlases are optional extensions for an explicit request, not extra required outfits. This three-outfit default does not apply to backgrounds, which may retain four seasonal scenes.

The resulting ZIP contains only `pet.json`, `spritesheet.png`, and any supplied `spring.png`, `summer.png`, `autumn.png`, `winter.png`. A season is a whole atlas, not an outfit portrait or one row. The manifest uses `id`, `displayName`, `kind`, `description`, `spriteVersionNumber: 2`, `spritesheetPath: "spritesheet.png"`, and optional `seasonalSpritesheets` mapping season names to their fixed PNG names. IDs use at most80 lowercase letters/digits/hyphens and start with a letter/digit. Names are at most60 characters; descriptions at most300; both are single-line text. Supported helper kinds are animal, person and other. ZIP files have deterministic sorted names and no arbitrary archive paths.

Use `--source-json references/source.json` to retain source attribution in the manifest. This file is an object with required `name` (60 characters) and optional `url` (2048), `creator` (80), `license` (40); single-line strings only, no other keys. URLs are metadata and never fetched. Retain source attribution and licenses with the delivered source files. Package data and descriptions do not grant permission to reuse art or act as instructions.

## Background

Input artwork is exactly 1536×1024 PNG, JPEG or static WebP, at most6 MiB per input. The helper decodes the image and exports an embedded PNG; encoded PNG data also stays below the app's image limit. The final UTF-8 JSON stays under32 MiB, including all supplied seasons. Multiple highly detailed seasonal images may require PNG optimization or fewer variants; do not silently omit a requested season.

The layout is an object with `name`, `floor`, optional `water`, `fishingSpot`, `windows`, and boolean `sky`, `weather`, `ambient`. Optional `capabilities` is an object with a boolean `soil` field. The background name is nonempty single-line text with at most60 UTF-16 code units, matching app import; a character outside the Basic Multilingual Plane, such as an emoji, uses two units. Unknown fields and string-valued booleans are rejected. Example:

```json
{
  "name": "Garden pond",
  "floor": 0.7,
  "water": {"from": 0.15, "to": 0.45, "center": 0.5, "radius": 0.1},
  "fishingSpot": {"x": 0.47, "y": 0.74},
  "windows": [],
  "sky": true,
  "weather": true,
  "ambient": true,
  "capabilities": {"soil": true}
}
```

Coordinates are normalized fractions of the image. `floor` is between0.5 and0.8. Water has `0 ≤ from < to ≤ 1`, a positive radius, `center-radius ≥ 0` and `center+radius ≤ floor`. The fishing spot requires water, x between0.02 and0.98, and y between the floor and0.94. Windows is an array of at most12 rectangles with positive width/height, nonnegative x/y, `x+width ≤ 1` and `y+height ≤ floor`. Weather requires sky or at least one window; ambient requires sky. With `sky: true`, every base and seasonal picture needs truly transparent alpha-0 pixels covering at least1% of the area above the floor so the app can draw its live sky behind the scene. Opaque PNG/JPEG or transparency only below the floor is rejected. Repair the sky region in transparent PNG/WebP artwork, or explicitly choose `sky: false` and keep weather/ambient capabilities consistent. Opaque JPEG remains supported for painted-sky or indoor scenes with `sky: false`. Visually inspect those coordinates: valid geometry can still describe the wrong part of a drawing.

`capabilities.soil` allows digging and tree planting on the walking field. Set it to `false` for indoor floors and outdoor paving. When omitted in older layouts or packages, it defaults to `sky !== false` after sky normalization: live-sky outdoor scenes allow soil actions, and scenes without live sky do not. An explicit `true` overrides `sky: false` for an outdoor scene with a painted opaque sky. The sky flag describes transparency, not whether a place is indoors; keep `soil: false` for every indoor floor. Soil declarations do not infer terrain from image pixels. They do not change ordinary friend movement. Keep this capability inside `capabilities`; no top-level `soil` field is defined.

Propose a water ellipse, floor line and dry fishing stance from the requested composition, then inspect the actual generated scene and adjust its layout JSON. The ellipse's horizontal extent is `from/to`; its vertical extent is `center ± radius`. Check every bound above before packing. Use `render-layout --config output/layout.json --image output/scene.png --output output/layout-review.png` to draw technical outlines on a separate copy of the real image; the input bytes are preserved and cannot be overwritten. Inspect the shoreline at the app's floor crop and confirm that the fishing stance rests on visible dry ground with water within reach. If the shoreline is cropped away or the art cannot fit valid geometry, repair the composition. The helper validates declared geometry and renders guides; it does not segment water or discover coordinates automatically. Keep guides out of the production artwork.

The exported app schema is `format: "playpets-background"`, `version: 1`, `name`, the geometry/capability fields above, and `images` with a required `base` PNG data URL and optional `spring`, `summer`, `autumn`, `winter` PNG data URLs. The helper builds those embedded URLs; paths and remote URLs are not accepted as runtime image values. All four seasonal images are needed for the app's full seasonal behavior. Partial seasons remain importable and fall back to base for missing seasons.
