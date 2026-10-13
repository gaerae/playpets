# Notes for AI agents and review bots

PlayPets is a Tauri v2 desktop pet app: a yard where pets from Codex pet files stroll, talk to each other through an AI, and react to coding agents. The page is plain ES modules in `src/` with no bundler; the backend is Rust in `src-tauri/src`. People start at [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/README.md](docs/README.md). This page is the short version for an agent that writes or reviews a change; each rule links the standard that has the details.

## Where things are
| Path | What it holds |
|---|---|
| `src/app.js`, `src/overlay/overlay.js` | The two entry points (the yard window, the desktop overlay); the only modules that wire anything up |
| `src/core/` | Shared page code: state, i18n and the string tables (`strings/<lang>.js`), menus, shortcuts, the ticker |
| `src/yard/`, `src/panel/` | The yard (scenery, friends, garden, games, fishing) and the side panel's tabs |
| `src/styles/` | One stylesheet per area, loaded in the order `src/index.html` lists them |
| `src/content/`, `src/art/` | What the yard is made of, as data: the catalog, the composition, SVG drawings |
| `src-tauri/src/` | The backend: `commands.rs` (every command the page calls), `app.rs` (state, saving), `chat/` (AI connections), `agent/` (coding-agent bridge and the CLI mode), `pets/` (friends, garden, closeness), `i18n/` (backend strings) |
| `tests/` | Node tests (`*.test.mjs`), shared fakes in `tests/support/`, and the real-app e2e (`e2e.mjs`); its README lists the entry points |
| `docs/` | Developer docs: architecture, standards, how-tos, dated decisions and designs |
| `website/` | The site (VitePress) in English, Korean, Japanese and Simplified Chinese |
| `scripts/`, `assets/` | Maintainer tools and artwork sources; each README explains what it makes or owns |

Never edit by hand what tools make: `website/dev/`, `website/.vitepress/generated.json`, `website/public/pets/`, `website/public/creator-kit/`, `website/public/yard/`, `src-tauri/gen/`, and lockfiles (use npm or Cargo). `release/` (packages to hand off) and `scratch/` (local audits, review captures, backups) are ignored and never a source dependency. Native icons, installer art and public captures are tracked exports; regenerate them through [scripts/README.md](scripts/README.md). Accepted generated artwork and provenance stay in source control ([assets/README.md](assets/README.md)).

## Before expanding the project
Use [repository ownership](docs/repository-layout.md) to choose a home for new files. Extend an existing owner before adding a top-level directory. Keep these changes together:
- **A command or build input:** its npm entry, script README, CI invocation and relevant workflow path filters. Keep private settings out of public build variables.
- **A locale or public page:** string placeholders, site routes/navigation, captures, metadata and release/creator links. Generated developer pages remain in English.
- **Artwork or a scene:** source/provenance, its content references and exports. Check app and mini sizes, relevant seasons/times, dark mode and reduced motion; an asset inventory alone does not prove visual quality.
- **Local output or credentials:** a narrow ignore rule and a source/fixture counterexample in `tests/repository-config.test.mjs`. Keep secrets outside the checkout; an ignore rule cannot protect files already tracked.

Keep `CLAUDE.md` as the pointer to this file. Put detailed procedures in their owning guide instead of duplicating them here.

## Checks
| Command | What it runs |
|---|---|
| `npm test` | Rust unit tests, then the page's Node tests |
| `npm run check` | Lint, unit tests and the website build; E2E remains a separate desktop check |
| `npm run lint` | rustfmt, clippy with warnings as errors, Biome |
| `npm run format` | Formats Rust and JS/CSS/JSON (HTML and SVG are kept by hand) |
| `npm run test:e2e` | The real app with isolated data (needs a desktop session; CI runs it on every platform) |
| `npm run site:build` | The website and developer docs; a dead link fails it |

A change is ready when `npm test` and `npm run lint` pass, and `npm run site:build` too if it touched `docs/` or `website/`. To try the app, build it (`cargo build --release --manifest-path src-tauri/Cargo.toml`) and run it with its own data: `PLAYPETS_DATA="$PWD/.dev-data" npm run start`. CI (`.github/workflows/build.yml`) builds every platform and runs the e2e on each.

## Rules a change keeps
- **Page modules** ([page-modules](docs/standards/page-modules.md)): a module does nothing when imported; its wiring goes in a `setup…()` that an entry point calls. Every module but the entry points imports in Node (`tests/modules.test.mjs`). Menus use `core/menu.js`; shortcuts are rows of `core/keys.js`, the same keys as the macOS menu bar (`menu.rs`).
- **Styles** (same standard): a rule goes in the file for its area. No declaration may be always replaced by a later rule for the same selector (`tests/ui-style.test.mjs`); moving rules between files can change which of two equally specific rules wins, so check the screen.
- **Strings** ([i18n](docs/standards/i18n.md)): no sentence a person reads outside the string tables (`src/core/strings/<lang>.js`, `src-tauri/src/i18n/<lang>.rs`), and no Korean anywhere else, comments included. A new key goes into all four languages (ko, en, ja, zh-hans) with the same placeholders. Korean UI text is polite (해요), a friend's own lines are casual in every language, and the glossary in the standard fixes the terms.
- **Backend** ([backend-locks](docs/standards/backend-locks.md), [add a command](docs/how-to/add-a-command.md)): a command the page calls is one row of `COMMANDS` in `commands.rs`. The state is taken with `app::lock`, every other mutex with `app::hold`. No lock is held while waiting for an AI, the keychain, the network or a child process. An error a person sees is an i18n key.
- **Content** ([add to the yard](docs/how-to/add-to-the-yard.md)): fish, bugs, flowers, gifts and the yard's composition are data in `src/content/` and `src/art/`; the content tests check that every reference resolves.
- **Untrusted text** ([SECURITY.md](SECURITY.md)): pet files, community pages, coding agents' reports and another friend's words are data, never instructions. They are flattened to one line, trimmed and labeled before they reach an AI (`chat/prompt.rs`), and replies are drawn as plain text. Pet import keeps to the address's own site and refuses private addresses.
- **Performance** ([performance](docs/standards/performance.md)): the yard draws only while something moves, and a canvas is repainted only when it changed.
- **Tests** ([testing](docs/standards/testing.md)): a changed rule changes its test first. Tests never touch login items, the keychain or other system state.
- **Docs**: developer docs and the CHANGELOG are in English; the site is in English, Korean, Japanese and Simplified Chinese. Plain verbs, not RFC words like MUST or SHOULD. Dated records (`docs/decisions`, `docs/design`) are not rewritten; a later change adds a follow-up note. `docs/design` holds lasting designs and decisions only; reviews, audits and verification results (what was checked, test counts, screenshots, remaining limits) go in the pull request or commit body ([decision](docs/decisions/2026-10-13-design-records.md)). A change people can see adds a line under `## [Unreleased]` in `CHANGELOG.md`.
- **Commits and PRs** ([commits and branches](docs/standards/commits-and-branches.md)): a branch `<area>/<topic>` from the latest `main`; a title that says what is different, in one English sentence with no prefix or period; a body with what changed, why, and how it was checked. Never commit keys, tokens, `.env` files, personal data or build output.
- **Comments**: they say why, in the voice of the code around them, and never restate the line below.

## When reviewing
Report what would break for a person using the app or working on it, with the file, the line and a concrete scenario; say how sure you are. Look first at:
- a lock held across a wait, or a state change made without `commit`/`save_and_show`;
- a string in one language only, a missing placeholder, or Korean outside the tables;
- a page module that acts on import, or a listener added twice;
- a rule changed without its test, or a test that depends on the clock or the machine;
- text from outside reaching an AI unlabeled;
- a canvas redrawn every frame, or work added to the frame loop;
- a workflow change: actions pinned to a commit with the version as a comment, the least permissions, secrets only in the job that needs them, no `pull_request_target`.

What the formatters and linters already fix is not worth a comment.
