# Contributing to PlayPets

Developer docs start at [docs/README.md](docs/README.md): the architecture, the standards to follow and the procedures all branch out from there. This file covers only the order of work up to opening a PR. The [Code of Conduct](CODE_OF_CONDUCT.md) applies everywhere you take part, and please report security issues privately as described in [SECURITY.md](SECURITY.md).

## Setup
Follow [Set up a development environment and run the app](docs/getting-started.md) once. In short: Node.js 26 (`.node-version`), Rust stable 1.98 or later, the Tauri prerequisites for your OS, then `npm ci` and `rustup component add rustfmt clippy`.

## Order of changing and checking
1. Read the standards for the area you are changing ([list of standards](docs/README.md#area-map)). For the page, [page code structure](docs/standards/page-modules.md) and [multilingual strings](docs/standards/i18n.md) almost always apply; for the backend, [backend locks and threads](docs/standards/backend-locks.md) does.
2. When a rule changes, change the test first, watch it fail, then change the code ([testing standard](docs/standards/testing.md)).
3. `npm test` — Rust unit tests and page-side tests
   `npm run lint` — code format (rustfmt, Biome) and static checks (clippy, Biome). Warnings count as failures too (same as CI)
4. `npm run test:e2e` — runs the real app with isolated data and checks it end to end
5. If the screen changed, build it yourself and look (steps 6 and 8 of the getting-started doc).
6. If you changed the drawing loop or animations, run `npm run measure` before and after the change and attach the results to the PR ([performance standard](docs/standards/performance.md)).
7. For changes people can see, add one line in English under `## [Unreleased]` in `CHANGELOG.md` in the same PR.
8. If you changed the site (`website/`) or `docs/`, `npm run site:build` has to pass. Dead links block the build ([Edit and check the website](docs/how-to/website.md)).

## Commits and PRs
- Write the commit title as one sentence describing the changed result (in English, no period), like "The yard shows friends talking and working", so readers can tell what is different. Put why you did it that way in the body.
- Create a branch and open a PR. Small PRs get in faster. Fill in the template's checklist, and add the issue number if there is a related issue.
- A maintainer reviews and merges. If this is your first time, start with issues labeled `good first issue`.

## Code format
Do not format by hand. `npm run format` formats Rust with rustfmt (`src-tauri/rustfmt.toml`) and JS, CSS and JSON with Biome (`biome.jsonc`). In your editor, the recommended extensions (`.vscode/extensions.json`) apply the same rules on save. HTML and SVG are kept by hand (files where a formatter does not help, like a one-line logo path).

## Tone
UI and error text is written in every app language (Korean, English, Japanese, Simplified Chinese), and each has its own tone: Korean uses the polite 해요체 style, English short plain sentences. Spell out developer jargon in plain words. The tone for each language and what words like pet, friend, import and invite mean are in [multilingual strings](docs/standards/i18n.md). If you only write one language, add the key to every table with your text and say so in the PR; a maintainer fills in the rest.

## Releases and secrets
Maintainers handle these. The procedure is in [Release a new version](docs/how-to/release.md), and keys and tokens are in [signing keys and secrets](docs/standards/keys-and-secrets.md). Contributing needs no keys at all.
