# Tree moments (2026-11-15)

## Why

- Since 1.7.2 the garden grows a Korean fringe tree, a red plum and a chestnut, but a grown one only stands there: the same drawing as any other tree, apart from its season art.
- Each of the three has a moment people know: the fringe tree's white blossom blown off like snow in late spring, the red plum flowering in the snow, chestnut burrs dropping in autumn.
- PlayPets is a yard to rest the eyes on. A tree that now and then does its one thing rewards growing it without adding a task.

## Goals

- A grown fringe tree in spring now and then sends a gust of white petals off its crown; they settle at its foot and fade. A friend under it may get one on its head.
- A grown red plum in winter sheds a few deep pink-red petals onto the snow, and now and then a friend walks over, looks up and smells the blossom.
- A grown chestnut in autumn now and then drops a burr at its foot. Clicking it sends a friend to pick it up, with a happy line, and the day's first pick has a line of its own.

## Non-goals

- No counts, no rewards, no album entries, no backend state: nothing to collect or finish.
- No new friend animation frames: a friend faces the tree with the look-up tilt flower viewing uses, and picks a burr with the dig stroke.
- Not shown on the desktop overlay.

## Anti-goals

- Petals fill the yard or fall all the time.
- The canvas or the frame loop gains steady work in a yard without such a tree.
- A visit or a pick interrupts something the person started (a game, fishing, a dig, a gathering).

## Rules

| What | Rule | Why |
|---|---|---|
| Which trees | A planted tree at stage 2 in the current place whose kind names a `moment` in `catalog.json` | Growing it is the way in; data, not code, decides which kinds |
| When | The yard shows the moment's `season` (`yardSeason`), outdoors with seasonal effects, morning to evening, in the moment's `weather` (clear by default; the plum also in snow) | Daytime, fair-weather outings, as flower viewing |
| A gust | 8–12 s of falling petals, half of them in its first quarter. The first gust comes 6–25 s after the moment starts, then one every 40–90 s per tree; at most two trees gust at once | Sparse and slow; the canvas rests between gusts |
| Petals | Drawn by the scenery canvas in the moment's `colors`, falling from the crown to a ring at the foot, lying about six seconds and fading over the last three | One painter for falling things; nothing in the DOM |
| A petal on a head | As a gust's first petals reach the ground, 60 % of the time one lands on a friend standing under the crown; it stays until the friend moves or the moment ends, and the friend may say a `lines.head` line | The flower viewing detail, kept by the tree instead of the festival |
| A visit | Every 3–7 min, half the time, an idle friend standing or strolling walks beside a tree with `lines.visit`, faces it, looks up, says a line (once any line of its own is done) and goes on after about five seconds | A friend notices the tree too |
| A burr | The first 1–4 min after the moment starts, then one every 6–15 min in the yard, with a short fall and one bounce, in front of the trunk | Rare enough to notice |
| Burrs lying | At most two under a tree and three in the yard; each stays six hours, until it is picked, or the season, the place or the tree changes | A few, never a carpet |
| A pick | A click sends the selected friend, else the nearest free one, with the walk and stroke of gathering a spring shoot; the burr leaves and the friend says a `lines.pick` line, or `lines.first` for the local day's first pick | The same gesture as other finds, with no reward |
| Reduced motion | No falling petals and no drop or bounce; burrs still appear, still, and can be picked; head petals, visits and lines still happen | The meaning stays without motion |

## Data

- `catalog.json` trees: an optional `moment`.

  | Field | Kind | Meaning |
  |---|---|---|
  | `season` | both | The season the yard shows when it is on |
  | `kind` | both | `drift` (gusts of petals) or `harvest` (burrs) |
  | `weather` | both | The weathers it is on in; `["clear"]` when absent |
  | `colors` | drift | Two or three petal colours, main first |
  | `petals` | drift | Petals in one gust, up to 16 |
  | `pace` | drift | A fall speed under 1 for a slower fall |
  | `petal` | drift | Petal length and breadth in yard pixels, each up to 5 |
  | `art`, `size` | harvest | The burr's drawing and its view box |
  | `lines` | both | String keys: `head`, `visit` (drift), `pick` and `first` (harvest) |
- The webview's storage key `burrs`: `{ next, picked, out }` (when the next burr may drop, the last local day of a first pick, and the burrs lying). Not in `state.json`.
- New strings in all four languages: the burr's title, the no-friend hint, and the four friend line lists.
- The burr drawing: `src/art/discovery/chestnut_burr.svg`, packed from `assets/discovery/chestnut-burr-source.png` (`assets/discovery/ART-SOURCES.json`).

## Code

- `src/yard/tree-moment-rules.js`: pure rules (when a moment is on, gusts, petal paths, burr spots and limits, the day's first pick).
- `src/yard/tree-moments.js`: gusts, head petals and visits; its tick returns at once while no drift tree is on.
- `src/yard/burrs.js`: the burrs, checked with the scene's minute repaint, never in the frame loop.
- `src/yard/scenery.js` `drift(gust)`: paints a gust's petals and keeps drawing only while they move or lie.
