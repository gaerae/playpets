# Capabilities

Tauri reads capability files (`*.json`, `*.toml`) from this folder to grant pages the commands of
its plugins. PlayPets has none: both pages reach the backend only through the app's own `call`
command (`BRIDGE_JS` in `src/commands.rs`), and the backend hands them state changes by running
`__pp` in the page, so no plugin command is exposed to a page.

The folder stays even while it holds no capability. `tauri-build` watches it, and Cargo counts a
watched path that does not exist as changed, so without it every `cargo build` and `cargo test`
compiled the app again.

A capability added here lets a page call that plugin directly, beside `call`. The pages show text
from pet files and AIs ([SECURITY.md](../../SECURITY.md)), so add one only for a command a page
itself needs.
