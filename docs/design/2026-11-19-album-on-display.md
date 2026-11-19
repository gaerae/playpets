# The album on display (2026-11-19)

## Why

- People arrange gifts, flowers and trees on the desktop, and flowers and trees now come out of the album again ([album take-out](2026-11-19-album-take-out.md)).
- Fish, bugs and treasures stay in the album: 35 fish, 28 bugs and 25 treasures that a person found and cannot show anywhere.
- A small display that holds one of them joins collecting to arranging: what was found becomes something to look at.

## Goals

- Four displays, each made from an album card of something found:
  - a small fishbowl holding one fish;
  - a bug jar holding one bug, which glows at night when the bug is a firefly;
  - a specimen case holding up to five treasures;
  - a pressed-flower frame holding one flower.
- Each stands in the yard and goes out on the desktop as any gift does.
- On the desktop the fishbowl answers a poke: its fish swims across and back.

## Non-goals

- No change to finding. A display holds only what the album has.
- No new album entries: displays are not gifts friends bring and have no card of their own.
- No limit of their own: a display is one of the yard's gifts (`DECOR_MAX`, 12), as everything set out is.

## Anti-goals

- A display that holds something the album does not have.
- A gift friends bring that turns into a display, or the gift rotation changing.
- A display that keeps moving: the fish swims only when poked, and not with reduced motion.

## Rules

| What | Rule | Why |
|---|---|---|
| Catalogue | A list of its own, `displays` in `catalog.json`, each with the gift fields (art, size, foot, shade) and `holds` (the album book: `fish`, `bugs`, `treasures`, `flowers`), `room` (how many it holds) and `slots` (where each held thing is drawn: `[x, y, w, h]` as shares of its box) | Gifts' lists, the album's 185 entries and the gift rotation stay as they are |
| Record | A display is a gift in the yard (`garden.decor`) with `holds`: the ids it holds, in slot order | It moves, goes out on the desktop and is put away as a gift is |
| Made | `display (book, item, x, y)`, the yard's only: the item must be in that album book. A fish, a bug or a flower makes a new display holding it. A treasure goes into the newest case with room that does not hold it yet, else into a new case | One button per card; the case fills one find at a time |
| Copies | Any number, up to the yard's gifts | A shelf of jars is the point |
| Out of the case | A treasure in a case has the card button take it out again (`undisplay (id, item)`); a case left empty goes | Swapping is taking one out and another in |
| Put away | A display is not kept in the gift box: it goes, and the card makes it again | It is free and made from the album |
| Loading | A saved display keeps only held ids its book has, at most `room`, without repeats; one left holding nothing is dropped | A save from a newer or edited build cannot draw a hole |
| Drawing | The display's drawing, then each held thing's album preview (`previewSvg`) in its slot, kept in proportion and centred | One picture each for the yard and the desktop |
| Firefly jar | A jar holding a bug whose kind is `firefly` gets the `glow` effect: its halo shows from evening, as a lit gift's does | Night is when fireflies are seen |
| Fishbowl poke | On the desktop, a poke swims the fish across and back over 2 s, turning at each end; nothing with reduced motion | As the pinwheel and the chime answer ([desktop items that answer](2026-11-19-desktop-items-that-answer.md)) |
| Album buttons | A fish, bug or treasure card that has been found gets a worded button (Into a bowl, Into a jar, Into the case; Out of the case once it is in one) and a small screen icon that also sends the display out on the desktop. A flower card gets a small frame icon beside Set out and the screen | As the flower and tree buttons ([album take-out](2026-11-19-album-take-out.md)) |
| Full | With the yard's gifts full, the make buttons are off and say so in their title; Out of the case stays on | |
| Names | Each display's name names what it holds (a fishbowl with a crucian carp) | Several of one kind are told apart by their menus and tooltips |
| Friends' lines | A friend visiting a display says one of its own lines, as for any gift | |
| Art | One painted sheet of the four empty containers, made in the house style through Codex with the gift sheets as references; the held things are the album's own drawings | No new drawing per fish, bug, treasure or flower |

## Left to the builder

- The slots, read off the painted containers.
- The words, in four languages, by the glossary.

## Calls made while building

- The book names follow the album's and the ornaments' (`fish`, `bug`, `treasure`, `flower`).
- The containers are painted empty and opaque; the finds are drawn over the glass rather than behind it, which reads as inside at this size.
- The album's fish all face right, so the fish swims right first.
- A treasure card's button takes it out of its case; there is no menu for the case's own compartments.
