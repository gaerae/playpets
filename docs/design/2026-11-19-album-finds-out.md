# Album finds out on their own (2026-11-19)

Replaces the displays first built on this branch (a fishbowl, a bug jar, a specimen case and a pressed-flower frame), which never shipped.

## Why

- The point of taking a find out of the album is to look at the find itself. A bowl, a jar, a case or a frame puts a container between the person and what they found, and a wooden case hides most of it.
- On the desktop, a find should look good wherever it is put, as a flower or a gift does.

## Goals

- A fish, a bug or a treasure the album has comes out on its own.
- A fish floats just above where it is put, turned a little. A poke makes it swim a turn, with a few bubbles.
- A bug sits where it is put, and a firefly glows from evening.
- A treasure sits where it is put.
- None has a shadow: on the desktop a shadow only covers more of what is behind it.

## Non-goals

- No pressed-flower frame: a flower already comes out of its card on its own ([album take-out](2026-11-19-album-take-out.md)).
- No new album entries and no new art: each find is drawn from its album painting.
- No change to finding.

## Anti-goals

- A container around a find.
- A find that keeps moving: a fish swims only when poked, and not with reduced motion.
- A shadow, a stand or a base under a find.
- A find drawn small or blurry: the finds use the full painting, not the album card's small preview.

## Approaches

| Approach | Trade-off | Picked |
|---|---|---|
| Keep the displays' record (a gift with `holds`), with one bare kind per book that draws only the find | Keeps the commands, saving, menus and album buttons from step 3; only the drawing, the sizes and the copy change | Yes |
| A new record per find (its own kind id per fish, bug and treasure) | Cleaner data, but 88 new kinds through the catalogue, the backend and the strings | No |
| Keep the fishbowl for fish only | The person chose fish out on their own | No |

## Rules

| What | Rule |
|---|---|
| Kinds | `catalog.json` `displays` becomes three bare kinds, `fish_out`, `bug_out` and `treasure_out`. Each has no container drawing and holds one find |
| Made | A fish, bug or treasure card that has been found gets a button that sets the find out in the yard, and a screen icon that also sends it to the desktop. Each press makes one more; treasures no longer fill a case |
| Size | One box per book: a fish 84 × 54, a bug 52 × 46 and a treasure 44 × 44, before the desktop's scale. The find's painting fits its box, in proportion |
| Fish | Drawn a little above its foot and turned a little. A poke swims it across and back over about 2 s, turning at each end, with three small bubbles |
| Bug | Sits on its foot. A jar is no longer needed for the firefly's glow: a firefly out glows from evening |
| Treasure | Sits on its foot |
| Shadow | None, in the yard or on the desktop. A firefly's glow has its halo but no pool of light on the ground, which reads as a shadow |
| Names and menus | A find out is named for itself (a goldfish), not for a container |
| Limit | Each find out is one of the yard's gifts, as before (`DECOR_MAX`), shared with the desktop |
| Old saves | None exist: displays never shipped |

## The vine

- The morning glory's climbing vine is taken out of this pull request: the person found it not pretty, and neither flower-mound mock was the shape yet.
- Flowers gathering on the desktop (a mound that grows, or a drift in a corner) was looked at in painted concepts and left out for now.

## Calls made while building

- One size per book, not per fish length: the album's paintings share one box per book, so a size per fish would need the backend's gift size to depend on what is held. A minnow and a catfish come out the same size; a later change can size them by length.

## Left to the builder

- The float height, read off the mocks: a fish fills the top 72% of its box, about 15 px above its foot.
- The words, in four languages, by the glossary.

## Follow-up (2026-11-20)

- A card now brings things back too, and sets out no more of a kind than the album found: [Album cards that set out and bring back](./2026-11-20-album-in-and-out.md).
