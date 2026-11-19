# Christmas from mid-November (2026-11-20)

Follows [a winter to share](2026-11-09-a-winter-to-share.md): the Christmas tree and the baby reindeer come from November 15, so the yard can get ready for Christmas over a few weeks.

## Why

- People start decorating for Christmas in mid-November. A tree that waits for December 1 comes late.
- Santa is the visit at the end. Keeping him for December leaves December something new.

## Goals

- From November 15, friends bring the tree, then the baby reindeer, with no event on: one each time a gift is due, before the everyday gifts.
- The two show in the yard and on the desktop from November 15 to January 7, and in any winter yard as before.
- Ornaments hung from November 15 stay up through December.

## Non-goals

- No change to the `lights` event: still December 1 to 31, with its lights, toast and Christmas night.
- Santa still comes and shows from December 1. The question about showing a winter yard still comes in December.

## How

| Piece | Rule |
|---|---|
| `catalog.json` | The tree and the baby reindeer have `"from": "11-15"` and `"shown": "advent"` |
| `decor-shown.js` SHOWN | `advent` is November 15 to January 7, fixed to the calendar in both hemispheres; `december` stays for Santa |
| `content.rs` early_gifts | An event gift with `from` comes from that day to its event's end, when the event is fixed to the calendar |
| `garden.rs` gift | The event's own gifts first, then the early ones, each once; then the everyday ones |
| Ornament season | A day from November 15 on decorates that year's tree; earlier days the year before's (`ornamentSeason`, `ornament_season`) |
| Album | The tree's and reindeer's hint gives November 15 to December 31; their out-of-sight title says November 15 to January 7 |

## Calls made

- A gift-level `from`, not a new event: an event would bring its own toast and scene to November.
- The decorating season moves with the tree. Otherwise ornaments hung in late November would be hidden on December 1 and taken down by the first hang in December.
