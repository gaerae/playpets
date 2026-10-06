# Decision: The page draws often only when something moves, and drawing loops run on timers

## Context
The yard and the desktop overlay draw sprite animation and weather on a canvas. Two performance reviews showed where the cost comes from. It was proportional not to the number of pixels drawn but to **the number of screen refreshes in which the canvas changed**. When the canvas changes, WebKit recomposites the window, and that work spans three processes: the app, the GPU and the display (about 0.6% CPU per refresh per second, measured 2026-09-30). Both loops used `requestAnimationFrame`, waking on every display refresh (60 to 120 Hz) and skipping most of them, and the clouds moved by CSS `left`, which recomputed the layout of the whole yard on every frame.

## Decision
We run page loops on timers at the interval they need (`src/core/ticker.js`). The yard draws every 50 ms when there is walking, a pose, a game, treat aiming, or rain or snow, and every 100 ms when the friends are only standing. The overlay draws every 100 ms. Standing animation advances frames on a shared clock rather than one per friend, so several friends change together. CSS animations move only `transform` and `opacity`, which go through compositing alone, and keyframes do not use CSS variables. When the window is not visible (`document.hidden`, or hidden and minimized as reported by the backend), the loops rest and CSS animations pause too.

## Consequences
- Positive: With 3 pets, CPU dropped from 23–25% to around 11% with the yard and the desktop both on, and from 18–30% to around 9% with only the yard on (the method and latest values are in the [Page and backend performance standard](../standards/performance.md)).
- Negative: Timers are not synced with display refresh, so walking can show slight jitter. In a quiet state it is 10 frames per second, so rain and snow particles get their own 50 ms.
- Neutral: New loops have to use `every()`, and every new motion condition (`busy`) means measuring the cost again.

## Alternatives considered
- **Keep `requestAnimationFrame` and only draw less:** Even when drawing is skipped, the cost of waking on every refresh and keeping the display link alive remains (confirmed by sampling).
- **Move sprites as DOM elements instead of a canvas:** Compositing gets cheaper, but sprite sheet cell switching and gaze direction would all have to be rewritten, and no gain was measured.
