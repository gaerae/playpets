# Desktop items that answer (2026-11-19)

## Why

- Gifts on the desktop are pictures: a lantern stays dark at night, a friend stands beside a bench and never on it, and a press only drags.
- In the yard the same gifts light up in the evening and friends stand on benches, swings and hammocks. The desktop is where people now arrange them, so it should feel as alive, in small touches.

## Goals

- Lit gifts (lantern, campfire) light up from evening on the desktop, as in the yard.
- A friend that strolls to a bench, a swing, a hammock, a stump or a picnic blanket stands on it, as in the yard.
- A poke (a press let go without moving) gets an answer: the pinwheel spins, the wind chime sways and rings, the lantern's light goes off or on.

## Non-goals

- No new drawings. The moving parts are cut from the gifts' own paintings.
- No poses friends do not have: a friend on a bench stands on it, as in the yard.
- Nothing new in the yard: these are the desktop's.

## Anti-goals

- Motion that keeps running: each answer ends by itself, and nothing draws while nothing is poked ([performance](../standards/performance.md)).
- Motion with reduced motion turned on.
- A poke that is a drag, or a drag that is a poke.

## Rules

| What | Rule | Why |
|---|---|---|
| Time of day | The desktop goes by the computer's clock (`periodFor` of the local hour), checked each minute; the yard's own time choice is the yard's | The desktop is the real desk |
| Lit gifts | A gift whose catalogue entry names `glow` gets the yard's halo and pool. They show at 0.55 in the evening and fully at night. The rules move from `garden.css` to `worn.css`, which the yard and the desktop both load | One look, two places |
| Lantern poke | Turns its light off when lit, on when not, until the time of day next changes | A lamp people can switch |
| Moving parts | A gift's catalogue entry may name `part`: a polygon over its drawing (shares of its box) that moves, the point it turns about, and how (`spin` or `sway`). The drawing is laid twice: once without the part, once with only the part, which turns | Painted gifts move without new art |
| Pinwheel poke | Its vanes turn three times in 1.6 s, slowing to a stop | |
| Wind chime poke | The bell and its paper swing about the hook, 10° and back, smaller each time, over 1.4 s, and it rings the yard's chime when the sound is on, at its volume. The sound wakes for the chime and rests after | Its sound is its point |
| Poke | A press let go within 5 px of where it started, as a friend's pat. A press that moved is a drag and nothing answers | The same gesture as a friend |
| Seats | A stroll to a gift whose catalogue entry has `stand: "on"` ends with the friend's feet on the gift's own ground line (its `foot`), 3 px lower, within the middle 40% of its width (`roam.rs onto`). Other gifts keep `beside` | As `walkTo` in the yard |
| Reduced motion | No spin and no sway; the light still switches and the chime still rings | |

## Left to the builder

- The exact polygons and pivots, read off the paintings.
