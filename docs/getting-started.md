# Set up a development environment and run the app

## Purpose
- Get the repository, make the tests pass, and run your own build with an isolated data folder so you can see page changes for yourself.
- A first-time contributor follows this once.
- How the code is laid out: [PlayPets app architecture](architecture.md).

## Audience and assumptions
- The same commands run on macOS, Linux and Windows.
- Examples use a macOS or Linux shell. Windows PowerShell versions are shown where they differ.
- You need no signing keys or secrets.

## Prerequisites
| What you need | Version | Check command |
|---|---|---|
| Rust | stable, 1.99 or later | `rustc --version` |
| Node.js | 26.12.1 or later (`.node-version`) | `node --version` |
| pnpm | 12.16.1 (`packageManager` in `package.json`) | `pnpm --version` |
| Python | 3.15 (as in CI), with the pinned Pillow dependency | `python3 --version` (`py --version` on Windows) |
| git | any version | `git --version` |
| Tauri prerequisites | per OS | below |

- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Linux (Debian, Ubuntu): the same packages as CI.

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev libdbus-1-dev patchelf xvfb dbus-x11 openbox x11-utils
```

- Windows: "Desktop development with C++" from Visual Studio Build Tools, and the WebView2 runtime (included in Windows 11).
- Other OS requirements: the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
- pnpm: Node.js 26 ships no corepack, so install it with the npm that comes with Node.js.

```bash
npm install -g pnpm@12.16.1
```

## Steps
1. Get the repository.

```bash
git clone https://github.com/gaerae/playpets.git
cd playpets
```

2. Install the dependencies and confirm the Rust toolchain.

```bash
pnpm install --frozen-lockfile
rustup show active-toolchain
```

- The root `rust-toolchain.toml` requests stable Rust with clippy and rustfmt, for commands run here or in `src-tauri/`.
- It follows stable updates rather than pinning a compiler release.
- `src-tauri/Cargo.toml` records the minimum supported Rust version.
- Container builds keep the compiler and cross targets installed in their Rust base image.
- pnpm records exact versions for new direct dependencies (`pnpm-workspace.yaml`).
- No dependency's install script runs; pnpm stops on a new package with one until it is listed in `allowBuilds`.
- `pnpm install --frozen-lockfile` installs from the existing lockfile.
- The creator helper tests also need Python and Pillow:
  - Use a virtual environment outside the checkout.
  - Activate it in each new shell before you run tests.

```bash
python3 -m venv "$HOME/.virtualenvs/playpets"
. "$HOME/.virtualenvs/playpets/bin/activate"
python -m pip install -r assets/creator-skill/playpets-creator/requirements.txt
```

In Windows PowerShell:

```powershell
py -3 -m venv "$env:LOCALAPPDATA\PlayPetsDev"
& "$env:LOCALAPPDATA\PlayPetsDev\Scripts\Activate.ps1"
python -m pip install -r assets/creator-skill/playpets-creator/requirements.txt
```

- Already have Pillow in an environment? Set `PLAYPETS_PYTHON` to its Python executable instead.
- `PLAYPETS_PYTHON` selects the interpreter for the creator tests. It installs nothing.

3. Run the unit tests and lint.

```bash
pnpm test
pnpm run lint
```

4. Run the real-app E2E.
   - It builds a test executable of its own in `src-tauri/target/e2e/`.
   - The first run takes a few minutes.

```bash
pnpm run test:e2e
```

5. Quit any installed PlayPets with "Quit" in the tray menu.
   - While it runs, a newly started app brings the running one to the front and exits right away.

6. Build the normal app executable and run it with an isolated data folder.
   - The E2E build has test-only features and stays in its own folder, so `pnpm run start` runs only what `pnpm run build:app` built.
   - Your usual friends and settings stay untouched.

```bash
pnpm run build:app
PLAYPETS_DATA="$PWD/.dev-data" pnpm run start
```

In Windows PowerShell:

```powershell
pnpm run build:app
$env:PLAYPETS_DATA = "$PWD\.dev-data"
pnpm run start
```

7. Pick a pet in the Invite tab.
   - The four illustrated starter entries are always there.
   - Pets in `~/.codex/pets` and community pets pasted in through "Import a pet" show on the shelf too.

8. After changing page code, rebuild and start the app.
   - Page files are built into the executable, so every change needs a build.

```bash
pnpm run build:app && PLAYPETS_DATA="$PWD/.dev-data" pnpm run start
```

## Optional editor setup

- The repository recommends the Oxc (Oxlint and Oxfmt), Biome (CSS checks), rust-analyzer and EditorConfig extensions.
- Keep personal editor settings in the ignored `.vscode/settings.json`.
- A starting point for format-on-save and Rust checks:

```json
{
  "[javascript]": {
    "editor.defaultFormatter": "oxc.oxc-vscode",
    "editor.formatOnSave": true
  },
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer",
    "editor.formatOnSave": true
  },
  "rust-analyzer.linkedProjects": ["src-tauri/Cargo.toml"],
  "rust-analyzer.check.command": "clippy",
  "files.watcherExclude": {
    "**/src-tauri/target/**": true,
    "**/website/.vitepress/**": true
  }
}
```

- Security checks run separately in CI.
- Maintainers can also run them locally:
  - Install Gitleaks 8.30.1 and cargo-audit 0.22.2 (`cargo install cargo-audit --version 0.22.2 --locked`).
  - Run `pnpm run security:check`.
  - See the [security policy](https://github.com/gaerae/playpets/blob/main/SECURITY.md#automated-security-checks).

## Verification
- At the end of `pnpm test`, Rust prints `test result: ok` and Node prints `fail 0`.
- At the end of `pnpm run test:e2e`, `PASS: tauri e2e` is printed.
- The app opens. With no pets invited yet, the yard asks "Who would you like to play with?" over all four starter pets.
- `.dev-data/state.json` exists and holds the friend you invited.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `cargo: command not found` | `~/.cargo/bin` is not on `PATH`. Run `export PATH="$HOME/.cargo/bin:$PATH"` |
| `pnpm run start` opens nothing | An installed PlayPets is running (step 5). Or there is no release build yet (step 4 or 8) |
| E2E prints "The app window was covered, so hide and seek only checked start and stop" | Not a failure. WebKit pauses animations in a covered window, so the walking check is skipped |
| The Linux build cannot find `webkit2gtk` | Install the packages from Prerequisites |

- Anything else that blocks you: the [Troubleshooting guide](troubleshooting.md).
