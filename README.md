# PlayPets

[![Banner: a yard where your pets talk to each other](assets/banner.png)](https://gaerae.github.io/playpets/)

**A yard where your pets talk to each other.** Bring the ten thousand Codex pets as they are. Each friend talks through its own AI: a Claude Code or Codex subscription, Ollama, or an OpenAI-compatible server. Friends keep the conversation going among themselves, and whatever coding agent is working has company. PlayPets is a separate open-source app that follows the Codex pet format. You don't need Codex.

[Website](https://gaerae.github.io/playpets/) · [User guide](https://gaerae.github.io/playpets/guide/) · [Releases](https://gaerae.github.io/playpets/releases/) · [Developer docs](https://gaerae.github.io/playpets/dev/)

한국어: [사이트](https://gaerae.github.io/playpets/ko/) · [사용 안내](https://gaerae.github.io/playpets/ko/guide/) · 简体中文: [网站](https://gaerae.github.io/playpets/zh-hans/) · [使用指南](https://gaerae.github.io/playpets/zh-hans/guide/)

[![build](https://github.com/gaerae/playpets/actions/workflows/build.yml/badge.svg)](https://github.com/gaerae/playpets/actions/workflows/build.yml) ![macOS · Windows · Linux](https://img.shields.io/badge/macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-Tauri%202-f9ae55) ![MIT](https://img.shields.io/badge/license-MIT-3a2a1e) ![Compatible with the Codex pet format](https://img.shields.io/badge/pets-Codex%20pet%20format%20compatible-4a9bd6)

More than ten pet apps that react to coding agents appeared in 2026, and nearly all are a single pet showing a status. PlayPets starts there and adds conversation and a place to live.

| | Codex pet | Most pet apps | PlayPets |
|---|---|---|---|
| Chat with a pet | No | No | Each friend: Claude Code, Codex, Ollama, OpenAI-compatible |
| Pets talking to each other | No | Scripted only | The AIs keep the conversation going |
| Where they live | Inside Codex | One pet over the desktop | A yard with time and weather, and the desktop |
| How many | One | Usually one | Several |
| Pet files | Codex format | Own or Codex format | Codex format as is, straight from a gallery address |
| Agent reactions | Codex | Hooks, several agents | Hooks and MCP, several agents |

![Three friends saying hi and going for a walk in the yard](assets/demo.gif)

- **Each friend, its own AI.** Claude Code or Codex CLI on your subscription (no extra fee), Ollama (on your own computer), or OpenAI and compatible APIs. Give each friend a different AI and personality, and pick a relationship: Friend, Partner, Reliable senior or Playful younger sibling.
- **Friends talk to each other.** When the AI brings another connected friend into the conversation, they answer in turn. Press "Let them chat" in the yard and friends keep talking among themselves. You can also let them chat now and then on their own. In the yard it shows as speech bubbles.
- **Friends at work.** Claude Code, Gemini CLI and Cursor hooks, Codex notifications and MCP pass thinking, tool use, permission requests and completion on to a friend. Give each agent its own friend. Ask "What were you doing?" and the friend tells you about recent work.
- **A living yard.** Morning, day, evening and night follow the clock, and the weather (clear, rain, snow) changes on its own. You can also pick them yourself. Put down a treat and friends walk over to eat it. Leave them alone and they wander and talk to themselves.
- **Desktop mode.** Pets stroll around the desktop (on macOS, even over other apps in full screen).
- **Play together.** Hide and seek (find the friend whose name is called), parade, and tag.
- **Three starter pets.** Tabby, Smoky and Mochi are included, so you can invite one the first time you open the app. They are drawn from the mascot in the Codex pet format and are MIT licensed.
- **Import community pets.** Paste the address of a pet page from OpenPets Registry (openpets.sh), Petdex, Codex PokéPets, Awesome Codex Pet (codexpet.top) or codex-pets.net, and the pet comes straight in. GitHub pet folder addresses and other sites built with codex-pet-share work too. Codex pets in `~/.codex/pets` load on their own. When a gallery adds a `playpets://import?url=<pet page>` link, one click brings the pet in.
- **Mini mode.** Keep a small window with just the yard, always on top.
- **Light.** Built with Tauri (Rust and the system webview), so the installer is small. The app redraws often only while something moves.

## Install

- Download the macOS dmg, the Windows installer or portable zip, or the Linux deb or AppImage from [GitHub releases](https://github.com/gaerae/playpets/releases). The builds are not code-signed yet, so macOS and Windows block the first launch once. The [install guide](https://gaerae.github.io/playpets/guide/install) shows how to get past it.
- To build it yourself, see [Development](#development) below.

## Getting started

1. In the **Invite** tab, invite one of the starter pets (Tabby, Smoky or Mochi) into the yard.
2. In the **Friend** tab, connect an AI. Installed Claude Code and Codex are found automatically. Ollama and OpenAI-compatible servers just need an address.
3. In the **Settings** tab, under coding agent hooks, copy the settings for your tool and paste them in. Now a friend reacts while your agent works.

## Coding agent integration

In the app's **Coding agent hooks** section, press "Copy settings" and paste. No Node.js needed: the app binary is the integration command.

| Tool | Where to paste | What it does |
|---|---|---|
| Claude Code (recommended) | `~/.claude/settings.json` | Reports every step through hooks |
| Codex CLI | `~/.codex/config.toml`, at the top | A note when a turn ends |
| Gemini CLI | `~/.gemini/settings.json` | Reports every step through hooks |
| Cursor | `~/.cursor/hooks.json` | Reports edits, commands and completion (observe-only hooks) |
| Other MCP tools | The tool's MCP settings | `set_pet_state`, `say`, `react`, `list_pets` |

```
playpets hook claude|gemini|cursor   # hooks (stdin JSON, always exit code 0; prints {} for Gemini and Cursor)
playpets hook codex <json>      # Codex notify
playpets mcp                    # MCP stdio server
playpets status <state> [message]   [--pet name|ID] [--bridge file]
playpets say <message>
playpets react <action>
playpets pets
playpets run -- <command>
```

Integrations stay on this computer (127.0.0.1, with token authentication). Your prompts and code are never sent to your pets.

## Data

- Data folder: macOS `~/Library/Application Support/app.playpets/`, Windows `%APPDATA%\app.playpets\`, Linux `~/.local/share/app.playpets/`. It holds `state.json` (pets and settings), `bridge.json` (integration port and token), `pets/` (imported pets) and `builtin/` (starter pets). Change it with `PLAYPETS_DATA`.
- Updates: a newer version shows as a button in the top bar and a dot on the Settings tab, and opens an update window ("What's new", "Later", "Install and restart" with progress). Check by hand under About PlayPets in the Settings tab, with "Check for updates…" in the tray, or from the macOS menu bar. The app also checks once, quietly, 20 seconds after it starts. It finds new versions through `latest.json` on GitHub releases and verifies them with the updater signing key before installing (from the first public release).
- Languages: Korean, English, Japanese and Simplified Chinese. The app follows the system language at first, and you can change it in the Settings tab (`language` in `state.json`). Force a language with `PLAYPETS_LANG=ko|en|ja|zh-hans` (for testing). Strings live per language in `src/core/strings/<language>.js` for the page and `src-tauri/src/i18n/<language>.rs` for the backend (how to add one: `docs/how-to/add-a-language.md`). Tests catch any Korean left inside a module. The app speaks English to coding agents and the terminal.
- API keys are stored only in the OS secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service).
- Conversations stay in memory only and are gone when the app quits.

## Development

Developer docs start at [docs/README.md](docs/README.md) (architecture, standards, procedures, decision records). For a first setup, follow [Set up a development environment and run the app](docs/getting-started.md).

You need Rust (stable, 1.98 or later), Node.js 26, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (webkit2gtk and others on Linux).

| Task | Command |
|---|---|
| Install dependencies | `npm ci` |
| Unit tests (Rust and page) | `npm test` |
| Tidy / check code layout | `npm run format` / `npm run lint` (rustfmt, clippy, Biome) |
| Real-app E2E | `npm run test:e2e` (isolated data folder, its own test pet, fake AI server) |
| Live check against community sites | `npm run test:live-import` |
| Site dev server / build | `npm run site:dev` / `npm run site:build` (includes dead link check) |
| Site screenshots (macOS) | `npm run shots -- x.y.z` → `website/public/shots/` |
| Installer art | `npm run art` (DMG window, Windows installer pictures, Linux store screenshots) |
| macOS distribution file (dmg) | `npm run dist:mac` → `release/macos/` |
| Linux distribution and E2E | `npm run dist:linux` (Docker) → `release/linux/` (deb and AppImage, E2E under Xvfb) |
| Windows x64 distribution | `npm run dist:windows` (Docker) → `release/windows/` (MinGW cross build, NSIS installer, portable zip, and an MSIX signed with a test certificate in `msix-test/`) |
| Real runners for every OS | `.github/workflows/build.yml` (builds and E2E on macOS, Windows x64/arm64 and Linux x64/arm64 for every push to main and every PR; artifacts are in the run) |
| Release | `npm run release -- x.y.z`, then `git push origin HEAD vx.y.z`. `.github/workflows/release.yml` builds every environment and creates a GitHub release draft with the changelog section as notes (details in [Release a new version](docs/how-to/release.md)) |
| Distribution channels | When a release is published, `.github/workflows/distribute.yml` makes the winget manifest and the Homebrew cask, and with tokens also opens the winget PR and updates the tap ([Signing keys and secrets](docs/standards/keys-and-secrets.md)) |
| Redraw icons | `npm run icons` (`assets/icon.svg` → every icon) |

```
src/              Page (HTML, CSS, JS, used as is with no build tool)
  index.html      Yard window · app.js entry point, render.js draws state, window.js window buttons and mini mode
  overlay.html    Desktop pet window · overlay/ its scripts and styles
  core/           Shared by both windows: state, sprites and animation, strings (i18n, strings), icons
  yard/           The yard: the painted scenery, friends, games, treats, the garden and its gifts,
                  fishing and bugs, closeness, seasonal events and the yard's sounds
  content/        What the yard is made of, as data: catalogue, composition, events · art/ its drawings
  panel/          Side panel: tabs, friends, chat, friend settings, AI connections, invite, settings
  styles/         Styles by area (base, shell, scenery, yard, panel, dialog, loaded in this order)
src-tauri/src/    App core (Rust)
  main.rs         Startup wiring · app.rs state (app/ loading, sprites) · commands.rs the COMMANDS table
  chat/           Chat, AI connections (subscription CLIs, HTTP), prompts
  pets/           Pet files, import from an address, friends in the yard
  agent/          Coding agents: the app's CLI mode (hooks, MCP) and the bridge
  desktop/        Desktop overlay and strolling
  i18n/           Backend strings tables
  *.rs            window, tray, system, store (data files), update, links (playpets://)
tests/            Page and script unit tests (*.test.mjs) and real-app E2E (e2e.mjs) · Rust tests live in each .rs file
packaging/        Distribution builds: macos (dmg), linux and windows (Docker, MSIX)
scripts/          Dev tools (release, distribution channels, site preparation, screenshots, installer art, OG images, mascot pets, measurement, icons)
assets/           Source art: icon, mascot, the three starter pets, banner and demo GIF
docs/             Developer docs (architecture, standards, how-to, decisions, design records)
website/          The site (VitePress): landing page, user guide and release pages in English (the root), Korean (ko/) and Simplified Chinese (zh-hans/); developer docs are copied in from docs/ to dev/
```

### Platform notes
- The macOS overlay is turned into an NSPanel so it shows even over other apps in full screen (`src-tauri/src/desktop/overlay.rs`).
- A Windows build made with MinGW needs `WebView2Loader.dll` next to the exe (the installer includes it, and the portable zip ships it). An MSVC build links it statically, so the exe is all you need.
- Windows mixed DPI: cursor coordinates are converted using the scale of the monitor under the cursor.
- Windows MSIX: `packaging/windows/msix/AppxManifest.xml` (a full-trust desktop app plus the execution alias `playpets.exe`). When installed as a package, the agent integration settings point at the alias instead of the executable path. For a Store submission, build with your Partner Center publisher ID in `MSIX_PUBLISHER`. How to test-install: `release/windows/msix-test/README.txt`.
- The app identifier `app.playpets` becomes the data folder name, so it does not change after release.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) has the check order, [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) has the code of conduct, and [SECURITY.md](SECURITY.md) explains how to report a vulnerability.

## Changelog

[CHANGELOG.md](CHANGELOG.md) lists the changes users can see in each release.

## License

MIT. See [LICENSE](LICENSE). The pet mascot art (`assets/`) is under the same license. Community pets you import belong to their creators, and their source is saved alongside them in `pet.json`.

## Trademarks

PlayPets is not affiliated with or endorsed by OpenAI. Codex is a trademark of OpenAI, and Claude, Gemini, Cursor and Ollama are trademarks of their respective companies. This app only reads the Codex pet file format.
