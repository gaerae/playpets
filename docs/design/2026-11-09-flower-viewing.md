# Flower viewing (2026-11-09)

## Why

- The `blossom` event (04-01 to 04-20) already sends more petals and butterflies, but friends walk past the blossom as on any other day.
- The moment that says "spring is here" is friends gathering under a cherry tree, petals drifting down, looking up together.
- Like winter, spring should bring something to do with friends, not more to count.

## Goals

- During the blossom days friends gather under a blossoming cherry tree to look at the flowers, and the person can call them to it.
- Petals land on friends and stay until they move.
- Catching a falling petal is a small wish: a friend says it will come true.

## Non-goals

- No photo of the gathering.
- No new friend animation frames: friends stand and face the tree, with a small look-up tilt. Imported pets work the same way.
- No count of caught petals, no reward for catching more.

## Anti-goals

- The yard fills with particles or the frame loop gains steady work.
- A gathering interrupts something the person started (a game, fishing, a dig).

## Rules

| What | Rule | Why |
|---|---|---|
| When | During `blossom`, the yard shows spring, morning to evening, not raining | Flower viewing is a daytime, fair-weather outing |
| Where | A mature cherry tree grown in the garden; else a picnic mat set out in the yard; else the yard's middle under the scenery's blossom | Uses what the person grew or set out first |
| Started by friends | Once a day, when at least two friends are in the yard and idle, one suggests it ("Let's go see the blossom!") and they walk over | Spring comes to the person without asking |
| Started by the person | "Flower viewing" in the play menu during the same window, at most once an hour | The person can call friends when they want |
| The gathering | Friends stand in a loose half circle facing the tree, tilt up now and then, and talk in turns: lines from the string tables, or the friends' own voices when an AI is connected (the same group chat rules as today). Petals fall a little thicker around the tree. About 60 to 90 s, then they wander off | Long enough to watch, short enough not to take over |
| On a picnic mat | Friends gather on and around the mat instead | The picnic gift finally has a use |
| Petals on friends | During `blossom` a falling petal sometimes lands on a friend's head and stays until that friend moves; now and then the friend notices it | A small, quiet detail people discover |
| A wish | Tapping a falling petal catches it: it twirls up into a small glint and a nearby friend says a wish will come true. Once a day the line is special; other catches just glint | A gentle custom, not a game |
| Reduced motion | Petals do not fall; friends gather and talk; petals rest on heads; catching is off | The meaning stays without motion |
| Overlay | Not shown on the desktop overlay | The overlay stays friends, names, bubbles and gifts |

## Spring shoots

A new album book, the spring counterpart of winter's footprints.

| What | Rule | Why |
|---|---|---|
| Kinds | Eight, each known by name in all four languages: shepherd's purse, mugwort, fiddlehead, wild garlic, bamboo shoot, horsetail shoot, asparagus, morel | Spring gathering is a custom in every language the app speaks, but most plants are local; these eight are not |
| When | The yard shows spring. A few shoots poke up after rain, or one a morning on fair days | Things sprout after spring rain |
| Gathering | Clicking a shoot sends a friend to pick it with the dig action; it goes into the book | Done with a friend, like a dig |
| The book | "Spring shoots": each entry shows the shoot, its name and the season | Matches the other books |
| Never | No advice on picking or eating wild plants | Toxic look-alikes make such advice risky |

## Data

- `garden.viewed` (the last local day friends started a gathering) so it happens once a day across restarts.
- The special wish line's day in the same way (`garden.wished`).
- New strings in all four languages: the suggestion, the gathering lines, the petal-notice lines, the wish lines, the play menu entry.

## Left to the builder

- How petals land on a head (a small DOM petal on the friend's view, removed when it moves) and how thick the local fall is, within the performance rules.
- The half circle's spacing at compact sizes.
- The exact wording, within the voice rules.
