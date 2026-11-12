# Add a place for friends

- Start with [the places design](../design/2026-10-11-places.md): the registry, capabilities, floor geometry and weather behind window panes.
- Every place shares the app's friends and activities.
- A place's artwork and capabilities describe where the friends stand.

1. Add one entry to `src/content/worlds.json`.
   - Choose a stable `id`. Changing it later sends saved choices back to the hillside garden.
   - Add its `label` and `about` activity-note keys to all four page string tables.
2. Set `geometry.fieldTop` to the back edge of the walkable floor, as a fraction of the image height.
   - Leave enough open foreground for the full cast and the tools.
   - Where the picture shows walkable ground reaching back past that line (a path, a gate, a dock), add `geometry.edge` (see [Traced edge](#traced-edge)).
3. For a fishing place, set the water and the standing position.
   - `geometry.lake` takes `from`, `to`, `center` and `radius`: fractions that describe the same raster water people click.
   - `geometry.fishingSpot` takes normalized `x` and `y`: a separate standing position on the floor.
   - The fishing spot follows the same image transform as the water.
4. Set each capability on purpose: `sky`, `weather`, `soil`, `wildlife`, `fishing`, `seasonalEffects` and `ambient`.
   - An indoor place usually turns off outdoor activities.
   - For weather through windows, enable `weather` and define `windowPanes` as normalized `x`, `y`, `width` and `height` rectangles over the glass.
   - Rain, snow and overcast shading share the background crop and stay inside those panes.
   - Do not enable fishing to make an activity button work when the image has no usable water.
5. Put generated or illustrated images in `assets/art/environments/` and run `pnpm run assets:webp` for the copies in `src/art/environments/`. Keep earlier source assets.
   - `environmentLook` lights each time of day with its own gentle filter and tint, so one picture per season serves the whole day.
6. Set `fit` to keep the image's proportions as the window changes shape.
   - `"cover-floor"` anchors the image's floor to `geometry.fieldTop`.
   - `"cover-bottom"` aligns the image's bottom edge instead of its floor line.
   - `environmentFrame` shares this transform with pond geometry, window weather and seasonal lights.
   - Before enabling fishing, check the visible water and the automatic fishing endpoints after cropping.
7. Add lighting to `environmentLook` when the new material or lamp light needs it.
   - Look at the actual image at every time of day.
   - A warm room at night needs readable walls and floor, and a clearly nighttime view through its window.
8. Give the place's atmosphere its own `chatter` string-table key, with casual idle lines in all four languages.
   - Indoor places need their own lines, so friends in one room do not talk about outdoor stars or another room's lamps.
   - Enabling `ambient` currently selects the woodland mix.
   - A café or city sound palette needs its own implementation and tests.
9. Add capability, geometry, asset and translation checks to `tests/worlds.test.mjs`. Change a test before you change its rule.
10. Add real visual fixtures through `scripts/visual-audit.mjs`: day, night, full size, 500×350, 320×240 and a wide short window.
11. Check that switching worlds ends fishing and games and keeps friends and collections.

- The existing modules read registry data with no extra entry-point wiring.
  - `loadContent()` loads the registry.
  - `setupSky()` builds the Place select from its entries, saves the chosen id and applies the new scene.
  - An unknown saved id falls back to the hillside garden.
- Before adding a place, run the repository's normal checks: Node and Rust tests, lint, the site build for documentation changes and the real-app E2E for the selector flow.
- Isolated fixtures make the result reviewable, but they do not replace native interaction checks.

## Traced edge

- `geometry.edge` is a polyline of picture `[x, y]` points, fractions of the image, ordered left to right.
- Straight lines join the points. At `x`, the field's top is `min(fieldTop, edge(x))`: the edge only raises the field, never lowers it.
- Left of the first point, right of the last, and wherever the edge lies below `fieldTop`, the `fieldTop` line holds.
- A friend's saved `y` stays 0 to 1 at every `x`: 0 is the field's top there, 1 its front edge. Saves do not change when an edge is added or moved.
- The edge shares the picture's transform (`environmentFrame`), so it follows the crop in wide, narrow and mini windows.
- `yard/field.js` reads it: `topAt(px)` gives the field's top at a yard x, `hasEdge()` says whether the place has one as shown now.
- It is not used on the painted fallback land or in a `cover-bottom` room.

| Field | Meaning |
|---|---|
| `fieldTop` | The flat back line of the walkable floor |
| `edge` | `[[x, y], …]` from `x` 0 to 1; each `y` is where walkable ground ends at that `x` |

To trace one:
1. Open the summer picture at full size (1536 × 1024).
2. Walk the boundary between walkable ground and what is behind it (water, hedges, walls, the sky), left to right.
3. Put a point at each corner, every 1–3% of the width where the boundary bends; divide pixels by 1536 and 1024.
4. Keep the edge on the near side of the pond: it stays below `geometry.lake`'s near shore (`center + radius` at its middle).
5. Check the other seasons; they share the camera, but snow and blossom can move the visible edge.
6. Check the place in a wide strip, a narrow window and the mini window: friends, plants and gifts on the raised ground stay on the ground.

## Workspaces for coding agents

- A place can give a coding agent's friend somewhere to go for each state ([agent workspaces](../design/2026-11-11-agent-workspaces.md)). The garden workshop is the built-in one.
- All of these live under `geometry` in source-image fractions and share the picture's transform (`environmentFrame`).

| Field | What it is |
|---|---|
| `stations.desks` | One `{x, y}` per seat: where a working friend's feet stand |
| `stations.approval` | Where a waiting friend stands; others line up beside it |
| `stations.rest` | The corner a friend rests in once its agent is done |
| `blocks` | `{x, y, rx, ry}` ellipses a stroll does not end on (furniture) |
| `fronts` | `{x, y, width, height, foot, shape}`: a piece cut from the picture and drawn over friends whose feet are above `foot` |
| `depthFar` | How small a friend at the back is drawn (default 0.84; about 0.6 for a deep room) |

- Measure each front on the picture. Start its `shape` at the tabletop, not at a lamp or a pot on it: anything above the top covers a seated friend's face.
- Ask for only flat things on a table in front of a seat (books, paper, seed packets): a laptop or a tall pot there sits in front of a face.
- A seated friend's name tag goes down to its feet, on the desk's front, so its face stays in view.
- Set the `soil` capability to `false` for a paved floor: flowers stand in pots and nothing is dug.
- Use `"fit": "cover-bottom"` so a short window keeps the front of the room.
- Draw the furniture at the friends' size for a window 850px tall: in a room, friends grow with the picture in larger windows (up to twice), so that size holds at full screen. With `cover-bottom`, the field follows the picture's floor line in a window wider than the picture.
- A room whose glass shows the live sky takes the outdoor light: name its picture under `seasonArt` (the same id for every season is fine). Its panes are not washed over again in rain.
- A station the window crops away is not used: a waiting friend comes to the front of the yard, and a working or resting friend stays where it stands.
- Put a station where the friend standing there reads clearly: beside a narrow post, not behind it.
- Check the room with every friend working, at day and night, in rain, and in a short wide window.

## Portable backgrounds

1. Get a creation kit from [the background studio](../../website/guide/background-kit.md). It includes a starting layout, a guide, a complete request and a portable skill.
2. Generate the art, review the composition and package it in the selected AI workspace, not in a browser image editor.
   - `render-layout` creates a PNG guide.
   - `pack-background` checks the final images and config and writes v1 JSON.
3. Import it from the scene menu. The app keeps it in the data folder's `backgrounds/`, one file per background (before 1.4.0, in the webview's IndexedDB, from which it moves at the first start of 1.4.0).
4. Keep the JSON as a backup if you want the exact file you made.

Layout:
- Each package declares a normalized floor, an optional water ellipse, a fishing stance and up to twelve window rectangles.
- Adjust the kit's layout JSON to match the actual artwork. Positions vary by background.
- The stance stays on the walkable floor, and the water stays above it.
- Optional window masks keep indoor weather inside the windows.
- Review large and small window crops, narrow windows included, with the app's floor-anchored transform (`environmentFrame`).
- A stance that is cropped out falls back to the visible shore.
- The website does not reopen, inspect or convert packages.

Images and limits:

| Item | Rule |
|---|---|
| Images | Embedded PNG data URLs, each 1536 × 1024, up to 6 MB |
| Package | Up to 32 MB of JSON |
| Validator | Rejects external addresses, unsupported versions and invalid geometry |
| Importer | Also decodes every image before saving |
| Base image | Required |
| Season images | Optional; missing seasons use the base image |

- All four seasons enable seasonal particles.
- Custom backgrounds do not inherit the built-in festival light locations.
- An outdoor live sky needs real alpha in the sky. A solid painted sky hides the dynamic one.
- The current format has no obstacle map. Keep the whole floor clear, including the margins that wandering friends reach.

Ids:
- The built-in hillside keeps the `woodland` id for saved selections.
- `seasonArt` maps the shared season names (`spring`, `green`, `autumn`, `winter`) to each place's artwork.
- A retired id opens the place that replaced it (`REPLACED` in `src/yard/worlds.js`): a saved `studio`, the former living room, opens the garden workshop.

### What changes with the scene

Built-in places:
- The courtyard, hillside garden and lakeside each have four seasonal images.
- The renderer adds time-of-day lighting, a dynamic sky and weather.
- Season and weather are separate: snow falls over the selected season's artwork.
- The garden workshop (`workshop`) has one picture. Its glass shows the live sky and weather, and the renderer lights it for the time of day.
- A room without a sky, such as a background of your own, shows rain and snow only inside its window panes; `tests/indoor-environment.test.mjs` checks it with a fixture room.
- Indoor places hide outdoor creatures, fishing and seasonal particles, and keep friends and collections.

Version 1 imported packages:
- Seasonal images are accepted.
- Separate morning, day, evening and night images are not. The app tints by time of day at runtime instead.
- Use daytime source images without painted rain or snow, so the app adds weather only once.
- A package can turn off weather and the woodland sound.
- A package has no custom flower, fish, insect, sound or prop assets. Those stay shared app content.

Art and floor:
- The art and the configured floor do different jobs.
- The visible floor can show furniture behind its walkable boundary.
- Every point below the boundary has to be safe for a friend to stand on.
- Check tall sprites and accessories, not only the feet.
- A small window crops more of the room and the lake. Check the transformed water and standing position instead of assuming they stay visible.

Festival lights:
- Built-in outdoor places can define `lightAnchors` for festival strands.
- Each `{from, to, y, sag}` uses normalized source-image coordinates.
- The renderer shares the image crop and leaves out bulbs outside the viewport.
- Place anchors on visible branches instead of copying another scene's positions.
- Custom version 1 packages do not expose this field and do not inherit built-in strands.
