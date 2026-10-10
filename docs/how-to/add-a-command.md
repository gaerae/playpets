# Add a backend command the page calls

## Purpose
Add one new backend command that the page calls as `window.playPets.<name>()`. The example name is `centerFriend` (moves a friend to the middle of the yard); when you add a real one, pick a name that says what it does. The full path a command travels is in data flows 1 and 2 of [Architecture: PlayPets app](../architecture.md).

## Prerequisites
- You finished [Set up a development environment and run the app](../getting-started.md), and `npm test` and `npm run test:e2e` pass.
- You read the [backend locks standard](../standards/backend-locks.md) and the [i18n standard](../standards/i18n.md). Commands run on a blocking thread, not on the main thread. Each handler takes the app state lock itself with `lock(state)`, and does slow work (network, dialogs, the keychain) without holding it.

## Steps
1. Add one row to the `COMMANDS` table in `src-tauri/src/commands.rs`. The row names the command (the page's method), says who may ask for it (`main` for the yard window, `overlay` if the desktop windows need it too, `test_only` for the e2e scenario), and gives what it does. The bridge script, the check of which window may call what, and the dispatch all come from this table. Read arguments with `c.text(i)`, `c.arg(i)` and `c.float(i)`.

```rust
static COMMANDS: &[Command] = &[
    // …
    main("centerFriend", |c| center_friend(c.app, &c.state, c.text(0))),
];
```

2. Write the handler in the same file (or in the module that owns the area). A handler that changes the state goes through `commit`: it takes the lock, runs your change, then saves and notifies every window once (a change that could not be saved still stands and is shown, and the error is returned).

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

3. If there is a new error sentence, add a row at the same position in every table under `src-tauri/src/i18n/` (`ko.rs`, `en.rs`, `ja.rs`, `zh_hans.rs`). If an existing key (`error.friend_missing`) works, skip this step.

4. Call it from the page. On failure `call` throws, and `guard` shows that sentence as a notice.

```js
import { $, call, guard, selected } from '../core/state.js';
$('center-button').onclick = guard(() => call('centerFriend', selected));
```

5. Move the parts with rules (position math and so on) into pure functions and add tests to `mod tests` in the same file. If people see the flow, add a calling line to the scenario in `tests/e2e.mjs` and a check line to its expected list. `each_command_is_named_once…` in `commands::tests` checks the table (a name listed twice, what the overlay may ask for).

## Verification
```bash
npm test
npm run lint
npm run test:e2e
```

- All three commands pass. If you skip the key in step 3, the Rust test `i18n::tests::every_key_asked_for_is_in_the_table` fails.
- Run the app and press the button: the friend moves to the middle of the yard (`changed` notified every window), and it is still there after you restart the app (`persist` saved it).

## Troubleshooting
| Symptom | Cause |
|---|---|
| `playPets.centerFriend is not a function` on the page | The row from step 1 is missing, or it is `test_only` |
| Calling it gives "That request isn't allowed." | You called it from the desktop window and the row says `main` (use `overlay`) |
| The app freezes | The handler waits on the main thread or slow work while holding the lock. Check it against the locks standard again |
