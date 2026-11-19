# Finds that come alive (2026-11-20)

Follows [album finds out on their own](2026-11-19-album-finds-out.md): a find out of the album is now something to play with, not only to look at, and the album has sixteen more entries worth growing, planting and setting out.

## Why

- A find out on the desktop sat still, except for a fish that swam when clicked. Every find should answer a click, each in a way that fits it.
- A killifish and a sturgeon came out at one size. The size of a fish is part of what was caught.
- A friend visiting a find said the same lines whatever it was.
- The album needed more entries that people want to collect: well-loved flowers, flowering trees and pretty keepsakes, rather than more fish and bugs.

## Goals

- A click on a find out on the desktop plays one short motion that ends by itself, and a find may make a sound.
- A fish out is drawn by its length, in the yard and on the desktop alike.
- A friend who visits a find out names it.
- Sixteen new entries, painted in the house style:

  | Book | New entries |
  |---|---|
  | Flowers | Two per season: lily of the valley and peony (spring), rose and lily (summer), marigold and Japanese anemone (autumn), poinsettia and amaryllis (winter) |
  | Trees | Lilac (spring), silk tree (summer), sweet osmanthus (autumn), holly (winter), each blooming or fruiting in its own season with a look for the other three |
  | Keepsakes | Heart locket, tiny perfume bottle (rare), pearl ribbon clip, seashell mirror |

## Non-goals

- No motion in the yard on a click: the yard's click opens the find's menu, as before.
- No change to how finds are caught, dug up, planted or set out.
- Bugs and treasures keep one size per book: their paintings already differ in shape, and the bug book has no lengths.
- No new fish or bugs in this batch.

## Anti-goals

- A find that keeps moving, or moves with reduced motion. Sound is not motion: it still plays.
- A loud or long sound: one short puff, at the yard's volume, only when the sound is on.
- A keepsake that reads as a trinket from a shop's shelf: each is a small, worn, personal thing found in the ground.

## How a find answers

| Find | Motion | Sound |
|---|---|---|
| Fish | swims across and back, with bubbles | |
| Butterfly, moth | flaps | |
| Dragonfly | darts ahead | |
| Firefly | blinks | |
| Beetle, cricket | hops | |
| Treasure | sparkles | |
| Heart locket | sways | |
| Tiny perfume bottle | sparkles | one soft spray |

- The default is by book, and for a bug by its `kind`; a find's own `poke` in `catalog.json` (`motion`, `cue`) overrides it.
- Each motion is one CSS animation in `overlay.css`; its layers (bubbles, sparkles) rest unseen beside the find until it moves.
- The cue is the yard's (`soundscape.js`): `spritz` is one short band of falling noise.

## Size by length

- Scale = 0.7 + 0.75 × t, where t is the fish's longest length on a log scale from 4 cm (t = 0) to 150 cm (t = 1), clamped.
- A killifish comes out at 0.7 of the fish box, a goldfish at about 0.97, a sturgeon at 1.45.
- The page (`display.js` findScale) and the backend (`content.rs` find_scale) compute it the same, so the yard and the desktop agree.

## Visits that name the find

- The desktop's visit event carries the decoration's id (`decorId`), and the page looks up what it holds.
- `decor.visit_fish_out`, `decor.visit_bug_out` and `decor.visit_treasure_out` take `{name}`, with the Korean particles.

## Calls made while building

- Each new tree takes a season, weather and place no tree of that season had yet: lilac in spring rain by the woods, silk tree on clear summer days in the courtyard, sweet osmanthus in autumn rain by the lake, holly on clear winter days in the courtyard.
- The perfume bottle is the one rare keepsake, so rare ones stay under a quarter of the book (7 of 29).
- The lily and the amaryllis stand a little taller than the other flowers (`stature` 1.2 and 1.15).
- The trail test's common-find share goes from over 40% to over 35%: three new common keepsakes widen the pool.
- Every new entry was compared with the older entries most like it. Three flowers were redrawn so they stand apart: a white Japanese anemone (not the cosmos's pink), a red-and-gold French marigold (not the chrysanthemum's orange) and long-stemmed roses (not a bush like the peony).
