# Environment artwork

- The backgrounds of the built-in places, as accepted from image generation.
- `pnpm run assets:webp` exports them to `src/art/environments/`; `../webp.json` records both hashes.
- No external game's artwork is included.
- Briefs, tone steps and SHA-256 of the outdoor pictures: [Four-place provenance](FOUR-PLACES-PROVENANCE.md).
- Each place's geometry lives in `src/content/worlds.json`: floor line, traced edge, pond, fishing stance, festival lights, seats. [Add a place](../../../docs/how-to/add-a-world.md) explains each field.

## Current places

| Place | ID | Files |
|---|---|---|
| Hill garden | `woodland` | `spring`, `green`, `autumn`, `winter` |
| Wild garden | `courtyard` | `courtyard-spring`, `-green`, `-autumn`, `-winter` |
| Lakeside cottage | `lakeside` | `lakeside-spring`, `-green`, `-autumn`, `-winter` |
| Garden workshop | `workshop` | `workshop` |

- **Hill garden:** an open hillside with a sage-roof cottage and a pond for fishing.
- **Wild garden:** an open meadow with a pond, a little waterfall and a big oak; no buildings.
- **Lakeside cottage:** a wide, calm lake behind a cottage and a compact near shore.
- **Garden workshop:** a glass-roofed workshop, half greenhouse, half pergola. Its glass is transparent, so the live sky and weather show through it.

## Outdoor pictures

- Each is 1536 × 1024 with a transparent sky; the app draws the sky, sun, clouds, weather and time-of-day light.
- The summer picture of a place was the reference for its spring, autumn and winter pictures. Camera, shore and walking area stay.
- The seasons share one lawn and land tone, so a season change does not jump in color.
- No rain or snow is painted in.
- The field's top follows the picture: `geometry.fieldTop`, raised where `geometry.edge` traces ground reaching back.
- The pond people click is `geometry.lake`, an ellipse in picture fractions. `yard/environment.js` (`environmentLake`) applies the picture's crop to it.
- The pictures keep their proportions with a floor-anchored cover crop (`environmentFrame`), shared with the pond, the fishing stance and the festival lights.
- Night tint uses alpha compositing, so darkness does not depend on Canvas filter support.
- Images load during easel setup; the procedural land (`src/content/yard.json`) stays as the loading and error fallback.

## Atlases

- Made with the built-in image generation tool on 2026-10-11, next to the first environment set.
- Flower atlas (`../flowers/specimens.png`): a transparent 1536 by 1024 atlas with four columns and two rows; centered isolated tulip, daffodil, sunflower, hydrangea, cosmos, chrysanthemum, camellia and snowdrop. Smooth sculpted petal volumes, soft gradients, natural pastel colors, generous margins, no labels, pots, soil or panels.
- Prop atlas (`../decor/props.png`): a transparent 1536 by 1024 atlas with three columns and two rows; honey-wood bench, sage tent with ivory trim, stone-lined pond with lily pad, cream mailbox with coral roof, gingham picnic blanket with basket and apples, and a stone-ring campfire. Rounded edges, soft highlights and ambient occlusion, consistent gently elevated front view, no labels, scenery or characters.
- The eight flower symbols reference the flower atlas, so planting, discovery cards and the album share the same artwork.
- Original vector growth stages remain for seeds, sprouts, leaves and buds.

## Garden workshop

- `workshop.png` was made with the built-in image generation tool on 2026-11-12, with the earlier places and companions as style references.
- Brief, not the verbatim prompt: a glass-roofed workshop, half greenhouse, half pergola; two long potting tables with two stools each, only notebooks, seed packets, a trowel and seedlings on them; hanging tools, a tea corner under the vines and a garden bench at the front with a call bell and a lantern.
  - Furniture at the friends' size, an open middle floor, no laptops or screens, no characters, text, letters or logos.
  - The first picture (four desks with laptops, a reception desk, a post) was replaced before release.
- It was then recomposed from itself (an edit with the picture as input), so it keeps its camera, glass roof, vines, wall and light.
  - Brief: move the two potting tables and the tea corner down a little, and the bench with its bell post and lantern down to the front; leave open floor to the right of the post and in the bottom-right quarter; keep the furniture's size.
  - The edit returned the glass without transparency. The rows above 28.5% of the height were copied from the previous picture with its exact alpha, blended into the edit over the next 4%; no pixels were painted.
- Seats, fronts, blocks and window panes were measured on the picture and live in `src/content/worlds.json`.
- SHA-256 of `workshop.png`: `07c772909e1b901069a2c4831a4de4444722c6b6cba5386cd68402fa65ffd403`

## History

| Date | Change |
|---|---|
| 2026-10-11 | First generated outdoor set, then a depth revision with layered mountains and a distant lake. City and modern-city studio rooms; their prompts stay in [Modern studio prompts](MODERN-STUDIO-PROMPTS.md) |
| 2026-10-13 | Four places: hillside garden, stone courtyard, lakeside and village study ([provenance](FOUR-PLACES-PROVENANCE.md)) |
| 2026-11-12 | Agent workspaces: a sunny office and the garden workshop. The office was dropped and the workshop replaced the village study (living room) |
| 2026-11-13 | New outdoor set; the stone courtyard became the Wild garden. The previous outdoor pictures and the retired studio and office sources were removed from the repository; Git history keeps them |

- Only `assets/sources/environments/studio-cozy-day.png` remains of the retired rooms: `scripts/creator-skill.mjs` copies it as the creator kit's interior example.
