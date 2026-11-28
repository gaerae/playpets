# Natural walking (2026-11-26)

Friends move like characters in a game: legs pass each other and arms swing against them, feet stay where they step, a friend faces the way it goes (sideways, toward you, away from you), runs in a game, and walks where you point. The owner asked for quality first: new art for the four friends, and the best effect the code can give every other pet.

## What is wrong today

| # | Where | What | What a person sees |
|---|---|---|---|
| 1 | Walk rows of the sheets (rows 1–2) | One held stride that wiggles: the legs never pass, the arms never change sides | No alternating limbs |
| 2 | `src/yard/motion.js`, `src/overlay/overlay.js` | The walk's cells follow the clock (1.06 s a cycle), not the distance walked: a stroll moves 0.85 bodies a cycle, a walk 2.1 | Feet slide over the ground |
| 3 | `core/animation.js` rows | The walk's last cell shows 220 ms, the others 120 ms | A hitch every cycle |
| 4 | `src/styles/friends.css` `stroll` | A bob every 0.3 s (0.42 s on a stroll) against drawn steps every 0.53 s, and a ±2° rock | Floating, a metronome sway |
| 5 | `motion.js` `pose(v, dx >= 0 ? 'right' : 'left')` | Strolls go any way (`wander.js`), but only side rows exist, chosen by the sign of dx | Walking up or down the field sideways; straight up or down always faces right |
| 6 | `games.js` `GAME_PACE` | Games go up to four times a stroll's pace with the walk row | A scurry instead of a run |
| 7 | `desktop/roam.rs` | A fixed 0.09 px/ms whatever the friend's size; it stops dead on arrival | Small friends slide; a pop at the stop |

- The creator kit's state-row prompt spells out jump's eight poses but leaves walking to the model (`assets/creator-kit/*/prompts/04-state-row.txt`).
- `assets/pets/README.md` already says some walks keep a shuffle-like stride.
- A spike redrew Daisy's base right row with a gait guide: the legs pass and the arms swing, her look kept (`scratch/walk-spike/`, not kept).

## Goals

- Every pet, imported ones included: planted feet, even steps, a bob in time with them, a look before it sets off, curved paths, a stop with its feet together, a turn without a pop.
- The four friends that ship (Daisy, Clover, Pip, Miso), in all three outfits: a real walk cycle sideways, a walk toward and away from you, and a run.
- A pet without front, back or run art still faces and moves as well as its sheet allows.
- A press on open ground sends the selected friend there.
- A pet made with the creator kit from now on can have all of it.

## Non-goals

- The site-only example pets (Aria, Noah, Mochi, Smoky, Tabby): a later round.
- Cutting sprites into parts and moving limbs in code: imported pets cannot be rigged and the flat painted style would break.
- The landing's preview strips: they keep the sheet's own timing.
- Steering a friend with keys, or several friends at once.

## Anti-goals

- A friend that no longer looks like itself (face, outfit, satchel side, height).
- Extra drawing while friends stand, or a canvas redrawn more often than a walk's cells change.
- A bob added on top of art that already rises and falls.
- A press meant for a tool, a gift or a friend that walks a friend away instead.

## Approaches

| Approach | Covers | Cost | Chosen |
|---|---|---|---|
| A. Code only | Sliding, hitch, bob, turns, paths, facing as well as two rows allow | Small | Yes |
| B. New art on top of A | Alternating limbs, front and back walks and a run for the four friends; the kit for new pets | 72 rows, each through a gate | Yes |
| C. Limbs moved in code | — | Breaks the style; impossible for imported pets | No |

- The owner chose A and B together, and the press to walk.

## A. Movement in code

### The gait

- Three gaits: a stroll (`STROLL`), a walk (`WALK`, errands) and a run (games' `GAME_PACE`).
- A walk keeps `walked`: the distance since it set off, in body lengths (the unit `motion.js` paces in), so a friend far up the field, drawn smaller, steps as often for the same ground.
- The row's cell is `floor(8 × walked / stride + start) mod 8`.
- The row's phase comes from its art, measured once per row as `bodyOf` measures the body (`core/sprites.js`):
  - the feet's spread in each cell: the width of the opaque pixels in the bottom band;
  - the contact cells are the two widest, four apart; the passing cells are the narrowest between them;
  - a walk starts on a passing cell (`start`), the pose nearest to standing;
  - a row with no clear widest pair (all spreads within 10 %) is taken as drawn: contact 0 and 4.
- `stride` (one cycle, two steps) is twice the contact spread, clamped to 0.5–1.2 cell widths.
- Faster steps the same stride, down to 70 ms a cell (560 ms a cycle). Past that the cadence holds and the feet slide a little: the best effect at a pace the art was not drawn for.
- A run uses the run clip where there is one (B), with its own stride; otherwise the walk row at the floor's cadence.
- Every cell of a walk shows for the same distance; the 220 ms last cell no longer hitches it. The rows table and the site keep the sheet's own timing.

### Waking for cells

- Walkers no longer share one clock, so cell ends no longer line up.
- The loop keeps today's rule (`app.js interval`): at most one early wake between two paced frames, aimed at the walker whose cell ends first.
- At any wake, a walker whose cell ends within the next 25 ms takes its next cell then, so a cell is at most 25 ms early or late.
- Budget: walking costs no more CPU than on `main` with four friends walking (`scratch/ux/measure-ab.mjs`); the number of wakes cannot grow, as the cap is the same.

### Facing

- On the screen, in pixels (depth included): a way within 40° of across is a side walk; nearer the vertical, a walk toward you (down the field) or away from you (up it).
- A facing changes only once the way has been past the boundary by 10°, so a path near 40° does not flicker.
- A pet with only side rows:
  - its strolls keep within 35° of across (`wanderTarget` chooses its angles there); a target further up or down is reached in two legs, a zig;
  - the vertical part left (an errand, a game) is walked in the side row it last faced, legs moving by distance.

### Setting off, the path, stopping, turning

- **Setting off:** a friend standing still first looks the way it will go (the look rows, 16 ways, every v2 sheet) for one look turn, then steps off.
- **The path:** the heading turns at most 180° a second, so a new target is reached in an arc; `strollClear` still checks the line it will walk, now the arc's chord at each step.
- **Stopping:** in the last half-stride the cycle eases to the next passing cell, so a friend stops with its feet together. The lean into a change of pace stays (`motion.js` tilt).
- **Turning back:** the idle row's first cell (facing front) for one cell, then the new row from its passing cell. Between side and front or back, the front cell too.

### The bob

- The CSS `stroll` animation (bob and ±2° rock) goes.
- Art that rises and falls by itself keeps its own motion: a row whose cells' tops vary by 1.5 % of the figure's height or more gets no bob.
- Other rows get a bob drawn with the cell: lowest on the cells after contact, highest on the cells before it, 1.5 % of the figure's height. It changes only with the cell, so it costs no extra redraw.
- Reduced motion: no walk, as today.

### The desktop

- `roam.rs` paces in body lengths, as the yard does: 0.0007 a millisecond (today's pace for a Medium friend), so a small friend steps as a large one does.
- It slows into a stop over the last body length, as `core/physics.js` does in the yard.
- Each position it sends carries the distance left to the target (`layout_of`), so the overlay eases to a passing cell before the stop.
- A walk the pointer cuts short (`target = None`) settles in place to the nearest passing cell over at most two cells.
- The overlay counts `walked` from the positions it is sent, and walks sideways only (the floor).

### Walking where you point

- A press on open yard ground sends the selected friend (`state.js pet()`, the friend the Play board and the chat show) there, at walking pace, by the same path rules; with none selected, the friend nearest the spot.
- A small mark in the house style (a ring of grass bent outwards, drawn through Codex) shows the spot until the friend reaches it, then fades.
- A press does not walk a friend when:
  - a tool is on (planting, digging, decorating, fishing) or a game runs;
  - it lands on a friend, a gift, a plant, a tree, water or anything with its own press;
  - it ends a drag, or a panel, menu or dialog is open.
- A spot it cannot stand on (water, under the dock) is moved to the nearest ground it can, as `groundAllows` decides.
- The friend says nothing; a friend at work (`duty.js`) or away does not go.
- With the keyboard: none this round.

## B. New art

### Scope

| Art | Ways | Outfits | Rows | Where it lives |
|---|---|---|---|---|
| Walk | right, left | base, summer, winter | 24 | Sheet rows 1–2 (portable) |
| Walk toward you, away from you | front, back | base, summer, winter | 24 | `actions.json` clips `walk-front`, `walk-back` (app-owned, as the game poses) |
| Run | right, left | base, summer, winter | 24 | `actions.json` clips `run-right`, `run-left` |

- For the four friends. The other rows, the game poses and their timings stay.
- Order: side walks, then front and back, then runs. Each stage goes through the gate for all four friends before the next starts.

### How each row is made

- Codex's built-in image tool, as the 2026-11-24 Daisy rows were made.
- References for each friend:
  - its own current row (identity, cells, scale) and its outfit's idle row as the approved look; Daisy's are the redrawn ones on this branch, the other three's the shipped sheets;
  - a gait guide (`gait-guide.png` and its front, back and run versions: grey mannequins, limb positions only);
  - for the back view, the creator kit's `turnaround.png`.
- **Base right** first. **Base left** is an edit of the accepted right row, mirrored, as the pose reference, with handed details (satchel side, hair part, markings) as in the friend's own left row. **Summer, winter** are outfit edits of the accepted base rows that keep the poses.
- The walk's eight poses: 1 contact (near leg forward, far arm forward), 2 down, 3 passing, 4 up, then the same with the other leg (5–8). Arms swing against the legs; a dress, a scarf or a tail sways with them.
- The run's eight: two flights where both feet leave the ground, a longer reach, arms bent and swinging further, the body leaning forward.
- Front and back walks: the same cycle seen from in front and behind; the body rises and falls, the arms swing at the sides.
- The animal friends walk and run upright as they do today.
- Each row is cleaned (`clean.py`), given full alpha where the tool stopped at 253, and packed with `pack-companion-batches.mjs` at the friend's idle height; clips are cut and anchored as the game poses are (`actions/unpack.py`).

### The gate

- A row is accepted only when all of these hold:
  - eight separate figures on a transparent background;
  - height within 3 % of the outfit's idle row, feet on one baseline (±3 px in a 208 px cell);
  - the legs pass: the feet's spread in the passing cells is at most three quarters of the contact cells';
  - the same friend: side by side with the idle row at the app's and the small window's size, light and dark, with no changed face, outfit or handed detail;
  - played in the yard at 1180 px and in the small window, and on the desktop for side rows.
- Up to four tries a row, two candidates a try. A row that never passes keeps today's art (or, for a clip, none), and A carries it; the source record says so.
- The builder accepts rows by the gate. The owner sees each stage's result for all four friends, as moving comparisons with today's, before the next stage.

### The creator kit

- The state-row prompt names the walk's eight poses for rows 1 and 2, as it names jump's.
- `--actions` can make `walk-front`, `walk-back`, `run-right` and `run-left` with the same prompts and guides.
- The kit ships the gait guides; `kit.json` lists them. The website's kit request and the skill instructions stay consistent (`scripts/README.md`).

### Records

- Sources in `assets/sources/walk-2026-11-26/<friend>/<outfit>/`, with `accepted-art.json` (prompts, references, tries) and a README.
- `assets/pets/README.md` drops the shuffle-stride note for the four friends.

## Checks

- Tests first (`tests/`, Rust tests in `roam.rs`, `overlay.rs`):
  - cells by distance, not time, and a friend far up the field stepping as often for the same ground;
  - the phase measured from the feet, the drawn order when no pair stands out;
  - start and stop on a passing cell; the turn cell; the look before setting off;
  - facing by angle with its margin; side-only pets' strolls kept near across;
  - a bob only for art without its own; no `stroll` keyframes on a walking canvas;
  - the wake rule: one early wake between paced frames, a cell at most 25 ms off;
  - the desktop's pace in body lengths, its slow stop and the distance left in each position;
  - a press on ground walks the selected friend, and none of the exceptions above does.
- `pnpm test`, `pnpm run lint`, `pnpm run test:e2e` on a desktop session, `pnpm run assets:webp`, `pnpm run site:build`.
- CPU with four friends walking compared with `main`.

## Left to the builder

- The exact clamps (stride, cadence floor, bob height, turn rate) tuned by eye within the ranges above.
- The mark's size and how long it fades.
- How tries are named in the source folder.

## Follow-up (2026-11-27)

- The ring of bent grass read as a target painted on the ground, and it was large. The mark is now a small star pin over the spot (a paw print was dropped: friends are not all animals) (`ambient/walk-pin.png`), dropping in and bobbing, with only a small soft shadow on the ground (garden.css `.walk-mark`, `.walk-pin`). It still scales by the friend's size and depth.
