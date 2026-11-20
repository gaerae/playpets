# Flowers and trees out of the album (2026-11-19)

## Why

- People set gifts, flowers and trees out on the desktop and arrange them where they like. The arranging became a reason to keep the app open.
- A gift found once can come back out of its album card (`garden.rs` `take_out`). A flower or a tree cannot: the only way to have one again is to find a seed or a sapling and wait for it to grow, and seeds come up at random by season.
- So a yard or a desktop full of the flowers a person likes best cannot be made on purpose.

## Goals

- A flower or tree kind in the album can be taken out again from its card, as many times as there is room.
- It comes out fully grown: a flower in bloom, a tree mature. It is free.
- One press puts it in the yard; another puts it in the yard and out on the desktop.

## Non-goals

- No change to finding: seeds still come up by season, saplings by digging, and growing still takes its hours.
- No separate desktop limit. Yard and desktop share the counts they have now (Rules, Limits), so there is one number to learn.
- No new album records. A flower or tree taken out does not count again and gives no bloom reward.

## Anti-goals

- A card that takes something out when there is no room, or puts it where it cannot stand (in the lake, under a gift).
- A second way to fill the album without finding anything.

## Rules

| What | Rule | Why |
|---|---|---|
| Who may | Only a kind the album has (`album.flowers`, `album.trees`). A kind not found yet stays a silhouette with no button | Finding stays the way in |
| Copies | Any number of one kind, up to the limit | A field of one flower is the point |
| Limits | Flowers: the field's 24 (`PLANT_MAX`). Trees: the yard's 6 (`TREE_YARD_MAX`). The same counts for the yard and the desktop: something on the desktop is also in the yard | One number, as before |
| Grown | A flower's `planted` is set back by the catalogue's bloom time and `bloomed` is true; a tree's by `TREE_MATURE_MS`, with stage 2 and `matured` true | Growth follows from `planted` (`growth.js`, `treeStage`), so it shows grown at once and never counts for the album |
| Cost | No seed and no sapling is spent | Free, as a gift is |
| Season | Any season. A tree shows its season's drawing as any tree does | The album is the person's, whatever the yard's weather |
| Where | A flower near the front of the field, as a gift is set out (`x` 0.3 to 0.7, `y` 0.8). A tree on free soil in the current place: twenty draws on the field that the ground allows for planting (`freeSpot`, `groundAllows` with `planting`), checked again by the backend (`validate_planting`) | It lands where it can stand; the person drags it on |
| No soil | In a place without soil (a paved workspace), the tree button is off and says to go outside | A tree is planted only in soil |
| Desktop | The second button takes it out, then sends it out (`setOnDesktop`), and shows the desktop tip the first time | The same as Show on desktop from its own menu |
| Commands | `takeOutFlower (kind, x, y)` and `takeOutTree (world, kind, x, y, ground)`, the yard's only; the desktop never takes anything out | As `takeOut` for gifts |

## Calls made while building

- The desktop button is a small screen icon beside Set out, named by its title: two worded buttons do not fit a card's width.
- A full yard, or a place without soil, turns both buttons off and says why in their title, as a gift's button does. Twenty draws finding no free soil say so in a toast.

## Follow-up (2026-11-20)

- A card now brings things back too, and sets out no more of a kind than the album found: [Album cards that set out and bring back](./2026-11-20-album-in-and-out.md).
