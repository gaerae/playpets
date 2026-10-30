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
| The wait | Once one may come and the person has done something with a friend that day: 5 minutes for the first, then 10 to 20 (`growth.js`); a wait from an earlier day starts again | Comes soon after playing, still not at once |
| Where the wait lives | `giftWait` in the garden (`after`: the last gift's day, `dueAt` ms), set by `waitForGift` | A restart keeps it, with no browser storage; a wait set before another gift came no longer counts |
| Closer | One gift for each new level from 2 to 5 (`thanksGift`, `thanked` per friend), a little after the level is reached, on a day the person did something with that friend (`together_on`); a level reached while the yard and box were full comes later, one level at a time | Growing closer is felt in the yard, not only on the name tag |
| Memento | At level 4, or the first level after it, the friend's own gift: one kind picked from the friend's id (`memento_kind`), marked with a heart. Not "keepsake", which names the dug treasures |  Each friend gives something of its own |
| Gift box | When the yard holds 12, a new gift waits in the box (`boxed`, `BOX_MAX` 12) in the album's gift book; it is set out from there once there is room | No gift is lost to a full yard |
| Putting away | Any gift is removed as before; a memento goes back into the box, or with the box full is removed too | A friend's own gift is never thrown away by accident |
| A friend that leaves | Its `thanked` entry goes; what it brought stays | The yard keeps its things |

## Limits

- No new art: the memento is one of the 16 everyday gift kinds, so the album has no new entries for it. Two friends can share a keepsake kind.
- A friend already at level 2 or more when this ships brings one gift for its current level, not one for each level it passed.
- The backend checks every rule; the page only decides the moment and the friend.

## Data

- `garden` in `state.json` gains `boxed`, `thanked` and `giftWait`; `decor` items gain `from` and `memento`. Older files read as empty.
- `limits()` sends `giftBox` and `giftEveryDays`; `src/core/limits.js` keeps the same values (`tests/limits.test.mjs`).
- The old per-profile browser record (`gift-progress:<folder>`) is no longer read.

## Follow-up: closeness and the album follow what is done (2026-10-29)

Level gifts made the speed of closeness matter: a yard left open for a day grew a friend faster than playing with it, and so brought gifts for time alone.

| What | Rule | Why |
|---|---|---|
| Time together | 2 points every 10 minutes the yard is seen, up to 12 a day (`TIME_DAILY`, an hour) | A window left open no longer outruns play |
| Pats | Up to 10 of the day's 40 points (`PAT_DAILY`) | A minute of clicking does not fill the day; treats, talk, watering and catching do the rest |
| A day | Every reason, time included, counts toward a date that has come (`has_come`) | One day's counters for all reasons |
| Fishing alone | A friend at level 3 still goes on its own, but a bite waits 4 seconds for the person to press the float and gets away otherwise | The album and closeness fill only from what the person does |

Days to each level for one friend, before → after:

| Play | Points a day | Levels 2 / 3 / 4 / 5 |
|---|---|---|
| Yard open 8 hours, no play | 96 → 12 | 1 / 3 / 6 / 11 → 5 / 17 / 42 / 84 |
| Day's worth of play, 2 hours seen | 64 → 52 | 1 / 4 / 8 / 16 → 2 / 4 / 10 / 20 |
| Some play (25), 1 hour seen | 37 → 37 | 2 / 6 / 14 / 28 (same) |

- Points already earned stay; no friend's level goes down.
- Flowers and trees still reach the album as they grow: the person planted them.
