# Decision: Hold twelve of every kind in the yard

## Context
- The yard held 12 friends, 12 gifts, 24 flowers and 6 trees, and the gift box 12 more gifts.
- The desktop shows only what the yard has, so it could hold up to 54 things, by four different numbers.
- With the album setting things out and bringing them back (`docs/design/2026-11-20-album-in-and-out.md`), people meet these limits often: on a card's `n/m` count, and when the yard says it is full.

## Decision
| Kind | Before | Now | Where |
|---|---|---|---|
| Friends | 12 | 12 | `pets/model.rs` `LIMIT` |
| Gifts and finds set out | 12 | 12 | `pets/garden.rs` `DECOR_MAX` |
| Flowers | 24 | 12 | `pets/garden.rs` `PLANT_MAX` |
| Trees | 6 | 12 | `pets/discovery.rs` `TREE_YARD_MAX` |
| Gift box | 12 | 12 | `pets/garden.rs` `BOX_MAX` |

- The desktop holds what the yard holds: up to 48 things, twelve of each kind.
- A yard saved with more flowers than the field now holds keeps all of them (`PLANT_KEEP`, 24, as `TREE_MAX` keeps trees). No more are planted or set out until fewer than twelve are left.
- The page keeps the same values before the state arrives (`src/core/limits.js`); `tests/limits.test.mjs` and `pets/mod.rs` check that every kind is twelve.

## Consequences
- Positive: one number to remember and to explain. A card's count never stops at a different number for flowers and trees.
- Negative: a field of flowers is half as full as it could be. Someone who liked 24 flowers keeps them, but cannot plant more until fewer than twelve are left.
- Neutral: twelve trees can cover more of the scenery than six. Trees stand only on free soil (`freeSpot`), and a full yard says so on the card.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Twenty-four of every kind | Twelve more friends means twice the AI chats and drawing; 24 trees would cover the scenery |
| Keep the yard's limits and give the desktop one limit of its own | One more number, and the yard's four would still differ |
| Keep everything as it is | The person asked for one rule |
