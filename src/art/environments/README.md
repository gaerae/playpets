# Environment artwork

The built-in image generation tool made these local assets on 2026-10-11.
No external game's artwork is included. The visual reference was the clean shapes,
material readability and calm composition of the [official Animal Crossing gallery](https://animalcrossing.nintendo.com/new-horizons/).

## Selected prompt set

- Green land: transparent environment layer for a cozy pet game, smooth sculpted rounded tree crowns in large pillow-like forms, sage grass with occasional edge tufts, pale blue hills, a small central pond and a broad empty foreground. Soft ambient occlusion, no outlines, grain, realistic leaf detail, animals, text or UI. Preserve tree and pond placement while removing the sky to true alpha.
- Spring: preserve the green layer's composition, add a blush-pink crown to the smaller left-center tree, sparse pale blossom clusters on fresh green crowns and small cream/pink flowers at the margins; preserve transparent sky and the clear foreground.
- Autumn: preserve the green layer's camera, silhouettes, pond and clearing; honey-gold, apricot and terracotta crowns, olive grass, blue distant hills, sparse amber flowers and fallen leaves only at the margins; preserve transparent sky.
- Winter: preserve the same composition; ivory snow caps and ground, pale blue-green crowns, lavender contact shadows, visible unfrozen teal pond, mist-blue hills, no daisies; preserve transparent sky.
- Flower atlas (`../flowers/specimens.png`): a transparent 1536 by 1024 atlas with four columns and two rows; centered isolated tulip, daffodil, sunflower, hydrangea, cosmos, chrysanthemum, camellia and snowdrop. Smooth sculpted petal volumes, soft gradients, natural pastel colors, generous margins, no labels, pots, soil or panels.
- Prop atlas (`../decor/props.png`): a transparent 1536 by 1024 atlas with three columns and two rows; honey-wood bench, sage tent with ivory trim, stone-lined pond with lily pad, cream mailbox with coral roof, gingham picnic blanket with basket and apples, and a stone-ring campfire. Rounded edges, soft highlights and ambient occlusion, consistent gently elevated front view, no labels, scenery or characters.

The land preserves its proportions with a floor-anchored cover crop. The pond's
fishing target uses the same transform in narrow and wide windows. `yard/environment.js`
records the raster pond's geometry. The live sky, clouds, moon, sun and weather are separate
layers. Night tint uses alpha compositing, so darkness does not depend on Canvas
filter support. Images load only during easel setup; the original procedural land
remains the loading/error fallback.

The flower atlas is referenced by the existing eight SVG symbols, keeping planting,
discovery cards and the album on the same artwork. Original vector growth stages
remain for seeds, sprouts, leaves and buds.

## Depth revision

The selected four environment files were regenerated after the first integration.
The final prompt restores layered misty mountains, a distant lake, overlapping
forests, detailed grouped leaves and dappled foreground shadows. It keeps the
central clearing free of characters and props, with transparent sky above the
mountain silhouette. The pond now occupies approximately x34–79%, y56.5–62.5%.
Seasonal variants preserve this camera and layout while changing foliage and
ground to spring blossoms, autumn gold and winter snow. The first prompt set above
records the earlier exploration; the depth revision is the selected environment.

## City studio revision

The four `studio-city-*` images preserve the studio's furniture, window frame and
open wooden floor while replacing its outdoor forest with a high-floor view of a
city, river and bridges. The built-in image tool authored morning, midday, sunset
and night separately from the same day reference. These images contain their own
lighting; the renderer does not add a second whole-room time tint. Rain and snow
use normalized window glass rectangles in `content/worlds.json`, transformed by
the same floor crop. Overcast shading stays within those rectangles as well.
The previous `studio.png` and `studio-night.png` source artwork remains available in `assets/sources/environments/`.

## Modern city studio follow-up

The selected `studio-modern-city-{morning,day,evening,night}.png` images replace
the rustic wooden room with ivory limestone flooring, graphite metal frames, a
cream bouclé chair, a small travertine table and a slim charcoal desk. The broad
pet floor, three glass regions and city composition retain the existing camera
and geometry. The four `studio-city-*` images remain available as comparisons in `assets/sources/environments/`.

The exact selected prompts are recorded in [Modern studio prompts](MODERN-STUDIO-PROMPTS.md).

The built-in image generator edited the original city-day reference into the new
day scene. Its prompt asked for a calm, accomplished personal workspace rather
than a corporate office; refined material contrast, soft rounded furniture,
restrained plants and books, no characters, labels, UI or rug, and an unobstructed
lower half. It explicitly preserved the window mullions, exterior city, camera,
walkable floor and image aspect ratio.

Each time variant used the accepted modern-day image as its reference. The
variant prompts preserved all furniture, window divisions, floor seams and
object positions while changing only environmental lighting and the city sky:
pale peach/lavender morning with gentle sunlight; coral/plum sunset and the first
city lights; deep navy night with illuminated buildings, river and bridge, plus
soft warm lamps indoors. Day remains bright with a pale blue sky. No generated
paint was drawn or repaired with scripts. The renderer continues to clip weather
and overcast shading to the registered glass panes instead of tinting the room.


## Four-place follow-up (2026-10-13)

The current built-ins use the hillside garden (`spring`, `green`, `autumn`,
`winter`), stone courtyard (`courtyard-*`), lakeside (`lakeside-*`) and village
study (`studio-cozy-*`). The earlier sections record previous accepted directions,
not the current runtime selection. The three outdoor places each have four
seasonal images; the study has four time-of-day images and seasonal window
views. Their geometry now lives per place in `src/content/worlds.json`, including a
separate fishing stance where water is present.

See [Four-place provenance](FOUR-PLACES-PROVENANCE.md) for generation briefs,
accepted filenames and SHA-256 hashes. Portable background files are described in
[Add a place](../../../docs/how-to/add-a-world.md#portable-backgrounds).

The retired `studio-modern-city-*` images are retained in
`assets/sources/environments/` and are no longer bundled as runtime art.
