# Add a backend command the page calls

## Purpose
Add one new backend command that the page calls as `window.playPets.<name>()`. The example name is `centerFriend` (moves a friend to the middle of the yard); when you add a real one, pick a name that says what it does. The full path a command travels is in data flows 1 and 2 of [Architecture: PlayPets app](../architecture.md).

## Prerequisites
- You finished [Set up a development environment and run the app](../getting-started.md), and `npm test` and `npm run test:e2e` pass.
- You read the [backend locks standard](../standards/backend-locks.md) and the [i18n standard](../standards/i18n.md). Commands run on a blocking thread, not on the main thread. Each handler takes the app state lock itself with `lock(state)`, and does slow work (network, dialogs, the keychain) without holding it.

## Steps
1. Add the new name to the end of the `COMMANDS` list in `src-tauri/src/commands.rs`. The bridge script reads this list to create methods on the page, so a name missing here never becomes `playPets.<name>`.

```rust
pub const COMMANDS: &[&str] = &[
    // …
    "checkUpdate", "installUpdate", "centerFriend",
];
```

2. Add an arm to the `match` inside `dispatch` in the same file. Read arguments with `text(&args, i)` and `arg(&args, i)`.

```rust
"centerFriend" => center_friend(&app, &state, text(&args, 0)),
```

3. Write the handler in the same file (or in the module that owns the area). A handler that changes the state goes through `commit`: it takes the lock, runs your change, then saves and notifies every window once.

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

4. If the desktop window also needs to call this command, add the name to `OVERLAY_COMMANDS` and increase the array length by one. If it does not, skip this step.

5. If there is a new error sentence, add a row at the same position in every table under `src-tauri/src/i18n/` (`ko.rs`, `en.rs`, `ja.rs`, `zh_hans.rs`). If an existing key (`error.friend_missing`) works, skip this step.

6. Call it from the page. On failure `call` throws, and `guard` shows that sentence as a notice.

```js
import { $, call, guard, selected } from '../core/state.js';
$('center-button').onclick = guard(() => call('centerFriend', selected));
```

7. Move the parts with rules (position math and so on) into pure functions and add tests to `mod tests` in the same file. If people see the flow, add a calling line to the scenario in `tests/e2e.mjs` and a check line to its expected list. `every_listed_command_has_a_dispatch_arm…` in `commands::tests` is the first to catch steps 1 and 2 drifting apart.

## Verification
```bash
npm test
npm run lint
npm run test:e2e
```

- All three commands pass. If you skip the arm in step 2, `commands::tests` fails; if you skip the key in step 5, the Rust test `i18n::tests::every_key_asked_for_is_in_the_table` fails.
- Run the app and press the button: the friend moves to the middle of the yard (`changed` notified every window), and it is still there after you restart the app (`persist` saved it).

## Troubleshooting
| Symptom | Cause |
|---|---|
| `playPets.centerFriend is not a function` on the page | The name is not in the list from step 1 |
| Calling it gives "That request isn't allowed." | The arm from step 2 is missing, or you called it from the desktop window and skipped step 4 |
| The app freezes | The handler waits on the main thread or slow work while holding the lock. Check it against the locks standard again |
