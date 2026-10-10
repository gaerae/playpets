# Standard: Page and backend performance

## Applies to
Code that keeps running as long as the app is open. This covers the drawing loops of the yard and the overlay (`src/app.js`, `src/overlay/overlay.js`, `src/yard/`), CSS animations (`src/styles/`, `src/overlay/overlay.css`), the overlay thread (`src-tauri/src/desktop/overlay.rs`), and state saving (`app::persist`, `app::persist_soon`).

Not covered: code that runs only when a person clicks once (importing, saving settings, one chat message). The [locks standard](backend-locks.md) keeps that code from freezing.

## Rules
- Drawing loops do not use `requestAnimationFrame`; they use `every(interval, frame)` from `src/core/ticker.js`. The frame function can return the next interval.
- The yard draws every 50ms while a friend moves (walking, poses, play, aiming a treat), every 66ms in rain and while birds or a shooting star cross, every 80ms in snow, and every 100ms otherwise. The overlay draws every 100ms. When you add new movement, add a condition to `interval()` in `app.js`.
- The weather canvas (`src/yard/scenery.js`) repaints only in a frame where something on it moved. Things drawn once stay drawn (stars; their twinkle is a CSS layer). Small life that would keep the canvas busy all day (butterflies, fireflies, falling petals and leaves) comes in spells with rests in between.
- Scenery that changes with the clock or the season (colours, the sun and moon, the moon's phase) is set as CSS custom properties once a minute, never animated.
- The painted backdrop (`src/yard/easel.js`) is painted only when the time of day, the weather or the season changes, or when the yard changes size, and stands still in between. Do not repaint it on a timer or for something that moves; moving things go on the weather canvas or in a CSS layer.
- Standing animations (state animations that are not poses) pick their cell from the shared clock (`now`), not from a per-friend time.
- A canvas redraws only when the visible cell changes (do not add a path that skips the cell key comparison in `drawSprite`).
- CSS animations move only `transform` and `opacity`. They do not animate layout properties such as `left`, `top`, or `width`.
- Do not use CSS variables (`var()`) inside CSS keyframes. Keyframes that contain variables do not run in the compositing stage.
- Do not draw when the window is not visible. Loops return right away when `document.hidden` is set or when the backend reports the window hidden (the `window` event, `<html data-unseen>`), and `data-unseen` stops CSS animations.
- The overlay thread does not ask the runtime for monitors on every tick (it uses the cache). When nobody is walking, nothing is being dragged, and the cursor is not within 300px of a friend, it rests at 120ms intervals.
- Frequent changes that are fine to lose (where a friend stopped walking) are batched and saved with `persist_soon`. Other changes are saved right away with `persist`.
- The yard's sounds (`src/yard/sound.js`) play only while they are on and the yard can be seen; otherwise the audio context is suspended and their timers are cleared. Their beds loop and drift inside the audio graph; the page wakes only for scheduled events (a gust, a wave, a call), never on a fast timer.
- Do not hold on to resources that decode large (sprite sheets, about 14MB each) for every pet. One minute after the Invite tab closes, the yard releases sheets it does not use.

The most recent measurements. Each value is the CPU of the app process plus the WebKit process, as a percentage of one core.

| State | CPU |
|---|---|
| Yard + desktop, walking | 7.5% |
| Yard + desktop, still | 8.7% |
| Desktop only (yard hidden) | 2.7% |
| All hidden | 0.2% |
| Yard only | 6.1% |
| Yard only, sounds playing | 8.6% |

Source: measured 2026-10-10, Apple M2 Pro, macOS 26.6.2, `npm run measure` (3 test pets, each state held for 30 seconds and measured from second 4 to second 16), after the yard's sounds were added. Most of the extra cost is WebKit's audio output itself. Compare only values from the same machine.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- For a PR that changes loops, animations, or the overlay thread, run `npm run measure` on the same machine before and after the change and attach the results to the PR description.

## Exceptions
| When | How |
|---|---|
| A new game really needs a tighter interval | Add it as a condition in `interval()` so it runs at 50ms only during that game. If it needs less than 50ms, attach measurements to the PR and a maintainer approves it |
| A CSS effect cannot move to the compositing stage | Allowed for short effects that run once (the response to a press). No exceptions for effects that loop forever |

## Rationale
Two performance reviews measured that the cost scales with the number of screen updates, not with the pixels drawn (about 0.6% CPU per update per second, measured 2026-09-30). The `requestAnimationFrame` loop woke WebKit on every display refresh even while skipping most of them, and the `left` animation recalculated layout every frame. After applying the rules above, CPU with 3 pets and both the yard and desktop on dropped from 23–25% to around 11%.
Based on: decisions “[The page draws often only when something moves, and drawing loops run on timers](../decisions/2026-09-30-timer-frame-loops.md)”, “[Never wait on the main thread while holding the app state lock](../decisions/2026-09-30-no-waiting-on-main-thread-under-state-lock.md)”

## Automated checks
There are no automated checks. `npm run measure` is a measurement a person runs on macOS and Linux; CI does not run it (load varies by runner, so there is no baseline). On Windows, watch the CPU of the `msedgewebview2` process in Task Manager.

## Change history
- 2026-10-01 First version — measurements are from the first run of `npm run measure`
- 2026-10-09 The painted backdrop is painted only when the light or the size changes; new measurements
- 2026-10-10 The yard's sounds: they play only while on and seen; a measured state with them playing
