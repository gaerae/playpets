# Standard: Page and backend performance

## Applies to
- Code that keeps running as long as the app is open:
  - the drawing loops of the yard and the overlay (`src/app.js`, `src/overlay/overlay.js`, `src/yard/`)
  - CSS animations (`src/styles/`, `src/overlay/overlay.css`)
  - the overlay thread (`src-tauri/src/desktop/overlay.rs`)
  - state saving (`app::persist`, `app::persist_soon`)
- Not covered: code that runs once per click (importing, saving settings, one chat message). The [locks standard](backend-locks.md) keeps that code from freezing the app.

## Rules
### Drawing loops
- Drawing loops use `every(interval, frame)` from `src/core/ticker.js`, not `requestAnimationFrame`.
- The frame function can return the next interval.
- Draw intervals:

| State | Interval |
|---|---|
| Yard, while a friend moves (walking, poses, play, aiming a treat) | 50ms |
| Yard, in rain and while birds or a shooting star cross | 66ms |
| Yard, in snow | 80ms |
| Yard, otherwise | 100ms |
| Overlay | 100ms |

- New movement adds a condition to `interval()` in `app.js`.
- Do not draw when the window is not visible.
  - Loops return right away when `document.hidden` is set or when the backend reports the window hidden (the `window` event, `<html data-unseen>`).
  - `data-unseen` stops CSS animations.

### Canvases and scenery
- The weather canvas (`src/yard/scenery.js`) repaints only in a frame where something on it moved.
- Things drawn once stay drawn (stars; their twinkle is a CSS layer).
- Small life that would keep the canvas busy all day (butterflies, fireflies, falling petals and leaves) comes in spells with rests in between.
- Scenery that changes with the clock or the season (colours, the sun and moon, the moon's phase) is set as CSS custom properties once a minute, never animated.
- The painted backdrop (`src/yard/easel.js`) is painted only when the time of day, the weather or the season changes, or when the yard is resized. It stays still in between.
  - Do not repaint it on a timer or for something that moves.
  - Moving things go on the weather canvas or in a CSS layer.
- Standing animations (state animations that are not poses) pick their cell from the shared clock (`now`), not from a per-friend time.
- A canvas redraws only when the visible cell changes.
- Do not add a path that skips the cell key comparison in `drawSprite`.

### CSS animations
- Move only `transform` and `opacity`. Do not animate layout properties such as `left`, `top` or `width`.
- Do not use CSS variables (`var()`) inside keyframes. Keyframes that contain variables do not run in the compositing stage.

### Backend, sound and memory
- The overlay thread does not ask the runtime for monitors on every tick (it uses the cache).
- With nobody walking, nothing dragged and the cursor not within 300px of a friend, it rests at 120ms intervals.
- Frequent changes that are fine to lose (where a friend stopped walking) are batched and saved with `persist_soon`.
- Other changes are saved right away with `persist`.
- The yard's sounds (`src/yard/sound.js`) play only while they are on and the yard is visible.
- Otherwise the audio context is suspended and the sound timers are cleared.
- Sound beds loop and drift inside the audio graph.
- The page wakes only for scheduled events (a gust, a wave, a call), never on a fast timer.
- Do not keep resources that decode large (sprite sheets, about 14MB each) for every pet.
- One minute after the Invite tab closes, the yard releases the sheets it does not use.

### Recorded baseline
- This baseline predates the later raster artwork and place changes. It is not a benchmark of the current release.
- Each value is the CPU of the app process plus the WebKit process, as a percentage of one core.

| State | CPU |
|---|---|
| Yard + desktop, walking | 7.5% |
| Yard + desktop, still | 8.7% |
| Desktop only (yard hidden) | 2.7% |
| All hidden | 0.2% |
| Yard only | 6.1% |
| Yard only, sounds playing | 8.6% |

- Source: measured 2026-10-10, Apple M2 Pro, macOS 26.6.2, `npm run measure` (3 test pets, each state held for 30 seconds and measured from second 4 to second 16), after the yard's sounds were added.
- With sounds playing, most of the extra cost is WebKit's audio output itself.
- Compare only values from the same machine.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- For a PR that changes loops, animations or the overlay thread, run `npm run measure` on the same machine before and after the change, and attach the results to the PR description.

## Exceptions
| When | How |
|---|---|
| A new game really needs a tighter interval | Add it as a condition in `interval()` so it runs at 50ms only during that game. Below 50ms: attach measurements to the PR, and a maintainer approves it |
| A CSS effect cannot move to the compositing stage | Allowed for short effects that run once (the response to a press). No exceptions for effects that loop forever |

## Rationale
- Two performance reviews found that the cost scales with the number of screen updates, not with the pixels drawn (about 0.6% CPU per update per second, measured 2026-09-30).
- The `requestAnimationFrame` loop woke WebKit on every display refresh, even while skipping most of them.
- The `left` animation recalculated layout every frame.
- With the rules above applied, CPU with 3 pets and both the yard and desktop on dropped from 23–25% to about 11%.
- Based on: decisions “[The page draws often only when something moves, and drawing loops run on timers](../decisions/2026-09-30-timer-frame-loops.md)”, “[Never wait on the main thread while holding the app state lock](../decisions/2026-09-30-no-waiting-on-main-thread-under-state-lock.md)”

## Automated checks
- None.
- `npm run measure` is run by hand on macOS and Linux.
- CI does not run it: load varies by runner, so there is no baseline.
- On Windows, watch the CPU of the `msedgewebview2` process in Task Manager.

## Change history
- 2026-10-01 First version — measurements are from the first run of `npm run measure`
- 2026-10-09 The painted backdrop is painted only when the light or the size changes; new measurements
- 2026-10-10 The yard's sounds: they play only while on and seen; a measured state with them playing
