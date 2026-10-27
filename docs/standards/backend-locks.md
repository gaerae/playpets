# Standard: Backend locks and threads

## Applies to
- All Rust code in `src-tauri/src` that takes the app state lock (`app::Shared`, a `Mutex<AppData>`) or any other mutex:
  - the overlay's internal lock
  - the CLI sessions
  - each Claude Code session's stderr tail
  - the chat CLIs' private folder (`chat/cli/`)
  - the tray's last-built menu (`SHOWN` in `tray.rs`)
  - the update that was found (`update::Found`)
- That code lives in the commands the page calls (`commands.rs`), chat (`chat/`), the agent bridge (`agent/`), the overlay thread (`desktop/overlay.rs`), the tray and windows (`tray.rs`, `window.rs`) and auto-update (`update.rs`).
- Not covered:
  - The app's CLI mode (`run` in `agent/cli.rs`): a separate process with no app state.
  - Test code.

## Rules
### Taking a lock
- Take the state with `app::lock`, every other mutex with `app::hold`.
- Both accept a poisoned lock as is. The data stays whole (every change is made in place), so one panic does not fail every later request.
- Never write `.lock().unwrap()` outside tests.

### Never under `Shared`
- No runtime call that waits on the main thread:
  - the monitor list (`available_monitors`, `primary_monitor`)
  - the cursor position (`cursor_position`)
  - menu and tray text changes (`set_text`, `set_tooltip`, `set_title`)
  - window state queries (`is_visible`, `inner_size`)
- No slow work: keychain reads and writes, network calls, file dialogs, waiting for an AI reply, waiting for a process to exit (`Child::wait`).
- After you release the lock and take it again, check what may have changed in between: whether the friend is still there, whether a reply is already pending, whether the AI connection is the same. Example: `chat::still_ready` in chat.

### Lock order
- Holding both: take `Shared` first, the overlay's internal lock second.
- Never take `Shared` while holding the overlay's internal lock.
- The other locks are held briefly, and none is held when `Shared` is taken:
  - CLI sessions (`CliManager.sessions` in `chat/cli/mod.rs`):
    - Taken after `Shared` when a chat is reset or cancelled (`chat::cancel` holds the state).
    - Taken alone by the idle reaper and a chat turn.
    - A turn takes its session out of the map before asking the CLI and puts it back afterwards, so the lock is never held during the wait for a reply.
    - A dropped session kills its process and reaps it on its own thread.
  - A Claude Code session's stderr tail (`StderrTail` in `chat/cli/claude.rs`), taken alone:
    - by its reader thread, for each piece it reads
    - by a turn that reads why the CLI quit; the turn waits on the tail for at most a second, with no other lock held
  - The chat CLIs' private folder (`DIR` in `private_dir`, `chat/cli/launch.rs`): taken alone and briefly, to return the folder or recreate it if it was removed.
  - The tray's `SHOWN`:
    - Taken on the main thread while the menu is built from a snapshot (`tray::apply`, queued with `run_on_main_thread`).
    - Taken briefly by `rebuild` and the e2e check.
    - The snapshot is read from `Shared` before, never under it.
  - The update's `Found`:
    - Taken only to store, read or take the update.
    - The download and install run after the guard is dropped.
    - A failed install puts the update back.

### Overlay and commands
- The overlay reads monitors from the cache (`current_monitors`, refreshed outside the lock every 2 seconds).
- Functions that can be called inside the lock, such as `layout()`, do not call the runtime.
- `commands::call` runs the commands the page calls on a worker thread (`spawn_blocking`).
- Inside a command, do not add a wait that blocks the main thread.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Inside the locked section, only read and write state. Build and send results after releasing the lock.

## Exceptions
| When | How |
|---|---|
| Code that already runs on the main thread (tray menu handling, window events) takes `Shared` briefly | Allowed. No deadlock as long as no other thread waits on the main thread while holding `Shared`; these rules keep that true |
| A runtime call cannot be moved outside the lock | Explain in the PR description why, and why there is no deadlock; a maintainer approves it |

## Rationale
- The main thread also takes `Shared`: sprite requests used to run on it, and the tray menu still does.
- If another thread waits on the main thread while holding `Shared`, the two wait on each other forever.
- A performance review confirmed that state-change notifications took this path.
- The same cause made the keychain prompt freeze the whole app.
- Based on: decision “[Never wait on the main thread while holding the app state lock](../decisions/2026-09-30-no-waiting-on-main-thread-under-state-lock.md)”

## Automated checks
- None. The compiler and clippy cannot tell whether a call runs inside a lock.
- Review PRs that change code taking locks against the rules above.
- E2E (`npm run test:e2e`) only confirms that runs finish without deadlock; it does not catch rare overlapping timing.

## Change history
- 2026-10-01 First version
- 2026-10-10 `app::lock` for the state and `app::hold` for every other mutex, both recovering from a poisoned lock; where the CLI sessions, the tray, the mini window and the update lock sit relative to `Shared`; the Claude Code stderr tail and the CLIs' private folder
