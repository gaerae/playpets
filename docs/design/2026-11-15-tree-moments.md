# Tree moments (2026-11-15)

## Why

- Since 1.7.2 the garden grows fruit trees and a red plum, but a grown tree only stands there: the same drawing as any other tree, apart from its season art.
- People know what these trees do in their season: the red plum flowers in the snow, chestnut burrs and persimmons drop in autumn, figs and green plums in summer, yuzu in winter.
- PlayPets is a yard to rest the eyes on. A tree that now and then does its one thing rewards growing it without adding a task.

## Goals

- A grown red plum in winter now and then draws a friend over to look up and smell the blossom.
- Every grown tree whose art shows fruit drops it at its foot in the season the art shows it. Clicking the fruit sends a friend to pick it up with a happy line; the day's first pick of each fruit has a line of its own.

## Non-goals

- No counts, no rewards, no album entries, no baskets, no backend state: nothing to collect or finish.
- No new friend animation frames: a visiting friend uses the look-up tilt of flower viewing; a pick uses the friend's own `discover` pose or the `jump` row every pet has.
- Not shown on the desktop overlay.

## Anti-goals

- Fruit carpets the yard or drops all the time.
- The canvas or the frame loop gains steady work in a yard without such a tree.
- A visit or a pick interrupts something the person started (a game, fishing, a dig, a gathering).

## Rules

| What | Rule | Why |
|---|---|---|
| Which trees | A planted tree at stage 2 in the current place whose kind names `moments` in `catalog.json` | Growing it is the way in; data, not code, decides which kinds |
| When | The yard shows the moment's `season` (`yardSeason`, so never in a place without seasons), morning to evening, in the moment's `weather` (clear by default; the plum's visit also in snow) | Daytime, fair-weather outings, as flower viewing |
| A visit | Every 3–7 min, half the time, an idle friend standing or strolling walks beside a tree with a `visit` moment, faces it, looks up, says a `lines.say` line (once any line of its own is done) and goes on after about five seconds | A friend notices the tree too |
| A visit ends | Whatever takes the friend (a press, a game, its agent, the person's errand) ends it; so does its tree moving, going or leaving its moment, on the way or there. A friend walking to the tree already counts as the visit: no second one is sent | Nobody looks up at empty snow |
| Fruit drops | The first 1–4 min after a harvest's time starts in the place shown, then one every 6–15 min, under a tree with room, on free ground in front of the trunk. Night, rain or another season forgets the wait, so the first wait comes again each time the harvest does, and at each start | Rare enough to notice |
| Fruit lying | At most two under a tree and three in each place. Each fruit stays six hours, until it is picked, its tree is pulled up or moved at all, or the yard's season (`scene.season`) is no longer its tree's harvest season. The hour, the weather and the place shown do not take it: fruit is there on coming back | A few, never a carpet |
| Its fall | From the lower edge of the tree's crown (a quarter of the drawn tree's height above its foot, `fruitFall`, `--fall`) in 1 s: faster as it goes, turning upright, one small lift (a tenth of its own height), a slight rock and rest, while its shade gathers under it. No squash, no stretch, nothing below the ground. Landed, it lies like any other fruit | A small, believable drop |
| A pick | A click sends the selected friend, else the nearest free one, else one viewing the blossom or visiting a tree. It walks to stand beside the fruit; the fruit rises toward its paws and fades in 600 ms (`FRUIT_LIFT_MS`, `--lift-x`, `--lift-y`) while the friend shows its pose; then it says a `lines.pick` line, or `lines.first` for the local day's first pick of that kind of tree. No soil, no shovel: spring shoots still dig | The same gesture as other finds, with no reward |
| A pick ends | Whatever takes the friend leaves the fruit lying, and rising fruit settles back. Fruit that is no longer there (its tree moved or pulled up, its time over) lets the friend go at once | The fruit and the friend never disagree |
| Reduced motion | No fall, no bounce and no lift: fruit is simply there and simply goes; visits, poses and lines still happen | The meaning stays without motion |

## Data

- `catalog.json` trees: an optional `moments` list, at most one moment a season and one of each kind.

  | Field | Kind | Meaning |
  |---|---|---|
  | `season` | both | The season the yard shows when it is on |
  | `kind` | both | `visit` (a friend looks up at the tree) or `harvest` (fallen fruit); `MOMENT_KINDS` |
  | `weather` | both | The weathers it is on in; `["clear"]` when absent |
  | `art`, `size` | harvest | The fruit's drawing and its view box |
  | `title` | harvest | A string key: the fruit button's title and label |
  | `lines` | both | String keys of friend line lists: `say` (visit, three or four lines); `pick` (three or four) and `first` (two or three) (harvest) |

- The one visit: the red plum in winter, clear or snowy.
- The harvests, one for every tree whose art shows fruit, in the season the art shows it:

  | Tree | Season | What falls | Drawing |
  |---|---|---|---|
  | `red_plum` | summer | three green plums (maesil) | `discovery/green_plums.svg` |
  | `chestnut` | autumn | a split burr with three chestnuts | `discovery/chestnut_burr.svg` |
  | `persimmon` | autumn | an orange persimmon with its calyx | `discovery/persimmon_fruit.svg` |
  | `oak` | autumn | two acorns, one in its cap | `discovery/acorns.svg` |
  | `fig` | summer | a ripe purple fig | `discovery/fig_fruit.svg` |
  | `yuzu` | winter | a yuzu with a leaf | `discovery/yuzu_fruit.svg` |

- The persimmon's winter art keeps a few fruit too; it drops only in autumn, one harvest a tree.
- The webview's storage key `fallen-fruit`: `{ picked, out }`. Not in `state.json`.
  - `picked`: tree kind → the last local day of its first pick.
  - `out`: the fruit lying, each `{ id, tree, world, x, y, treeX, treeY, at }`; `treeX` and `treeY` are where its tree stood when it dropped.
  - The wait for the next fruit is not stored: a start waits the first wait again.
- Strings in all four languages: each fruit's title, the no-friend hint, and the line lists.
- Drawings are packed from `assets/discovery/*-source.png` (`assets/discovery/ART-SOURCES.json`).

## Code

- `src/yard/tree-moment-rules.js`: pure rules (when a moment is on, which trees, when fruit is due, where it lands, how far it falls, what stays, the stored record, the day's first pick).
- `src/yard/tree-moments.js`: visits; its frame-loop tick returns at once while no visit tree is on.
- `src/yard/fallen-fruit.js`: drops, draws and picks up fruit; checked with the scene's repaint (`fruitMinute`), never in the frame loop.
- `src/render.js` redraws fruit and looks the moments up when the garden, place, season or limits change; `src/app.js` does it with each scene repaint, a place change, a new land and a new size.
- `src/yard/planted-trees.js` `treeBox`: the drawn size of a tree, shared by fruit falls and visits.

## Considered and dropped

- Gusts of petals off a crown (the fringe tree in spring, the red plum in winter), and a petal landing on a friend's head: the yard's own spring petals already fall, a second fall from one tree was easy to stop noticing, and a white petal on a friend under white blossom was close to invisible.
