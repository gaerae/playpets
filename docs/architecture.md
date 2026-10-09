# Architecture: PlayPets app

## Scope
This describes the current structure of one PlayPets app install. It covers the yard window, the desktop overlay windows, the Rust backend, the files the app reads and writes, and the outside touchpoints (AI, coding agents, GitHub Releases). The commands and HTTP spec of the agent integration are in [Architecture: coding agent integration](agent-integration.md), and the pet file format is in the [Pet file format standard](standards/pet-files.md). Building and distribution are covered by the [release procedure](how-to/release.md).

## Diagram
A container-level diagram. It shows the three parts inside the app and the touchpoints outside it.

```mermaid
flowchart LR
  person([User])
  agent([Coding agent])
  subgraph app[PlayPets app]
    yard[Yard window<br/>src/index.html]
    overlay[Desktop window<br/>one per monitor]
    backend[Rust backend<br/>state and commands]
    bridge[Agent bridge<br/>127.0.0.1]
  end
  cli[CLI mode<br/>hooks and MCP]
  data[(Data folder<br/>state.json)]
  pets[(Pet folders)]
  ai[AI<br/>subscription CLI, HTTP]
  releases[GitHub Releases<br/>latest.json]
  person --> yard
  person --> overlay
  yard -- command --> backend
  overlay -- command --> backend
  backend -- state, events --> yard
  backend -- layout --> overlay
  agent -- runs --> cli
  cli -- HTTP --> bridge
  bridge --> backend
  backend -- save --> data
  backend -- read --> pets
  backend -- chat --> ai
  backend -- update check --> releases
```

## Components
| Component | Location | Responsibility |
|---|---|---|
| Yard window | `src/index.html`, `src/app.js`, `src/yard/`, `src/panel/`, `src/core/`, `src/styles/` | Draws the scenery and friends, and opens the side panel (Friend, Invite, Settings). ES modules the browser reads with no build tool |
| Desktop window | `src/overlay.html`, `src/overlay/` | One transparent window per monitor. Draws friends where the backend places them and reports presses and drags |
| Commands | `src-tauri/src/commands.rs` | The single command the page calls (`call`) and the handling for each name. Decides which commands each window may call |
| App state | `src-tauri/src/app.rs` | `AppData` (friends, pet list, AI connections, chat history, status, the garden in `pets/garden.rs`, the album in `pets/album.rs`), loading and saving, announcing changes to every window, serving sprites. `state.json` carries a format number (`schema`); when an older version opens a file from a newer one, it keeps a copy and preserves unknown keys and connections as they are |
| Chat | `src-tauri/src/chat/` | Chat with one friend or several together. Keeps Claude CLI sessions alive, runs the Codex CLI, HTTP AI, prompts. Everything that differs per AI kind (request and response shape, key rules, default address) is one table in `kind.rs` |
| Pets | `src-tauri/src/pets/` | Unpacks the starter pets bundled with the app, reads and checks pet folders (in one place, `catalog.rs`), imports from community pages (`importer/`: each site is one record in `sites.rs`), creates and edits friends |
| Agent | `src-tauri/src/agent/` | The CLI mode of the same executable (hooks, MCP, status commands) and the local HTTP bridge inside the app. The agent list is one table in `kinds.rs`; the settings snippets to paste are in `snippets.rs` |
| Desktop | `src-tauri/src/desktop/` | Opens and closes the overlay windows, computes friends' strolls and drags, and makes a window take clicks only while the cursor is over a friend |
| Windows, tray, menus, OS open | `window.rs`, `tray.rs`, `menu.rs`, `system.rs` | The main window and mini mode (whose place is kept in `state.json` as `miniRect`), the tray menu, built again from the state on every change (check-marked switches that appear only when they apply, a mark on the icon when a coding agent waits) and the macOS menu bar (one handler, `menu::act`, for both), opening folders and addresses through the OS |
| Strings | `src-tauri/src/i18n/<language>.rs`, `src/core/strings/<language>.js` | Per-language sentence tables. Registered in `i18n/mod.rs` and `core/strings.js` |
| Import links | `src-tauri/src/links.rs` | Takes `playpets://import?url=…`, imports the pet through the same path as a pasted address, and opens the Invite tab |
| Saved files | `src-tauri/src/store.rs` | Reads and writes the JSON files in the data folder atomically. A file that cannot be parsed is kept as a timestamped copy beside it (`state.json.corrupt-…`) so nothing is lost |
| Auto-update | `src-tauri/src/update.rs` | Checks `latest.json` on the latest release, renames the tray's update item once a version is found, reports download progress (`update-progress`), verifies the signature, then installs and restarts |

## Data flow
What each arrow in the diagram actually carries, path by path.

1. **Page commands:** When the page calls something like `window.playPets.addPet(id)`, Tauri passes it to `commands::call`. `call` checks that the calling window may use that command (the overlay may use only five), and handles it on a worker thread. The handler changes `AppData` inside the app state lock and saves to `state.json`. The result comes back as `{ok, data}` or `{ok: false, error}`, and the error sentence is already in the current language.
2. **State notifications:** When state changes, `app::changed` builds the full state for the page and puts it into every window as `__pp('change', state)`. The page receives it and redraws. One-off happenings (speech bubbles, reactions, chat arrivals, window hidden, new version) are sent separately as `__pp('event', …)`.
3. **Sprites:** The backend takes the page's image address `pet-asset://sprite/<pet id>` (on Windows, `http://pet-asset.localhost/sprite/<pet id>`), reads the file on a worker thread and returns it. The page reads pixels to measure the empty rows at the top of each cell, so the response carries a CORS allow header.
4. **Agent status:** When a coding agent's hook runs `playpets hook claude`, the same executable runs in CLI mode with no window. It turns the hook payload into a state and a code (`@tool Bash`), reads the port and token from `bridge.json` in the data folder, and sends them to the app's bridge. The app turns the code into a sentence in the current language, shows it above the friend, and remembers it as recent activity to use when answering "what were you doing?".
5. **Chat:** When the page calls `chat`, the backend looks at the friend's AI connection and asks one of the Claude CLI (a long-lived session per friend), the Codex CLI (one run per message) or an HTTP AI. API keys are read from the OS secure storage after the lock is released. Answers stay in the in-memory chat history (the latest 24 per friend) and reach the page as a `chat-message` event. Chat history is not saved to a file.
6. **Desktop:** The overlay thread reads the cursor every 40ms (while moving) or 120ms (while quiet), advances strolls and drags by one step, and makes only the monitor window with the cursor over a friend take clicks. When a friend moves, it sends the layout to that monitor's window, and when the cursor comes onto a friend or leaves it, a `hover` event tells the windows which friend shows its name button. A friend belongs to the monitor whose work area holds the centre of its box. Resting positions are batched and saved within 2 seconds.
7. **Update:** 20 seconds after start (except in dev builds and E2E), or from the button in the Settings tab, the app reads `latest.json` from the latest GitHub release. If there is a new version it tells the page; when a person presses install, it downloads it, verifies the signature with the public key, installs and restarts.

## Interfaces
| Touchpoint | Source | Summary |
|---|---|---|
| Page → backend commands | The `COMMANDS` list and `dispatch` in `src-tauri/src/commands.rs` | Friends (add, update, remove, play), pet files (import, openFolder), AI and chat (saveProvider, chat, chatWith), yard chatter (chatter, setAutoChatter), the garden and its gifts (findSeed, plant, pullPlant, receiveGift, moveDecor, putAway), the album (catch), copying agent settings and choosing which friend an agent reports to (copyConnection, assignAgent), desktop and windows, language, update, quit. The overlay gets only bootstrap, play, openChat, dragStart, dragStop |
| Backend → page | `app::changed`, `app::push_event` | `change` (full state), `event` (status, say, play, chat-message, select, window, update, persona-saved, history-reset, import-request, pet-moved) |
| Sprites | `app::sprite_response` | The `pet-asset` custom protocol |
| Coding agents | [Architecture: coding agent integration](agent-integration.md) | CLI commands, hooks, MCP, HTTP bridge |

## Environment and touchpoints
The app data folder is named after the app identifier `app.playpets`. The identifier does not change after release.

| OS | Data folder |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` (the package virtualization path when installed through MSIX) |
| Linux | `$XDG_DATA_HOME` or `~/.local/share/app.playpets/` |

The folder holds `state.json` (friends, settings, AI connections), `bridge.json` (the agent bridge's port and token, which change on every launch), `pets/` (pets imported from an address) and `builtin/` (the three starter pets bundled in the executable, unpacked at launch). API keys are not in this folder but in the OS secure storage.

| Environment variable | Use |
|---|---|
| `PLAYPETS_DATA` | Changes the data folder (E2E, measurement) |
| `CODEX_HOME` | Changes the Codex pet folder (`<value>/pets`) |
| `PLAYPETS_LANG` | Pins the language to one of `ko`, `en`, `ja`, `zh-hans` |
| `PLAYPETS_E2E_EVAL` | The E2E scenario script. Honored only by an executable built with the `e2e` feature (`cargo build --features e2e`): it turns off single-instance, deep-link registration and the start-at-login plugin (the switch only pretends), turns on the `e2eLog` and `e2eWindow` commands, and skips the update check. It runs 3 seconds after the page loads |
| `PLAYPETS_BRIDGE`, `PLAYPETS_PET` | The `bridge.json` path and default friend for CLI mode |
| `PLAYPETS_DEBUG` | Makes `playpets hook …` print to standard error why it could not reach the app. Without it, a hook stays silent |
| `PLAYPETS_BINARY` | The executable E2E and measurement launch |

The system starts the app at login with `--autostart` (`tauri-plugin-autostart`: a LaunchAgent on macOS, the Run key on Windows, an autostart entry on Linux). Started that way with desktop mode on, the yard window stays hidden.

What differs per OS.

| OS | Differences |
|---|---|
| macOS | Turns the overlay into an NSPanel so it shows even over other apps' full screen, and restores the original class before closing (without that the app crashes). Closing the yard also hides the Dock icon. The menu bar exists only on macOS |
| Windows | The page draws the window title bar. CLI child processes get no console window. A `claude.cmd` installed through npm is run directly as node plus the script (a `.cmd` cannot take arguments that contain line breaks). Folders and addresses open through ShellExecuteW. Cursor coordinates are converted with the scale of the monitor under the cursor. When installed through MSIX, the agent settings point at the execution alias `playpets.exe` |
| Linux | The page draws the window title bar. Distributed as deb and AppImage; E2E runs on Xvfb |

## Related decisions
- "[The backend is split into folders by role, and main.rs only wires things up](decisions/2026-09-30-backend-modules-by-role.md)"
- "[Page modules run nothing on import and do not import each other in cycles](decisions/2026-09-30-page-modules-run-nothing-on-import.md)"
- "[Never wait on the main thread while holding the app state lock](decisions/2026-09-30-no-waiting-on-main-thread-under-state-lock.md)"
- "[The page draws often only when something moves, and drawing loops run on timers](decisions/2026-09-30-timer-frame-loops.md)"
- "[Strings live in two per-language tables, one for the page and one for the backend, and agent status is sent as codes](decisions/2026-09-30-strings-in-two-tables.md)"
- "[GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets](decisions/2026-10-01-distribution-channels-and-signing.md)"
- "[Real-app E2E runs a scenario script inside the app](decisions/2026-09-29-e2e-inside-the-real-app.md)"

## Change history
- 2026-09-29 Moved from Electron to a single Tauri v2 shell. The web page is in `src/`, the backend in `src-tauri/`
- 2026-09-30 Split the backend into folders by role. Added Korean, English and Japanese. Switched the page loops to timers and set the lock rule
- 2026-10-01 Added auto-update and distribution channels (winget, Homebrew tap)
- 2026-10-05 Bundled the three starter pets in the executable and unpacked them into the data folder (`pets/builtin.rs`), and added the import link scheme
- 2026-10-06 Added Simplified Chinese as the fourth language, relationships between a friend and the person, and yard chatter (friends talking among themselves, on a button or a timer)
