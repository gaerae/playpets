# Add a place for friends

Start with [the places design](../design/2026-10-11-places.md), which describes the registry, capabilities, floor geometry and weather behind window panes. A place shares the app's friends and activities; its artwork and capabilities describe where they are standing.

1. Add one entry to `src/content/worlds.json`. Choose a stable `id`; changing it later sends saved choices back to the hillside garden. Add its `label` and `about` activity-note keys to all four page string tables.
2. Set `geometry.fieldTop` to the back edge of the walkable floor, as a fraction of the image height. Keep enough open foreground for the full cast and the tools. A fishing place also needs `geometry.lake` with `from`, `to`, `center` and `radius`; those fractions describe the same raster water that people click. Add `geometry.fishingSpot` with normalized `x` and `y` for the separate standing position on the floor; it follows the same image transform as the water.
3. Set each capability deliberately: `sky`, `weather`, `wildlife`, `fishing`, `seasonalEffects` and `ambient`. An indoor place normally disables outdoor activities. To show weather through its windows, enable `weather` and define `windowPanes` as normalized `x`, `y`, `width` and `height` rectangles over the glass. Rain, snow and overcast shading share the background crop and stay inside those panes. Do not enable fishing to make an activity button work when the image has no usable water.
4. Put generated or illustrated images in `src/art/environments/` and name them in `art.morning`, `art.day`, `art.evening` and `art.night` when they have authored lighting, and set `"authoredLighting": true` so `environmentLook` does not tint the painted light again; without it, `environmentLook` lights each time of day with its own gentle filter and tint for places with pictures. Preserve prior source assets. Use `fit: "cover-floor"` (or `"cover-bottom"`, which aligns the image's bottom edge instead of its floor line) to keep the image's proportions and anchor its floor to `geometry.fieldTop` as the window changes shape. `environmentFrame` shares this transform with pond geometry, window weather and seasonal lights. Review visible water and automatic fishing endpoints after cropping before enabling fishing.
5. Add lighting to `environmentLook` when the new material or lamp light needs it. Review the actual image in every time of day: a warm night room needs readable walls and floor, with a genuinely nighttime view through its window.
6. Give the new place's atmosphere its own `chatter` string-table key containing casual idle lines in all four languages. Indoor places need their own lines so friends do not talk about outdoor stars or studio lamps in another room. A café or city sound palette needs a distinct implementation and tests; enabling `ambient` currently selects the woodland mix.
7. Add capability, geometry, asset and translation checks to `tests/worlds.test.mjs`, changing tests before changing their rules. Add real visual fixtures through `scripts/visual-audit.mjs`, including day, night, full size, 500×350, 320×240 and a wide short window. Verify that changing worlds ends fishing and games and retains friends and collections.

The existing modules consume registry data without extra entry-point wiring. `loadContent()` loads the registry; `setupSky()` builds the Place select from its entries, saves the chosen id and applies the new scene. Unknown saved ids return to the hillside garden.

Run the repository's normal checks before integrating a place: Node and Rust tests, lint, the site build for documentation changes and real-app E2E for the selector flow. Isolated fixtures make the result reviewable, but they do not replace native interaction checks.

## Portable backgrounds

Get a creation kit from [the background studio](../../website/guide/background-kit.md).
It includes an initial layout, a guide, a complete request and a portable skill.
Generation, composition review and final packaging happen in the selected AI
workspace, not in a browser image editor. Its `render-layout` helper creates a PNG
guide; `pack-background` checks the final images and config and writes v1 JSON.
The app imports it from the scene menu and stores it in this profile's IndexedDB.
Keep the JSON as a backup; it is not part of the native pet data file.

Each package declares a normalized floor, optional water ellipse, fishing stance
and up to twelve window rectangles. Adjust the kit's layout JSON to match the
actual artwork; positions are not fixed across backgrounds. The stance stays on
the walkable floor and water stays above it. Optional window masks bound indoor
weather. Review large and small window crops using the app's floor-anchored transform
(`environmentFrame`), including narrow windows. A cropped-out stance falls back
to the visible shore. The website does not reopen, inspect or convert packages.

Images are embedded PNG data URLs, each 1536 × 1024, up to 6 MB, within a 32 MB JSON
package. The validator rejects external addresses, unsupported versions and invalid
geometry. The importer also decodes every image before saving. The base image is
required; individual season images are optional. Missing seasons use the base image.
All four seasons enable seasonal particles; custom backgrounds do not inherit the
built-in festival light locations. Outdoor live sky requires actual alpha in the sky.
A solid painted sky hides the dynamic one. The current format has no obstacle map:
keep the entire floor clear, including the margins reached by wandering friends.

The built-in hillside retains the `woodland` id for saved selections. `seasonArt`
maps the shared seasonal names (`spring`, `green`, `autumn`, `winter`) to each place's
artwork. The studio retains `studio`, using its authored time-of-day variants.


### What changes with the scene

The built-in courtyard, hillside garden and lakeside each have four seasonal
images. The renderer adds time-of-day lighting, dynamic sky and weather. Snow
selects winter artwork even when another season is selected. The cozy living room (`studio`)
has four authored time-of-day images. Its `windowArt` adds spring, autumn and
winter scenery inside the window masks; summer keeps the authored room view.
These seasonal views receive time-of-day lighting before window weather is drawn.
Snow and winter are independent: snow keeps the selected season's window view. Indoor places suppress outdoor
creatures, fishing and seasonal particles, while keeping friends and collections.

A version 1 imported package accepts seasonal images, but not separate morning,
day, evening and night images. It uses runtime time tinting. Use daytime source
images without painted rain or snow particles so the app can add weather once.
The package can disable weather and woodland sound. It does not contain custom
flower, fish, insect, sound or prop assets: these remain shared app content.

The art and the configured floor have different jobs. The visible floor can
include furniture behind its walkable boundary, but every point below the
boundary must be safe for a friend to stand. Check tall sprites and accessories,
not only the feet. A small window crops more of the room and the lake; review the
transformed water and standing position rather than assuming they remain visible.


Built-in outdoor places can define `lightAnchors` for festival strands. Each
`{from, to, y, sag}` uses normalized source-image coordinates; the renderer shares
the image crop and omits bulbs outside the viewport. Place anchors on visible
branches instead of reusing another scene's positions. Custom version 1 packages
do not expose this field and do not inherit built-in strands.
