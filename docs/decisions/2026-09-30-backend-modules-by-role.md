# Decision: The backend is split into folders by role, and main.rs only wires things up

## Context
The backend (`src-tauri/src`) was 16 flat modules, and `main.rs` alone was 919 lines holding app state, command dispatch, the tray, file opening and startup wiring. The names were confusing too. `cli.rs` was the Claude and Codex CLIs used for chat, while `agentcli.rs` was the app's own CLI mode. Finding a place for a new feature meant opening several files.

## Decision
We split the backend into folders by role.

| Place | Job |
|---|---|
| `main.rs` | Startup wiring only |
| `app.rs` | App state, loading and saving, telling every window about changes |
| `commands.rs` | Commands the page can call |
| `chat/` | Chat, AI connections (subscription CLIs, HTTP), prompts |
| `pets/` | Pet files, importing from an address, friends in the yard |
| `agent/` | The app's CLI mode (hooks, MCP) and the local bridge |
| `desktop/` | The desktop overlay and strolling |
| `i18n/` | The backend strings table |
| `window.rs`, `tray.rs`, `system.rs`, `store.rs`, `update.rs` | Windows, tray, opening with the OS, file storage, auto-update |

The scripts that build distribution files follow the same rule and live in `packaging/{macos,linux,windows}` (the old `ci/` was not CI but local distribution builds).

## Consequences
- Positive: File names say what the file does. `main.rs` is now 114 lines. The guard tests no longer keep a hand-written file list; they scan all of `src/`, so new modules are checked automatically.
- Negative: Files moved, so following git history needs `git log --follow`. Paths between modules got longer (`crate::chat::providers`).
- Neutral: Folders go one level deep at most. Splitting further is decided when a file grows.

## Alternatives considered
- **Keep the flat layout and only split main.rs:** `main.rs` shrinks, but the `cli.rs` and `agentcli.rs` confusion stays.
- **Split into crates with a Cargo workspace:** Boundaries get stronger, but at this size the build configuration and visibility management cost more than they give.
