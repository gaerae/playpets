# PlayPets developer guide

## Overview and audience
PlayPets is a pet app whose pets play on the desktop and in the yard window. You connect an AI to a friend to chat with it, and friends react while a coding agent works. It is a Tauri v2 app: the page is web code with no build tool (`src/`), and the backend is Rust (`src-tauri/`). It runs on macOS, Windows and Linux.

This guide is the entry point for people who change the code, build integrations, or handle releases. How to use the app is in the [user guide on the site](https://gaerae.github.io/playpets/guide/) and in the repository [README](../README.md). These documents also appear as is under the site's "Developers" tab. The contribution process (PRs, check order) is in [CONTRIBUTING](../CONTRIBUTING.md).

## Key concepts
- **One app, two windows:** There is the yard window (the main window) and a transparent desktop window, one per monitor. Both windows only draw the state the backend holds.
- **Commands and notifications:** The page calls the backend through a single `window.playPets.<command>()`. When state changes, the backend sends the new state (`change`) to every window, and sends one-off happenings as events (`event`).
- **Pets and friends:** A pet is a character file (`pet.json` plus a sprite sheet, in the Codex pet format). A friend is a pet invited into the yard. Each friend has a name, a personality, a size and an AI connection.
- **AI connection:** The AI a friend uses to chat. Claude Code and Codex are asked through the user's subscription CLI; Ollama and OpenAI-compatible servers are asked over HTTP. API keys live only in the OS secure storage.
- **Agent integration:** Running the app executable as `playpets hook …` or `playpets mcp` runs it in CLI mode with no window, and it sends status to the running app through a local HTTP bridge. Node.js is not needed.
- **Strings tables:** Sentences shown to people live in two tables, one for the page and one for the backend, in Korean, English, Japanese and Simplified Chinese. Code uses only keys.
- **Lock rule and page redraws:** The backend never waits on the main thread while holding the state lock. The page redraws often only while something moves. These two rules exist to prevent freezes and battery drain.

## Area map
Go to a document based on what you want to know.

| What you want to know | Document |
|---|---|
| Getting the repo, running tests and starting the app for the first time | [Set up a development environment and run the app](getting-started.md) |
| How the app is built and what calls what | [Architecture: PlayPets app](architecture.md) |
| How coding agents reach the app; CLI, HTTP and MCP specs | [Architecture: coding agent integration](agent-integration.md) |
| Adding a backend command the page can call | [Add a backend command the page calls](how-to/add-a-command.md) |
| Releasing a new version and distribution channels | [Release a new version](how-to/release.md) |
| Changing the site (intro, user guide, version pages) | [Edit and check the website](how-to/website.md) |
| Adding a language the app speaks | [Add a language](how-to/add-a-language.md) |
| Where to look first when stuck | [Troubleshooting guide](troubleshooting.md) |

These are the standards to follow. Read the one for an area before changing it.

| Area | Standard |
|---|---|
| Page modules, styles | [Standard: Page code structure](standards/page-modules.md) |
| Backend concurrency | [Standard: Backend locks and threads](standards/backend-locks.md) |
| Strings and translation | [Standard: Multilingual strings](standards/i18n.md) |
| Draw loops, animation, overlay | [Standard: Page and backend performance](standards/performance.md) |
| Tests | [Standard: Testing](standards/testing.md) |
| Signing keys, tokens, certificates | [Standard: Managing signing keys and secrets](standards/keys-and-secrets.md) |
| Pet files | [Standard: Pet file format](standards/pet-files.md) |

These are the procedures for outages and incidents.

| Situation | Procedure |
|---|---|
| Updater signing key lost or leaked | [The updater signing key is lost or leaked](runbooks/updater-key-lost-or-leaked.md) |

## Getting started
If you are new, read in this order.

1. Follow [Set up a development environment and run the app](getting-started.md) to get the tests passing and start the app.
2. Read the diagram and data flow in [Architecture: PlayPets app](architecture.md). Find which component the part you want to change belongs to.
3. Read the standard for the area you are changing (the standards table above). Page changes almost always involve Page code structure and Multilingual strings; backend changes almost always involve Backend locks and threads.
4. Test in the check order in [CONTRIBUTING](../CONTRIBUTING.md) and open a PR. Add one line to `CHANGELOG.md` for any change users can see.

## Deep dives and reference
**Decision records**: why the structure is the way it is. The standards point to them as their basis.
- "[Real-app E2E runs a scenario script inside the app](decisions/2026-09-29-e2e-inside-the-real-app.md)"
- "[Page modules run nothing on import and do not import each other in cycles](decisions/2026-09-30-page-modules-run-nothing-on-import.md)"
- "[Strings live in two per-language tables, one for the page and one for the backend, and agent status is sent as codes](decisions/2026-09-30-strings-in-two-tables.md)"
- "[Pet pictures in chat (images that fit the moment) are on hold](decisions/2026-10-05-pet-pictures-on-hold.md)"
- "[The backend is split into folders by role, and main.rs only wires things up](decisions/2026-09-30-backend-modules-by-role.md)"
- "[Never wait on the main thread while holding the app state lock](decisions/2026-09-30-no-waiting-on-main-thread-under-state-lock.md)"
- "[The page draws often only when something moves, and drawing loops run on timers](decisions/2026-09-30-timer-frame-loops.md)"
- "[The version lives only in package.json, and a version tag creates a draft release](decisions/2026-09-30-releases-from-version-tags.md)"
- "[GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets](decisions/2026-10-01-distribution-channels-and-signing.md)"
- "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](decisions/2026-10-03-website-on-github-pages.md)"
- "[Lead with "a yard where your pets talk to each other", and treat Codex pet compatibility and hook reactions as the price of entry](decisions/2026-10-05-positioning-talking-friends.md)"

**Design records and research**
- [Stronger agent integration · community import · personality and activity memory](design/2026-09-29-agent-link-import-persona.md): the design as of 2026-09-29. Some file paths have changed since.
- [What do code signing and distribution channels cost for a desktop app, and in what order does PlayPets take them?](reference/code-signing-and-distribution.md): cost, units, identity checks, distribution channel requirements, and the order PlayPets takes. Kept up to date.
- [How do open-source desktop apps lay out their public websites?](reference/oss-desktop-app-websites.md): the case study behind the site's structure (2026-10-03).

**Repository automation**
| File | What it does |
|---|---|
| `.github/workflows/build.yml` | `build` job: lint, test, build and E2E on five environments. `site` job: builds the site, so a dead link fails the PR. Runs for every push to main and every PR |
| `.github/workflows/release.yml` | Builds every environment from a version tag into a release draft |
| `.github/workflows/distribute.yml` | winget manifest and Homebrew cask from a published release |
| `.github/workflows/pages.yml` | Builds the site and publishes it to GitHub Pages on every push to main |
| `website/` | The VitePress site. Developer docs are copied from `docs/` at build time |
| `packaging/` | Local distribution builds (macOS dmg; Linux and Windows through Docker) |
| `scripts/` | Icon generation, release, distribution file generation, CPU measurement, site preparation, screen capture, mascot pets |

**Common commands**
| Command | What it does |
|---|---|
| `npm test` | Rust unit tests and page tests |
| `npm run lint` / `npm run format` | Check / tidy code layout (rustfmt, clippy, Biome) |
| `npm run test:e2e` | Real-app E2E |
| `npm run measure` | CPU measurement in five states (macOS, Linux) |
| `npm run site:dev` / `site:build` | Site dev server / build (includes dead link check) |
| `npm run shots -- x.y.z` | Real-app screenshots in every app language (macOS) |
| `npm run mascot-pet` | Redraw the sprite sheets of the three sample pets (tabby, smoky, mochi) |
| `npm run og` | Redraw the share cards (`website/public/og.png` in English, `og-ko.png`, `og-zh-hans.png`) and the README banner |
| `npm run art` | Redraw the installer art: the macOS disk image background (`packaging/macos/dmg-background.png`), the Windows installer's sidebar and header (`packaging/windows/nsis-*.bmp`), and the English screenshots Linux software centers show (`website/public/listing/en/`, from the current captures). Where each is used is set in `src-tauri/tauri.conf.json` (`bundle.macOS.dmg`, `bundle.windows.nsis`, `bundle.linux`) and `packaging/linux/app.playpets.metainfo.xml` |
| `npm run dist:mac`, `dist:windows`, `dist:linux` | Local distribution files (`release/`) |
| `npm run release -- x.y.z` | Release commit and tag |
| `npm run icons` | Every icon from `assets/icon.svg` |

## Frequently asked questions
**Can I change Windows code without checking it on Windows?**
You can check that it compiles with `npm run dist:windows` (Docker), and the CI Windows runner runs E2E. For things you only learn by running, like window behavior, say in the PR description that it needs checking.

**Why does the page have no bundler?**
The browser reads the page's ES modules as they are. With no build step, the file you edit is the file that runs, and tests enforce the module rules instead. The full reasoning is in the decision "Page modules run nothing on import…".

**Do I need a signing key to develop?**
No. Tests, E2E and local distribution builds all run without keys. Keys are used only in CI when a maintainer releases.

**How do I change a string?**
For a sentence on the page, edit `src/core/strings/<language>.js`; for a backend sentence, edit `src-tauri/src/i18n/<language>.rs`. Change every language together (the Korean file is the reference). The rules are in the Multilingual strings standard.
