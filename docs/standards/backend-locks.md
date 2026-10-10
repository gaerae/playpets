# Standard: Backend locks and threads

## Applies to
All Rust code in `src-tauri/src` that takes the app state lock (`app::Shared`, that is `Mutex<AppData>`) or any other mutex: the overlay's internal lock, the CLI sessions (`chat/cli.rs`), the tray's last-built menu (`SHOWN` in `tray.rs`), the full-size window frame (`FULL` in `window.rs`) and the update found (`update::Found`). This covers the commands the page calls (`commands.rs`), chat (`chat/`), the agent bridge (`agent/`), the overlay thread (`desktop/overlay.rs`), the tray and windows (`tray.rs`, `window.rs`), and auto-update (`update.rs`).

Not covered: the app's CLI mode (`run` in `agent/cli.rs`) is a separate process that runs without app state, so it does not apply. Test code does not apply either.

## Rules
- Take the state with `app::lock` and any other mutex with `app::hold`. Both take a poisoned lock as it is (the data is whole: every change is made in place), so one panic does not fail every later request. Never write `.lock().unwrap()` outside tests.
- Do not make a runtime call that waits on the main thread while holding the `Shared` lock. This includes the monitor list (`available_monitors`, `primary_monitor`), the cursor position (`cursor_position`), changing menu and tray text (`set_text`, `set_tooltip`, `set_title`), and window state queries (`is_visible`, `inner_size`).
- Do not do slow work while holding the `Shared` lock. This includes keychain reads and writes, network calls, file dialogs, waiting for an AI reply, and waiting for a process to exit (`Child::wait`).
- If you release the lock and take it again, check again any condition that may have changed in between (is the friend still there, is a reply already pending, is the AI connection the same). `chat::still_ready` in chat is an example.
- When you hold both locks, take `Shared` first and the overlay's internal lock second. Do not take `Shared` while holding the overlay's internal lock.
- The other locks are taken briefly, and none of them is held while `Shared` is taken:
  - CLI sessions (`CliManager.sessions` in `chat/cli.rs`): taken after `Shared` when a chat is reset or cancelled (`chat::cancel` holds the state), and alone by the idle reaper and a chat turn. A turn takes its session out of the map before it asks the CLI and puts it back after, so the lock is never held while waiting for a reply. A dropped session kills its process and reaps it on its own thread.
  - The tray's `SHOWN`: taken on the main thread while the menu is built from a snapshot (`tray::apply`, queued with `run_on_main_thread`), and briefly by `rebuild` and the e2e check. The snapshot is read from `Shared` before, never under it.
  - The window's `FULL`: taken by `set_mini` (the `windowMini` command, on a worker thread) after the state's `prefs.mini_rect` was read and its guard dropped. It is held across the window calls that resize the window; nothing on the main thread takes it.
  - The update's `Found`: taken only to store, read or take the update. The download and install run after the guard is dropped, and a failed install puts the update back.
- When the overlay needs monitors, it uses the cache (`current_monitors`, refreshed outside the lock every 2 seconds). Functions that can be called inside the lock, such as `layout()`, do not call the runtime.
- `commands::call` runs the commands the page calls on a worker thread (`spawn_blocking`). Do not add a wait inside a command that blocks the main thread.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Keep only reading and writing state inside the locked section. Build and send results after releasing the lock.

## Exceptions
| When | How |
|---|---|
| Code that already runs on the main thread (tray menu handling, window events) takes `Shared` briefly | Allowed. There is no deadlock as long as no other thread waits on the main thread while holding `Shared`. These rules keep that assumption true |
| A runtime call cannot be moved outside the lock | Explain the reason and why there is no deadlock in the PR description, and a maintainer approves it |

## Rationale
The main thread also takes `Shared` (sprite requests used to run on the main thread, and the tray menu still does). If another thread waits on the main thread while holding `Shared`, the two wait on each other forever. A performance review confirmed that state-change notifications took this path, and the same cause made the keychain prompt freeze the whole app.
Based on: decision “[Never wait on the main thread while holding the app state lock](../decisions/2026-09-30-no-waiting-on-main-thread-under-state-lock.md)”

## Automated checks
There are no automated checks. The compiler and clippy cannot tell calls inside a lock apart. Review PRs that change code taking locks against the rules above. E2E (`npm run test:e2e`) only confirms that runs finish without deadlock; it does not catch rare overlapping timing.

## Change history
- 2026-10-01 First version
- 2026-10-10 `app::lock` for the state and `app::hold` for every other mutex, both recovering from a poisoned lock; where the CLI sessions, the tray, the mini window and the update lock sit relative to `Shared`
