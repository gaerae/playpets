# Yard content as data (2026-10-10)

## Why

The yard grew one feature at a time: a garden, gifts, fishing, an album, a painted backdrop. Adding a fish meant editing a JavaScript list and the backend's list of kinds. A gift needed edits in three places: a symbol in `index.html`, a size in `catalog.js`, and the Rust list. Moving a tree meant editing a constant in `layout.js`, and the lantern's light was a special case written against its name. Each improvement touched code that runs the yard, so changing how the yard looks risked how it works.

The goal is that **content and behaviour change apart**:
- A new fish, flower, gift, drawing, or a tree moved on the hill is a change to content files only.
- A better painter, drawer or effect is a change to code only, and every piece of content that uses it follows.

## The split

| Content (files) | Behaviour (code) |
|---|---|
| `src/content/catalog.json`: every kind, with its seasons, hours, weights, sizes, looks, colours, drawing, how friends use it, and its effects; the garden's stages | `catalog.js` (when things bite and fly), `growth.js` (stages over time), `album.js` (books), `garden.js` and `decor.js` (props on the field), `content.rs` (what the backend believes) |
| `src/content/yard.json`: the curves, the field, the lake, and the layers painted from back to front, each naming its painter with its settings | `backdrop.js` `PAINTERS` and `THINGS`, `trees.js`, `lake.js`, `clouds.js` |
| `src/art/**.svg`: one drawing per plant stage, flower and gift; a fish or a bug may have its own | `art.js` (loads them as symbols), `creatures.js` (draws fish and bugs from their looks) |
| Effect names on a gift (`"effects": ["glow"]`) | `effects.js` (layers) and the "Effects" rules in `yard.css` |
| Colours of the seasons, the light and the weather: `scenery.css` custom properties | The painter and every drawing read them by name |
| Names and lines: the string tables, by convention keys (`catch.fish_<id>`, `decor.visit_<id>`…) | `t()` |

## Decisions

- **One catalogue for both sides.** The backend builds `catalog.json` into the app (`include_str!`) and reads it with serde, so the two sides can never disagree about which kinds exist. The album now refuses an unknown kind, or a fish longer than its kind grows, where before it accepted any name shaped like one.
- **The page fetches its content at start.** `content.js` loads the two JSON files and the drawings before anything is drawn. To allow this, the page's CSP gains `'self'` in `connect-src`: the page's own files, nothing outside. JSON module imports would avoid the fetch, but the system webviews on older macOS and Linux do not support them.
- **Drawings are SVG files turned into symbols.** They stay inline, so they keep painting with the stylesheet's colours (`var(--leaf)`), and the season and light colour them with no code. The view box is the drawing's size, so a gift's size is not written down twice. Scripts and `on…` attributes are removed when a drawing loads, and a test refuses them in the files.
- **Effects are named, not special-cased.** A gift lists its effects. The decoration carries them as `data-effects`, and the stylesheet selects on them. A drawing that only needs to follow the scene uses scene colours (`--lamp`, `--bird`, `--sky-*`) and needs no effect.
- **The composition is a list of painted layers.** Each layer names a painter and gives its settings: which curve, its seed and colours (palette names, or `mix`/`shade`/`light` of them), and `when` it is painted. The order of the list is the painting order. Each layer has its own seed, so a change to one layer leaves the others as they were. Moving the composition out of the code left the painting pixel-for-pixel the same: baseline screenshots of five scenes were compared before and after.
- **Lists stay lists.** `catalog.js` keeps exporting `FISH`, `BUGS`, `FLOWERS`, `GIFTS` and `STAGES`, filled in place once the catalogue is loaded, so the rules and their tests read them as before.
- **What stays code.** A whole new book in the album is one entry in `album.js`, and its tab is made from it. A new rule, such as a new way to catch things, is code. Sound (`soundmix.js`, `soundscape.js`) is behaviour; its levels per scene are a small table in code.

## Checks

- `tests/content.test.mjs` covers everything the content names, so a missing piece fails with its name: strings in every language, drawing files (with a view box and nothing that runs), effects, painters, standing things, curves and palette colours.
- `content::tests` (Rust) checks the catalogue the backend built in.
- `tests/backdrop.test.mjs` counts the composition and the drawings among what reads the palette's colours.

## How to add

[Add to the yard](../how-to/add-to-the-yard.md).
