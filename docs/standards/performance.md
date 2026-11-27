# Standard: Page and backend performance

## Applies to
- Code that keeps running as long as the app is open:
  - the drawing loops of the yard and the overlay (`src/app.js`, `src/overlay/overlay.js`, `src/yard/`)
  - CSS animations (`src/styles/`, `src/overlay/overlay.css`)
  - the overlay thread (`src-tauri/src/desktop/overlay.rs`)
  - state saving (`app::show_and_save`, `app::show_and_save_soon`, `app::commit_soon`, `app::persist_soon`)
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
| Overlay | when the first cell a friend shows ends (`nextDraw` in `src/overlay/pace.js`), never sooner than 8ms |
| Overlay, while a friend is held or looks at the pointer | 100ms |
| Overlay, with reduced motion | none: each friend shows one cell, and the loop rests until something changes |
| Overlay, with no friend on its monitor | none: the loop rests until one comes |

- New movement adds a condition to `pace()` in `app.js`.
- While a friend walks, the yard also wakes when its walk cell ends (`cellEnds`, set in `motion.js`), never sooner than 8ms, so a cell does not show for a frame too long.
  - A walk cell follows the ground covered, not a clock (`src/core/gait.js`), and shows at least 70ms (`CELL_FLOOR_MS`).
  - At most one such wake comes between two frames at the table's interval, aimed at the walker due first; every walker whose cell ends within 25ms takes its next cell then (`EARLY_MS`). No more than 40 wakes a second while friends walk (20 at the interval, one between each two).
  - Standing and gestures wake nothing extra: friends that only stand keep to 10 a second.
  - The weather canvas still moves only at the interval in the table, counted from its last repaint.
- Between steps the compositor carries a moving friend: `moveTo` in `src/core/ticker.js`.
  - It starts a short linear Web Animation from where the friend shows to its new place: 64ms in the yard, 52ms on the desktop, a little longer than a step.
  - After a step that came late, the glide lasts the gap since the last step plus one 16ms timer tick, up to twice its usual time: a timer that ticks every 15.6ms (Windows on battery) brings a 50ms frame at 62.5 or 78ms.
  - A gap longer than twice the usual time is a rest, not a late step: the next glide takes the usual time.
  - Not on a friend's first placing, not while it is held, not with reduced motion.
  - Use it, not a CSS transition: WebKit starts a transition that replaces another a frame late, so the friend stops once every step.
- Something that cycles on a canvas (a wing beat) spans at least six frames at the interval it is drawn at. A faster cycle is drawn at scattered points and flickers.
- The overlay stays open all day, so its loop wakes only for a cell that ends, not on a fixed interval.
  - A standing friend plays its idle row once in some beats and rests between ([lively friends](../design/2026-11-19-lively-friends.md)): while it rests, the loop sleeps until its next gesture starts (`idleLeft`); while it plays, it wakes about five times a second.
  - A friend turning toward the pointer wakes it every 60ms (`TURN_MS`) until it faces the pointer.
  - A pose wakes it once its cells have played, when the pose ends: a jump holds its last cell until then.
  - Whatever changes a drawing in between wakes it at once (`drawNow`): a friend come out, a status, a pat, a walk's first step or a turn, a drag, a look, the season, reduced motion turned off.
  - A new thing the overlay draws calls `drawNow` where it changes, or the friend shows it only at its next cell.
- Measured 2026-11-15, Apple M2 Pro, e2e build, three friends standing on the desktop, the yard hidden, the pointer about 450px from them, 30 s per run, alternating runs (app, GPU and both pages):

| Overlay | CPU |
|---|---|
| Before: a frame every 100ms, the thread looking every 120ms | 4.0–4.3% |
| After: a frame when a cell ends, the thread looking by the pointer's distance | 3.7% |
| The friends' idle cycle stopped (a trial, not shipped) | 0.8% |

- What is left is the idle cycle itself: about 0.6% for each redraw a second (see Rationale), and the idle row changes cells about five times a second.
  - Since 2026-11-19 the row plays for 1.1 s in three beats of 3.6 s out of five, so a standing friend redraws about a fifth as often.
  - Measured 2026-11-19 with `pnpm run measure`, Apple M2 Pro, two alternating runs each: desktop only (yard hidden) 4.4–5.1% before, 2.3–2.9% after. The yard's states varied too much between runs that day (12–33%) to compare.
  - Since 2026-11-23 a desktop friend nobody has been with lately gestures in three beats out of ten (`CALM_SHARE` in `overlay/pace.js`), and in the yard's three out of five for a minute after someone was with it (`LIVELY_MS`).
  - Measured 2026-11-23, Apple M2 Pro, e2e build, four friends standing on the desktop, strolling off, the yard hidden, 90 s per run, after the first lively minute:
    - WebKit's GPU and page processes together went from 1.7% to 0.9%;
    - the whole app went from 3.9% to 2.5–2.6%.
  - Neither a compositing layer per friend nor one per canvas (`will-change`) lowered the cost of a redraw.
- In the yard, a turn and a lean that still moves keep the loop at its busy pace (`pace()` in `app.js`); a friend that stands, or holds its lean toward the pointer, adds nothing.
- Strolling friends cost the same before and after (8.6–10.1% against 8.7–9.3%): walking wakes the loop for each step anyway.
- Do not draw when the window is not visible.
  - Loops return right away when `document.hidden` is set or when the backend reports the window hidden (the `window` event, `<html data-unseen>`).
  - The yard's page listens for the `window` event before its first question, so a window shown or closed while the page loads is heard.
  - What came before that (a start at login) it reads from `windowShown` in `bootstrap`, and again from the answer to `windowReady`.
  - Events and answers may cross: an event heard while a question was on its way stands over the answer.
  - While the window waits hidden for its page, its Resized and Focused events say nothing about being seen (window.rs `FirstShow::seen`): sizing the hidden window would boot the page as unseen.
  - `data-unseen` stops CSS animations, those on `::before` and `::after` too.
  - On Windows the backend also hides the webview (`Webview::hide`, WebView2's `IsVisible`) while the window is hidden to the tray: WebView2 is not told otherwise, and keeps the page drawing and reported as seen.
  - Not while it is minimized: the webview would show again only with the Resized after the window is restored, so the restored window would be blank for a moment. A minimized page still stops drawing and rests on the `window` event.
- The yard window is made hidden and shows once the page has drawn the yard (`windowReady`), or after 3 s if the page never says so. A start at login that keeps it in the tray never shows it.
  - An e2e run waits 15 s instead, and checks that `windowReady` showed it (`firstShow` in `e2eWindow`).

### Pushes from the backend
- The backend pushes its whole state to the yard window on most changes. A push re-renders only what changed:
  - Pushes that come together are drawn once, from the latest state, after a zero-delay timer (`app.js`).
  - A section of the page is rebuilt only when its own part of the state differs from what it was drawn from (a key per section, as in `render.js`).
  - Text, titles and attributes are written only when they differ (`put`, `putAttribute` in `src/core/dom.js`): writing the same value still costs a style check and a mutation.
  - A friend's size is written only when it changes; the dock is measured once for all friends.
- An agent's status draws only its friend, the agent summary and the panel when that friend is shown.
- A chat's start and end push no state: the `busy` event says who is waiting, and redraws only the friends whose wait began or ended and the chat's buttons (`syncBusy` in `src/panel/chat.js`).
- A state is sent as JSON text that the page parses (`pp_script` in `app.rs`, `__pp` in `commands.rs`), not as a script literal: the page takes it in about a third faster.
- A desktop window is sent only what the overlay reads (`OVERLAY_KEYS` in `app.rs`), with only its friends' pet files.
  - `tests/overlay-slice.test.mjs` runs the overlay page and fails when it reads a key that is not sent, or is sent one it never reads.
- A desktop window is sent a change only when its part differs from the last one sent, apart from `desktopLayout`: the overlay thread's `layout` event carries where things stand.
  - A pat, time together, a letter or a catch changes nothing there and sends it nothing.
- An event goes only to the windows that act on its kind (`hears` in `app.rs`):
  - `status`, `say` and `play` go to both; `visit` to the desktop only.
  - Every other kind (`busy`, chat messages, updates, the window shown or hidden) goes to the yard only.
  - A new kind the overlay acts on goes into `OVERLAY_EVENTS`; the test above checks the list against `overlay.js`.
- A change only the desktop shows is not pushed to the yard window:
  - `decorNight` sends the desktop windows their part.
  - `hideDecor` sends no state: the overlay places what is out again and each window hears its layout; the yard hears only when the desktop switch would read otherwise.
- Measured 2026-11-15, Node 26 (V8), a synthetic state of six friends, 14 pet files, 12 letters and a small garden, each case in its own process, five alternating runs, medians of 200 evaluations:

| Push | Bytes | Evaluated in |
|---|---|---|
| Before: the whole state as a literal, to every window | 38,852 | 392–441 µs |
| After: the whole state as JSON text, to the yard window | 41,576 | 272–302 µs |
| After: the desktop's part as JSON text, to each desktop window | 15,465 | 69–72 µs |
| After: a change that leaves the desktop's part as it was, to each desktop window | 0 | – |

- A pointer moving over the yard reads no layout: a friend under it reads its box once a frame at most.
- A card waiting under an open panel measures itself again only when a panel opens or closes or the window changes size (`hold` in `src/yard/card.js`); each second in between it only reads which panels are open.
  - Measuring shows the hidden card for a moment, which lays out the whole yard: about 13 ms a look in the app (0.2 ms a second after), once a second for as long as a chat stayed open.
- The frame loop's ticks look up what changes on the minute once a minute: the gift's event, which reads the system's time zone through `Intl` (`eventNow` in `src/yard/decor.js`), and only once someone has played with a friend that day.
- A conversation draws its last 50 lines; earlier ones are drawn as it is scrolled to its top.

### Canvases and scenery
- The weather canvas (`src/yard/scenery.js`) repaints only in a frame where something on it moved.
- Things drawn once stay drawn (stars; their twinkle is a CSS layer).
- Small life that would keep the canvas busy all day (butterflies, fireflies, falling petals and leaves) comes in spells with rests in between.
- Scenery that changes with the clock or the season (colours, the sun and moon, the moon's phase) is set as CSS custom properties once a minute, never animated.
- The painted backdrop (`src/yard/easel.js`) is painted only when the time of day, the weather or the season changes, or when the yard is resized or moves to a screen of another density. It stays still in between.
  - It is painted once its picture has decoded (`image.decode()`), so the first paint does not decode it on the main thread.
  - Do not repaint it on a timer or for something that moves.
  - Moving things go on the weather canvas or in a CSS layer.
- Standing animations (state animations that are not poses) pick their cell from the shared clock (`now`), not from a per-friend time.
- A canvas redraws only when the visible cell changes.
- A canvas sized for the screen's density is sized again when the density changes (`onDensityChange` in `src/core/dom.js`): a window moved to another screen keeps its size, so no resize says so.
- Do not add a path that skips the cell key comparison in `drawSprite`.
- A friend's sheet and its pose atlases are drawn from an `ImageBitmap` of them (`pixels` in `src/core/pixels.js`), made once the image is in and closed with it (`letGo`); until then, from the image.
  - WebKit lets go of a large image's decoded pixels while the image itself is not on screen, then decodes it again for every cell drawn from it.
  - Measured 2026-11-26, Apple M2 Pro, Playwright's WebKit, the idle yard with four friends, 20 s: a cell took 3.1–4.5 ms from the image and 0.04 ms from the bitmap; the frame loop's script went from 48 to 23 ms a second.
  - A bench drawing one sheet over and over shows no difference (0.05–0.11 ms against 0.04 ms): the cost comes only once the page holds many large images.
  - Measured 2026-11-26 in the app, same machine, e2e build, the yard only with three built-in friends and the chat open, 20 s per sample, three alternating runs:
    - the frame loop's script, timed around its timers: 57.3 ms a second before, 27.0 ms after;
    - CPU, median of 12 and 13 samples: 26.4% before, 24.7% after; the yard's page 15.5% before, 12.2% after.
    - The same build with `createImageBitmap` taken away against with it, 15 samples each: 22.8% against 20.0%; the app's own process 4.8% against 4.4%, the page 10.3% against 9.0%. The bitmaps cost the app's process nothing.
- A friend's hit area is measured once for each row of its sheet (`bodyOf` in `src/core/sprites.js`): about 320,000 pixels read the first time a pose plays, then a comparison a frame. The frame loops write it only when the row changes (`fitHit`; the desktop's `setBody`).

### CSS animations
- Move only `transform` and `opacity`. Do not animate layout properties such as `left`, `top` or `width`.
- A loop that runs on the compositor and asks nothing of the page may run while the yard is shown:
  - the clouds' drift;
  - the breeze in trees and flowers (`garden.css`);
  - a walking friend's step (`friends.css`);
  - the living layers (`living.js`, `.living-*` in `scenery.css`): glints on the water, cloud shadows, the near tufts, and the room's light and dust;
  - the lit Christmas tree after it has grown (`.xmas-grand:not(.xmas-rise)` in `garden.css`): the halo and the pool of light breathe over 5 s, three groups of bulbs fade in turn, five gold flecks drift.
- The lit tree, measured 2026-11-27, Apple M2 Pro, headless Chrome with software compositing, the yard on Christmas night with the tree grown and settled, five alternating runs:
  - main thread 3.9% before, 4.5% after;
  - every Chrome process together, median 35.6% before, 37.9% after; software compositing exaggerates this, so check it again with `pnpm run measure` in the e2e build.
- The living layers, measured 2026-11-26, Apple M2 Pro, e2e build, the yard only with three friends standing, the layers on and off in turns of 30 s after the friends had settled, six pairs:
  - median 21.2% with them and 20.2% without, a median difference of 0.5 points between pairs, inside G3's 1.5 points ([the yard plays like a game](../design/2026-11-24-the-yard-plays-like-a-game.md));
  - single pairs ranged from −4.6 to +11 points, so compare medians only;
  - not measured in WebView2.
- Such a loop pauses under `data-unseen` and stops with reduced motion. A loop that needs the page (a canvas, a style written each frame) is a drawing loop and follows the rules above.
- In WebView2 (`<html data-webview2>`), the clouds move in steps of about a pixel (`steps()`): moved smoothly, they have the page composited on every display frame while nothing else moves.
  - The clouds alone, measured 2026-11-15 in Chrome with software compositing (as WebView2 with no GPU), the frame loop resting, three runs: 600 frames and 1.9 s of CPU in 10 s smoothly, 115–119 frames and 0.7 s in steps of 1500.
  - Not in WebKit, which moves steps on the page's own thread: the yard with one friend took 7.6–7.7% of a core with steps against 5.9–6.3% without (macOS, e2e build, three alternating runs of 40 s).
- A short burst that is not a loop may run on the desktop when a person does something there, never on a timer or for an agent's news:
  - the flurry over the desktop grass (`overlay/flurry.js`): seven bits for about five seconds, at most once every four minutes, on four fixed paths (`flurry-fall-0…3`).
  - Measured 2026-11-24, Apple M-series, e2e build, four friends on the desktop, the yard hidden, a pat every 6.5 s with no gap between flurries, 56 s per run, alternating runs: summer (nothing falls) 6.0–6.3%, spring 8.2–9.1%, winter 8.3–9.2%.
  - So a flurry costs about 2.5 points of a core while it falls; once every four minutes that averages under 0.1 point.
  - Keyframes that read variables cost about the same there (spring 8.0–9.5%, winter 8.5–9.6%): the cost is the window composited every frame, not the keyframes.
- Do not use CSS variables (`var()`) inside keyframes. Keyframes that contain variables do not run in the compositing stage.
- Do not put a filter on the element a looping animation moves: put it on what is inside (the light on a swaying tree is on its `use`, `garden.css`).

### Backend, sound and memory
- The overlay thread does not ask the runtime for monitors on every tick (it uses the cache).
- While something moves, something is dragged or the pointer is within 300px of a box, it ticks every 40ms.
- Otherwise it waits until a pointer moving at 2500 px/s (300px in 120ms) could reach the nearest box (`calm_wait`):
  - at least 120ms, at most 500ms;
  - never past the start of the next stroll.
  - Each look asks the main thread where the pointer is: a far pointer costs two looks a second, not eight.
  - A pointer faster than that reaches a friend before its window takes clicks, by up to 500ms.
- A thing that grew (a tree, a flower in bloom) wakes the thread: it is placed now, not at the next look.
- With nothing out and no window open, it waits to be woken: a change to what is out wakes it at once. It looks in every 2 seconds only as a safety net.
- A monitor's window stays 60 seconds after the last thing on it leaves, or after the yard opens the menu of something not out yet; then it closes.
  - Building a window and loading its page takes most of a second, and something sent out again soon then shows at once.
  - While it is kept with nothing on it, its page draws nothing and the thread looks in every 400ms only to close it in time.
  - The switch that brings everything in closes the windows at once.
- Frequent changes no page shows (where a friend stopped walking, where the window was left) are batched and saved with `persist_soon`, within 2 s.
- Small changes that come often and show (a pat, a scene picked, something moved) are shown at once and written within 250 ms with any others (`show_and_save_soon`, `commit_soon`).
- Other changes are shown and written right away with `commit` or `show_and_save`; the write comes after the lock is let go.
- The yard's sounds (`src/yard/sound.js`) play only while they are on and the yard is visible.
- Otherwise the audio context is suspended and the sound timers are cleared.
- Sound beds loop and drift inside the audio graph.
- The page wakes only for scheduled events (a gust, a wave, a call), never on a fast timer.
- A yard hidden for 30 seconds rests (`src/yard/rest.js`): the backdrop's and the weather's canvases are emptied (`width = height = 0`) and the yard takes `content-visibility: hidden` (`data-resting`), so WebKit lets go of what it drew.
  - `document.hidden` or the backend's word (the `window` event, `windowShown` in `bootstrap`) starts a rest: WebView2 may never report a hidden window's page hidden.
  - The page wakes in `visibilitychange`, before WebKit draws it, and paints the backdrop and the weather at once: the first frame shows them. The backend's `window` event cannot promise that: `show()` sends it before the window shows, but it runs as a script that may come after the first frame, and a window restored from minimized sends it only once it is back. It wakes the page where the page was never reported hidden.
  - Nothing is painted while it rests: a new scene, a resize or another density waits until it wakes.
  - Emptying the canvases frees nothing while the yard is still drawn, and `content-visibility` alone frees about half: both are needed.
  - The friends' decoded sheets stay: letting them go freed nothing measurable, and the friends would show late.
  - Measured 2026-11-15, same machine, e2e build, three friends and the small garden, alternating runs, 50 s after hiding: hidden to the tray, the yard's page 335–341 → 293–298 MB and all processes 422–440 → 375–390 MB; minimized, 333 → 272 MB and 433 → 365 MB.
  - Shown again, the first frame after `visibilitychange` has the backdrop painted, as before; two frames after showing took 126–143 ms against 62–148 ms before (a minimized window: about 690 ms both, the window's own animation).
  - What stays (about 130 MB of graphics memory in WebKit, the decoded sheets and the page's heap) WebKit keeps whether the page is drawn or not.
- Do not keep resources that decode large (sprite sheets, about 14MB each) for every pet.
- One minute after the Invite tab closes, the yard releases the sheets it does not use.
- A card that shows a drawing small (the album) draws its preview in `src/art/album/`, not the drawing's painted sheet (`previewSvg` in `src/yard/art.js`).
  - Decoding a book's 1536 × 1024 sheets for 112-pixel cards held up its first open: gifts 96–119 ms, keepsakes 95–114 ms, trees 160–175 ms, to the next frame.
  - With previews: 30–32, 26–27 and 22–24 ms; the pictures are in 10–15 ms later. The 161 previews add 690 KB.
  - Measured 2026-11-15, same machine, e2e build, three alternating runs each.
- Pictures travel by address, not inside a command's answer: `listBackgrounds` names each picture of an imported background as `pet-asset://background/<id>/<picture>`, read when its place or its card shows.
  - Five packs (64 MB) sent whole held back the first friend by about 230 ms and kept about 200 MB in the app and the page all day.

### Starting a window
- A window loads the string table of the language it speaks and English, the fallback, not every table (`loadStrings` in `src/core/strings.js`, called by `i18n.js`).
  - Changing the language reloads the page, which loads the new table. The Settings tab lists every language from `LANGUAGES`, which holds each one's own name, without loading their tables.
  - Outside a page (the Node tests, scripts) every table loads: the tests check them all.
  - The four tables are 246 KB. In Chrome, after a collection, the JS heap with `i18n.js` loaded went from 1,232 KB to 999 KB (Korean, which also loads English) and 875 KB (English); the import took 13–15 ms before and after, the files coming in parallel either way.
  - Measured 2026-11-15, Apple M2 Pro, headless Chrome over localhost, medians of 15 runs.
- The first render waits for the yard's content (`loadContent`), not for the friends' own game poses (`actionsPath` in a pet file, about 25 KB each for the four friends).
  - A friend with poses asks for them (`petActions`) as the yard draws it (`syncViews` in `src/yard/views.js` calls `loadCompanionActionsFor` in `src/core/companion-actions.js`), once, at the first render or when it comes in later; a pet without poses asks nothing.
  - On its own the file takes about 4 ms to fetch and 0.2 ms to parse in Chrome. Beside the hundred drawings `loadContent` fetches, the time to the content made no measurable difference (medians 105–222 ms either way, noisy); on Windows each request also passes through the window's thread (WebView2), and the start makes one fewer.
- The content files stay formatted as people edit them: the app has no build step for the page (`frontendDist` is `src/`), and Tauri compresses what it embeds.

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
- Follow-up, 2026-11-26: the build of 2026-10-11, run again on the same machine under macOS 27.2.1, took 12–14% for the yard only (app 3.2%, page 4.2%, GPU 6%), so about 7 points of the gap to today's builds come from the system, not the app.
  - Today's build took about 20% there, the extra mostly in the yard's page; drawing the friends from bitmaps (Canvases and scenery) took back about 3 points of it.

### Each process, measured 2026-11-14
- Same machine as above, e2e build, three built-in friends and the small garden of `pnpm run measure`, two runs of each state, 20 seconds each.
- CPU is a percentage of one core. Memory is each process's footprint (`top`'s MEM), summed.

| State | App | GPU process | Yard's page | Desktop's page | All, CPU | All, memory |
|---|---|---|---|---|---|---|
| Yard, no friends | 2.6–2.7% | 4.1–4.3% | 3.4–3.6% | – | 10.0–10.7% | 526–554 MB |
| Yard, friends strolling | 2.9–3.1% | 3.7–3.9% | 4.8–5.4% | – | 11.5–12.2% | 503–532 MB |
| Yard and desktop, friends and a flower out | 5.7–6.1% | 3.7–4.7% | 5.1–5.2% | 3.5–4.2% | 18.9–19.3% | 638–664 MB |
| Desktop only, yard hidden | 2.9–3.5% | 1.3–1.6% | 0.1% | 2.4–2.8% | 6.8–8.0% | 568–591 MB |
| Hidden to the tray | 0–0.1% | 0.1% | 0.1% | – | 0.1–0.3% | 417–424 MB |
| Minimized | 0.1% | 0.1% | 0.1% | – | 0.2–0.3% | 434–440 MB |

- Left 12 minutes with every friend in the yard and out on the desktop, strolling, the yard's page grew and fell back with garbage collection (WebKit malloc 137–219 MB) and ended where it was after 3 minutes; the desktop's page stayed at 160 MB.
  - The page's nodes, listeners, timers and Web Animations did not grow: finished glides are released.
  - In Chrome with 12 friends, after a collection, the JS heap went from 3.5 to 4.1 MB in 10 minutes while 17,000 glides ran.
- Turned off in turn, these cost nothing measurable here (within 2 points): the garden's light filter (evening rain), the glass blur behind the dock over the rain, a desktop window cut to the friends' width instead of the screen.
  - The cut window saved 0.8 points and 18 MB, but would have to move and resize with every stroll: the window stays the size of the screen.
  - Also kept on 2026-11-15, when the overlay's loop was paced by its cells: a window cut to the friends would move and resize from the overlay thread through the main thread on every 40ms step of a stroll and a drag, and a friend carried to another screen needs that screen's window whole. Resting the loop was the safer of the two.

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
- None assert a speed.
- `pnpm run measure` is run by hand on macOS and Linux.
- CI does not run it: load varies by runner, so there is no baseline.
- On Windows, watch the CPU of the `msedgewebview2` process in Task Manager.
- The e2e prints timings on every system CI runs it on, one `perf <name> <value> <unit>` line each:
  - startup (from the process start and from the page's own start to the first friend drawn, and the files loaded before it);
  - the bridge (a command that does nothing, one that asks the window), timers, and a sprite sheet's load and decode;
  - a render and a push with nothing changed, the size of a pushed state and when it arrives, a commit saved and one saved later;
  - a status event, a pat, a chat turn;
  - each panel, the album and a book in it, the first time and the second; each place and a season, until the new land is hung;
  - Show on desktop, cold, warm and again.
- Read them with `gh run view <run> --job <job> --log | grep ' perf '`.
- Compare systems by their ratio within one run, against the bridge's round trip and the render with nothing changed: runners differ in speed.

## Change history
- 2026-10-01 First version — measurements are from the first run of `pnpm run measure`
- 2026-10-09 The painted backdrop is painted only when the light or the size changes; new measurements
- 2026-10-10 The yard's sounds: they play only while on and seen; a measured state with them playing
- 2026-11-09 The yard's loop looks once a second, not ten times, while the window cannot be seen
- 2026-11-11 Loops on the compositor (the breeze, a walking friend's step) may run while the yard is shown; `pnpm run measure` plants a small garden
- 2026-11-13 The compositor carries a moving friend between steps; the yard wakes when a walking step ends, on one clock for all walks; creatures and falling petals keep the 50ms interval; wing beats span six frames
- 2026-11-14 The overlay thread is woken by a change to what is out; a monitor's window stays a minute after its last thing leaves and opens early from the yard's menu, and its page draws nothing while it has nobody
- 2026-11-14 A glide after a late step lasts until the next step is likely to come; a push re-renders only what changed; canvases follow a change of screen density
- 2026-11-14 Pictures travel by address, not inside a command's answer (imported backgrounds); each process measured in each state, over 12 minutes, and with the filters and the blur off
- 2026-11-15 A state travels as JSON text; a desktop window is sent only its part, only when it changed, and only the events it acts on
- 2026-11-15 A window loads only the string table it speaks and English; the first render does not wait for the companions' authored actions
- 2026-11-15 A page started in a hidden window knows it from `bootstrap`, and the backend's word starts a rest too; the window shows once the yard is drawn; WebView2 is told when the window is hidden; in WebView2 the clouds move in pixel steps
- 2026-11-15 The overlay's loop wakes when a friend's cell ends and rests with reduced motion; the overlay thread looks at the pointer by its distance from the friends, up to 500ms apart
