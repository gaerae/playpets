# Environment artwork

- The built-in image generation tool made these local assets on 2026-10-11.
- No external game's artwork is included.
- Visual reference: the clean shapes, material readability and calm composition of the
  [official Animal Crossing gallery](https://animalcrossing.nintendo.com/new-horizons/).

## Selected prompt set

- Green land: transparent environment layer for a cozy pet game, smooth sculpted rounded tree crowns in large pillow-like forms, sage grass with occasional edge tufts, pale blue hills, a small central pond and a broad empty foreground. Soft ambient occlusion, no outlines, grain, realistic leaf detail, animals, text or UI. Preserve tree and pond placement while removing the sky to true alpha.
- Spring: preserve the green layer's composition, add a blush-pink crown to the smaller left-center tree, sparse pale blossom clusters on fresh green crowns and small cream/pink flowers at the margins; preserve transparent sky and the clear foreground.
- Autumn: preserve the green layer's camera, silhouettes, pond and clearing; honey-gold, apricot and terracotta crowns, olive grass, blue distant hills, sparse amber flowers and fallen leaves only at the margins; preserve transparent sky.
- Winter: preserve the same composition; ivory snow caps and ground, pale blue-green crowns, lavender contact shadows, visible unfrozen teal pond, mist-blue hills, no daisies; preserve transparent sky.
- Flower atlas (`../flowers/specimens.png`): a transparent 1536 by 1024 atlas with four columns and two rows; centered isolated tulip, daffodil, sunflower, hydrangea, cosmos, chrysanthemum, camellia and snowdrop. Smooth sculpted petal volumes, soft gradients, natural pastel colors, generous margins, no labels, pots, soil or panels.
- Prop atlas (`../decor/props.png`): a transparent 1536 by 1024 atlas with three columns and two rows; honey-wood bench, sage tent with ivory trim, stone-lined pond with lily pad, cream mailbox with coral roof, gingham picnic blanket with basket and apples, and a stone-ring campfire. Rounded edges, soft highlights and ambient occlusion, consistent gently elevated front view, no labels, scenery or characters.

- The land keeps its proportions with a floor-anchored cover crop.
- The pond's fishing target uses the same transform in narrow and wide windows.
- `yard/environment.js` records the raster pond's geometry.
- The live sky, clouds, moon, sun and weather are separate layers.
- Night tint uses alpha compositing, so darkness does not depend on Canvas filter support.
- Images load only during easel setup; the original procedural land stays as the
  loading/error fallback.

- The existing eight SVG symbols reference the flower atlas, so planting, discovery cards
  and the album share the same artwork.
- Original vector growth stages remain for seeds, sprouts, leaves and buds.

## Depth revision

- The selected four environment files were regenerated after the first integration.
- The final prompt restores layered misty mountains, a distant lake, overlapping forests,
  detailed grouped leaves and dappled foreground shadows.
- It keeps the central clearing free of characters and props, with transparent sky above
  the mountain silhouette.
- The pond occupies approximately x34–79%, y56.5–62.5%.
- Seasonal variants keep this camera and layout and change foliage and ground to spring
  blossoms, autumn gold and winter snow.
- The first prompt set above records the earlier exploration; the depth revision is the
  selected environment.

## City studio revision

- The four `studio-city-*` images keep the studio's furniture, window frame and open wooden
  floor, and replace its outdoor forest with a high-floor view of a city, river and bridges.
- The built-in image tool authored morning, midday, sunset and night separately from the
  same day reference.
- These images carry their own lighting; the renderer adds no second whole-room time tint.
- Rain and snow use normalized window glass rectangles in `content/worlds.json`,
  transformed by the same floor crop.
- Overcast shading also stays within those rectangles.
- The previous `studio.png` and `studio-night.png` source artwork remains in `assets/sources/environments/`.

## Modern city studio follow-up

- The selected `studio-modern-city-{morning,day,evening,night}.png` images replace the
  rustic wooden room with ivory limestone flooring, graphite metal frames, a cream bouclé
  chair, a small travertine table and a slim charcoal desk.
- The broad pet floor, three glass regions and city composition keep the existing camera
  and geometry.
- The four `studio-city-*` images remain as comparisons in `assets/sources/environments/`.
- The exact selected prompts are in [Modern studio prompts](MODERN-STUDIO-PROMPTS.md).

- The built-in image generator edited the original city-day reference into the new day scene.
- Its prompt asked for:
  - a calm, accomplished personal workspace rather than a corporate office;
  - refined material contrast, soft rounded furniture, restrained plants and books;
  - no characters, labels, UI or rug, and an unobstructed lower half.
- It explicitly preserved the window mullions, exterior city, camera, walkable floor and
  image aspect ratio.

- Each time variant used the accepted modern-day image as its reference.
- The variant prompts preserved all furniture, window divisions, floor seams and object
  positions, and changed only environmental lighting and the city sky:

  | Variant | Lighting and sky |
  |---|---|
  | Morning | Pale peach/lavender, gentle sunlight |
  | Sunset | Coral/plum, the first city lights |
  | Night | Deep navy, illuminated buildings, river and bridge, soft warm lamps indoors |
  | Day | Stays bright with a pale blue sky |

- No generated paint was drawn or repaired with scripts.
- The renderer still clips weather and overcast shading to the registered glass panes
  instead of tinting the room.


## Four-place follow-up (2026-10-13)

- The current built-ins:

  | Place | Files |
  |---|---|
  | Hillside garden | `spring`, `green`, `autumn`, `winter` |
  | Stone courtyard | `courtyard-*` |
  | Lakeside | `lakeside-*` |
  | Village study | `studio-cozy-*` |

- The earlier sections record previous accepted directions, not the current runtime selection.
- The three outdoor places each have four seasonal images.
- The study has four time-of-day images and seasonal window views.
- Their geometry lives per place in `src/content/worlds.json`, including a separate fishing
  stance where water is present.
- Generation briefs, accepted filenames and SHA-256 hashes: [Four-place provenance](FOUR-PLACES-PROVENANCE.md).
- Portable background files: [Add a place](../../../docs/how-to/add-a-world.md#portable-backgrounds).
- The retired `studio-modern-city-*` images are kept in `assets/sources/environments/`
  and are no longer bundled as runtime art.
