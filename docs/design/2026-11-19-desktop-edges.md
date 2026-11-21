# The desktop's edges (2026-11-19)

## Why

- Gifts, flowers and trees now stay where a person puts them on the desktop ([desktop items that answer](2026-11-19-desktop-items-that-answer.md)), but everything still stands on something: the screen's top and sides stay empty.
- A desktop pet app is open for days. Something that hangs from the top of the screen uses the frame of the screen without covering the work in the middle.

## Goals

- Things that hang: the wind chime and two new gifts, a hanging flower pot and a wooden mobile. Each stands on its hook in the yard. On the desktop, one set down near the top of a screen hangs from that edge by a cord, without its stand.

## Non-goals

- Nothing hangs from the sides or the bottom, and nothing hangs in the yard: the yard has no screen edges.
- Nothing grows along the edges: a climbing morning glory was built and taken out (below).

## Anti-goals

- A cord that catches the pointer: it is drawn only, so clicks go to what is under it.
- Something hung that friends walk to: a friend cannot reach the top of a screen.

## Rules

| What | Rule | Why |
|---|---|---|
| Hanging kinds | A gift with `"hangs": true` in `catalog.json`: the wind chime, `hanging_pot` and `mobile`. Each has a `part` (the hanging piece, cut from its painting) whose `pivot` is where it meets the hook | The part is already what a poke sways ([desktop items that answer](2026-11-19-desktop-items-that-answer.md)) |
| Hanging | On the desktop, a hanging kind set down with its top within 32 px of a screen's work area top is moved up to that edge (desktop/overlay.rs `set_down`). Placed anywhere else, it stands on its hook | One rule in one place: a drop, a screen change and growth all go through `set_down` |
| Hung look | The layout says `hung` for it; the overlay hides the stand and draws a cord from the screen's edge to the pivot. While it is dragged within reach, it already looks hung | A person sees it will hang before letting go |
| Poke | A hung piece sways about its pivot, as on its hook; a chime rings | |
| Friends | A friend does not visit a hung thing | It is out of reach |
| New gifts | `hanging_pot` and `mobile` are gifts friends bring, with album cards, names and visit lines in four languages. The album grows to 187 | They are things to collect, as the chime is |
| Art | One sheet for the two new gifts, made in the house style through Codex with the chime as a reference | |

## Left to the builder

- The parts and pivots, read off the paintings.
- The words in four languages, by the glossary.

## Calls made while building

- The hanging sheet kept a soft haze behind the mobile; its alpha is cut below 190 rather than 50, which keeps the threads and drops the haze.
- The new gifts come after the last everyday gift and before the seasonal ones, so the first gifts, the mementos and the album's order keep theirs.
- A morning glory that climbed the bottom and a side of a screen as a vine was built and taken out before release: the person did not find the vine pretty. Painted flower mounds were looked at instead and left out for now ([album finds out](2026-11-19-album-finds-out.md)).

## Follow-up (2026-11-21)

- The wreath stand hangs too, by the same rule ([winter decorations](2026-11-21-winter-decor.md)).
