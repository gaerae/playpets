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
| Yard, while creatures fly or petals and leaves fall | 50ms |
| Yard, in rain and while birds or a shooting star cross | 66ms |
| Yard, in snow | 80ms |
| Yard, otherwise | 100ms |
| Yard, while it cannot be seen (nothing is drawn) | 1000ms |
| Overlay | 100ms |
| Overlay, with no friend on its monitor | none: the loop rests until one comes |

- New movement adds a condition to `pace()` in `app.js`.
- While a friend walks, the yard also wakes when a step of its walk ends (`cellEnds`, set in `motion.js`), never sooner than 8ms, so each 120ms step shows for its own length.
  - All walks share one clock, as standing animations do: one wake serves every walker.
  - At most one such wake comes between two frames at the table's interval: no more than 29 wakes a second while friends walk (20 at the interval, one per 120ms step).
  - Standing and gestures wake nothing extra: friends that only stand keep to 10 a second.
  - The weather canvas still moves only at the interval in the table, counted from its last repaint.
- Between steps the compositor carries a moving friend: `moveTo` in `src/core/ticker.js`.
  - It starts a short linear Web Animation from where the friend shows to its new place: 64ms in the yard, 52ms on the desktop, a little longer than a step.
  - Not on a friend's first placing, not while it is held, not with reduced motion.
  - Use it, not a CSS transition: WebKit starts a transition that replaces another a frame late, so the friend stops once every step.
- Something that cycles on a canvas (a wing beat) spans at least six frames at the interval it is drawn at. A faster cycle is drawn at scattered points and flickers.
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
- A loop that runs on the compositor and asks nothing of the page may run while the yard is shown:
  - the clouds' drift;
  - the breeze in trees and flowers (`garden.css`);
  - a walking friend's step (`friends.css`).
- Such a loop pauses under `data-unseen` and stops with reduced motion. A loop that needs the page (a canvas, a style written each frame) is a drawing loop and follows the rules above.
- Do not use CSS variables (`var()`) inside keyframes. Keyframes that contain variables do not run in the compositing stage.

### Backend, sound and memory
- The overlay thread does not ask the runtime for monitors on every tick (it uses the cache).
- With nobody walking, nothing dragged and the cursor not within 300px of a friend, it rests at 120ms intervals.
- With nothing out and no window open, it waits to be woken: a change to what is out wakes it at once. It looks in every 2 seconds only as a safety net.
- A monitor's window stays 60 seconds after the last thing on it leaves, or after the yard opens the menu of something not out yet; then it closes.
  - Building a window and loading its page takes most of a second, and something sent out again soon then shows at once.
  - While it is kept with nothing on it, its page draws nothing and the thread looks in every 400ms only to close it in time.
  - The switch that brings everything in closes the windows at once.
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

- Source: measured 2026-10-10, Apple M2 Pro, macOS 26.6.2, `pnpm run measure` (3 test pets, each state held for 30 seconds and measured from second 4 to second 16), after the yard's sounds were added.
- With sounds playing, most of the extra cost is WebKit's audio output itself.
- From 2026-11-11, `pnpm run measure` also plants four flowers in bloom and two grown trees in the woodland. The values above were measured without a garden.
- Runs on the same machine differ by several points when anything else is busy. Compare medians of alternating runs (before, after, before, after).
- Compare only values from the same machine.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- For a PR that changes loops, animations or the overlay thread, run `pnpm run measure` on the same machine before and after the change, and attach the results to the PR description.

## Exceptions
| When | How |
|---|---|
| A new game really needs a tighter interval | Add it as a condition in `pace()` so it runs at 50ms only during that game. Below 50ms: attach measurements to the PR, and a maintainer approves it |
| A CSS effect cannot move to the compositing stage | Allowed for short effects that run once (the response to a press). No exceptions for effects that loop forever |

## Rationale
- Two performance reviews found that the cost scales with the number of screen updates, not with the pixels drawn (about 0.6% CPU per update per second, measured 2026-09-30).
- The `requestAnimationFrame` loop woke WebKit on every display refresh, even while skipping most of them.
- The `left` animation recalculated layout every frame.
- With the rules above applied, CPU with 3 pets and both the yard and desktop on dropped from 23–25% to about 11%.
- Based on: decisions “[The page draws often only when something moves, and drawing loops run on timers](../decisions/2026-09-30-timer-frame-loops.md)”, “[Never wait on the main thread while holding the app state lock](../decisions/2026-09-30-no-waiting-on-main-thread-under-state-lock.md)”, “[Make the yard livelier on the current renderer before reaching for a game engine](../decisions/2026-11-11-living-yard-on-the-current-renderer.md)”

## Automated checks
- None.
- `pnpm run measure` is run by hand on macOS and Linux.
- CI does not run it: load varies by runner, so there is no baseline.
- On Windows, watch the CPU of the `msedgewebview2` process in Task Manager.

## Change history
- 2026-10-01 First version — measurements are from the first run of `pnpm run measure`
- 2026-10-09 The painted backdrop is painted only when the light or the size changes; new measurements
- 2026-10-10 The yard's sounds: they play only while on and seen; a measured state with them playing
- 2026-11-09 The yard's loop looks once a second, not ten times, while the window cannot be seen
- 2026-11-11 Loops on the compositor (the breeze, a walking friend's step) may run while the yard is shown; `pnpm run measure` plants a small garden
- 2026-11-13 The compositor carries a moving friend between steps; the yard wakes when a walking step ends, on one clock for all walks; creatures and falling petals keep the 50ms interval; wing beats span six frames
- 2026-11-14 The overlay thread is woken by a change to what is out; a monitor's window stays a minute after its last thing leaves and opens early from the yard's menu, and its page draws nothing while it has nobody
