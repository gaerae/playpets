# Art direction and the art pipeline

Consolidated on 2026-10-13 from the design work of 2026-10-11 and 2026-10-12.

PlayPets is meant to feel like a small, polished world worth keeping beside everyday
work. This record holds the visual direction the yard, the companions, the collection
and the brand share, how generated raster art sits beside the code-drawn layers, how new
art is accepted, and where sources and exports live. It follows [A painted
yard](2026-10-09-a-painted-yard.md) and [Yard content as
data](2026-10-10-yard-content-as-data.md); how to add a drawing is in [Add to the
yard](../how-to/add-to-the-yard.md).

## The direction

A softly sculpted cozy-game look: broad rounded forms, soft shading without outlines,
believable contact shadows, sage foliage, powder-blue distance and cream highlights. The
reference was the clean shapes and material readability of cozy life-sim games; no
game's characters or artwork are copied, and every generated image was made for this
project.

Two earlier environments were rejected on the way. One with realistic leaves and grass
competed with the simple pets. A later one with broad rounded forms lost the yard's
depth. The selected scenery keeps the depth cues of the original painted yard:

- layered, misty mountain silhouettes and a distant lake;
- overlapping forests whose contrast drops with distance;
- dappled shadows in the foreground;
- an open central clearing with no characters or props, so friends, plants and gifts
  read clearly.

Companions follow the same rule: distinct silhouettes and clothes that say their role
(explorer, gardener, courier) in the landscape's palette, rather than recoloured copies.
The same palette of forest-sage ink, pale sky, warm apricot light and quiet paper
surfaces connects the app, the site and the installers.

## Raster layers and the procedural fallback

The yard is built from separate layers, so each can change on its own:

| Layer | Source | Notes |
|---|---|---|
| Land | Four transparent seasonal pictures in `src/art/environments/` | Cropped by the place's frame ([places](2026-10-11-places.md)) |
| Sky | `src/art/sky/` sun, moon and cloud pictures over a painted gradient | Clock placement, moon phases and weather stay live |
| Weather | `src/art/weather/seasonal.png` for leaves and petals; rain and snow are cached materials in `src/yard/weather-art.js` | Materials are made at setup or a weather change, never per frame |
| Wildlife | `src/art/ambient/birds.png` (three wing states); flying insects reuse their collection specimens | Wings fold by transform, not painted cycles |
| Friends and objects | Sprite sheets, garden and gift drawings | Drawn by their own modules |

The procedural painter (`src/yard/backdrop.js` with `brush.js`, `trees.js`, `lake.js`
and `clouds.js`) stays as the loading and error fallback and still draws seasonal event
details such as the festival lights. Pictures load only during easel setup, never on
module import or in a frame loop; a stale load never repaints an old scene; the scene
repaints only on a scene or size change ([the performance
standard](../standards/performance.md)).

Small interface marks and fast effects stay code-drawn or vector where that keeps them
legible, themeable and cheap: the UI icon set, stars, fireflies, rain, the fishing rod
and bobber, the bug net, and the heart, spark, notice and treat marks in
`src/art/ambient/`.

## Collection specimens

All 61 collection entries use sculpted specimen art: 8 flowers, 19 fish, 16 bugs and 18
gifts (`src/content/catalog.json`). Five shared atlases under `src/art/` hold them:
`flowers/specimens.png`, `fish/specimens.png`, `bugs/specimens.png`, `decor/props.png`
for the six permanent props, and `decor/collection.png` for the other twelve gifts.
Small SVG wrappers select each specimen's measured bounds and clip neighbours away,
keeping each item's existing display size; `src/art/collection.json` maps the 47 fish,
bug and gift wrappers. Removing a fish or bug's `art` field returns it to its procedural
look.

The album shows each entry on a specimen tray: a quiet circular mat and a grounded
shadow, with a short reveal on discovery that reduced motion removes. Undiscovered
entries are neutral alpha silhouettes with their hints. These are stylized game
collectibles, not identification plates; the moon carp and golden firefly are fantasy
event collectibles.

The four garden growth stages are SVG viewports over `src/art/plants/growth.png`,
keeping the 40×60 garden footprint and ground line. The New Year card shows the
generated `src/art/events/newyear.png` through `newyear.svg`.

## Accepting new art

Compare the previous and the candidate rendering at the same scale and in the same
scene. A changed file hash, a higher asset count or a striking key visual is not
acceptance. Review at normal and mini sizes, at device pixel ratios 1 and 2, in light
and dark interfaces and with reduced motion. Reject clipped, incoherent or less readable
replacements, and keep the original as a fallback until the new one passes.

For a character sheet, keep its identity, every animation state, the cell layout, alpha
and apparent height, and compare the meaning of each action, not only its sharpness:
waiting keeps its thoughtful gesture, working keeps its laptop, jumping and celebration
keep their movement. `scripts/pack-companion.mjs` and
`scripts/pack-companion-batches.mjs` pack generated poses with one shared scale anchored
to the idle height and refuse a pose that would cross a cell gutter; a frame map records
any pose swapped for another accepted one. Code crops and packs generated pixels; it
never draws replacement bodies.

`scripts/visual-audit.mjs` renders the review fixtures ([Visual
review](../how-to/visual-review.md)). `npm run assets:audit` checks image dimensions and
raster references into ignored `scratch/asset-audit/`; it does not judge visual quality.

## Brand

Clover is the mascot. The mark in `assets/icon.svg` is a vector interpretation of
Clover, not a crop of a sprite: ginger fur, cream cheeks and a straw hat with a sage
leaf bow, broad enough to read in a tray or favicon. One source feeds every surface:

- `npm run icons` (`scripts/make-icons.mjs`): the app icons for macOS, Windows and
  Linux, the tray icon and `src/logo.svg`;
- `npm run og` (`scripts/make-og.mjs`): the four share cards and the README banner;
- `npm run art` (`scripts/make-installer-art.mjs`): the macOS disk image background, the
  Windows installer art and the Linux listing images;
- `npm run site:prepare`: the site's `icon.svg`, with PNG and ICO favicons copied from
  the generated icons.

The tray icon stays coloured; there is no monochrome macOS template icon.

## Where sources and exports live

| Location | Holds |
|---|---|
| `src/art/` | Runtime art the app ships, with provenance beside it (`environments/README.md`, `MODERN-STUDIO-PROMPTS.md`, `COLLECTION.md`, `sky/README.md`, `plants/README.md`, `weather/GENERATION.md`, `ambient/GENERATION.md`, `events/GENERATION.md`) |
| `assets/sources/` | Generation originals and retired variants of `src/art/` (earlier studios, original gift drawings, the bird, weather and New Year sources); not shipped |
| `assets/pets/` | Companion manifests, canonical and seasonal sheets, source rows and prompt records |
| `assets/concepts/` | Approved direction and identity images (`forest-companions.png`, `adult-idol-companions.png`, `adult-realistic-companions.png`) |
| `assets/creator-kit/` | Reference sheets and metadata for the public creator downloads |
| `packaging/`, `website/public/` | Exports for installers, captures and share cards, made by the scripts above |

Accepted generated originals and their exact prompts stay in source control because they
cannot be rebuilt; discarded candidates and review captures go under ignored `scratch/`.
PNG exports are optimized losslessly with `npm run assets:optimize`; see [the art
storage decision](../decisions/2026-10-12-art-storage.md) and
[assets/README.md](../../assets/README.md).
