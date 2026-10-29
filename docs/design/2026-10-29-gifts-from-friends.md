# Gifts from friends (2026-10-29)

## Why

- A gift came once a day after the yard had been open 20 to 40 minutes. Leaving the app open was enough; no one had to play.
- Yards in the games this one draws on give things for being together, not for time passing.
- So a gift now follows what the person and a friend did together, and growing closer brings one too.

## Rules

| What | Rule | Why |
|---|---|---|
| Everyday gift | At most one every other local day for the whole yard (`GIFT_EVERY_DAYS` 2) | Fewer, so each one counts; more friends do not multiply them |
| Who brings it | A friend the person did something with that day: points other than time together on that date (`Bonds::together_on`, bond.rs) | Time alone in the yard brings nothing |
| The wait | Once one may come: 5 minutes for the first, then 10 to 20 (`growth.js`) | Comes soon after playing, still not at once |
| Where the wait lives | `giftWait` in the garden (`after`: the last gift's day, `dueAt` ms), set by `waitForGift` | A restart keeps it, with no browser storage; a wait set before another gift came no longer counts |
| Closer | One gift for each new level from 2 to 5 (`thanksGift`, `thanked` per friend), a little after the level is reached | Growing closer is felt in the yard, not only on the name tag |
| Memento (en) / keepsake (code) | At level 4, or the first level after it, the friend's own gift: one kind picked from the friend's id (`keepsake_kind`), marked with a heart | Each friend gives something of its own |
| Gift box | When the yard holds 12, a new gift waits in the box (`boxed`, `BOX_MAX` 12) in the album's gift book; it is set out from there once there is room | No gift is lost to a full yard |
| Putting away | Any gift is removed as before; a keepsake goes back into the box | A friend's own gift is never thrown away by accident |
| A friend that leaves | Its `thanked` entry goes; what it brought stays | The yard keeps its things |

## Limits

- No new art: the keepsake is one of the 20 existing gift kinds, so the album has no new entries for it. Two friends can share a keepsake kind.
- A friend already at level 2 or more when this ships brings one gift for its current level, not one for each level it passed.
- The backend checks every rule; the page only decides the moment and the friend.

## Data

- `garden` in `state.json` gains `boxed`, `thanked` and `giftWait`; `decor` items gain `from` and `keepsake`. Older files read as empty.
- `limits()` sends `giftBox` and `giftEveryDays`; `src/core/limits.js` keeps the same values (`tests/limits.test.mjs`).
- The old per-profile browser record (`gift-progress:<folder>`) is no longer read.
