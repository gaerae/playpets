# Add a place for friends

- Start with [the places design](../design/2026-10-11-places.md): the registry, capabilities, floor geometry and weather behind window panes.
- A place shares the app's friends and activities; its artwork and capabilities describe where they are standing.

1. Add one entry to `src/content/worlds.json`.
   - Choose a stable `id`. Changing it later sends saved choices back to the hillside garden.
   - Add its `label` and `about` activity-note keys to all four page string tables.
2. Set `geometry.fieldTop` to the back edge of the walkable floor, as a fraction of the image height.
   - Keep enough open foreground for the full cast and the tools.
3. For a fishing place, set the water and the standing position.
   - `geometry.lake` with `from`, `to`, `center` and `radius`: fractions that describe the same raster water people click.
   - `geometry.fishingSpot` with normalized `x` and `y`: the separate standing position on the floor. It follows the same image transform as the water.
4. Set each capability deliberately: `sky`, `weather`, `wildlife`, `fishing`, `seasonalEffects` and `ambient`.
   - An indoor place normally disables outdoor activities.
   - Weather through windows: enable `weather` and define `windowPanes` as normalized `x`, `y`, `width` and `height` rectangles over the glass. Rain, snow and overcast shading share the background crop and stay inside those panes.
   - Do not enable fishing to make an activity button work when the image has no usable water.
5. Put generated or illustrated images in `src/art/environments/`. Preserve prior source assets.
   - With authored lighting: name them in `art.morning`, `art.day`, `art.evening` and `art.night`, and set `"authoredLighting": true` so `environmentLook` does not tint the painted light again.
   - Without it: `environmentLook` lights each time of day with its own gentle filter and tint for places with pictures.
6. Set `fit` to keep the image's proportions as the window changes shape.
   - `"cover-floor"` anchors the image's floor to `geometry.fieldTop`.
   - `"cover-bottom"` aligns the image's bottom edge instead of its floor line.
   - `environmentFrame` shares this transform with pond geometry, window weather and seasonal lights.
   - Before enabling fishing, review visible water and automatic fishing endpoints after cropping.
7. Add lighting to `environmentLook` when the new material or lamp light needs it.
   - Review the actual image in every time of day. A warm night room needs readable walls and floor, with a genuinely nighttime view through its window.
8. Give the place's atmosphere its own `chatter` string-table key, with casual idle lines in all four languages.
   - Indoor places need their own lines so friends do not talk about outdoor stars or studio lamps in another room.
   - Enabling `ambient` currently selects the woodland mix. A café or city sound palette needs a distinct implementation and tests.
9. Add capability, geometry, asset and translation checks to `tests/worlds.test.mjs`. Change tests before changing their rules.
10. Add real visual fixtures through `scripts/visual-audit.mjs`: day, night, full size, 500×350, 320×240 and a wide short window.
11. Verify that changing worlds ends fishing and games and retains friends and collections.

- The existing modules consume registry data without extra entry-point wiring.
  - `loadContent()` loads the registry.
  - `setupSky()` builds the Place select from its entries, saves the chosen id and applies the new scene.
  - Unknown saved ids return to the hillside garden.
- Before integrating a place, run the repository's normal checks: Node and Rust tests, lint, the site build for documentation changes and real-app E2E for the selector flow.
- Isolated fixtures make the result reviewable, but they do not replace native interaction checks.

## Portable backgrounds

1. Get a creation kit from [the background studio](../../website/guide/background-kit.md).
   It includes an initial layout, a guide, a complete request and a portable skill.
2. Generate, review the composition and package in the selected AI workspace, not
   in a browser image editor.
   - `render-layout` creates a PNG guide.
   - `pack-background` checks the final images and config and writes v1 JSON.
3. Import it from the scene menu. The app stores it in this profile's IndexedDB.
4. Keep the JSON as a backup; it is not part of the native pet data file.

Layout:
- Each package declares a normalized floor, optional water ellipse, fishing stance
  and up to twelve window rectangles.
- Adjust the kit's layout JSON to match the actual artwork; positions are not fixed
  across backgrounds.
- The stance stays on the walkable floor and water stays above it.
- Optional window masks bound indoor weather.
- Review large and small window crops using the app's floor-anchored transform
  (`environmentFrame`), including narrow windows.
- A cropped-out stance falls back to the visible shore.
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
- Outdoor live sky requires actual alpha in the sky. A solid painted sky hides the
  dynamic one.
- The current format has no obstacle map: keep the entire floor clear, including
  the margins reached by wandering friends.

Ids:
- The built-in hillside retains the `woodland` id for saved selections.
- `seasonArt` maps the shared seasonal names (`spring`, `green`, `autumn`,
  `winter`) to each place's artwork.
- The studio retains `studio`, using its authored time-of-day variants.


### What changes with the scene

Built-in places:
- The courtyard, hillside garden and lakeside each have four seasonal images.
- The renderer adds time-of-day lighting, dynamic sky and weather.
- Snow selects winter artwork even when another season is selected.
- The cozy living room (`studio`) has four authored time-of-day images.
  - Its `windowArt` adds spring, autumn and winter scenery inside the window
    masks; summer keeps the authored room view.
  - These seasonal views receive time-of-day lighting before window weather is
    drawn.
  - Snow and winter are independent: snow keeps the selected season's window view.
- Indoor places suppress outdoor creatures, fishing and seasonal particles, while
  keeping friends and collections.

Version 1 imported packages:
- Seasonal images are accepted; separate morning, day, evening and night images
  are not. Runtime time tinting is used instead.
- Use daytime source images without painted rain or snow particles, so the app
  can add weather once.
- The package can disable weather and woodland sound.
- It does not contain custom flower, fish, insect, sound or prop assets: these
  remain shared app content.

Art and floor:
- The art and the configured floor have different jobs.
- The visible floor can include furniture behind its walkable boundary, but every
  point below the boundary must be safe for a friend to stand.
- Check tall sprites and accessories, not only the feet.
- A small window crops more of the room and the lake. Review the transformed water
  and standing position rather than assuming they remain visible.


Festival lights:
- Built-in outdoor places can define `lightAnchors` for festival strands.
- Each `{from, to, y, sag}` uses normalized source-image coordinates.
- The renderer shares the image crop and omits bulbs outside the viewport.
- Place anchors on visible branches instead of reusing another scene's positions.
- Custom version 1 packages do not expose this field and do not inherit built-in
  strands.
