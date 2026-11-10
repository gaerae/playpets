# A winter to share (2026-11-09)

## Why

- Winter is the emptiest season in the yard: no bugs, few flowers, and December only adds fairy lights and one snowman gift.
- The yard is for healing. Winter should feel cute, sparkling and warm, and give the person things to do with friends rather than more things to count.
- The year's end is a moment people already pause on. A friend who asks how the year went, and remembers the answer, is what makes a pet feel like a friend.

## Goals

- December fills the yard step by step: a small Christmas tree, a baby reindeer and Santa come as gifts, the tree gets decorated a little each day, and on a snowy December night it becomes a grand tree.
- Winter play: building a snowman with friends, and following animal footprints in the snow.
- At the year's end a friend writes a letter, asks about the year and next year, and brings the person's answer back in the New Year and again the next December.

## Non-goals

- No photo or album snapshot of the yard.
- No living creatures (fish, bugs) hung as ornaments.
- No streaks, scores or "did you do it?" checks on the person's plans.
- No Lunar New Year; it is a later design, as its date differs by country.
- The desktop overlay stays as it is: friends, names, bubbles and gifts only.
- No trademarked names: the reindeer is "baby reindeer", never a named character.

## Anti-goals (a failure even if it works)

- The yard feels busy or noisy in December.
- The person feels guilty about a plan they did not follow.
- The yard's words reach an AI unlabeled, or the person's answer leaves the computer when no AI is connected.
- A canvas repaints every frame, or the frame loop gains steady work.

## Seeing winter

| Rule | Detail | Why |
|---|---|---|
| The `lights` event runs 12-01 to 12-31 and is `fixed` | Was 12-10, and moved six months in the south | Christmas is in December everywhere; the gifts must be reachable all month, so missing one day must not mean missing them |
| Christmas comes by the calendar | During `lights` the event gift comes whatever season the yard shows, in every world (studio too). The page passes the calendar event to `receiveGift`, not only the scene's | Answering "keep my season" must not cost the person Christmas |
| Ask once in December | When the yard is not showing winter during `lights`, ask once a year: show the winter yard until 01-07, or keep it. If they say yes, the earlier season choice comes back on 01-08 (`winterAsked: {year, previous}`) | The yard's season defaults to spring, so most people would never see snow; the same question works north and south |
| Christmas decor by date | Kinds with `"shown": "december"` (the tree, the reindeer, Santa) show from 12-01 to 01-07 whatever the season, and are hidden the rest of the year with their state kept | A Christmas tree in summer is out of place; nothing is lost |
| Winter-only decor | Kinds with `"seasons": ["winter"]` (the built snowman) show only while the yard shows winter | A snowman belongs to snow |
| Limits | Hidden decor still counts toward `DECOR_MAX`; there are at most four such kinds | Keeps the limit rules unchanged |
| No snow, no snow play | Christmas night, building a snowman and footprints need the yard to show winter; studio has none of them. The letter and decorating work everywhere | They are about snow; the letter and the tree are not |

## Christmas gifts

| What | Rule |
|---|---|
| New gift kinds | `xmas_tree` (small Christmas tree), `baby_reindeer`, `santa`, appended at the end of `gifts` (the first 16 feed mementos) with `"event": "lights"` and `"shown": "december"` |
| How they come | During `lights` the event gift is the first of these not yet received, in that order, through the normal gift rules (every other day, after doing something with a friend). The snowman is no longer an event gift: it comes from building one (below) |
| Putting away | These three go back into the gift box like a memento, never thrown away, so the tree can always be set out again |
| The years after | Once all three are received, December brings no new event gift; the decorating, Christmas night and the letter are that year's Christmas |
| Album | They are gift entries like any other, so they show in the gift book |

## Christmas night

| What | Rule |
|---|---|
| When | During `lights`, the yard shows winter, it is evening or night, it is snowing, and `xmas_tree` is set out in the yard |
| The change | The small tree becomes the grand tree in place, ground contact fixed: lights climb from the roots, a gold veil reveals the grand tree bottom to top while the small one fades, the star swells once, a warm light pools on the snow, nearby friends look up. About 2.6 s, once per night |
| After | The grand tree stays while the conditions hold; a single bulb glints now and then (10 to 16 s apart). When they stop holding it goes back to the small tree with a short crossfade |
| All three out | With the grand tree showing and `baby_reindeer` and `santa` both in the yard: the reindeer, then Santa, look up; a dark sleigh silhouette with a warm gold rim crosses the moon right to left; after it passes, 24 to 36 gold motes drift down from the star. Once per night, then calm |
| Reduced motion | The change is a short crossfade; the sleigh is a still vignette over the moon that fades; no motes, glints or swing |

## Decorating the tree

| What | Rule |
|---|---|
| Where | Clicking `xmas_tree` (small or grand) opens a small decorating view of the tree, with a tray of album items |
| What can hang | Found entries of flowers, trees, gifts (received) and small finds (treasures). Not fish or bugs |
| Ornament look | A small round bauble with a thin gold rim, tinted by kind, holding the item's art: flowers pink, trees green, gifts lavender, small finds honey. Trees with an autumn drawing use it, so green trees stay apart |
| How many | Three a day; the tray shows how many are left as dots |
| Hanging | Pick an item, hook points light up on the tree, pick one: the bauble arcs onto it, the branch dips, the bauble swings to rest, three glints, a friend reacts with a line |
| Reading | Hover, focus or tap on a bauble shows a card with the item's art, name and book |
| Keeping | Ornaments stay on the tree all winter and show on it in the yard. At the next `lights` they are taken down, so each December starts a fresh tree |
| Data | `garden.ornaments` (`[{book, id, hook}]`), `garden.ornamentDay` (`{day, count}`), `garden.ornamentYear` |

Follow-up (2026-11-10): the decorating view lets a person take a bauble down from its card. It frees the hook and does not return the day's count. With three a day the tree fills in about four days, and taking one down lets it keep changing through the season.

## Building a snowman

| What | Rule |
|---|---|
| When | The yard shows winter. A friend suggests it now and then, and it can be started from the play menu. Once a day |
| How | Friends roll a ball across the snow; the person taps the ball to help push (a short squash) or grabs and drags it to roll it themselves. The ball grows as it rolls and rolls more slowly as it grows |
| Stacking | Three balls (1 : 0.7 : 0.46). A full ball lifts in an arc onto the stack and settles with a small squash |
| Done | Five sparkles, a friend leans in; the person can put on a hat, a scarf and a carrot nose |
| Result | A snowman decor item is placed (it counts as receiving `snowman`) and keeps its accessories (`decor.dress`). It is winter-only decor |
| One at a time | The yard has one built snowman; a new one replaces it (the old one "melts" with a friend's line). With the yard full and no snowman yet, building is not offered and a friend says the yard is full |
| Trail | Where a ball rolls, a faint, blurred blue shade stays and fades back into the snow over a few seconds. No grass, earth or crumbs |

## Footprints in the snow

| What | Rule |
|---|---|
| Animals | Eight: hare, fox, water deer, raccoon dog, squirrel, sparrow, magpie, cat. Each print shape differs at a glance |
| When | The yard shows winter. One trail a day for sure; one more on a morning after snow (reconstructed from the deterministic `autoWeather`). From 12-26 to 01-07 only one a day |
| The trail | Faint prints enter from the yard's edge, wind across the field and end at a bush or the edge. They fade like the snowman trail and are gone after a new snowfall or the next day |
| Following | Clicking the prints sends a friend along them, sniffing (6 to 8 s) |
| The end | A tail shows for about a second behind the bush and whisks away with a puff of snow; birds flutter off instead. The animal is never shown whole |
| The find | A small find waits there; the dig never comes up empty (a `trail` context like `rainbow`), and each animal leans to certain finds (magpie: shiny things; squirrel: pinecone, acorn teacup) |
| Album | A new footprint book: each entry first shows the print and "Whose prints?"; following one fills in the tail drawing and the name |
| Reduced motion | No running; the tail appears and fades |

## The year-end letter

| What | Rule |
|---|---|
| When | Once, on the first day the yard is open from 12-26 to 12-31 |
| Who writes | The friend the person is closest to (highest closeness; ties go to the one earlier in the friends list) |
| How it comes | A bubble ("I wrote you a letter!") and a letter card. With a mailbox in the yard the letter waits there; otherwise it opens from the bubble or the event chip |
| What it says | A few warm lines about the year together, with real facts: things found in the album this year, a tree grown together, how close they are, and days since meeting when known. Then it asks how the year was and what the person wants to do next year |
| Days since meeting | Nothing records it today. A bond gains `met` (the day it was first created) from now on; for friends without it the letter leaves that fact out |
| Without AI | Lines from the string tables, in the friend's casual voice, with placeholders for the facts |
| With AI | The friend's voice writes it from the same facts; the facts and any earlier answer are flattened to one line, capped and labeled before they reach the AI |
| Answering | A short text box (up to 200 characters) under the letter. Skipping is fine: the friend still ends with a warm line |
| Kept | `letters` in `state.json`: `{year, friend, text, answer, at}`. The letter's own text is saved, so it reads the same after a restart and an AI is asked once. Only on this computer; the card has a way to delete the letter and the answer |
| Reading again | Until 01-07 the letter reopens from the event chip, or the mailbox when there is one. After that only the answer is kept for the recalls below |
| New Year | On the first day the yard is open from 01-01 to 01-07, the same friend brings the answer back: quotes it as plain text and cheers the person on. Never asks whether it was done |
| Next December | The next year's letter recalls last year's answer to look back on |
| A friend that left | Its letters stay; the closest friend now brings the answer back |

Follow-up (2026-11-10): the letter has its own chip (`#letter-chip`) beside the event chip and a row in the yard menu, so it no longer shares the event chip. The New Year cheer is its own card, and the answer counts as brought back only after the card shows. The friend's AI writes only while the yard is seen and never without a connection; without one the letter is made on the device from the app's own lines. The letter's text is cleared after January 7 by the minute check, and the answer stays.

## Constraints

- Repository rules: page modules act only in `setup…()`, every string in all four languages, Korean UI polite and friends casual, commands are one row of `COMMANDS`, no lock across a wait, text from outside labeled before an AI, a canvas repainted only when it changed.
- New saved fields read as empty from older files.
- Art follows the house style (softly sculpted miniature, true alpha), made with Codex from the existing art as reference; accepted art gets provenance in `assets/README.md`, rejected variants stay in `scratch/`.
- The compact yard (300 to 640 px wide) must still read: ornaments, prints and the letter card are checked there.

## Left to the builder

- Exact timings, counts and colours beyond the ones above (they are starting points from the mockups).
- Hook positions on the tree, how prints are drawn (static DOM marks or a canvas painted once per change), and the footprint art's exact size.
- Wording of every line, within the voice rules.
- How the decorating view and letter card are laid out, within the existing dialog styles.
- Which finds each animal leans to, beyond the two examples.
