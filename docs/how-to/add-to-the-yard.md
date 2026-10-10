# Add to the yard: kinds, drawings, effects and scenery

## Purpose
Change or add what is in the yard without touching the code that runs it. The yard is made of three kinds of files, and each change below touches only those:

| What | Where | Read by |
|---|---|---|
| The catalogue: fish, bugs, flowers, gifts, the garden's stages | `src/content/catalog.json` | the page (`src/yard/catalog.js`) and the backend (`src-tauri/src/pets/content.rs`, built in) |
| The scenery's composition: curves, the lake, the field, the layers painted from back to front | `src/content/yard.json` | the page (`src/yard/layout.js`, `src/yard/backdrop.js`) |
| Seasonal events: when, their gift, what they add to the scenery and how they look | `src/content/events.json` | the page (`src/yard/events.js`, `src/yard/festival.js`) and the backend (its gift's dates, `content.rs`) |
| Drawings: plant stages, flowers, gifts (and any fish or bug that has its own) | `src/art/<folder>/<id>.svg` | the page (`src/yard/art.js`), as symbols |
| Colours of the seasons, the light and the weather | `src/styles/scenery.css` | the stylesheet, the painter and every drawing |
| Names and lines | `src/core/strings/<language>.js` | the page |

The code holds what things do: the painters (`backdrop.js`, `trees.js`, `lake.js`), the drawers for fish and bugs (`creatures.js`), the effects (`effects.js` and their rules in `garden.css`), and the rules (when fish bite, when a gift comes). A change to one of those changes every thing that uses it; a change to a content file never needs a code change.

## Prerequisites
- You finished [Set up a development environment and run the app](../getting-started.md), and `npm test` passes.
- To see the result without the app, the page also runs in a browser served from `src/` (the e2e and screenshot scripts do this).

## Steps

### Add a fish or a bug
1. Add an entry to `fish` or `bugs` in `src/content/catalog.json`. Copy one that is close and change it: `id` (lowercase and `_`), `seasons`, `periods`, `weight` (how often, among those that can bite or fly then), for a fish `size` ([shortest, longest] in cm; the backend refuses a longer catch) and `rain` (more likely in rain), for a bug `kind` (`butterfly`, `dragonfly` or `firefly`), and `look` (the colours the drawer paints it with; the fields each drawer reads are in `creatures.js`).
2. To draw it yourself instead, add `"art": "fish/<id>.svg"` and put the drawing there (see "Drawings" below).
3. Add its name to every string table: `catch.fish_<id>` or `catch.bug_<id>`.

It is in the album, it bites or flies when its seasons and hours say, and the backend counts it.

### Add a flower
1. Add an entry to `flowers`: `id`, the `season` whose seeds grow into it, `art` (`flowers/<id>.svg`), `colors` (`petal`, `petal-hi`, `petal-lo`, `heart`: the drawing paints with `var(--petal)` and so on, so the same drawing can come in other colours), and optionally `weight` (how often seeds of its season grow it, among that season's flowers) and `stature` (how much taller than others it stands once grown).
2. Draw it in `src/art/flowers/<id>.svg`. The garden's stages before the bloom are shared (`src/art/plants/`).
3. Add `garden.kind_<id>` to every string table.

Seeds planted in a season grow one of that season's flowers, picked at random (`flowerFor` in `src/yard/growth.js`; an optional `weight` makes one more likely, 1 if left out). The backend accepts only flowers that are in the catalogue.

### Add a gift
1. Add an entry to `gifts`. The order is the order the first gifts come in. Fields: `art` (`decor/<id>.svg`), `flat` (true if it lies on the ground under plants and friends, like the pond), `stand` (`"on"` if friends stand on it, like the bench; left out, they stand beside it) and `effects` (see below).
2. Draw it in `src/art/decor/<id>.svg`.
3. Add `decor.kind_<id>` (its name) and `decor.visit_<id>` (a list of things friends say when they visit it) to every string table.

### Drawings
- One SVG per file, with a `viewBox` from `0 0`. The view box is its size in the yard (a plant's 40 × 60 units stand 50 × 75 pixels in a full-size yard; a gift's units are 1.05 pixels), and its foot is at the bottom centre.
- Paint with the yard's colours, `style="fill:var(--leaf)"`, so the season, the light and the weather colour it. What drawings use now: `--leaf`, `--leaf-hi`, `--leaf-lo`, `--pine`, `--pine-lo`, `--trunk`, `--blade`, `--rock`, `--rock-hi`, `--soil`, `--soil-hi`, `--stem`, `--shadow` (the contact shadow), `--wood`, `--wood-hi`, `--wood-lo`, `--iron`, `--sky-a`, `--sky-m` (a water surface mirroring the sky), `--lamp` (warm from evening on), `--bird` (1 by day, 0 at night and in rain or snow; use it as an opacity), and a flower's `--petal`, `--petal-hi`, `--petal-lo`, `--heart`. A fixed colour (`fill:#c45c4a`) stays the same in every light.
- Nothing in a drawing runs: scripts and `on…` attributes are taken out when it loads, and a test refuses them.

### Give a gift an effect
Name it in the gift's `effects`. The effects there are:

| Effect | What it does |
|---|---|
| `glow` | Lit from evening on: a warm pool of light around it, and it is not dimmed at night |
| `chime` | Rings when a friend visits it (the `chime` sound in `soundmix.js`) |

To make a new effect, add an entry to `EFFECTS` in `src/yard/effects.js`, shaped `{ name: { layer, visited } }`: `layer` is markup drawn with the gift, and `visited` is what happens when a friend visits it (both are optional; leave both out if the effect is only a rule). Put its rules under "Effects" in `src/styles/garden.css`, selecting `.decor[data-effects~="<name>"]`. Every gift that names it follows.

### Change the scenery
`src/content/yard.json`:
- `curves`: the hills, as cubic curves in fractions of the yard (x across, y down): a start point, then two control points and an end point for each piece.
- `field` and `fieldTop`: the curve the field friends stand on starts at, and where its top is (a fraction of the height).
- `lake`: where the lake starts and ends across (`from`, `to`), its far shore's height at the middle (`top`) and the curve that hides its near half (`under`). The far shore is half an oval whose ends sink behind that curve, so the water shows between where the two cross; the painter and fishing share this shape (`layout.js` `lakeShape`).
- `layers`: what is painted, from back to front. Each names its painter (`paint`) and that painter's settings; `seed` makes it come out the same each time (change it to get another arrangement of the same parts), and `when` paints it only in a weather, a season or a time of day (`"snow"`, `"winter"`, `"night"`, or `"bloomy"` for when flowers are out).

The painters and what each takes are in `src/yard/backdrop.js` (`PAINTERS`); things that stand on the field (`standing` layer, `things`) are `tree`, `maple`, `bush`, `rock` and `cedar` (`THINGS`). Colours in a layer are the palette's names (`"back-hi"`), or `{ "mix": [a, b, amount] }`, `{ "shade": [a, amount] }`, `{ "light": [a, amount] }`.

To paint something new, add a painter to `PAINTERS` (or a thing to `THINGS`) and use it from `yard.json`.

### Add a seasonal event
1. Add an entry to `src/content/events.json`: `id`, `from` and `to` (month-day, `"04-01"`, as north of the equator; south of it the event comes six months later unless `"fixed": true`, as for the new year), and what it brings:
   - `gift`: the id of a gift that comes only then. Add that gift to `catalog.json` with `"event": "<id>"`; it comes the first time a gift is due during the event, and is not one of the everyday gifts.
   - `boost`: more small life while it is on: `petals`, `butterflies`, `fireflies` (how many times as many).
   - `looks`: names of looks; each is a class on the yard (`look-<name>`) whose rules go in `src/styles/scenery.css` (the harvest moon's `fullmoon` makes the moon big and full).
   - `art`: a drawing for its card, if it has no gift (the new year's sunrise).
2. A fish or a bug that comes only then: add it to the catalogue with `"event": "<id>"`.
3. Something painted only then: give a layer in `yard.json` `"when": "<id>"` (the winter lights' `fairyLights`).
4. Add `event.<id>.name`, `event.<id>.about` (the card's words) and `event.<id>.lines` (what friends say) to every string table.

The scene label shows the event while it is on, a card says it has begun the first time each year, and friends talk about it.

### Change the colours of a season or a time of day
The custom properties in `src/styles/scenery.css`, per season, time of day and weather. The painter and every drawing read them.

## Verification
```bash
npm test
npm run lint
npm run test:e2e
```

- `tests/content.test.mjs` says what is missing: a name or a line in a language, a drawing file, an effect, a painter, a curve, a colour, an event's words or gift, or a look's rules.
- `tests/events.test.mjs` checks when each event is on, north and south of the equator. The days it checks are in `tests/fixtures/event-dates.json`, which the backend's `content.rs` test reads too, so the page and the backend agree on an event's dates. When you add an event or change its dates, add cases there for the days around its first and last day, north and south.
- When the composition's lake changes (`lake` or the curve it names in `under`), `tests/lake.test.mjs` checks that the water still shows between the far shore and the hill in front at several yard sizes.
- To see an event outside its dates, the screenshot harness and the e2e run can set the date; in the app, the system clock decides.
- The backend's test `content::tests` checks the catalogue it built in.
- Look at it: build and run the app as in [getting started](../getting-started.md), and set the time of day and weather from the scene label in the yard to see the new thing in each light.

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
