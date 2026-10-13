# Set up a development environment and run the app

## Purpose
Get the repository, make the tests pass, and run an app you built yourself with an isolated data folder so you can see page changes with your own eyes. This is a procedure a first-time contributor follows once. How the code is laid out is in [PlayPets app architecture](architecture.md).

## Audience and assumptions
The same commands run on macOS, Linux and Windows. Command examples use a macOS and Linux shell; places where Windows PowerShell differs are noted separately. This procedure uses no signing keys or secrets.

## Prerequisites
| What you need | Version | Check command |
|---|---|---|
| Rust | stable, 1.98 or later | `rustc --version` |
| Node.js | 26 (`.node-version`) | `node --version` |
| npm | 11 or later, included with Node.js 26 | `npm --version` |
| git | any version | `git --version` |
| Tauri prerequisites | per OS | below |

- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Linux (Debian, Ubuntu): install the same packages as CI.

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev libdbus-1-dev patchelf xvfb dbus-x11
```

- Windows: "Desktop development with C++" from Visual Studio Build Tools, and the WebView2 runtime (included in Windows 11).
- For other OS requirements, follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Steps
1. Get the repository.

```bash
git clone https://github.com/gaerae/playpets.git
cd playpets
```

2. Install the dependencies and add the Rust check tools.

```bash
npm ci
rustup component add rustfmt clippy
```

3. Run the unit tests and lint.

```bash
npm test
npm run lint
```

4. Run the real-app E2E. It builds a test executable of its own in `src-tauri/target/e2e/`, so the first run takes a few minutes.

```bash
npm run test:e2e
```

5. If an installed PlayPets is running, quit it with "Quit" in the tray menu. If it is running, the newly started app brings the running one to the front and exits right away.

6. Build the normal app executable and run it with an isolated data folder. The
E2E build has test-only features and stays in its own folder, so `npm run start`
runs only what `npm run build:app` made. This leaves the friends and settings you
normally use untouched.

```bash
npm run build:app
PLAYPETS_DATA="$PWD/.dev-data" npm run start
```

In Windows PowerShell, start it like this.

```powershell
npm run build:app
$env:PLAYPETS_DATA = "$PWD\.dev-data"
npm run start
```

7. Pick a pet in the Invite tab. The ten starter entries are always there, and pets in `~/.codex/pets` and community pets pasted in through "Import a pet" show on the shelf too.

8. After changing page code, build again and start the app. Page files go into the executable at build time, so you need a build to see your change.

```bash
npm run build:app && PLAYPETS_DATA="$PWD/.dev-data" npm run start
```

## Verification
- At the end of `npm test`, Rust prints `test result: ok` and Node prints `fail 0`.
- At the end of `npm run test:e2e`, `PASS: tauri e2e` is printed.
- The app opens, and with no pets the yard asks "Who would you like to play with?" over the first three starter pets.
- `.dev-data/state.json` is created, and the friend you invited is in it.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `cargo: command not found` | `~/.cargo/bin` is not on PATH. `export PATH="$HOME/.cargo/bin:$PATH"` |
| `npm run start` opens nothing | An installed PlayPets is running (step 5). Or there is no release build yet (step 4 or 8) |
| E2E prints "The app window was covered, so hide and seek only checked start and stop" | This is not a failure. When the window is covered, WebKit pauses animations, so the walking check is skipped |
| The Linux build cannot find `webkit2gtk` | Install the packages from Prerequisites |

For anything else that blocks you, see the [Troubleshooting guide](troubleshooting.md).
