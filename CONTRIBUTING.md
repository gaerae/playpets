# Contributing to PlayPets

- Developer docs start at [docs/README.md](docs/README.md): architecture, standards and procedures.
- This file covers only the order of work up to opening a PR.
- The [Code of Conduct](CODE_OF_CONDUCT.md) applies everywhere you take part.
- Report security issues privately, as [SECURITY.md](SECURITY.md) describes.

## Setup
- Follow [Set up a development environment and run the app](docs/getting-started.md) once.
- In short: Node.js 26.12.1 or later (`.node-version`), Rust stable 1.99 or later, the Tauri prerequisites for your OS, then `npm ci` and `rustup component add rustfmt clippy`.

## Order of changing and checking
- `npm run check` runs lint, unit tests and the site build together.
- For a focused iteration, use `test:js`, `test:rust`, `lint:js` or `lint:rust`;
  run the combined checks before a PR.
- Where source, generated content and local output belong:
  [repository layout](docs/repository-layout.md).

1. Read the standards for the area you change ([list of standards](docs/README.md#area-map)).
   - Page: [page code structure](docs/standards/page-modules.md) and [multilingual strings](docs/standards/i18n.md) almost always apply.
   - Backend: [backend locks and threads](docs/standards/backend-locks.md).
2. When a rule changes, change the test first, watch it fail, then change the code ([testing standard](docs/standards/testing.md)).
3. `npm test` — Rust unit tests and page-side tests
   `npm run lint` — code format (rustfmt, Biome) and static checks (clippy, Oxlint, Biome). Warnings count as failures too (same as CI)
4. `npm run test:e2e` — runs the real app with isolated data and checks it end to end
5. Screen changed: build it and look (steps 6 and 8 of the getting-started doc).
6. Drawing loop or animations changed: run `npm run measure` before and after, and attach the results to the PR ([performance standard](docs/standards/performance.md)).
7. Change people can see: add one line in English under `## [Unreleased]` in `CHANGELOG.md`, in the same PR. Website, user guide and README changes go under `### Website and docs`; tests, CI and developer docs need no line. The release pages are written at release time ([release notes rules](docs/standards/writing.md#release-notes)).
8. Site (`website/`) or `docs/` changed: `npm run site:build` has to pass. Dead links block the build ([Edit and check the website](docs/how-to/website.md)).

## Commits and PRs
Full rules: [commits, branches and history](docs/standards/commits-and-branches.md). In short:
- Branch from the latest `main` as `<area>/<topic>` (`yard/lake-shape`, `fix/gift-day`), then open a PR.
- Small PRs get in faster.
- Fill in the template's checklist; add the issue number if there is a related issue.
- Commit title: one English sentence describing the changed result, no period, like "The yard shows friends talking and working".
- Commit body: what changed, why you did it that way, how you checked it.
- Every commit passes `npm test` and `npm run lint`.
- Commit with your GitHub no-reply email (`git config user.email <id>+<name>@users.noreply.github.com`).
- Never commit keys, tokens, personal data or generated build output.
- Reviewed source artwork and reproducible asset exports already tracked by the repository stay with their source and provenance.
- A maintainer reviews and merges.
- First time? Start with issues labeled `good first issue`.

## Code format
- Do not format by hand. `npm run format` formats:
  - Rust with rustfmt (`src-tauri/rustfmt.toml`)
  - JS, CSS and JSON with Biome (`biome.jsonc`)
- The recommended extensions (`.vscode/extensions.json`) provide these formatters.
- Recommendations alone do not enable format-on-save; turn it on in your local editor settings if wanted.
- HTML and SVG are kept by hand (a formatter does not help files like a one-line logo path).

## Tone
- UI and error text is written in every app language: Korean, English, Japanese, Simplified Chinese.
- Each language has its own tone: Korean friendly and polite, English short plain sentences.
- Spell out developer jargon in plain words.
- Per-language tone and what pet, friend, import and invite mean: [multilingual strings](docs/standards/i18n.md).
- Translate a new key in every language before integrating it.
- Need translation help? Ask in the PR. Copying English into the other tables hides missing translations from the parity checks.

## Releases and secrets
- Maintainers handle these.
- Procedure: [Release a new version](docs/how-to/release.md).
- Keys and tokens: [signing keys and secrets](docs/standards/keys-and-secrets.md).
- Contributing needs no keys at all.
