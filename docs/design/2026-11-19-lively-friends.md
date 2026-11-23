# Lively friends (2026-11-19)

## Why

- People said a friend standing still moves too much, and stiffly: its face and body do not react, they jump.
- A standing friend plays its sheet's idle row without a pause: six cells (a tilt, closing eyes, opening them) every 1.1 s, all day. It reads as fidgeting, and the desktop spends most of its drawing on it ([performance](../standards/performance.md): 3.7% CPU with the cycle, 0.8% without).
- A look at the pointer jumps to one of 16 drawn directions and back, face and body together.
- A walk starts and stops at full pace. Only a 0.26 s squash marks the stop.
- Every walk's pace is now counted in body lengths in one place (`motion.js`, since #128), so a small physics written once looks the same in every window and depth.

## Goals

- A standing friend mostly stands, and now and then does its idle gesture, at its own moments.
- A look turns toward the pointer and back instead of jumping.
- A walk speeds up, slows into its stop and leans with it. A friend put down falls the last bit and lands. A jump lands.
- A friend in the yard has a shade on the ground that shrinks as it is lifted, sized by depth like the friend.

## Non-goals

- No joints. A Codex pet sheet carries no skeleton: a head cut at the neck shows seams where hair or hands cross it, and imported friends could not be checked. Reconsidered only if stiffness remains after this, and then for the bundled friends only, with an optional neck line in their files.
- No breathing loop. A steady compositor animation runs all day on every friend, which is the cost this design removes.
- No new frames and no changes to pet files.
- The desktop's walks and drops are placed by the backend (`desktop/overlay.rs`); this design changes how desktop friends stand and look, not how they walk.

## Anti-goals

- Friends who wobble, bounce or slide past where they were going.
- Steady drawing in a yard where friends only stand.
- Motion with reduced motion turned on.

## Rules

| What | Rule | Why |
|---|---|---|
| Idle rhythm | Time is cut into 3.6 s beats (`IDLE_BEAT`). In 60% of them a standing friend plays its idle row once (1.1 s), starting 0.5 to 2 s into the beat; otherwise it shows the row's first cell. Two gestures start at least 2.1 s apart and leave at least 1 s of rest between them. Which beats and when come from a seed of the friend's canvas, so friends do not move together. Yard, desktop, panel portrait and the invite previews alike (`drawSprite`) | A gesture every 6 s on average instead of every 1.1 s |
| Idle actions | Every 8–20 s an idle friend in the yard picks: a stroll 88%, a pose 12%. A pose is a wave, or a jump one time in four (never a jump when the yard is quiet) | Big gestures become rare |
| Turning | A look changes its drawn direction by at most one of the 16 per 60 ms (`TURN_MS`), the shorter way round. It starts at the pointer's direction; once the look ends the last direction holds 250 ms (`LOOK_HOLD`) before the friend stands again | Moving the pointer round a friend turns it instead of jumping; a pointer leaving does not snap it back |
| Pace ramp | A walk reaches its pace in 240 ms (`RAMP_MS`) and slows so it would stop at its target: its pace is at most √(2·a·left) and at least 15% of the pace, `a` being the pace over `RAMP_MS`. In body lengths, like the pace. A walk cut short leaves the friend standing, so the next one sets off from a stand; a stop on the way to the next one (a trail's prints, `sendTo` `through`) is walked through at the pace, without slowing or a squash | It sets off and arrives instead of starting and stopping at full speed |
| Lean | The body (the friend's button, about its feet) tilts: forward up to 3° while it speeds up and back while it slows, toward the pointer by 1.5° while it looks, and against the pull up to 8° while it is carried (1.5° per body length a second). A spring follows the target (stiffness 180/s², critically damped) and settles in about 0.4 s; written only when it changes by 0.1° | Weight shows without frames |
| Put down | A carried friend is lifted 10% of its height off its feet. Let go, it falls that height under gravity (9 body lengths/s², about 150 ms, faster as it goes), then squashes as it does at a stop | A friend set down lands |
| Jump | When a jump pose ends, the friend squashes as at a stop | The jump lands |
| Shade | A soft ellipse at the feet, inside the friend's button, so it takes its depth. It stays on the ground while the friend is lifted, smaller and fainter. The same earth brown as a flower's shade (`garden.css` `.plant::before`). Not on the desktop, where there is no ground | The friend stands on the field |
| Reduced motion | No idle gesture, turn, ramp, lean, lift, fall or squash: a standing friend shows one cell, a look its direction at once, a walk is set down where it goes (as before) | The meaning stays without motion |
| Frame loop | The ramp and the lean are worked out in `moveFriends`. The yard stays at its busy pace while a friend turns or a lean settles (`pace()`); a friend standing still with no lean adds nothing. The desktop wakes when the next idle cell or turn step is due (`overlay/pace.js`) | Movement costs only while it moves |

## Code

- `src/core/animation.js`: `idleCell` and `idleLeft` (the idle rhythm), `turnStep` (one turn step), `lookDirection`.
- `src/core/sprites.js` `drawSprite`: draws the idle rhythm and the turn; the canvas keeps its seed, its direction and when it last turned.
- `src/core/physics.js`: pure rules for the pace ramp, the lean spring and the fall.
- `src/yard/motion.js`: the ramp, the lean and the squash after a jump; `src/yard/views.js`: the lift, the fall and the shade; `src/overlay/pace.js`: wakes for the idle rhythm and a turn.
- `src/styles/friends.css`: the lift and the shade.

## Considered and dropped

- Cutting the head from the body at a neck line found from the sprite's outline: daisy's hands rest under her chin and her hair falls past her shoulders, so the cut shows.
- A breathing scale on every standing friend: see Non-goals.

## Follow-up: after review (2026-11-19)

- A carried friend swings with the pull instead of against it: held up top, its feet trail and its top leads, up to 8°. Leaning against the pull read as the friend pulling away from the hand.
- The lean is the `--lean` custom property on the friend's button (`rotate: var(--lean)`), and the shade turns back by the same angle, so it stays level on the ground while the body leans.
- A drag the system cancels (`pointercancel`) sets the friend back where it started, with no fall from the lift and no squash: it was never let go over the yard.
- The site's yard and desktop previews (`WorldPreview.vue`, `HeroDesk.vue`) follow the idle rhythm in CSS (`landing.css` `sprite-rest`): a standing friend plays its idle row in the first 1.1 s of a 6 s cycle and holds the first cell for the rest, each friend from its own point in the cycle. Every gesture plays, not 60% of them: a fixed cycle needs no script.

## Follow-up: the desktop rests while nobody is with its friends (2026-11-23)

- A friend on the desktop plays its idle gesture in 30% of beats (`CALM_SHARE` in `overlay/pace.js`) instead of 60%: about one gesture every 12 s.
- The gesture itself is unchanged: the same cells, timing and moment in the beat.
  - The calm gestures are a subset of the yard's (the same draw from the seed), so switching between the two never cuts into a gesture.
- A friend is as lively as in the yard for a minute (`LIVELY_MS`) after any of these:
  - it comes out;
  - the person points at it, holds it or pats it;
  - it gets a status, a line or a visit.
- Livening takes effect from the next beat (`liven` in `core/animation.js`), so the beat under way is never cut into.
- The yard, the panel portrait and the invite previews keep the yard's rhythm.
- Why: each cell a desktop friend shows redraws its full-screen window. With four friends standing, the idle gestures were most of the overlay's CPU ([performance](../standards/performance.md)).
