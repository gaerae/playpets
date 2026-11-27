# The yard plays like a game

## Intent
- The owner's words, 2026-11-24: "This is a game now."
- The yard is painted (watercolour planes, warm-brown lines), but it reads like a web page laid over a picture:
  - glass panels and 16px line icons;
  - a still backdrop;
  - friends with only a walk, a wave and a jump to choose from.
- North star: someone opening PlayPets for the first time feels they opened a cozy game.
  - The yard is alive.
  - The friends move like characters.
  - Every play surface is a garden object that answers a touch.
- Rules used: gamedev-skills `game-ui-ux` and `game-feel`, and omer-metin `game-ui-design` (read, not installed). Codex gave a second opinion on the same screens and agreed.

## Goals and how each is checked
| # | Goal | Done when |
|---|---|---|
| G1 | Play surfaces are garden objects (plan B, below) | The dock, Play panel, thing bar and album match the approved mockups in shots at every size and language, light and dark. Every label is at 4.5:1 or more (measured) |
| G2 | Everything a person plays with answers a touch | Every play button, tile, bar choice and book has hover, press and focus states. Panels open with an overshoot and close faster than they open. Reduced motion removes the movement |
| G3 | The yard is alive with nobody touching it | Each place shows at least three kinds of ambient motion within 10 s: water glints, cloud shadows, swaying foreground plants, plus the clouds and small life it has today. The yard's CPU while friends only stand rises by no more than 1.5 points of a core (`pnpm run measure`). It all stops under `data-unseen` and reduced motion |
| G4 | The four friends move like characters | Outdoors an idle friend chooses among more than a walk, a wave and a jump: it sits to rest, stretches, stops to look at something, and meets another friend face to face. Each friend's pace and rhythm fit it (Pip brisk, Miso unhurried). No new cost while friends stand |
| G5 | Nothing covers what a person is looking at | Notices wait behind any open dialog. A thing's bar clears name tags and notices. A panel never cuts a speech bubble. Checked in shots |
| G6 | Daisy reads as an 11–12-year-old in palette A | Every sheet and pose of Daisy (base, summer, winter) has the new face and outfits, with the same proportions, cells and timings. The packers' checks pass and a contact sheet shows every row |

## Anti-goals (all goals)
- No text on texture. Large text is at 3:1 or more.
- No target smaller than today's. Keyboard focus stays visible and different from hover.
- Painted icons always sit beside their label, never alone.
- No new drawing loop, and no repaint of the backdrop or a canvas for ambient motion. Ambient motion is compositor-only CSS (`transform`, `opacity`) on small layers, as the clouds and the breeze are ([performance](../standards/performance.md)).
- Dark mode, night, reduced motion and the compact window (560x400, 300x210) keep working.
- The structure from the UI round of 2026-10-21 (PR #19) stays: one home per action, the same names everywhere, dock panels with a head and sections ([page modules](../standards/page-modules.md)).
- Imported and community pets keep working with their own sheets. New clips are optional, like the game poses ([game poses](2026-11-23-game-poses-for-every-pet.md)).

## G1 Play surfaces (plan B)
### Findings (2026-11-24, mock harness, ko 1180x850 and 820x600, ja 1180x850)
| # | What reads as "web page" | Where |
|---|---|---|
| 1 | Glass surfaces and line icons next to painted art | every panel |
| 2 | **Play** has the same weight as **Friends & settings** | dock |
| 3 | Ten activities of equal weight, like a settings list | Play panel |
| 4 | 213 dashed cards repeating the same two-line hint | album |
| 5 | A large dialog showing two settings | Settings |

### Approaches
| Approach | What it means | Trade-off |
|---|---|---|
| A. Reskin only | Paper and wood for today's panels; painted icons swap in | Cheapest; the dock and album keep their web-like hierarchy |
| **B. Two layers (chosen)** | Play surfaces become garden objects with a new hierarchy; system surfaces stay app-like in the same frame | Fixes the feel where people play and keeps settings readable; needs about 25 painted icons and a few textures |
| C. In-world UI | Settings as a mailbox, the album as a book in the house | Most immersive, hardest to find; the first-minute spike's mailbox entry felt forced (2026-11-23) |

- Mockups the owner approved: `scratch/first-minute/v10/menu/` (not tracked).

### Design
- **Material:**
  - Cream paper in a 6px honey-wood rim, rounded corners and a warm shadow.
  - The rim is a transparent border with the wood as a gradient behind it (`--garden-frame`), so it keeps its round corners at any size; a dark outer edge, a crease and a paper that warms toward its edges give it depth.
  - The paper stays flat behind words (no grain under text).
  - A painted vine trails after each panel's and dialog's title and a painted sprig sits before each section name; the type stays the system font.
  - A question before something is removed keeps a plain title.
  - Every surface on paper takes the paper's ink and fields, choice cards included.
  - The page's old green marks and blue-green shades do not show on paper: a count, a found stamp, a picked card and a shadow take the paper's browns, and every switch that is on is lit the same.
  - The first-run card is framed paper too; name tags and speech bubbles stay white labels in the paper's brown ink, in the yard and on the desktop.
  - Every Close on paper, and a small window's corner buttons, is one round wooden button.
  - Honey stays for **Play** alone; a dialog's main action keeps the dark ink button.
  - Dark mode and night use a lamplit paper (darker, warmer).
- **Dock:**
  - **Play** is the main button: larger, honey-filled, with a painted icon.
  - The scene chip and **Friends & settings** stay small.
- **Play panel:**
  - The friend's portrait sits beside the title.
  - Each activity is a tile with its painted icon above its label.
  - Groups and order stay.
- **Thing bar:**
  - The menus of a friend, gift, flower and tree become a name plate (with closeness hearts for a friend), and below it one horizontal bar of choices with a notch toward the thing.
  - Rows, keys and names stay (`core/menu.js`). On the bar the plate names the friend, so its choices say only what they do (Talk, Play, Ask to dig); the list in a small window still says whom each is with.
  - The right-click menu on empty scenery stays a list in the paper material.
- **Album:**
  - An open book. The books are ribbon bookmarks along the top edge, each with a painted icon and its count.
  - The left page shows the selected find large, with its name and record, or a missing find's hint.
  - The right page shows one hint line for the book, then the grid.
  - A missing find is a pale outline with its number.
- **System surfaces:**
  - Surfaces: Settings, AI connection, updates, Invite and the chat body.
  - They keep their controls and layout and take the paper frame.
  - Settings keeps one size from section to section, as before (`tests/settings-density.test.mjs`), so moving between sections never moves its edges.
  - The strip of tools in hand (dig, plant, sow) shows the same painted pictures as the Play panel.

### Art
| Asset | Count |
|---|---|
| Painted icons | Play 10, thing bar about 8 (shared where the action is the same), album books 8, dock 1 |
| Paper (light, lamplit), honey-wood rim, book spread, ribbon | 1 each |

- Made with Codex in the house style. Halos are cleaned (alpha threshold, then crop).
- Sources and provenance are kept in `assets/`, and WebP exports go in `src/art/ui/`.
- The line icons in `src/core/icons.js` stay for system surfaces and as a fallback.

## G2 Feedback
- The `game-feel` small tier is for UI: a short eased response, no shake, no hit-stop.
- **Hover:** lift by 2px and brighten.
- **Press:** scale to 0.96 and back with an overshoot (about 180 ms).
- **Panels:**
  - Open: scale from 0.94 and fade in, with an ease-out-back (about 220 ms).
  - Close: at once. A fading panel would keep taking clicks and focus while it goes, and `hidden` is set from many places.
- **Bar choices** come in one after another, 30 ms apart.
- Focus uses its own ring, never the hover style.
- Reduced motion keeps the state colours and drops the movement.

## G3 Living yard
- The backdrop is one painted picture (`easel.js`), so motion goes on one small layer above it (`living.js`, `.living-layer` in `scenery.css`), placed from each place's geometry (`worlds.json`) when the place or the yard's size changes. Nothing runs per frame.

| Layer | What moves | How |
|---|---|---|
| Water glints | Eight soft horizontal glints on the lake twinkle in turn | Radial gradients placed by `environmentLake`; `opacity` and `transform: scaleX`; a 5.6 s loop, staggered |
| Cloud shadows | Two very soft shadows slide across the field | Radial gradients in two full-width lanes; `transform` over 96 s and 131 s; clear days only |
| Foreground plants | Painted tufts of grass and flowers in the two bottom corners sway | Painted art (`src/art/ambient/tuft-*.webp`); the existing `breeze` keyframes, with no filter |
| Clouds, small life, weather | Already there | Unchanged |

- Night gives the glints a pale gold, at a slower pace.
- Rain, snow, evening and night hide the cloud shadows.
- Winter hides the tufts, whose grass and flowers would stand in the snow; the small window hides them too.
- Reduced motion hides the glints, shadows and dust, and leaves the tufts still.
- The indoor place has no water. Its motion is a soft shaft of light under each window pane (an `opacity` shimmer) and golden dust drifting up in front of the window. A lamp's flicker was left out: the painted lamp has no separate light to move.
- At least three kinds of motion in every place (`tests/living-yard.test.mjs`).

## G4 Friends
- New optional clips in the poses format (`actions.json`):
  - `sit`: sits down, rests, gets up.
  - `stretch`: a stretch or a yawn.
  - Same canvas, anchor and ground rules as the six clips today.
  - The four friends ship them for each outfit; other pets without them never use them.
- New behaviour, no new art:
  - **Stop and look:** between strolls the friend turns its gaze for 1–2 s to the nearest friend on the move, else the nearest friend, else up and away. Needs a sheet with look rows (version 2). The small fliers and petals are drawn on canvases the friends do not see, so they are left out.
  - **Meet:** two idle friends near each other sometimes walk to stand facing each other, look at each other, and one may wave.
  - **Pace by character:**
    - Pip: brisk, short rests.
    - Clover: middling.
    - Miso: slow, long rests.
    - Daisy: middling, stops to look more often.
    - The shares and paces are one table in `wander.js` (`characterOf`); any other pet gets Clover's.
- Built: `pastimes.js` picks a turn's pastime; `motion.js` scales a friend's own stroll by its pace and its wait by its rest.
- Outdoors only. A workspace keeps its own lounging.
- An agent's state, a game or a person's request takes the friend at once, as today.

## G5 Overlaps
- A notice that arrives while a dialog is open waits, and shows once the dialog closes.
- The thing bar places itself above the thing.
  - Near the top it flips below.
  - It slides sideways to stay inside the yard.
  - It never covers the thing's own name tag.
- A dock panel that would cover a speech bubble moves the bubble beside the panel, to its left. Where the yard has no room there, the bubble rises above the panel's top edge.
- Only a bubble that shows while the panel is open moves; one already showing when the panel opens stays until it is said again.

## G6 Daisy
- Choices, 2026-11-24:
  - palette A (cream, honey and butter yellows, moss-green satchel on a crossbody strap);
  - a white daisy;
  - the face of an 11–12-year-old with the same chibi proportions.
- Outfits: the pet format has `base`, `summer` and `winter`.

| Outfit | Seasons | Look |
|---|---|---|
| `base` | spring, autumn | Cream beret with a white daisy, cream cable cardigan over a butter-yellow dress, white socks, brown boots |
| `summer` | summer | Cream headband with a white daisy, sleeveless lemon sundress with a white collar and daisy print, white socks, tan strapped shoes |
| `winter` | winter | Cream beret, honey coat, cream scarf, brown tights and boots |

- Separate spring and autumn outfits would need new season keys in the pet format. They are left out.
- **Method:** the wardrobe method of 2026-10-11 (`assets/pets/DAISY-PIP-WARDROBE-PROMPTS.md`).
  - Each row of eight poses from today's sheet goes to Codex as a reference, with the approved look.
  - Only clothes, colours and the face change.
  - The rows are cleaned and packed with `pack-companion-batches.mjs` at Daisy's 163px idle silhouette, and the poses with `pack-companion-actions`.
  - Provenance goes in `assets/pets/`.
- Mockups: `scratch/first-minute/v10/daisy/` (not tracked).
- Built:
  - all 33 rows (three outfits), the twelve action strips, her sit and stretch clips, the site's preview strips and the creator kit's turnaround, face detail and collages;
  - an action strip is redrawn as an edit of the shipped one, enlarged, and each pose is fitted back to the old frame by its feet, so `actions.json` does not change;
  - provenance is in `assets/sources/daisy-2026-11-24/` rather than `assets/pets/`, beside the earlier companion sources.

## Order (one branch, one PR)
1. G6 and G4's clips are drawn first in the background, because Codex takes the longest.
2. G1 and G2:
   - materials and the dock;
   - the Play panel;
   - the thing bar;
   - the album book.
3. G5 overlaps and Settings height.
4. G3 living layers.
5. G4 behaviour, then the clips once they are packed.
6. G6 sheets swapped in.

## Checks
- A rule that changes changes its test first.
- Mock harness shots:
  - Languages: ko, en and ja.
  - Sizes: 1180x850, 820x600, 560x400 and 300x210.
  - Modes: light and dark, day and night.
  - States: an album with finds, not only the empty one.
- A contrast script over the labels of play surfaces.
- `pnpm run measure` before and after G3 and G4, alternating runs.
- `pnpm test`, `pnpm run lint`, `pnpm run site:build`, and the e2e on CI.

## Left to the builder
- Exact sizes and spacing inside the anti-goals.
- Whether find cards and notices reuse the bar's plate or the panel's paper.
- The desktop: the thing bar replaces the spike's ring when the rest of the desktop-first work lands.
- The spike's grass strip is the one part of it brought over:
  - `desktop/grass.rs` keeps its ends as shares of the first screen's width (`desktopGrassSpan`), at least 420px apart.
  - `overlay/ground.js` draws it; an end takes the pointer only after the pointer rests on it for 300ms.
  - Friends on that screen stroll over it only.
  - A switch beside **Stroll on desktop** turns it off; it starts on (`desktopGrass`).
  - It wears the yard's season as still drawings (`data-season`): a lawn drawn with its mirror image, so it has no seam, and a scatter of the season over it at another width, so the two repeat together only far past a screen's width. Winter has its own snowy lawn and pebble.
  - A flurry (`overlay/flurry.js`): after the person pats, feeds or waves to a friend on the grass, seven petals, leaves or flakes fall around it for about five seconds and settle. At most once every four minutes, never in summer or with reduced motion, and not for an agent's status or news, which come while the person works. The compositor moves the bits, so no frame loop wakes.
  - Not done yet: resizing by keyboard.

## Follow-up: shown, not written (2026-11-25)
- The owner's words: a cozy game is more appealing when it works by itself than when it explains, whatever the language.
- What to try next is a painted hand, not a sentence (`yard/show-how.js`):
  - It taps the first friend until the first pat, then the water until the first fishing.
  - With a tool in hand it taps open ground, until that tool has been used once (`shown-<tool>` in storage). The patch is the first with no friend on it, else the one farthest from them (`clearPatch`).
  - It rides in the friend's label, so it walks with the friend; CSS moves it, and it waits while a panel, menu, dialog or game is open.
- The tool strip shows its tools and Close in one row at every size; its instruction is read aloud only. Why a tool waits ("no saplings") stays in sight.
- How an album kind is found is painted pictures (`panel/album-clues.js`), in up to three rows that never share a line, each under its word on a tag:
  - **How**: steps joined by arrows (dig → plant → hourglass with the hours; the rod for a fish; play → two days → gift for an everyday gift). Each arrow is an element of its own between two steps, so a long word never pushes it off its picture.
  - **When**, on a tag: what has to be so (a flower's season, a fish's or bug's seasons and times of day, clear weather). A kind only at an event shows the event by its own drawing and name, then its dates on a calendar, then its own times;
  - **Best in**, on a tag: what makes a tree, a keepsake or a fish likelier (seasons, weather, places). It was **More often** first; that reads as how often, not where or when, and 'More often: Hill garden' says nothing on its own.
  - One line held steps and likes together, after a heart, and read as one sequence; the rows keep the two meanings apart.
  - Every picture has one word under it: a picture alone is a guess (summer's sunflower reads as the flower it grows into, midday's sun as clear weather).
  - Nothing is a word alone: a place is its thumbnail from the place picker, clear weather and snow have their own painted pictures.
  - A tool's word is its button's name, so the clue and the button match. A built snowman, shoots and tracks stay a sentence: their conditions are building or counts, not something to show. The scene that calls an event up by hand stays in the sentence too: a row of it repeats the same season and time pictures with another meaning.
  - A long row wraps between kinds of clue (seasons, times of day), never inside one.
  - The row is one image to a screen reader, named by the old sentence, which is also its tooltip.
- The album's right page is one column (`.album-right`: its line, then its cards), so the left page's height no longer pushes the cards down.
- The first desktop notice is three painted gestures with one word each (`toast(…, { pictures })`): tap the name (chat), drag (move), right-click (take off). The sentence stays for a screen reader and as the line's tooltip.
- The rule: a picture to find it at a glance, a word to be sure, never a sentence. Play buttons keep their labels.
- New art: `assets/sources/ui-icons-2026-11-25/` (hand, seasons, hourglass, rain, gift, times of day, clear weather, snow, the tap-a-name, drag and right-click gestures, and a calendar).

## Follow-up: one kind of mark, one kind of Close (2026-11-26)
- **Play** stays honey but is as tall as the dock's other buttons (36px), its word one size larger (`--font-lg`). Standing over the rim made it the loudest thing on screen; the honey alone marks it as the way in.
- Marks over a picture are paper tags: the card's number, **Rare** (with the painted star) and a keepsake's heart share the album's paper, its edge line and a 20px height. The heart is round only because it holds one picture.
- The heart is painted, not the font's ♥, and the yard's memento heart and waiting letter use the same paintings on a cream tag with an edge line (`assets/sources/ui-icons-2026-11-25/sheet-m.png`). The yard's tags keep fixed colours, so they read the same on the grass in either theme.
- A tab's new dot sits inside the tab; at the corner it hung in the ribbon's curve over the next tab.
- Every "new" dot is 8px in the accent colour with a 2px ring of the surface it sits on. They were five dots of three sizes; on the honey button and in dark mode the ringless ones disappeared.
- A Close at a panel's or a dialog's corner is the round wooden button, 32px with an 18px × at one stroke weight. The ×'s size had varied from 14px to 20px, so the same button looked heavy in one panel and faint in the next.
- A Close inside something that already has a frame (a notice, a catch card) is a bare × with a round hover. A ring there was a third outline next to the frame and the **Undo** button. On a touch screen it grows to 44px like every other icon button.
- On the album's wooden cover the Close's rim matched the cover, so in dark mode it lost its edge; it takes the Play button's darker edge (`--garden-rim-edge`).

## Follow-up: a game designer's and an art director's review (2026-11-26)
Four reviews of the whole app (game design, words, art direction, HUD) asked what still felt like a tool rather than a game. What changed:
- **Rewards follow play.** The gift clue says playing brings gifts, but closeness counted only pats and talks. A finished game now counts for every friend in it (`bond.rs` `play`, 3) and a dig the person asked for counts once (`dig`, 1); a dig a friend chose itself does not.
- **A find says what kind of find it is.** The catch card adds paper tags: **New** for a first (with a pop), **Rare** with a gold edge (`rareKind`, the album's own rule), and **Best ever** for a fish bigger than the stored best. A wrong guess in hide-and-seek and an early reel are shown (a shake and a ?, a mark on the float), not told.
- **The hand teaches the whole loop.** After fishing: Play → Dig until the first dig, Plant once there are seeds, Album once something is in it (`hint.js`). Digging from the yard's menu counts as learned. The hand avoids the news lane's rectangle and rides inside the button it points at, so nothing new runs in the frame loop.
- **News gets out of the way.** While a tool is in hand the lane moves into the sky. In a large window a card shows its picture and name and keeps its sentence for hover and the live region; a fish's size and a bug's count stay, being short and the point of the catch (`.measured`).
- **Now in the album.** A missing fish, bug or flower the yard could give at this moment wears a leaf-green **Now** tag (the album's green-soft read as the record's tan), using the game's own rules (`fishHere`, `bugChances`, `seasonFlowers`). Trees, keepsakes and gifts have only "likelier" or no time rules, so they are not tagged.
- **Chosen looks chosen.** The tool in hand, a pressed Play action and a chosen talk companion wear the same 2px wooden rim, which hover never adds.
- **Place & atmosphere** is pictures with one word each and fits a short window without scrolling; a place's description moved to its card's tooltip.
- **Words.** System surfaces keep their layout (plan B) but lose what a game would not say: the AI picker after an AI is chosen, the points left to the next level, the friend's ID unless an agent uses it, connection jargon. Limits read as the game's ("That's a lot of digging for today"), not as errors.
- **Keys.** ⌘3 opens Play and ⌘4 the place, after ⌘1 Friends and ⌘2 Invite, the same in the menu bar.

Asked and not done, for the owner to decide:
- **Night and dark mode.** Following the yard's time instead of the system's would change what dark mode means for every panel.
- **The switch colour.** Every switch that is on is lit the same (settled); a game's green or the honey of Play would make it one of two.
- **Settings as a game menu.** Plan B keeps Settings a system surface; painting it would reopen that decision.
- **Verbs in tag and the parade.** They are watched, not played; giving the person a part is a game design of its own.
- **A welcome-back summary** of what happened while away, and a book-complete card.
- **Slimmer album cards** (the record line reads like inventory) and a **Now count on the tabs**, which does not fit the English tabs.
- **How many Now tags.** In summer, most missing fish and bugs are catchable, so most cards wear Now. No single "short window" threshold works for both fish and bugs; the alternatives are to fade what is not catchable or to keep Now as is.
- **The small window.** The corner button as Play, and the album as pictures rather than sentences.

## Follow-up: the desktop grass, found and undone (2026-11-26)
The grass came out on its own, but nothing showed that its pebbles move or how to put it away. What changed:
- **The tray menu** has **Grass on desktop** under **Stroll on desktop**, as Settings does (`tray.rs`). The macOS menu bar has neither.
- **A right click on a pebble** offers spreading the grass across the floor again or rolling it up (`grassMenu`, `menu::grass_choices`), the overlay's own menu as for a friend.
- **The hand shows the pull** the first three times the grass comes out (`ground.js` `demo`): the yard's hand, mirrored so the screen's corner cuts none of it, pulls the right pebble in twice and lets it spring back. Pulling a pebble ends it for good. With reduced motion the hand rests on the pebble without moving; with no storage it does not show, so it cannot come back every time.
- **No scatter.** The season's daisies, petals, leaves and winter tufts laid over the lawn were 4 to 8 px at the strip's size and read as specks, so they are gone. Winter keeps its snowy lawn and pebble; the other seasons show in what falls around a friend (`flurry.js`), which comes from something the person did.
- **Kept as it was:** the grass starts across the whole floor. A pointer resting 300ms on a corner still lets the pebble take the next click there, as over a full window's scrollbar or resize corner; this is looked at again only if it is reported.

## Follow-up: flower patches and press answers (2026-11-27)
Two parts of the desktop-first spike that were tried and left out are brought over:
- **One bloom or a patch.** Six flowers have a patch drawing (`patch` in `catalog.json`). In bloom, outdoors and on the desktop, they draw as the patch unless the plant is set to one bloom (`single` in the garden, `setSingleBloom`).
  - The yard's thing bar and the desktop's native menu offer **One bloom** and **A patch** as a checked pair, only in bloom, so a flower's kind stays a surprise until then.
  - The workshop has no soil: flowers there stay one bloom in a pot, and the pair is not offered.
- **A press answers** (`yard/press-answer.js`, `styles/answer.css`): a flower bobs and drops three of its own petals, a tree rustles and lets three leaves go (autumn colours only on a tree that turns, snow in winter), a gift bobs.
  - The same in the yard and on the desktop. A desktop gift with its own answer (a part that spins, a lamp, a find) keeps that answer instead.
  - One CSS animation on `scale` or `rotate`, so the breeze on `transform` goes on under it, and at most eight bits per thing that remove themselves; nothing joins the frame loop. Reduced motion shows none.

## Follow-up: 1.10.1 review and feedback (2026-11-27)
The rest of the desktop-first spike, and what a review and a tester found:
- **A friend's remark** (`press-answer.js` `remarker`): two presses in five, the nearest friend within 360 px says one of its visit lines about what was pressed, in the yard and on the desktop.
- **Arrivals** (`overlay/arrive.js`): `overlay.rs` marks what came out after the first sync as `arriving` for six seconds. A friend drops in and waves; a thing pops up and the nearest friend hops over. Once per coming out; reduced motion shows it in place.
- **The planting marker** shows the sapling on soil at the size it grows from (`planted-trees.js` `saplingPreview`); a spot refused greys and leans it with a drawn "no" sign.
- **Depth from one far line** (`field.js` `depthScaleAt`): on a place whose field top curves, depth was measured from the top at the friend's own x, so a walk toward the viewer that drifted sideways could shrink. It is measured from the place's far line now.
- **Walking around furniture** (`workspace.js` `wayAround`): a walk that would cross a workspace's furniture passes its corners, the shortest way; a seat on its back half is reached and left from behind. The way is measured once per target (`motion.js` `aimOf`), and strolls over furniture are not chosen.
- **Sizes follow the friend:** the walk ring scales by the friend's size and depth, and a patch takes its own width of ground (`growth.js` `plantBreadth`), so strolls and the waterer stay out of it.
- **Saving:** a failed write is retried five times, 80 ms apart, unless the disk is full or read-only, and each failure leaves a line in `save-errors.log` (`store.rs`). The notice names a full disk only when it is one.
