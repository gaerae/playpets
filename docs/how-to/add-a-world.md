# Add a place for friends

- Start with [the places design](../design/2026-10-11-places.md): the registry, capabilities, floor geometry and weather behind window panes.
- Every place shares the app's friends and activities.
- A place's artwork and capabilities describe where the friends stand.

1. Add one entry to `src/content/worlds.json`.
   - Choose a stable `id`. Changing it later sends saved choices back to the hillside garden.
   - Add its `label` and `about` activity-note keys to all four page string tables.
2. Set `geometry.fieldTop` to the back edge of the walkable floor, as a fraction of the image height.
   - Leave enough open foreground for the full cast and the tools.
3. For a fishing place, set the water and the standing position.
   - `geometry.lake` takes `from`, `to`, `center` and `radius`: fractions that describe the same raster water people click.
   - `geometry.fishingSpot` takes normalized `x` and `y`: a separate standing position on the floor.
   - The fishing spot follows the same image transform as the water.
4. Set each capability on purpose: `sky`, `weather`, `wildlife`, `fishing`, `seasonalEffects` and `ambient`.
   - An indoor place usually turns off outdoor activities.
   - For weather through windows, enable `weather` and define `windowPanes` as normalized `x`, `y`, `width` and `height` rectangles over the glass.
   - Rain, snow and overcast shading share the background crop and stay inside those panes.
   - Do not enable fishing to make an activity button work when the image has no usable water.
5. Put generated or illustrated images in `src/art/environments/`. Keep earlier source assets.
   - With authored lighting, name the images in `art.morning`, `art.day`, `art.evening` and `art.night`, and set `"authoredLighting": true` so `environmentLook` does not tint the painted light again.
   - Without it, `environmentLook` lights each time of day in a place with pictures with its own gentle filter and tint.
6. Set `fit` to keep the image's proportions as the window changes shape.
   - `"cover-floor"` anchors the image's floor to `geometry.fieldTop`.
   - `"cover-bottom"` aligns the image's bottom edge instead of its floor line.
   - `environmentFrame` shares this transform with pond geometry, window weather and seasonal lights.
   - Before enabling fishing, check the visible water and the automatic fishing endpoints after cropping.
7. Add lighting to `environmentLook` when the new material or lamp light needs it.
   - Look at the actual image at every time of day.
   - A warm room at night needs readable walls and floor, and a clearly nighttime view through its window.
8. Give the place's atmosphere its own `chatter` string-table key, with casual idle lines in all four languages.
   - Indoor places need their own lines, so friends in one room do not talk about outdoor stars or another room's studio lamps.
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
- The studio keeps `studio` and uses its authored time-of-day variants.

### What changes with the scene

Built-in places:
- The courtyard, hillside garden and lakeside each have four seasonal images.
- The renderer adds time-of-day lighting, a dynamic sky and weather.
- Snow selects the winter artwork even when another season is selected.
- The cozy living room (`studio`) has four authored time-of-day images.
  - Its `windowArt` adds spring, autumn and winter scenery inside the window masks. Summer keeps the authored room view.
  - These seasonal views get time-of-day lighting before window weather is drawn.
  - Snow and winter are independent: snow keeps the selected season's window view.
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
