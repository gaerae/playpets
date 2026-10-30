# Repository layout and tooling

## Find the right owner

- The root holds repository-wide configuration and the documents GitHub shows to contributors.
- Runtime code, website content and packaging each have their own directory.
- Keep to these boundaries when you add a feature.

| Directory | Owns | Keep out |
| --- | --- | --- |
| `src/` | The shipped page, shared core, yard, panels, styles and runtime artwork | Node tooling and website-only components |
| `src-tauri/` | Rust backend, Tauri configuration, capabilities and native icon exports | Website code and generated build output in commits |
| `website/` | Four-language public pages, Vue theme and public site media | Hand-edited copies of developer docs or generated pet downloads |
| `docs/` | Current developer instructions, standards, dated decisions and research | User-facing translations maintained on the site |
| `assets/` | Character source material, accepted atlases, creator references and brand sources | Disposable generation attempts and build logs |
| `packaging/` | Platform-specific installer resources and local distribution recipes | App behavior and release credentials |
| `scripts/` | Maintainer commands and pure helpers used by them | Runtime imports from the app |
| `tests/` | Node test entries, isolated native E2E, helpers and shared fixtures | Private user data and captured build output |
| `release/` | Ignored local packages from `pnpm run dist:*` and the store pictures from `pnpm run shots` | Audits, experiments, keys, or source that CI needs |
| `scratch/` | Ignored local audits, review captures, optimization backups and experiments | Packages, keys, or source that CI needs |

- The runtime module split already follows ownership boundaries.
- Script and test entry points stay flat, so imports and documented commands stay stable.
- Their directory READMEs group them by purpose.
- New shared test helpers go in `tests/support/`, reusable data in `tests/fixtures/`.
- Move a feature into a subdirectory when it needs its own helper modules, not just to shorten a listing.
- Update imports, command paths and test discovery together.

## Where builds go

A package passes through three places. Only the first is in Git.

| Stage | Place | Who writes it |
| --- | --- | --- |
| Recipe | `packaging/<platform>/` (Dockerfiles, build scripts, MSIX templates, installer art) and `src-tauri/tauri.conf.json` | People, and `pnpm run art` for the installer pictures |
| Build | `src-tauri/target/release/` (the app `pnpm start` runs, and `bundle/` with the Tauri installers); `src-tauri/target/e2e/` for the e2e, capture and measurement builds | Cargo and the Tauri bundler; the Docker builds keep theirs in named volumes |
| Hand-off | `release/<platform>/` (`macos/`, `windows/` with `msix-test/` or `msix-store/`, `linux/`) | `pnpm run dist:*`; CI stages its files in the runner's `out/` and uploads them to a draft release instead |

- `release/` holds only what is handed off: the platform folders and `store/`.
- Local audits, review captures and backups go in `scratch/` (`asset-audit/`, `asset-size/`, `legacy-pets/`, art review folders).
- The Docker builds copy the checkout without local data, keys or build output (the root `.dockerignore`, which `packaging/*/build.sh` hands to rsync).
- They install pnpm dependencies without running their install scripts, as the release workflow does.
- The Windows build keeps its MSIX test signing key in the `playpets-msix-key` volume. `release/windows/msix-test/` holds only the package, the public certificate and the install notes.

## Root configuration map

| File | Role |
| --- | --- |
| `package.json` | App version, pnpm commands, development dependencies, supported Node/pnpm versions and the pnpm version (`packageManager`) |
| `pnpm-lock.yaml` | Exact dependency graph, and pnpm's own executable; update with pnpm and install with `pnpm install --frozen-lockfile` |
| `.node-version` | Node major used locally and by Actions |
| `pnpm-workspace.yaml` | pnpm's settings: reject unsupported engines, pin new direct dependencies exactly, skip dependencies' install scripts, the minimum release age and the vite and katex overrides |
| `.oxlintrc.json` | JavaScript, TypeScript and Vue script static checks and generated-output exclusions |
| `biome.jsonc` | CSS lint only (Biome's recommended rules); its formatter and import sorting are off |
| `.oxfmtrc.jsonc` | JavaScript, TypeScript, CSS and JSON formatting and import order; HTML, SVG, Vue and Markdown are kept by hand |
| `.editorconfig` | Editor-independent indentation, encoding and line endings |
| `.gitattributes` | Git line endings, binary handling and generated-file review metadata |
| `.gitignore` | Local state, credentials and reproducible build output excluded from commits |
| `.dockerignore`, `packaging/*/.dockerignore` | What reaches Docker: each image's context is only what its Dockerfile copies; the root file lists what never enters a container (everything `.gitignore` lists), and the container builds copy the checkout through it |
| `.coderabbit.yaml` | Optional CodeRabbit review behavior and area rules |
| `AGENTS.md` / `CLAUDE.md` | One agent rule source and Claude's pointer to it |
| `.github/` | Workflows, dependency update policy and contribution templates |
| `.vscode/extensions.json` | Optional editor recommendations; personal settings stay ignored |
| `README.md` | Product entry point |
| `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `CHANGELOG.md` | Contribution, security, conduct, licensing and release history |

- Rust's minimum version: `src-tauri/Cargo.toml`. CI uses stable Rust with clippy and rustfmt.
- Rust formatting: `src-tauri/rustfmt.toml`.
- Tauri reads the app version from `package.json`. The release command updates Cargo metadata and translated release pages.
- Don't add a second, independent version source.

## Commands by scope

| Task | Command |
| --- | --- |
| Install the locked dependencies | `pnpm install --frozen-lockfile` |
| Check code and documentation together | `pnpm run check` |
| Check Node or Rust tests alone | `pnpm run test:js` / `pnpm run test:rust` |
| Check page/tooling or Rust style alone | `pnpm run lint:js` / `pnpm run lint:rust` |
| Format one tool's files | `pnpm run format:js` / `pnpm run format:rust` |
| Build a normal app executable | `pnpm run build:app` |
| Run the already-built executable | `pnpm start` |
| Build this platform's packages (macOS `.app`, Windows NSIS installer, Linux deb and AppImage, as CI does) | `pnpm run build` |
| Run isolated desktop checks | `pnpm run test:e2e` |
| Prepare generated site inputs | `pnpm run site:prepare` |
| Run, build or preview the built site | `pnpm run site:dev` / `pnpm run site:build` / `pnpm run site:preview` |
| Check artwork files and references | `pnpm run assets:audit` |

- `check` does not launch the desktop app, generate artwork or release anything.
- E2E still needs a desktop session.
- Its test-feature build goes to `src-tauri/target/e2e/`, so it never replaces the executable `start` runs.
- `start` does not rebuild or change the data directory.
- To use isolated development data, follow [getting started](getting-started.md).

Local Docker distribution:
- Runs through `scripts/local.mjs`, which passes paths with spaces intact, without shell interpolation.
- The host needs Docker with Linux containers.
- `dist:windows` passes `MSIX_IDENTITY_NAME`, `MSIX_PUBLISHER` and `MSIX_PUBLISHER_DISPLAY_NAME` through.
- `dist:linux` passes `BUNDLES` through.
- These are local packaging options, not the hosted release matrix.

## Generated files and accepted assets

Site inputs:
- `scripts/site-prepare.mjs` copies developer docs, pet sheets, creator downloads, environment art and icons into the website.
- Edit their sources, then regenerate.
- Ignored destinations include `website/dev/`, `website/public/pets/`, `website/public/creator-kit/`, `website/public/yard/`, and VitePress cache/build files.
- Some reproducible exports are tracked on purpose, for builds and review: native icons, installer art, captures and share cards.

Accepted artwork:
- Accepted generated artwork counts as source material when a build cannot reproduce it without the original image-generation result.
- Keep its provenance.
- A disposable experiment or an audit screenshot goes under ignored `scratch/`.
- Never move a referenced asset there to reduce repository size.

More detailed maps: the [script directory](../scripts/README.md), [test directory](../tests/README.md) and [asset directory](../assets/README.md).

## Keep repository policies useful

Ignore rules:
- `.gitignore` controls untracked local files.
- `.dockerignore` repeats every entry for the container builds, in patterns Docker and rsync read alike: `/name` at the top, `**/name` anywhere, no `!`.
- `tests/repository-config.test.mjs` fails when an entry is missing there.
- Root-scoped caches and test reports stay local: `.npm/`, `.cache/`, `coverage/`, `.nyc_output/`, `test-results/` and `playwright-report/`.
- Isolated app data: `.dev-data/` or `.dev-data-<scenario>/`.
- Temporary artwork and audit output: `scratch/`.
- These paths are conventions for optional tools, not dependencies the app requires.

Secrets:
- Keep signing material outside the checkout.
- `.credentials/` is also ignored, as a backstop against accidental local staging.
- Git cannot recognize every secret by name.
- If configuration later needs a secret, track only a root `.env.example` that holds placeholders.
- Public `.key.pub` files and sanitized `tests/fixtures/**/*.log` stay visible.
- Don't add blanket ignores for JSON, archives, `generated` folders or all hidden files. They can hide manifests, reusable sources and regression fixtures.

Attributes:
- `.gitattributes` normalizes text to LF and treats image, audio, font and archive payloads as binary.
- SVG sources and provenance JSON stay reviewable.
- GitHub's `linguist-generated` marks tracked exports, not the accepted source images used to make them.
- This metadata neither regenerates files nor removes them from Git.

Review:
- `.coderabbit.yaml` sets optional review scope, not an approval gate.
- Its filters skip binary payloads and generated copies, and keep public manifests and asset provenance visible.
- CI checks structure and references.
- Reviewers still inspect visual changes.
- Add a new area rule only when a concrete risk is not covered by `AGENTS.md` or an owning guide.

To change a policy:
1. Check its actual effect with `git check-ignore -v <path>` and `git check-attr text diff linguist-generated -- <path>`.
2. Run `node --test tests/repository-config.test.mjs`. Cover both examples that stay trackable and output that is ignored.
3. Before a first push, review `git diff --cached --stat` and the staged patch.
   - A newly ignored file may already be tracked. Removing it from the index does not erase its history.
   - If a credential was exposed, follow [the secrets policy](standards/keys-and-secrets.md).
