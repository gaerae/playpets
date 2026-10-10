# Decision: Real-app E2E runs a scenario script inside the app

## Context
PlayPets is a Tauri app, so the page (WebKit or WebView2) and the Rust backend run as one bundle of processes. Testing the page on its own cannot check backend commands, saved state, the overlay window or the agent CLI mode. The standard way to drive an app from outside is WebDriver, but Tauri's WebDriver (`tauri-driver`) supports only Linux and Windows. There is no driver for WKWebView on macOS. The main development machine is a Mac, and an E2E suite that does not run on macOS does not run every day.

## Decision
We launch the real release executable with an isolated data folder, and the app runs a scenario script, passed in the environment variable `PLAYPETS_E2E_EVAL`, inside the page. The script uses the page's real bridge (`window.playPets`) and buttons. It reports results through the backend's `e2eLog` command, which prints `[e2e] …` lines to standard output. The harness (`tests/e2e.mjs`) compares those lines with a list of expected ones. The `e2eLog` command and the release of the single-instance lock turn on only when this environment variable is set.

The harness fakes whatever the scenario needs from outside. `tests/support/fixture-pet.mjs` makes the test pets, a fake Ollama server takes the HTTP AI calls, and the agent side calls the CLI mode of the same executable directly.

## Consequences
- Positive: The same scenario runs on macOS, Linux (Xvfb) and Windows runners. Backend commands, saving, the overlay, the CLI mode and MCP are all checked in one pass. No extra driver or browser to install.
- Negative: The scenario lives inside a JS template string, so a syntax error shows up only as every check failing (the harness parses it first to soften this). WebKit pauses animation when the window is covered, so checks that depend on walking (hide and seek) are skipped. There is no pixel-level screen comparison.
- Neutral: Two E2E-only paths stay in the product code (`e2eLog` and the environment variable branch). Neither does anything without the environment variable.

## Follow-up (2026-10-06)
The E2E hooks are now compiled in only with the `e2e` Cargo feature (`[features]` in `src-tauri/Cargo.toml`). `e2e_mode()` in `src-tauri/src/commands.rs` is true only when the build has that feature and `PLAYPETS_E2E_EVAL` is set, so a shipped build ignores the variable: it runs no scenario, has no `e2eLog` or `e2eWindow` command, and keeps the single-instance lock. `npm run test:e2e`, `npm run measure` and `npm run shots` each build the real app with `cargo build --release --features e2e` before they run, and both CPU measurement and screenshots now drive that real app instead of a page on a static server.

## Follow-up (2026-10-10)
The E2E-only commands are the `test_only` rows of the `COMMANDS` table in `src-tauri/src/commands.rs`: `e2eLog`, `e2eWindow`, `e2eTray` (the tray menu as last built) and `e2eFreshGifts`. They can be called only in an e2e run, and the page's bridge never offers them.

## Alternatives considered
- **Drive the app from outside with WebDriver (`tauri-driver`):** The standard approach, but it does not support macOS. It cannot run on the main development machine.
- **Serve only the page from a static server and automate a browser:** Useful for checking the page (we use it for performance measurements and screenshots), but the backend is fake, so it cannot check saving, the overlay or the CLI.
