# Add a backend command the page calls

## Purpose
- Add one backend command the page calls as `window.playPets.<name>()`.
- The example is `centerFriend`, which moves a friend to the middle of the yard. Name a real command for what it does.
- Data flows 1 and 2 in [Architecture: PlayPets app](../architecture.md) show the full path a command takes.

## Prerequisites
- You finished [Set up a development environment and run the app](../getting-started.md).
- `npm test` and `npm run test:e2e` pass.
- You read the [backend locks standard](../standards/backend-locks.md) and the [i18n standard](../standards/i18n.md).
- Commands run on a blocking thread, not the main thread.
- Each handler takes the app state lock itself, with `lock(state)`.
- A handler does slow work (network, dialogs, the keychain) without holding the lock.

## Steps
1. Add one row to the `COMMANDS` table in `src-tauri/src/commands.rs`.
   - A row gives the command name (the page's method), who may call it, and what it does.
   - Who may call it: `main` (the yard window), `overlay` (the desktop windows need it too) or `test_only` (the e2e scenario).
   - The table drives the bridge script, the check of which window may call what, and the dispatch.
   - Read arguments with `c.text(i)`, `c.arg(i)` and `c.float(i)`.

```rust
static COMMANDS: &[Command] = &[
    // …
    main("centerFriend", |c| center_friend(c.app, &c.state, c.text(0))),
];
```

2. Write the handler in the same file, or in the module that owns the area.
   - A handler that changes the state goes through `commit`: it takes the lock, runs your change, then saves and notifies every window once.
   - If the save fails, the change still stands and every window shows it; `commit` then returns the error.

```rust
fn center_friend(app: &AppHandle, state: &State<Shared>, id: &str) -> Result<Value, String> {
    commit(app, state, |d| {
        let pet = d.pets.iter_mut().find(|p| p.id == id).ok_or_else(|| i18n::t("error.friend_missing"))?;
        pet.x = 0.5;
        pet.y = 0.5;
        Ok(Value::Null)
    })
}
```

3. For a new error sentence, add a row at the same position in every table under `src-tauri/src/i18n/` (`ko.rs`, `en.rs`, `ja.rs`, `zh_hans.rs`).
   - Skip this step if an existing key (`error.friend_missing`) works.

4. Call it from the page. On failure `call` throws, and `guard` shows the error sentence as a notice.

```js
import { $, call, guard, selected } from '../core/state.js';
$('center-button').onclick = guard(() => call('centerFriend', selected));
```

5. Put logic with rules (position math, for example) in pure functions, and test them in `mod tests` in the same file.
6. If people see the flow, add a line that calls it to the scenario in `tests/e2e.mjs` and a line that checks it to its expected list.
   - `each_command_is_named_once…` in `commands::tests` checks the table for a name listed twice and for what the overlay may ask for.

## Verification
```bash
npm test
npm run lint
npm run test:e2e
```

- All three pass.
- Without the key from step 3, the Rust test `i18n::tests::every_key_asked_for_is_in_the_table` fails.
- Run the app and press the button: the friend moves to the middle of the yard (`changed` notified every window).
- Restart the app: the friend is still there (`persist` saved it).

## Troubleshooting
| Symptom | Cause |
|---|---|
| `playPets.centerFriend is not a function` on the page | The row from step 1 is missing, or it is `test_only` |
| Calling it gives "That can't be done here. Reopen the app." (`error.not_allowed`) | You called it from the desktop window and the row says `main` (use `overlay`) |
| The app freezes | The handler waits on the main thread or on slow work while it holds the lock. Check it against the locks standard |
