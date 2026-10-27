# Add to the yard: kinds, drawings, effects and scenery

## Purpose
- Change or add what is in the yard without touching the code that runs it.
- Content and artwork files describe the yard; most additions reuse the existing rendering rules:

| What | Where | Read by |
|---|---|---|
| The catalogue: fish, bugs, flowers, gifts, trees, keepsakes and the garden's stages | `src/content/catalog.json` | the page (`src/yard/catalog.js`) and the backend (`src-tauri/src/pets/content.rs`, built in) |
| The scenery's composition: curves, the lake, the field, the layers painted from back to front | `src/content/yard.json` | the page (`src/yard/layout.js`, `src/yard/backdrop.js`) |
| Seasonal events: when, their gift, what they add to the scenery and how they look | `src/content/events.json` | the page (`src/yard/events.js`, `src/yard/festival.js`) and the backend (its gift's dates, `content.rs`) |
| Drawings: plant stages, flowers, gifts (and any fish or bug that has its own) | `src/art/<folder>/<id>.svg` | the page (`src/yard/art.js`), as symbols |
| Colours of the seasons, the light and the weather | `src/styles/scenery.css` | the stylesheet, the painter and every drawing |
| Names and lines | `src/core/strings/<language>.js` | the page |

- The code holds what things do:
  - the painters (`backdrop.js`, `trees.js`, `lake.js`);
  - the drawers for fish and bugs (`creatures.js`);
  - the effects (`effects.js` and their rules in `garden.css`);
  - the rules (when fish bite, when a gift comes).
- A change to one of those changes every thing that uses it.
- A content addition within an existing schema usually reuses that code; new rendering or activity rules need their own implementation and tests.

## Prerequisites
- [Set up a development environment and run the app](../getting-started.md) is done; `npm test` passes.
- To see the result without the app: the isolated browser fixtures in `scripts/visual-audit.mjs`. Native E2E and the normal screenshot script launch the real app.

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

- It is then in the album, bites or flies when its seasons and hours say, and the backend counts it.

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

- Seeds planted in a season grow one of that season's flowers at random (`flowerFor` in `src/yard/growth.js`); `weight` makes one more likely.
- The backend accepts only flowers in the catalogue.

### Add a gift
1. Add an entry to `gifts`. The order is the order the first gifts come in.

   | Field | Meaning |
   |---|---|
   | `art` | `decor/<id>.svg` |
   | `flat` | True if it lies on the ground under plants and friends, like the pond |
   | `stand` | `"on"` if friends stand on it, like the bench; left out, they stand beside it |
   | `effects` | See below |
   | `size` (optional) | `[width, height]` in catalogue units, when furniture needs a different footprint from its SVG view box |

2. Draw it in `src/art/decor/<id>.svg`.
   - Preserve the drawing's aspect ratio.
   - Furniture and friends share the same yard zoom, independent of display density. Do not multiply layout sizes by `devicePixelRatio`.
3. Add `decor.kind_<id>` (its name) and `decor.visit_<id>` (a list of things friends say when they visit it) to every string table.

### Drawings
Collection art:
- Current collection art uses generated transparent atlases and SVG crop wrappers.
- `src/art/collection.json` records each specimen's atlas, reviewed crop and display
  size; `scripts/pack-collection.mjs` reproduces its wrapper.
- Preserve the accepted PNG source and record prompts and provenance alongside it.
- Measure each crop rather than assuming equally spaced generated cells.
- Review the complete body, alpha, neighboring-cell isolation and the real
  album/yard size.
- See `src/art/COLLECTION.md` and the related specimen and atlas tests.
- Original vector and procedural drawings remain fallback/reference material.

Vector drawings:
- One SVG per file, with a `viewBox` from `0 0`.
  - The view box is its size in the yard: a plant's 40 × 60 units stand 50 × 75 pixels in a full-size yard; a gift's units are 1.05 pixels.
  - Its foot is at the bottom centre.
- Paint with the yard's colours, `style="fill:var(--leaf)"`, so the season, the light and the weather colour it. What drawings use now:
  - `--leaf`, `--leaf-hi`, `--leaf-lo`, `--pine`, `--pine-lo`, `--trunk`, `--blade`, `--rock`, `--rock-hi`, `--soil`, `--soil-hi`, `--stem`, `--wood`, `--wood-hi`, `--wood-lo`, `--iron`, `--sky-a`;
  - `--sky-m`: a water surface mirroring the sky;
  - `--lamp`: warm from evening on;
  - `--bird`: 1 by day, 0 at night and in rain or snow; use it as an opacity;
  - a flower's `--petal`, `--petal-hi`, `--petal-lo`, `--heart`.
- A fixed colour (`fill:#c45c4a`) stays the same in every light.
- The shipped drawings now wrap painted atlases (an `<image>` of a PNG cell) and use none of these names; the names remain how a vector drawing takes the yard's light.
- A drawing the content no longer names moves to `assets/sources/`, out of `src/art/`, which ships inside the app.
- Nothing in a drawing runs: scripts and `on…` attributes are taken out when it loads, and a test refuses them.

### Give a gift an effect
Name it in the gift's `effects`. The effects there are:

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

- Every gift that names it follows.

### Change the scenery
- The normal backdrop comes from `src/content/worlds.json` and accepted raster environments. Follow [Add a place](add-a-world.md) for geometry, lighting and capabilities.
- `src/content/yard.json` describes the procedural loading/error fallback and shared composition:

| Key | What it describes |
|---|---|
| `curves` | The hills, as cubic curves in fractions of the yard (x across, y down): a start point, then two control points and an end point for each piece |
| `field`, `fieldTop` | The curve the field friends stand on starts at, and where its top is (a fraction of the height) |
| `lake` | Where the lake starts and ends across (`from`, `to`), its far shore's height at the middle (`top`) and the curve that hides its near half (`under`) |
| `layers` | What is painted, from back to front. Each names its painter (`paint`) and that painter's settings |

- `lake`: the far shore is half an oval whose ends sink behind the `under` curve, so the water shows between where the two cross. The painter and fishing share this shape (`layout.js` `lakeShape`).
- `layers`:
  - `seed` makes a layer come out the same each time; change it to get another arrangement of the same parts.
  - `when` paints it only in a weather, a season or a time of day (`"snow"`, `"winter"`, `"night"`, or `"bloomy"` for when flowers are out).
- The painters and what each takes are in `src/yard/backdrop.js` (`PAINTERS`).
- Things that stand on the field (`standing` layer, `things`) are `tree`, `maple`, `bush`, `rock` and `cedar` (`THINGS`).
- Colours in a layer are the palette's names (`"back-hi"`), or `{ "mix": [a, b, amount] }`, `{ "shade": [a, amount] }`, `{ "light": [a, amount] }`.
- To paint something new, add a painter to `PAINTERS` (or a thing to `THINGS`) and use it from `yard.json`.

### Add a seasonal event
1. Add an entry to `src/content/events.json` with `id`, `from` and `to`, and what it brings.
   - `from`, `to`: month-day (`"04-01"`), as north of the equator. South of it the event comes six months later unless `"fixed": true` (as for the new year).

   | Field | What it brings |
   |---|---|
   | `gift` | The id of a gift that comes only then. Add that gift to `catalog.json` with `"event": "<id>"`. It comes the first time a gift is due during the event, and is not one of the everyday gifts |
   | `boost` | More small life while it is on: `petals`, `butterflies`, `fireflies` (how many times as many) |
   | `looks` | Names of looks; each is a class on the yard (`look-<name>`) whose rules go in `src/styles/scenery.css`. The harvest moon's `fullmoon` makes the moon big and golden on the nights around the event's first real full moon, when `sky.js` also sets `moon-full` |
   | `art` | A drawing for its card, if it has no gift (the new year's sunrise) |

2. A fish or a bug that comes only then: add it to the catalogue with `"event": "<id>"`.
3. Something painted only then: give a layer in `yard.json` `"when": "<id>"` (the winter lights' `fairyLights`).
4. Add `event.<id>.name`, `event.<id>.about` (the card's words) and `event.<id>.lines` (what friends say) to every string table.

- While it is on, the scene label shows the event. A card says it has begun the first time each year, and friends talk about it.

### Change the colours of a season or a time of day
- Change the custom properties in `src/styles/scenery.css`, per season, time of day and weather.
- The painter and every drawing read them.

## Verification
```bash
npm test
npm run lint
npm run test:e2e
```

- `tests/content.test.mjs` says what is missing: a name or a line in a language, a drawing file, an effect, a painter, a curve, a colour, an event's words or gift, or a look's rules.
- `tests/events.test.mjs` checks when each event is on, north and south of the equator.
  - Its days are in `tests/fixtures/event-dates.json`, which the backend's `content.rs` test reads too, so the page and the backend agree on an event's dates.
  - When you add an event or change its dates, add cases there for the days around its first and last day, north and south.
- `tests/lake.test.mjs`: when the composition's lake changes (`lake` or the curve it names in `under`), the water still shows between the far shore and the hill in front at several yard sizes.
- The backend's `content::tests` checks the catalogue it built in.
- To see an event outside its dates, the screenshot harness and the e2e run can set the date; in the app, the system clock decides.
- Look at it: build and run the app as in [getting started](../getting-started.md), then set the time of day and weather from the scene label to see the new thing in each light.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| A new gift never comes | The yard holds 12 decorations (`DECOR_MAX` in `pets/garden.rs`, `decor` in `src/core/limits.js`), or every earlier gift has not come yet | Put some away; gifts come in the catalogue's order, once a day |
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
- `bugChances(season, period, weather, event, kinds)` accepts a supplied catalogue for the guide and defaults to the loaded app catalogue at runtime.

Bug odds:
- Percentages describe one spawned individual.
- Daylight mixes butterflies at 55%, dragonflies at 25%, beetles at 10% and crickets at 10%, renormalizing when a family is unavailable, then applies species weights within each family.
- Do not normalize both families to 100% independently.
- Rain, snow and unavailable seasons return an empty bug pool.
- Explicit bug `rarity` metadata controls rare badges.

Fish odds:
- Percentages describe species conditional on a landed fish, separately from landing success.
- Clicking water starts manual fishing; Play's Fish action uses a 75% automatic landing chance.
- An idle friend at bond level 3 may start independently every 12–25 minutes while the visible yard is free of competing activities.
- Species odds do not promise a waiting time.

Guide labels:

| Label | Chance |
|---|---|
| “often” | At least 20% |
| “sometimes” | 5% to below 20% |
| “rarely” | Below 5% |

- Probability labels in the guide describe only the selected context.
- Event selection assumes an active event and shows conditional species odds, not the chance of a festival occurring.
- Event dates and hemisphere rules are in `events.json`; event gifts remain calendar-bound.
- Gifts follow a deterministic sequence, not a loot probability.
- The 12-decoration placement cap pauses deliveries. Removing a decoration retains its album entry and allows all 20 gifts to be collected over time.

Reachability:
- Keep every album entry reachable across valid contexts.
- `tests/discovery-guide.test.mjs` enumerates fish and bug pools across seasons, times and events, checks positive flower/tree/keepsake chances, and verifies each event gift's calendar mapping.
- When adding an appearance rule, update the shared helper and tests before the guide.
- Do not retune gameplay merely to finish every collection in one sitting.

## Planted trees and discoveries

Trees:
- Trees in `catalog.json` have an ID, three `stages` (seedling, young, mature), an optional `seasonArt` map for mature art, and a `footprint` root ellipse in authored pixels.
- New species need a `tree.<id>` string in every language.
- Drawings use a bottom-centre anchor and share yard zoom; the field coordinate stays fixed through growth and season changes.
- `planted-trees.js` owns these saved trees; `trees.js` remains the procedural scenery painter.

Keepsakes:
- Keepsakes use the `treasures` list, an art path and `rarity` (`common` or `uncommon`), plus `treasure.<id>` in every language.
- Each tier uses the item weights within that tier. Tier odds and timing limits are in `pets/discovery.rs` and exposed by the backend.
- The page fallback and website guide share `core/limits.js`; its test compares them with Rust.

Affinity:
- Trees and keepsakes may include `affinity: { seasons: ["spring"], weather: ["rain"], places: ["woodland"] }`.
- Each matching axis doubles the base weight within its own reward category; unmatched items remain available.
- Built-in place preferences use `woodland`, `courtyard` or `lakeside`.
- Imported outdoor scenes keep neutral place weights and still use season and weather preferences.
- Add readable habitat clues through the existing four-language strings rather than duplicating species-specific prose.
- The page and site share `src/yard/discovery-rewards.js`.
- The backend keeps one uncommon reward per rolling 24 hours across all friends and places, using saved dig history. During that interval its 3% becomes common keepsakes.
- See the [environmental discovery contract](../design/2026-10-19-environmental-discovery.md).

Places and ground:
- A tree belongs to its `world` ID; existing flowers and decorations remain shared.
- The ground profile is a local geometry snapshot of the current floor, projected water and placed roots/props, not image inference.
- Optional imported-background `capabilities.soil` controls digging and tree planting independently of sky transparency. The creator skill and import validator preserve it.

Ground bugs:
- Beetles crawl and crickets hop near the floor. Keep their specimen heads pointing
  up in the atlas so heading rotation remains correct.
- They share clear daytime appearance rules without becoming airborne.
- The native album shows ground habitat clues.
- `ambient-art.js` loads each referenced bug atlas once and invalidates its canvas
  when decoding finishes.
- Exact probabilities stay internal. The player-facing album and guide show
  conditions, qualitative frequency and waiting status.
