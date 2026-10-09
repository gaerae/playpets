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

Later pieces, each its own change: friendship that deepens with time together, an album of finds.

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

## Performance

Plants and decorations are static SVG drawn once; a plant's stage is looked at once a minute with the sky. A find or a gift is one short pose and bubble; the lantern's glow is a still layer shown from evening on. Nothing new moves continuously (docs/standards/performance.md).
