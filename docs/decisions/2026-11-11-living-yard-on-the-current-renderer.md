# Decision: Make the yard livelier on the current renderer before reaching for a game engine

## Context
- The yard read as still: friends waited, walked in a straight line and stood one size anywhere on the field, and the place was one painted picture.
- A move to a WebGL renderer (PixiJS 8, with Spine or DragonBones for rigged animation) or to an engine (Unity, Godot, Bevy) was considered.
- The causes were in motion logic and content, not in the renderer:

| What looked still | Cause | Renderer needed |
|---|---|---|
| Friends wait 8 to 20 s, then walk in a straight line | Idle planning (`wander.js`, `motion.js`) | No |
| No depth | Draw order followed the field, size did not | No |
| Strolls ended on a tree or a flower | Strolls ignored the ground that `ground.js` already measured | No |
| The place does not move | One painted picture per place and season | Mostly no; it is art |
| Imported pets move little | A 9-row sheet is all the frames there are | No renderer adds frames |

- What a move would cost:
  - Friends are DOM buttons: name tags, bubbles, clicks on drawn shapes, keyboard focus, screen readers and the e2e scenario rely on them.
  - The page has no bundler and no runtime dependencies.
  - PixiJS draws on every display refresh by default; the yard draws on timers (`core/ticker.js`) because that wakes WebKit far less ([timer frame loops](2026-09-30-timer-frame-loops.md)).
  - WebGL in a transparent window on Linux (WebKitGTK) and in the desktop overlay was not checked.

## Decision
- Keep Canvas 2D and DOM. Add life where it costs little:

| Change | Where | How it runs |
|---|---|---|
| A friend farther back is drawn smaller, down to 0.84 at the ridge | `field.js depthScale`, `views.js place` | `scale` on the friend's button, about its feet; written only when it changes |
| A walking friend bobs and leans at each step, more slowly on a stroll | `friends.css .walking` | CSS animation on the compositor |
| A friend settles with a short squash as it stops | `motion.js` | One Web Animation |
| A stroll keeps out of the water and does not end on a tree, a flower or a gift | `wander.js strollClear` | Checked once per stroll |
| Trees and flowers sway outdoors | `garden.css breeze` | CSS animation on the compositor |

- A loop that runs on the compositor and asks nothing of the page may run while the yard is shown ([performance](../standards/performance.md#css-animations)).
- A WebGL layer is reconsidered only when all of these hold:
  - the yard still reads as still after the changes above and new layered art;
  - the effect wanted needs a shader (wind through a whole meadow, reflections, light);
  - the same scene drawn both ways and measured with `pnpm run measure` shows WebGL cheaper or the 2D version too slow.
- If one comes, it is one background layer under the DOM friends, not a rewrite of the yard.

## Consequences
- Positive: no new dependency, and friends keep their tags, focus, clicks and tests.
- Positive: every new motion stops under reduced motion and pauses while the window is unseen.
- Negative: shader effects stay out of reach; a living background needs drawn layers (cut-out canopies, water loops), which is art work.
- Neutral: a drawing farther back shrinks, and so does where it takes a press; its tag keeps its size.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Move the yard to PixiJS 8 now | It fixes none of the causes above, and friends' tags, focus and clicks would be rebuilt |
| Move to Unity, Godot or Bevy | A second app shell, and the coding-agent bridge, the overlay and the four-language page would be rebuilt |
| Run the yard on `requestAnimationFrame` for smoother motion | It wakes WebKit on every display refresh; compositor animations give the same smoothness without it |
