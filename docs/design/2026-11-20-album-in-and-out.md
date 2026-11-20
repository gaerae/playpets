# Album cards that set out and bring back (2026-11-20)

## Why

- An album card could set things out, one more each press, but nothing came back through it. Bringing them in meant finding each one in the yard or on the desktop and removing it there.
- People set out a few favourites, look at them, and want them back as easily as they came out.
- An Undo notice in the yard closed only by its button. A press on its words started a text selection, so it felt stuck.

## Goals

- From a card, set out and bring back what the album keeps, in the yard and on the desktop.
- As many copies of a kind as were found (the album's count), never more than the yard's room.
- Every notice line closes the same way, quickly.

## Non-goals

- No new limits: the yard's counts (24 flowers, 6 trees, the gifts' room) stay as they are.
- No change to how things are found or counted in the album.
- Nothing grown from a seed or a sapling is taken while it is still growing.

## Rules

| What | Rule | Why |
|---|---|---|
| Copies of a kind | A flower of the kind in bloom (`bloomed`), a tree of the kind grown (`matured`), a find out holding the item, a gift of the kind | What a card would set out; a seedling is still growing and is left alone |
| How many | Up to the album's count for the kind (`count`), and only while the yard has room. A gift is one | The person found that many |
| One allowed | One button, `Set out`, that turns to `Put back` while it is out, at the same width, filled in while out | A press again brings it back, under the same pointer |
| More allowed | `−  n/m  +` from the start, `0/m` with none out: `−` brings the last one in, `+` sets one more out, `m` the most there can be | Add and remove within what was found; the row never changes shape under the pointer |
| A press that cannot happen | Marked `aria-disabled`, not `disabled`: it keeps the focus and its title says why (`+` with all out, `−` with none, a full yard) | A quick second key press stays on `+` and does nothing, instead of landing on `−`; WebKit shows no title on a disabled button |
| While a press is saved | The row is held (`data-pending`) until the album redraws, then the focus goes back to the same control of the same card | Keyboard use goes on where it was; nothing is pressed twice |
| Sizes | Every button at least 28 px tall; `−` and `+` 28 px square | A quick second press lands |
| Desktop button | A toggle, pressed (filled in) while any copy is on the desktop. On: every copy goes out, or one is set out when none is. Off: every copy comes off the desktop and stays in the yard | One press for the whole kind |
| `+` with the desktop on | The new copy goes on the desktop too | The kind stays where it is shown |
| Backend | `takeOutFlower`, `takeOutTree` and `takeOutFind` refuse past the album's count (`error.album_all_out`). `takeOut` takes `desktop` too. `albumOnDesktop (book, item, on)` sets every copy at once, saved once | The page's rule holds whatever calls it |
| Bring back | `pullPlant`, `removeTree` or `putAway` on the last copy, without Undo | `+` sets it out again |
| Notices | Every line has a close button and closes on a press anywhere on it; its words cannot be selected. Closing an Undo line keeps the removal and saves it now | One way to close; closing means done |

## Approaches

| Approach | Trade-off | Picked |
|---|---|---|
| One per kind, toggled | Simplest card, but no field of one flower | No |
| A toggle with a `+` for more | Adds a copy but cannot take one back | No |
| `−  n/m  +` up to the album's count | One more control on a card; the count the person earned is the limit | Yes (the person's choice) |

## Calls made while building

- Desktop off leaves things in the yard (the person's choice).
- A built kind (a snowman) keeps its old card: it is built in the snow, never set out.
- A gift kept in the box goes back to the box when put back, as Put away does.
- The words follow the yard's menus: the desktop button's title says Show on desktop and Take off the desktop, as a thing's own menu does.
