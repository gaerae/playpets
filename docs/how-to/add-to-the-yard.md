# Add to the yard: kinds, drawings, effects and scenery

## Purpose
- Change or add what is in the yard without touching the code that runs it.
- Content and artwork files describe the yard. Most additions reuse the existing rendering rules:

| What | Where | Read by |
|---|---|---|
| The catalogue: fish, bugs, flowers, gifts, trees, keepsakes and the garden's stages | `src/content/catalog.json` | the page (`src/yard/catalog.js`) and the backend (`src-tauri/src/pets/content.rs`, built in) |
| The scenery's composition: curves, the lake, the field, the layers painted from back to front | `src/content/yard.json` | the page (`src/yard/layout.js`, `src/yard/backdrop.js`) |
| Seasonal events: when, what they add to the scenery and how they look | `src/content/events.json` | the page (`src/yard/events.js`, `src/yard/festival.js`) and the backend (its gifts' dates, `content.rs`) |
| Drawings: plant stages, flowers, gifts (and any fish or bug that has its own) | `src/art/<folder>/<id>.svg` | the page (`src/yard/art.js`), as symbols |
| Colours of the seasons, the light and the weather | `src/styles/scenery.css` | the stylesheet, the painter and every drawing |
| Names and lines | `src/core/strings/<language>.js` | the page |

- The code holds what things do:
  - the painters (`backdrop.js`, `trees.js`, `lake.js`)
  - the drawers for fish and bugs (`creatures.js`)
  - the effects (`effects.js` and their rules in `garden.css`)
  - the rules (when fish bite, when a gift comes)
- Changing one of those changes everything that uses it.
- A content addition within an existing schema usually reuses that code.
- New rendering or activity rules need their own implementation and tests.

## Prerequisites
- You finished [Set up a development environment and run the app](../getting-started.md).
- `pnpm test` passes.
- To see the result without the app, use the isolated browser fixtures in `scripts/visual-audit.mjs`.
- Native E2E and the normal screenshot script launch the real app.

## Steps

### Add a fish or a bug
1. Add an entry to `fish` or `bugs` in `src/content/catalog.json`. Copy a close one and change:

   | Field | For | Meaning |
   |---|---|---|
   | `id` | both | Lowercase and `_` |
   | `seasons`, `periods` | both | When it can bite or fly |
   | `weight` | both | How often, among those that can bite or fly then |
   | `size` | fish | [shortest, longest] in cm; the backend refuses a longer catch |
   | `rain` | fish | More likely in rain |
   | `kind` | bug | `butterfly`, `dragonfly`, `firefly`, `beetle` or `cricket` |
   | `look` | both | The colours the drawer paints it with; each drawer's fields are in `creatures.js` |

2. To draw it yourself instead, add `"art": "fish/<id>.svg"` and put the drawing there (see "Drawings" below).
3. Add its name to every string table: `catch.fish_<id>` or `catch.bug_<id>`.

- The new fish or bug then shows in the album and bites or flies in its seasons and hours.
- The backend counts it.

### Add a flower
1. Add an entry to `flowers` with an `id` and:

   | Field | Meaning |
   |---|---|
   | `season` | The season whose seeds grow into it |
   | `art` | `flowers/<id>.svg` |
   | `colors` | `petal`, `petal-hi`, `petal-lo`, `heart`. The drawing paints with `var(--petal)` and so on, so the same drawing can come in other colours |
   | `weight` (optional) | How often seeds of its season grow it, among that season's flowers; 1 if left out |
   | `stature` (optional) | How much taller than others it stands once grown |

2. Draw it in `src/art/flowers/<id>.svg`. The garden's stages before the bloom are shared (`src/art/plants/`).
3. Add `garden.kind_<id>` to every string table.

- Seeds planted in a season grow one of that season's flowers at random (`flowerFor` in `src/yard/growth.js`).
- `weight` makes a flower more likely.
- The backend accepts only flowers in the catalogue.

### Add a gift
1. Add an entry to the end of `gifts`. The first gifts arrive in list order, and a friend's memento is picked from the first 16 everyday gifts (`MEMENTO_KINDS` in `pets/garden.rs`), so a gift added in between would change mementos already given.

   | Field | Meaning |
   |---|---|
   | `art` | `decor/<id>.svg` |
   | `flat` | True if it lies on the ground under plants and friends, like the pond |
   | `stand` | `"on"` if friends stand on it, like the bench. Without it, friends stand beside it |
   | `effects` | See below |
   | `size` | `[width, height]` in catalogue units, in the drawing's shape. Usually its SVG view box; furniture may need a different footprint. The desktop draws the gift at this size too (`gift_size` in `pets/content.rs`) |
   | `event` | An event's id. The gift comes only during that event. Several gifts of one event come in catalogue order, one each time a gift is due |
   | `shown` | `"december"`: shows in the yard and on the desktop from December 1 to January 7, and is hidden with its state kept the rest of the year. It goes back into the gift box when put away. The windows are `SHOWN` in `src/yard/decor-shown.js` |
   | `seasons` | Shows only while the yard shows one of these seasons; never in a place without seasons (`seasonalEffects: false`, the studio). The season the yard shows is `yardSeason` in `src/yard/decor-shown.js` |
   | `built` | `true`: never brought by a friend; it comes from building it (the snowman) |
   | `ball` | The drawing a built kind is rolled from |
   | `stack` | `[base ball width ÷ box width, base ball bottom ÷ box height]` |
   | `dress` | `[{id, art, at: [x, y, w]}]`, in drawing order; `at` is the centre and width as fractions of the box, and the backend reads only the ids |
   | `hooks` | Where ornaments hang on this drawing, as fractions of its box; only `xmas_tree` has them, and `ORNAMENT_HOOKS` in `garden.rs` is their count |
   | `night` | The gift's Christmas night look; only `xmas_tree` has one. Read by `src/yard/christmas-night.js` (see below); its `hooks` name the same places on the grand tree |

   - At most four kinds use `shown` or `seasons`.
   - A `built` kind is never set out from the album nor sent to the desktop, and putting it away removes it.
   - What can hang and where: flowers, trees, gifts and keepsakes found in the album. The rule is `hang_ornament` in `garden.rs` and `src/yard/ornaments.js`.

   `night` holds:

   | Key | Meaning |
   |---|---|
   | `art` | The grand drawing, standing on the same foot point as the gift's own |
   | `star`, `bulbs` | Fractions of that drawing's box: where the star swells, and where single bulbs glint |
   | `sleigh` | A drawing shown as a mirrored silhouette over the moon |
   | `guests` | Gift kinds that must also be out; they look up in this order |

   - It plays during the winter lights, in a winter yard, at evening or night, while it snows.
   - It plays once per night per webview; a night runs until 05:00.
   - Hidden kinds still count toward `DECOR_MAX`.

2. Draw it in `src/art/decor/<id>.svg`.
   - Preserve the drawing's aspect ratio.
   - Furniture and friends share the same yard zoom, independent of display density. Do not multiply layout sizes by `devicePixelRatio`.
3. Add `decor.kind_<id>` (its name) and `decor.visit_<id>` (a list of things friends say when they visit it) to every string table.

### Drawings
Collection art:
- Current collection art uses generated transparent atlases and SVG crop wrappers.
- `src/art/collection.json` records each specimen's atlas, reviewed crop and display size.
- `scripts/pack-collection.mjs` reproduces each wrapper.
- Keep the PNG atlas in `assets/art/` with its prompts and provenance, then run `pnpm run assets:webp`; the wrapper's `<image>` names the `.webp` copy in `src/art/` ([shipped WebP](../../assets/README.md)).
- Measure each crop rather than assuming equally spaced generated cells.
- Review the whole body, the alpha, the isolation from neighbouring cells and the real album and yard size.
- See `assets/art/COLLECTION.md` and the related specimen and atlas tests.
- The original vector and procedural drawings stay as fallback and reference material.

Vector drawings:
- One SVG per file, with a `viewBox` from `0 0`.
  - The view box is the drawing's size in the yard.
  - A plant's 40 × 60 units stand 50 × 75 pixels in a full-size yard.
  - A gift's unit is 1.05 pixels.
  - Its foot is at the bottom centre.
- Paint with the yard's colours (`style="fill:var(--leaf)"`) so the season, the light and the weather tint the drawing. The names drawings use now:
  - `--leaf`, `--leaf-hi`, `--leaf-lo`, `--pine`, `--pine-lo`, `--trunk`, `--blade`, `--rock`, `--rock-hi`, `--soil`, `--soil-hi`, `--stem`, `--wood`, `--wood-hi`, `--wood-lo`, `--iron`, `--sky-a`
  - `--sky-m`: a water surface mirroring the sky
  - `--lamp`: warm from evening on
  - `--bird`: 1 by day, 0 at night and in rain or snow; use it as an opacity
  - a flower's `--petal`, `--petal-hi`, `--petal-lo`, `--heart`
- A fixed colour (`fill:#c45c4a`) stays the same in every light.
- The shipped drawings now wrap painted atlases (an `<image>` of a WebP cell) and use none of these names.
- The names are still how a vector drawing takes on the yard's light.
- Move a drawing the content no longer names to `assets/sources/`, out of `src/art/`, which ships inside the app.
- Nothing in a drawing runs. Scripts and `on…` attributes are stripped when it loads, and a test refuses them.

### Give a gift an effect
Name it in the gift's `effects`. The existing effects:

| Effect | What it does |
|---|---|
| `glow` | Lit from evening on: a warm pool of light around it, and it is not dimmed at night |
| `chime` | Rings when a friend visits it (the `chime` sound in `soundmix.js`) |

To make a new effect:
1. Add an entry to `EFFECTS` in `src/yard/effects.js`, shaped `{ name: { layer, visited } }`.
   - `layer`: markup drawn with the gift.
   - `visited`: what happens when a friend visits it.
   - Both are optional; leave both out if the effect is only a rule.
2. Put its rules under "Effects" in `src/styles/garden.css`, selecting `.decor[data-effects~="<name>"]`.

- Every gift that names the effect gets it.

### Change the scenery
- The normal backdrop comes from `src/content/worlds.json` and accepted raster environments.
- For geometry, lighting and capabilities, follow [Add a place](add-a-world.md).
- `src/content/yard.json` describes the procedural fallback for loading and errors, and the shared composition:

| Key | What it describes |
|---|---|
| `curves` | The hills, as cubic curves in fractions of the yard (x across, y down): a start point, then two control points and an end point for each piece |
| `field`, `fieldTop` | The curve where the field friends stand on starts, and the height of its top (a fraction of the yard's height) |
| `lake` | Where the lake starts and ends across (`from`, `to`), its far shore's height at the middle (`top`) and the curve that hides its near half (`under`) |
| `layers` | What is painted, from back to front. Each names its painter (`paint`) and that painter's settings |

- `lake`: the far shore is half an oval whose ends sink behind the `under` curve, so the water shows between the two points where they cross.
- The painter and fishing share this shape (`layout.js` `lakeShape`).
- `layers`:
  - `seed` makes a layer come out the same each time. Change it to get another arrangement of the same parts.
  - `when` paints it only in a weather, a season or a time of day (`"snow"`, `"winter"`, `"night"`, or `"bloomy"` for when flowers are out).
- The painters and what each takes are in `src/yard/backdrop.js` (`PAINTERS`).
- Things that stand on the field (`standing` layer, `things`) are `tree`, `maple`, `bush`, `rock` and `cedar` (`THINGS`).
- Colours in a layer are the palette's names (`"back-hi"`), or `{ "mix": [a, b, amount] }`, `{ "shade": [a, amount] }`, `{ "light": [a, amount] }`.
- To paint something new, add a painter to `PAINTERS` (or a thing to `THINGS`) and use it from `yard.json`.

### Add a seasonal event
1. Add an entry to `src/content/events.json` with `id`, `from` and `to`, and what it brings.
   - `from`, `to`: month-day (`"04-01"`), as seen north of the equator.
   - South of the equator, the event comes six months later unless `"fixed": true` (as for the winter lights and the new year).
   - `fixed` also means the event's gift is asked for whatever season the yard shows, in every place.
   - An event's gifts are the catalogue kinds with its `event`, in catalogue order. Add them to `catalog.json` with `"event": "<id>"`; they are not everyday gifts.

   | Field | What it brings |
   |---|---|
   | `boost` | More small life while it is on: `petals`, `butterflies`, `fireflies` (each a multiplier) |
   | `looks` | Names of looks; each is a class on the yard (`look-<name>`) whose rules go in `src/styles/scenery.css`. The harvest moon's `fullmoon` makes the moon big and golden on the nights around the event's first real full moon, when `sky.js` also sets `moon-full` |
   | `art` | A drawing for its card, if it has no gift (the new year's sunrise) |

2. A fish or a bug that comes only then: add it to the catalogue with `"event": "<id>"`.
3. Something painted only then: give a layer in `yard.json` `"when": "<id>"` (the winter lights' `fairyLights`).
4. Add `event.<id>.name`, `event.<id>.about` (the card's words) and `event.<id>.lines` (what friends say) to every string table.

- While the event is on, the scene label shows it.
- The first time each year, a card says it has begun.
- Friends talk about it.

### Add an animal's footprints
1. Add an entry to `tracks` in `src/content/catalog.json`, copying a close one:

   | Field | Meaning |
   |---|---|
   | `id` | Lowercase and `_` |
   | `print` | `prints/<id>.svg`, the mark laid in the snow and shown in the album |
   | `tail` | `tracks/tail_<id>.svg`, the tail that peeks out at the bush |
   | `bird` | `true` for a bird: it flutters off instead of whisking away |
   | `gait.group` | `true` for a bounder whose prints fall in one line; `false` for a walker whose prints alternate sides |
   | `gait.step` | Distance between prints, before the yard's zoom |
   | `gait.side` | How far a walker's prints sit off the line; ignored when `group` is `true` |
   | `gait.size` | Size of one print |
   | `finds` | Keepsake ids the animal likes to leave in the dig |

2. Put the drawings in `src/art/prints/` and `src/art/tracks/`. `trailArt` lists the shared `bush`, `twigs` and `puff` drawings.
3. Add the animal's name to every string table.

- A print is a 24-unit vector mark with `fill="currentColor"`, so the snow shade colours it.
- A tail is a rear-only crop, so the animal is never whole.
- `finds` weigh `TRAIL_LEAN` (`pets/content.rs`) times more in a trail dig than in an ordinary one.
- The album's Footprints book lists every track.
- `tests/print-art.test.mjs` and the content tests check the references.

### Change the colours of a season or a time of day
- Change the custom properties in `src/styles/scenery.css`, per season, time of day and weather.
- The painter and every drawing read them.

## Verification
```bash
pnpm test
pnpm run lint
pnpm run test:e2e
```

- `tests/content.test.mjs` says what is missing: a name or a line in a language, a drawing file, an effect, a painter, a curve, a colour, an event's words or gift, or a look's rules.
- `tests/events.test.mjs` checks when each event is on, north and south of the equator.
  - Its days are in `tests/fixtures/event-dates.json`.
  - The backend's `content.rs` test reads the same file, so the page and the backend agree on an event's dates.
  - When you add an event or change its dates, add cases there for the days around its first and last day, north and south.
- `tests/lake.test.mjs` checks that, when the composition's lake changes (`lake` or the curve it names in `under`), the water still shows between the far shore and the hill in front at several yard sizes.
- The backend's `content::tests` checks the catalogue it built in.
- To see an event outside its dates, set the date in the screenshot harness or the e2e run.
- In the app, the system clock decides.
- Look at it: build and run the app as in [getting started](../getting-started.md), then set the time of day and weather from the scene label to see the new thing in each light.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| A new gift never comes | Both the yard and the gift box hold 12 (`DECOR_MAX` and `BOX_MAX` in `pets/garden.rs`), no one did anything with a friend today, or not every earlier gift has come yet | Put some away and play with a friend; gifts come in the catalogue's order, every other day ([gifts from friends](../design/2026-10-29-gifts-from-friends.md)) |
| A new fish is refused (`error.bad_request`) | The backend was built before the catalogue changed | Build the app again: the backend builds the catalogue in |
| A drawing does not show | The path in `art` does not match the file, or the file has no `viewBox` | `tests/content.test.mjs` names the file |
| A drawing is black or a single colour | It paints with a colour name the yard does not set | Use the names listed under "Drawings" |

## Related
- Design: [A yard that grows with you](../design/2026-10-09-a-yard-that-grows.md), [A painted yard](../design/2026-10-09-a-painted-yard.md), [Yard content as data](../design/2026-10-10-yard-content-as-data.md)
- [Add a language](add-a-language.md), for the string tables

## Keep discovery information accurate

Shared pools:
- The website's discovery guide reads the app's catalogue and locale strings.
- `eligibleKinds`, `fishWeight`, `relativeChances` and `bugChances` in `src/yard/catalog.js` define the shared pools.
- `bugChances(season, period, weather, event, kinds)` takes a catalogue from the guide.
- At runtime it defaults to the loaded app catalogue.

Bug odds:
- Percentages describe one spawned individual.
- In daylight, the families mix as butterflies 55%, dragonflies 25%, beetles 10% and crickets 10%.
- The mix renormalizes when a family is unavailable.
- Species weights then apply within each family.
- Do not normalize both families to 100% independently.
- Clear autumn evenings and nights have only crickets: a couple at a time, from the bugs of kind `cricket` whose `periods` include that hour.
- Rain, snow and unavailable seasons return an empty bug pool.
- Each family holds a fixed share, so a family with many species in one season dilutes each of them; keep at most about two ordinary beetles or crickets in a season, or an ordinary one falls under 5% (`tests/collection-goal.test.mjs`).
- A fish's or a bug's explicit `rarity: "rare"` gives it the album's rare badge.
- Anything with an `event` (fish, bug or gift) is rare in the album, and its hint gives the event's dates.
- Over a year, a rare fish has to bite less often than every ordinary one (`tests/collection-goal.test.mjs`); a fish that comes in few seasons or hours needs a higher weight.

Fish odds:
- Percentages are species odds for a fish that has landed, separate from the chance of landing one.
- Clicking water starts manual fishing.
- Play's Fish action uses a 75% automatic landing chance.
- An idle friend at bond level 3 may start fishing on its own every 12–25 minutes, while the visible yard has no competing activity.
- Species odds do not promise a waiting time.

Guide labels:

| Label | Chance |
|---|---|
| “often” | At least 20% |
| “sometimes” | 5% to below 20% |
| “rarely” | Below 5% |

- Probability labels in the guide describe only the selected context.
- Selecting an event assumes it is active and shows the species odds during it, not the chance that the festival happens.
- Event dates and hemisphere rules are in `events.json`.
- Event gifts stay tied to the calendar.
- Gifts follow a deterministic sequence, not a loot probability.
- The cap of 12 placed decorations pauses deliveries.
- Removing a decoration keeps its album entry, so all 29 gifts can be collected over time.

Reachability:
- Keep every album entry reachable across valid contexts.
- `tests/discovery-guide.test.mjs` enumerates fish and bug pools across seasons, times and events.
- It also checks that flower, tree and keepsake chances are positive, and that each event gift maps to its calendar dates.
- When you add an appearance rule, update the shared helper and tests before the guide.
- Do not retune gameplay so that every collection can be finished in one sitting.

## Planted trees and discoveries

Trees:
- Trees in `catalog.json` have an ID, three `stages` (seedling, young, mature), an optional `seasonArt` map for mature art, and a `footprint` root ellipse in authored pixels.
- New species need a `tree.<id>` string in every language.
- Drawings use a bottom-centre anchor and share the yard zoom.
- A tree's field coordinate stays fixed through growth and season changes.
- `planted-trees.js` owns these saved trees.
- `trees.js` is still the procedural scenery painter.

Keepsakes:
- Keepsakes use the `treasures` list, an art path and `rarity` (`common` or `uncommon`), plus `treasure.<id>` in every language.
- Each tier uses the item weights within that tier.
- Tier odds and timing limits are in `pets/discovery.rs`, and the backend exposes them.
- The page fallback and the website guide share `core/limits.js`.
- Its test compares those values with Rust.

Affinity:
- Trees and keepsakes may include `affinity: { seasons: ["spring"], weather: ["rain"], places: ["woodland"] }`.
- Each matching axis doubles the base weight within its own reward category.
- Items that do not match stay available.
- Built-in place preferences use `woodland`, `courtyard` or `lakeside`.
- Imported outdoor scenes keep neutral place weights and still use season and weather preferences.
- Write readable habitat clues in the existing four-language strings instead of repeating prose for each species.
- The page and site share `src/yard/discovery-rewards.js`.
- The backend allows one uncommon reward per rolling 24 hours, across all friends and places, based on saved dig history.
- During that window, the 3% uncommon share becomes common keepsakes.
- See the [environmental discovery contract](../design/2026-10-19-environmental-discovery.md).

Places and ground:
- A tree belongs to its `world` ID.
- Existing flowers and decorations stay shared across places.
- The ground profile is a local geometry snapshot of the current floor, the projected water and the placed roots and props. It is not inferred from the image.
- The optional `capabilities.soil` of an imported background controls digging and tree planting, independently of sky transparency.
- The creator skill and the import validator keep it.

Ground bugs:
- Beetles crawl and crickets hop near the floor.
- Keep their specimen heads pointing up in the atlas so heading rotation stays correct.
- They share the clear-daytime appearance rules but stay on the ground.
- Crickets also come out on clear autumn evenings and nights.
- `kind` sets how a bug moves, not its family name: a mantis crawls as a `beetle`.
- The native album shows ground habitat clues.
- `ambient-art.js` loads each referenced bug atlas once and invalidates its canvas when decoding finishes.
- Exact probabilities stay internal.
- The album and the guide that players see show conditions, a rough frequency and waiting status.
