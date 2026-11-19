# The desktop's edges (2026-11-19)

## Why

- Gifts, flowers and trees now stay where a person puts them on the desktop ([desktop items that answer](2026-11-19-desktop-items-that-answer.md)), but everything still stands on something: the screen's top and sides stay empty.
- A desktop pet app is open for days. Something that hangs from the top of the screen, or grows along its edges a little each day, uses the frame of the screen without covering the work in the middle.

## Goals

- Things that hang: the wind chime and two new gifts, a hanging flower pot and a wooden mobile. Each stands on its hook in the yard. On the desktop, one set down near the top of a screen hangs from that edge by a cord, without its stand.
- A climbing flower: a morning glory in bloom, set down on the bottom of a screen, sends a vine along the bottom to the nearer corner and up that side. It is longer each day for a week, with leaves, flowers open in the morning and day, and closed buds in the evening and night.

## Non-goals

- No new album entry for the vine: it is the album's morning glory.
- Nothing hangs from the sides or the bottom, and nothing climbs in the yard: the yard has no screen edges.
- No vine across the middle of a screen: one standing anywhere but the bottom is a flower like any other.

## Anti-goals

- A vine or a cord that catches the pointer: both are drawn only, so clicks go to what is under them.
- Something hung that friends walk to: a friend cannot reach the top of a screen.
- A vine that redraws every frame or moves on its own.

## Rules

| What | Rule | Why |
|---|---|---|
| Hanging kinds | A gift with `"hangs": true` in `catalog.json`: the wind chime, `hanging_pot` and `mobile`. Each has a `part` (the hanging piece, cut from its painting) whose `pivot` is where it meets the hook | The part is already what a poke sways ([desktop items that answer](2026-11-19-desktop-items-that-answer.md)) |
| Hanging | On the desktop, a hanging kind set down with its top within 32 px of a screen's work area top is moved up to that edge (desktop/overlay.rs `set_down`). Placed anywhere else, it stands on its hook | One rule in one place: a drop, a screen change and growth all go through `set_down` |
| Hung look | The layout says `hung` for it; the overlay hides the stand and draws a cord from the screen's edge to the pivot. While it is dragged within reach, it already looks hung | A person sees it will hang before letting go |
| Poke | A hung piece sways about its pivot, as on its hook; a chime rings | |
| Friends | A friend does not visit a hung thing | It is out of reach |
| New gifts | `hanging_pot` and `mobile` are gifts friends bring, with album cards, names and visit lines in four languages. The album grows to 187 | They are things to collect, as the chime is |
| Climbing | A morning glory on the desktop climbs once it blooms, when its foot is within 64 px of the work area's bottom, which takes in the floor line a flower is sent out to (`catalog.json` `climbs`: its vine's pieces) | The bottom is the floor things stand on; the vine starts from there |
| Where | From the flower's foot along the bottom to the nearer side, then up that side to two thirds of the screen's height | It frames the screen and keeps out of the middle |
| How long | A share of that path: one tenth on the day it blooms, all of it a week later, by the clock | Something to come back to, without counting days |
| Pieces | Every 26 px a leaf on the inner side, turning; every third a flower (blue or pink), and a closed bud beside each; a tendril now and then; a young leaf at the tip. Chosen from the flower's id, so a vine looks the same each time it is drawn | |
| Open and closed | Flowers show in the morning and day, buds in the evening and night, by the overlay's hour (a class, no redraw) | Morning glories open in the morning |
| Drawing | One SVG under the desktop's things, drawn again only when its visible length changes by 4 px or its flower moves; pointer events off | The desktop draws only when something changed |
| Art | One sheet for the two new gifts and one of vine pieces, made in the house style through Codex with the chime and the album's flowers as references | |

## Left to the builder

- The parts and pivots, read off the paintings.
- The words in four languages, by the glossary.

## Calls made while building

- The hanging sheet kept a soft haze behind the mobile; its alpha is cut below 190 rather than 50, which keeps the threads and drops the haze.
- The new gifts come after the last everyday gift and before the seasonal ones, so the first gifts, the mementos and the album's order keep theirs.
- The vine runs 3 px above the flower's foot, so the screen's edge does not cut its stem.
- While a climbing flower is carried, its vine is not drawn; set down, it shows again.
- The reach was 48 px at first; in the real app a flower sent out stands on the floor line 53 px up (FLOOR_GAP + SPRITE_FOOT) and did not climb, so it is 64 px.
