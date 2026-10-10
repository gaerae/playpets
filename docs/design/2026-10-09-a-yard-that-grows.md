# A yard that grows with you (2026-10-09)

## Why

PlayPets is meant to stay open all day. Apps that people keep open in a corner of the screen (Rusty's Retirement, Ropuka's Idle Island, Spirit City) share one thing: something builds up while they are open, the result stays on screen, and day by day the space becomes the person's own. PlayPets had none of that. After the first days the yard looked the same every time, so there was little reason to keep it open beyond the agent hooks.

Goal: a slow, calm loop that makes each yard different and gives a reason to look again ("how far has it grown?"), with no pressure (nothing is lost by being away) and no running cost.

## The loop

1. **Find**: a friend out for a stroll now and then finds a seed and leaves it at its feet. A click picks it up; left alone, the friend picks it up after a while (nothing is missed by not watching).
2. **Plant**: "Plant a seed" on the toolbar, then a click on the field.
3. **Grow**: by the clock, also while the app is closed: seed, sprout, leaves, bud, flower. What flowers depends on the season it was planted in.
4. **Tend**: friends visit flowers on their own; a click on a plant sends the nearest friend to water it.

5. **Gifts**: once a day a friend brings a decoration and sets it down; the person arranges the yard with them.
6. **Catch**: friends fish at the lake and leap for bugs.
7. **Album**: one place for all of it, in four books (flowers, fish, bugs, gifts), so the garden, the gifts and the catches are one collection that grows with the year.
8. **Friendship**: each friend grows closer through time in the yard and everything above done together, and each level changes what the friend does.
9. **Seasonal events**: a few times a year the yard changes for a while (cherry blossoms, firefly nights, the harvest moon, winter lights, the new year), with a gift and creatures that come only then.

## Rules (first piece: the garden)

| Rule | Value | Why |
|---|---|---|
| A find | every 8 to 20 minutes of the yard being seen, by an idle friend | often enough to notice in a working session, rare enough to stay special |
| Seeds kept | at most 20 | a full pocket says "plant some", finds pause |
| Plants | at most 24 | the field stays a field |
| Growth | sprout at 10 min, leaves at 40 min, bud at 2 h, flower at 4 h, by wall-clock time since planting | progress within a session, a full flower by the afternoon, nothing to lose by closing the app |
| Kind | spring tulip, summer sunflower, autumn cosmos, winter camellia (by the season at planting) | the garden carries a memory of when it was planted |
| Removing | a plant can be pulled from its menu | the person stays in control of their yard |

The backend owns the garden (`state.json` key `garden`: seed count and plants with kind, place and planting time) and checks every limit; the page decides when a friend finds something (it knows who is idle and whether the yard is seen).

## Rules (second piece: gifts)

| Rule | Value | Why |
|---|---|---|
| A gift | once a day (the person's local date), after 20 to 40 minutes of the yard being seen that day; the very first after 5 minutes | a reason to come back each day, never more than one; a new yard shows what gifts are in its first session |
| What comes | bench, lantern, birdhouse, little pond, mailbox, picnic blanket, in that order; then one not in the yard | every yard gets the same first steps; later the yard fills out with what it lacks |
| Placing | the friend sets it down beside itself; the person drags it anywhere on the field (arrow keys too) | no inventory to learn: it is in the yard at once and can be moved |
| Decorations | at most 8; while full, no gift comes | room for friends to play |
| Removing | put away from its menu (right-click or Delete); it can come again as a later gift | the person stays in control without losing anything for good |
| Life | friends visit decorations on their own (sit on the bench, gather on the blanket, look into the pond) and say something that fits; the lantern is lit from evening on, the pond mirrors the sky, a bird sits on the birdhouse by day | the gift changes what friends do, not only how the yard looks |

The backend keeps the decorations in the same `garden` key (`decor`, `received`, `giftDay`) and decides which kind comes next and whether today's gift has come; the page decides when (it knows whether the yard is seen and what day it is for the person).

Interactive things (friends, plants, decorations) are drawn in flat colour with clear edges, like characters in front of an animated film's painted background (docs/design/2026-10-09-a-painted-yard.md), so what can be touched stands out from the painted world.

## Rules (third piece: fishing, bugs and the album)

| Rule | Value | Why |
|---|---|---|
| Fishing | a click on the lake sends the nearest free friend to the shore; the fish bites after 3 to 9 seconds and gets away 1.7 seconds after the float dips | a small moment of skill, short enough to fit between two tasks |
| Bugs | butterflies and dragonflies by day, fireflies on spring and summer nights, in the existing spells of small life; a click within reach catches one | the creatures that already fly become something to do, at no extra cost |
| Kinds | twelve fish, nine bugs, each with seasons, times of day and a rarity; rain brings up catfish and eels; a fish's size differs every time | a reason to look again in another season and hour; records to beat |
| Album | four books: flowers (counted by the backend the first time a plant blooms, `bloomed`), fish, bugs, gifts (the garden's `received`); found ones with a count and the biggest fish, the others as silhouettes with when and where to look | the garden, the gifts and the catches read as one collection; a visible goal that grows with the year |

The catalogue is `src/content/catalog.json`, read by the page (`src/yard/catalog.js`, which decides what was caught) and built into the backend (`src-tauri/src/pets/content.rs`); the backend keeps the album (`state.json` key `album`, `src-tauri/src/pets/album.rs`) and refuses what could not be a catch (a kind the catalogue does not have, a fish longer than its kind grows). Fish and bugs are drawn from each kind's look (`src/yard/creatures.js`), in the same flat colours as the decorations. Since 2026-10-10: [Yard content as data](2026-10-10-yard-content-as-data.md).

## Rules (fourth piece: friendship)

| Rule | Value | Why |
|---|---|---|
| Time together | 2 points every ten minutes the yard is seen, per friend in it (the backend counts it at most every 9 minutes) | keeping the app open is the main way to grow close, which is what the app is for |
| Things done together | pat 1, treat 2, chat 2, water 3, catch 3, gift 5; at most 40 points a day from these, per friend | doing things helps, but a few minutes of clicking cannot rush it |
| Levels | new friend 0, friend 60, good friend 200, best friend 500, dearest friend 1000 points | the second level in the first session or two, the last after weeks of keeping the yard open |
| What a level brings | 2: a wave and a word when the app opens and when the yard is seen again after 20 minutes away; 3: fishes alone every 12 to 25 minutes and lands three in four bites (the card says it caught it alone); 4: seeds are found at 0.6× the gap and by best friends first; 5: a flower on the name tag and, about a third of the time it chatters, words to the person | each level is something the person sees the friend do, not a number |
| Showing it | hearts on the name tag (one per level above the first), a row in the Friend tab with the level, a bar, the points to the next level and what it brings; a card when a level is reached | progress is visible where the friend is, and the next goal is always named |
| Losing it | never: being away takes nothing; a friend that leaves takes its bond with it | no pressure, as for the garden |

The backend keeps the bonds (`state.json` key `bonds`, `src-tauri/src/pets/bond.rs`) and owns what each thing is worth, the daily cap and the levels, so the page only says what happened (`befriend` with a reason and the person's local day) and cannot hand out points of its own. The page decides when (`src/yard/bond.js`) and holds what each level does.

## Rules (fifth piece: seasonal events)

| Event | When (north; south six months later) | What it brings |
|---|---|---|
| Cherry blossom festival | April 1 to 20 | 2.5× the falling petals, 2× the butterflies; the cherry sapling |
| Firefly nights | July 20 to August 20 | 2.5× the fireflies; the golden firefly; the watermelon |
| Harvest moon | September 25 to October 15 | A big, full, golden moon every night; the moonlight carp at night; the pumpkin |
| Winter lights | December 10 to 31 | Little lights on the big tree, lit from evening on; the snowman |
| New Year | January 1 to 7 (the same everywhere) | Greetings |

| Rule | Value | Why |
|---|---|---|
| An event's gift | the first gift due during the event is its own; the backend gives it only if the page's local date is in the event's dates (north or south) | something to look forward to each season, that cannot be had early |
| Event creatures | a fish or bug marked with an event bites or flies only while it is on; the album says when | a reason to open the yard in that season |
| Showing it | the event's name beside the scene label; a card the first time it is seen each year; friends talk about it now and then (two in five idle remarks) | noticeable without interrupting |
| Data | `src/content/events.json` (dates, gift, boost, looks, art), events-marked kinds in `catalog.json`, `when: "<event>"` layers in `yard.json` | an event is added or moved with no code (docs/how-to/add-to-the-yard.md) |

## Performance

Plants and decorations are static SVG drawn once; a plant's stage is looked at once a minute with the sky. A find or a gift is one short pose and bubble; the lantern's glow is a still layer shown from evening on. Friendship adds a check every ten minutes and redraws a name tag only when its level changes. Nothing new moves continuously (docs/standards/performance.md).
