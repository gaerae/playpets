# Repository layout and tooling

## Find the right owner

The root contains repository-wide configuration and the documents GitHub shows
to contributors. Runtime code, website content and packaging each have their own
directory. Keep these boundaries when adding a feature.

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
| `release/` | Ignored local packages from `npm run dist:*` and the store pictures from `npm run shots` | Audits, experiments, keys, or source that CI needs |
| `scratch/` | Ignored local audits, review captures, optimization backups and experiments | Packages, keys, or source that CI needs |

The runtime module split already follows ownership boundaries. The flat script
and test entry points retain stable imports and documented commands; their
directory READMEs group them by purpose. New shared test helpers belong in
`tests/support/`, and reusable data in `tests/fixtures/`. Split a feature into a
subdirectory when it needs its own helper modules, rather than moving files only
to shorten a listing. Update imports, command paths and test discovery together.

## Where builds go

A package passes through three places, and only the first is in Git:

| Stage | Place | Who writes it |
| --- | --- | --- |
| Recipe | `packaging/<platform>/` (Dockerfiles, build scripts, MSIX templates, installer art) and `src-tauri/tauri.conf.json` | People, and `npm run art` for the installer pictures |
| Build | `src-tauri/target/release/` (the app `npm start` runs, and `bundle/` with the Tauri installers); `src-tauri/target/e2e/` for the e2e, capture and measurement builds | Cargo and the Tauri bundler; the Docker builds keep theirs in named volumes |
| Hand-off | `release/<platform>/` (`macos/`, `windows/` with `msix-test/` or `msix-store/`, `linux/`) | `npm run dist:*`; CI stages its files in the runner's `out/` and uploads them to a draft release instead |

`release/` holds only what is handed off (the platform folders and `store/`);
local audits, review captures and backups go in `scratch/` (`asset-audit/`,
`asset-size/`, `legacy-pets/`, art review folders). The Docker builds copy the checkout without
local data, keys or build output (the root `.dockerignore`, which `packaging/*/build.sh`
hands to rsync), and install npm dependencies without running their install scripts,
as the release workflow does. The Windows build keeps its MSIX test signing key in the
`playpets-msix-key` volume, so `release/windows/msix-test/` holds only the package,
the public certificate and the install notes.

## Root configuration map

| File | Role |
| --- | --- |
| `package.json` | App version, npm commands, development dependencies and supported Node/npm versions |
| `package-lock.json` | Exact npm dependency graph; update with npm and install with `npm ci` |
| `.node-version` | Node major used locally and by Actions |
| `.npmrc` | Reject unsupported engines before dependency installation |
| `biome.jsonc` | JavaScript, TypeScript, CSS and JSON formatting and static checks |
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

Rust's minimum version is in `src-tauri/Cargo.toml`; CI uses stable Rust with
clippy and rustfmt. Rust formatting is in `src-tauri/rustfmt.toml`. Tauri reads
the app version from `package.json`; the release command updates Cargo metadata
and translated release pages. Avoid a second independent version source.

## Commands by scope

| Task | Command |
| --- | --- |
| Install the locked dependencies | `npm ci` |
| Check code and documentation together | `npm run check` |
| Check Node or Rust tests alone | `npm run test:js` / `npm run test:rust` |
| Check page/tooling or Rust style alone | `npm run lint:js` / `npm run lint:rust` |
| Format one tool's files | `npm run format:js` / `npm run format:rust` |
| Build a normal app executable | `npm run build:app` |
| Run the already-built executable | `npm start` |
| Build a native application bundle | `npm run build` |
| Run isolated desktop checks | `npm run test:e2e` |
| Prepare generated site inputs | `npm run site:prepare` |
| Run or build the site | `npm run site:dev` / `npm run site:build` |
| Check artwork files and references | `npm run assets:audit` |

`check` does not launch the desktop app, generate artwork or release anything.
E2E still needs a desktop session and changes the local executable to its
test-feature build. Use `build:app` before manually trying normal behavior after
E2E. `start` does not rebuild or change the data directory; follow
[getting started](getting-started.md) to select isolated development data.

Local Docker distribution uses `scripts/local.mjs`, preserving paths with spaces
without shell interpolation. The host needs Docker with Linux containers.
`dist:windows` passes `MSIX_PUBLISHER` through; `dist:linux` passes `BUNDLES`
through. These are local packaging options, not the hosted release matrix.

## Generated files and accepted assets

`scripts/site-prepare.mjs` copies developer docs, pet sheets, creator downloads,
environment art and icons into the website. Edit their sources, then regenerate.
The ignored destinations include `website/dev/`, `website/public/pets/`,
`website/public/creator-kit/`, `website/public/yard/`, and VitePress cache/build
files. Some reproducible exports, such as native icons, installer art, captures
and share cards, are intentionally tracked for builds and review.

Accepted generated artwork is source material when a build cannot reproduce it
without the original image-generation result. Keep its provenance. A disposable
experiment or an audit screenshot belongs under ignored `scratch/` instead.
Never move a referenced asset there to reduce repository size.

See the [script directory](../scripts/README.md), [test directory](../tests/README.md)
and [asset directory](../assets/README.md) for more detailed maps.

## Keep repository policies useful

`.gitignore` controls untracked local files. `.dockerignore` repeats every entry
for the container builds, in patterns Docker and rsync read alike (`/name` at the
top, `**/name` anywhere, no `!`); `tests/repository-config.test.mjs` fails when an
entry is missing there. Root-scoped caches and test reports
(`.npm/`, `.cache/`, `coverage/`, `.nyc_output/`, `test-results/` and
`playwright-report/`) stay local. Use `.dev-data/` or `.dev-data-<scenario>/` for
isolated app data, and `scratch/` for temporary artwork and audit output. These
paths are conventions for optional tools, not dependencies the app requires.

Keep signing material outside the checkout. `.credentials/` is also ignored as a
backstop for accidental local staging; Git cannot recognize every secret by name.
Only a placeholder-only root `.env.example` can be tracked if configuration later
needs one. Public `.key.pub` files and sanitized `tests/fixtures/**/*.log` remain
visible. Avoid blanket ignores for JSON, archives, `generated` folders or all
hidden files: they can hide manifests, reusable sources and regression fixtures.

`.gitattributes` normalizes text to LF and treats image, audio, font and archive
payloads as binary. SVG sources and provenance JSON stay reviewable. GitHub's
`linguist-generated` marks tracked exports, not the accepted source images used
to make them. This metadata neither regenerates files nor removes them from Git.

`.coderabbit.yaml` sets optional review scope, not an approval gate. Its filters
skip binary payloads and generated copies while keeping public manifests and
asset provenance visible. CI checks structure and references; reviewers still
inspect visual changes. Add a new area rule only when a concrete risk is not
covered by `AGENTS.md` or an owning guide.

For a policy change, inspect its actual effect with `git check-ignore -v <path>`
and `git check-attr text diff linguist-generated -- <path>`, then run
`node --test tests/repository-config.test.mjs`. Include examples that remain
trackable as well as output that is ignored. Before a first push, review
`git diff --cached --stat` and the staged patch. A newly ignored file may already
be tracked; removing it from the index does not erase its history. Follow
[the secrets policy](standards/keys-and-secrets.md) if a credential was exposed.
