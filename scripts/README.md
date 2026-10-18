# Maintainer tools

Run tools from the repository root. Prefer the named npm command when there is
one. `*-lib.mjs` files and the content/specification modules are reusable helpers;
import them instead of importing a command that writes files.

The tools that draw pictures (icons, share cards, installer art, creator kits, captures, atlas
packing) start their browser through `launchBrowser()` in `browser-lib.mjs`: an installed Google
Chrome, or Playwright's own Chromium (`npx playwright install chromium`) when Chrome is missing.
The capture backdrop in `shots.mjs` alone needs Google Chrome. Shared helpers live with their
owner: data URLs and sprite-sheet loading in `art-lib.mjs`, pose isolation in `atlas-lib.mjs`, and
PNG header size, row unfiltering and hashing in `png-lossless-lib.mjs`.

| Area | Commands and sources | Outputs |
| --- | --- | --- |
| Local execution and Docker builds | `local.mjs` via `npm start`, `dist:linux`, `dist:windows` | Native app process or ignored `release/<platform>/`; Windows MSIX goes to `msix-test/` by default, unsigned `msix-store/` with `MSIX_PUBLISHER` |
| Linux desktop checks | `linux-e2e.sh` via `test:e2e:linux` (build and run) or with `node tests/e2e.mjs` (CI prebuilt binary) | Isolated D-Bus/Xvfb/Openbox session; waits for a window manager before testing native pin and fullscreen |
| Security review | `npm run security:check` with Gitleaks 8.30.1 and cargo-audit 0.22.2 installed | Redacted full-history secret scan, npm high-severity dependency check and RustSec review; advisory warnings stay visible |
| Dependency notices | `licenses.mjs`, `licenses-lib.mjs` via `licenses:generate` and `licenses:check`; `prepare-appimage-licenses.mjs` before Linux packaging; `appimage-license.mjs` on the finished image | Native dependency notice and fingerprint under `packaging/licenses/`; collected distro copyright files and an exact AppImage system-source manifest during a release build |
| Website preparation | `site-prepare.mjs`, `site-lib.mjs`, `site-content.mjs` via `site:prepare` | Generated docs, downloads, artwork and metadata under `website/` |
| Releases | `release.mjs`, `release-lib.mjs`, `release-notes.mjs`, `package-smoke.mjs` | Version changes, a commit and a tag; native package install-and-launch verification runs in release CI |
| Distribution metadata | `distribute.mjs`, `distribute-lib.mjs` | Updater, Homebrew and winget manifests |
| Brand exports | `make-icons.mjs`, `make-installer-art.mjs`, `make-og.mjs` via `icons`, `art`, `og` | Tracked native, installer and site artwork; `icons` includes the illustrated Clover face for the app and every platform’s tray; it needs macOS (`iconutil` makes the `.icns`) |
| Native captures | `shots.mjs`, `shots-lib.mjs`, `shot-windows.swift` via `shots` | Localized captures and listing media; macOS capture host required |
| Performance and visual review | `measure.mjs`, `visual-audit.mjs`, `asset-audit.mjs` | Local measurements and review evidence; asset inventory defaults to `scratch/asset-audit/` |
| Portable creation skill | `creator-skill.mjs` via `creator:skill`, source `assets/creator-skill/playpets-creator/`, `creator-workflow.py` launcher | Generated skill and plugin ZIPs and per-layout references under `website/public/creator-kit/skill/`; offline pet ZIP and background JSON from the supplied helper |
| Creator references | `creator-kit.mjs`, `creator-specs.mjs`, `creator-bundle-lib.mjs` | Accepted reference sheets, metadata and downloadable bundles |
| Atlas preparation | `pack-*.mjs`, `normalize-cat-row.mjs`, atlas/art/normalization helpers | Explicit destination files from approved image sources |

The local Linux Docker build follows the same two-pass AppImage notice collection
as CI, then verifies the finished image and exports its system-source manifest.
Old package and manifest outputs are cleared before bundling. Container builds use the compiler already installed in their Rust image, including the Windows cross target, rather than downloading another toolchain because of the checkout's root configuration.
`BUNDLES=deb npm run dist:linux` skips AppImage collection and never exports an
older image or manifest from the build cache. Local Debian builds are development
checks; CI uses Ubuntu for the published packages.

Website preparation packages existing references; it does not invent missing
character views. Art tools can overwrite their documented outputs, so compare
results with the accepted files before keeping a change. Exact character prompts
and sources are in `assets/pets/` and `src/art/`.

Install the pinned native notice generator with `cargo install cargo-about --version 0.9.2 --locked --features cli`, then run `npm run licenses:generate` after dependency changes. `npm run licenses:check` verifies the tracked native report fingerprint before a Tauri build. The website build emits a license asset for the dependencies in its actual bundle.

`npm run lint:js` runs Oxlint correctness checks, then Biome formatting, import sorting and static checks. Use `npm run lint:oxlint` for correctness checks alone and `npm run format:js` to format source. Do not apply spread fixes blindly to live DOM collections; removing a snapshot can skip nodes or attributes during mutation.

Tool checks belong in `tests/*.test.mjs`. Export pure transformations where useful;
keep process execution behind the command entry point. See
[repository tooling](../docs/repository-layout.md) and
[release instructions](../docs/how-to/release.md).

The default `npm run shots` capture includes seasonal scenes, all four places, small windows
and the app panels in every language. Ordinary captures start in clear spring daylight;
summer evening and night scenes and the winter comparison are explicit feature views.
The four companions remain visible beside the chat sheet. Set `SKIP_GIF=1` to keep the existing GIF.

To refresh only seasonal landing scenes in every language:

```bash
SHOT_SCENE=seasons SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

To refresh seasonal scenes, all four places and small windows together (without the GIF):

```bash
SHOT_SCENE=places SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

To refresh only `friend-chat` and `companions` in every language (without the GIF):

```bash
SHOT_SCENE=chat SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

To refresh only the small-window yard and conversation after a responsive layout change:

```sh
SHOT_SCENE=small SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

Chat captures cancel existing walks and place the actual views beside the real panel.
A bounds check logs every friend's canvas and stops if any of the four is clipped or covered.

## Lossless PNG size checks

Install `oxipng` separately (`brew install oxipng` on macOS), then run:

```bash
node scripts/optimize-png.mjs --report-dir scratch/asset-size/review-1
# Narrow a run to selected runtime artwork:
node scripts/optimize-png.mjs --report-dir scratch/asset-size/review-2 assets/pets/clover
```

The default scope is PNG artwork in `src/art/`, `assets/pets/`, and
`assets/creator-kit/`, plus the banner and public Open Graph images. Git-ignored
files, generated website copies, original generation folders, source rows, and
pet identity originals are excluded. Explicit paths only narrow that scope.

The tool runs `oxipng -o 2 --nx`, independently decodes 8-bit RGB/RGBA PNGs, and
compares every sample byte (including RGB beneath transparent pixels), the PNG
header, and all ancillary chunks. It never resizes, reduces colors, strips
metadata or enables alpha optimization. Unsupported PNG formats and changes to
metadata such as C2PA are skipped and reported. Only smaller verified files
replace their originals. Original bytes and a per-file JSON report remain in
the ignored run directory; use a new directory for each run.

A canonical pet's adjacent `ART-SOURCES.json` hash is updated only when it
matches the original sprite hash. Its optimization history records both byte
hashes and the decoded sample hash. Source-row and generation records remain
unchanged. Review the report's skipped files, run the repository checks, and
rebuild the app and site after accepting optimized artwork. Regenerating an
export can restore its larger encoding; rerun this tool after regeneration.

`background-specs.mjs` supplies shared layout presets, the creation request and the SVG
placement guide. `creator-skill.mjs` packages these with a self-contained skill and
the canonical `assets/creator-skill/playpets-creator/scripts/creator-workflow.py`;
the repository-level Python command remains a thin launcher. Site preparation
includes the generated files. The website
does not inspect or convert finished images. Run the portable helper in an AI
workspace with Python 3 and the Pillow version in the skill's `requirements.txt`.
Use `PLAYPETS_PYTHON` to select a Python environment for the real helper tests;
CI installs that pinned dependency before unit tests. The helper does not install
packages or call a model. Its `render-layout` command creates technical PNG guides,
`pack-pet` assembles approved rows or uses an existing atlas, and `pack-background`
creates the final app JSON. Run `--help` for each contract. Keep the website's ZIP
request and the skill instructions consistent with these tested commands.

Layout coordinates belong to each background, not a global pond position.
The supplied helper is cross-checked against `src/yard/background-pack.js` by tests.
Keep that validator and its `src/core/season.js` dependency in Pages path filters.
Accepted built-in image provenance is recorded in
[`src/art/environments/FOUR-PLACES-PROVENANCE.md`](../src/art/environments/FOUR-PLACES-PROVENANCE.md).

### High-resolution website companions

`npm run preview:pack -- source-row.png idle-row.png destination.png idle 165`
packs an approved transparent 1536×1024 eight-pose row into a 3072×416 website
strip. The second file is the approved idle row shared by every state; the final
number is its intended runtime silhouette height. Use `wave` or `jump` instead
of `idle` for those states. The exporter preserves pose scale and jump lift,
rejects clipping, and refuses sources too small for a genuine double-resolution
preview. It reads optional `pack-settings.json` beside the source row: validated
`rowScales` apply once, and `jumpLifts` place each jump phase using canonical
pixels (doubled in the preview). Pass the uncorrected character idle height even
when a row has a scale correction. It never generates or redraws artwork.

Store accepted strips at `assets/pets/<id>/preview/{idle,wave,jump}.png` with the
character's provenance. Seasonal strips live at
`assets/pets/<id>/preview/{summer,winter}/{idle,wave,jump}.png`; spring and autumn
reuse the base strips. Pack each seasonal source against its own accepted idle
row and corresponding `pack-settings.json`. Daisy and Clover use the accepted
2026-10-14 seasonal sources with idle heights 163 and 168. Pip uses the denim
seasonal `canonical` rows with height 164; Miso uses its seasonal `canonical`
rows with height 163. Do not use a lower-resolution runtime atlas as a source.
The shared 0.8 normalization of Pip and Miso source rows does not change the
requested runtime height or justify upscaling an inadequate source.

`site:prepare` validates every available strip before replacing public files,
exports it into generated `website/public/pets/previews/<id>/`, and records
base availability in `petPreviews` and seasonal availability in
`petSeasonalPreviews` in `generated.json`. Seasonal exports retain the
`<season>/<state>.png` suffix. Missing seasonal poses use that season's runtime
atlas, so they keep the correct clothes. Logical display size,
frame counts and reduced-motion behavior stay unchanged; the extra pixels help
Retina displays without enlarging the character. The Pages workflow already
watches `assets/**` and `scripts/**` and runs this validation through `site:build`.

### Companion batch scale corrections

`node scripts/pack-companion-batches.mjs source-directory destination.png 163`
packs eleven original four-by-two pose batches using the idle reference scale.
An optional `pack-settings.json` in the source directory can contain
`{"rowScales":{"7":0.9}}` to correct a whole generated row whose model size
drifted. Every frame in that row uses the same factor; frame-specific shrinking
is not supported. Compare the face and body with the idle reference before
choosing a correction. Invalid rows, nonpositive or nonnumeric factors fail,
and the existing cell-margin check still rejects clipped gestures. The output
JSON records base scale, row factors, effective scales and jump displacement.
`frame-map.json` independently chooses existing generated poses and can reorder
a gaze sequence without redrawing it.

The same settings file can provide `jumpLifts`, eight nonnegative offsets in
canonical 192 × 208 cell pixels, in destination frame order. Use these when the
generated batch has inconsistent vertical gutters: crouch and landing stay at
zero, while takeoff, apex and descent keep their measured displacement. Omitting
the array retains source-relative displacement. The packer rejects poses whose
size plus lift would clip; the correction never redraws or stretches a pose.
High-resolution previews multiply these offsets by their cell-height ratio to
208. Keep settings beside accepted source batches so future seasonal exports can
reproduce their geometry.

Brand groups keep Daisy, Clover, Pip and Miso in that order, with Clover remaining
the main mascot.
`art-lib.mjs` normalizes their approved idle silhouettes to the same visible
height for installer and sharing art; `shots-lib.mjs` applies the same rule to
native captures. Recheck silhouette measurements when replacing starter art.

Installer artwork is regenerated with `npm run art`. The macOS renderer reads the
window and icon positions from `src-tauri/tauri.conf.json`; keep the entire native
icon and label area on its solid sage surface. Continue that color through the
header and footer instead of splitting the window into bands. It gives black and white
Finder labels at least 4.5:1 contrast. Scenery and the four friends belong in the
header, away from the drag path. Inspect a mounted DMG in light and dark appearance
after changing it; the PNG alone cannot confirm Finder label placement.

Windows sidebar and header exports stay at NSIS's native sizes (164 × 314 and
150 × 57). The sidebar uses two rows so all four friends remain legible;
the header fits them in one row without clipping. Only the brand is baked into the image; the installer supplies translated
instructions and buttons. NSIS offers English, Korean, Japanese and Simplified
Chinese through its language selector, configured in `bundle.windows.nsis`.
Linux uses the system's package installer rather than a custom wizard. Review its
AppStream description and the four software-center
captures under `website/public/listing/en/` after changing installation artwork.

The creator distribution test can also exercise `skills@1.7.2` against the local
source with `PLAYPETS_TEST_SKILLS_INSTALL=1 node --test tests/creator-distribution.test.mjs`.
This network-dependent check installs only into an isolated temporary project and
HOME, verifies Codex and Claude Code copies, then removes the temporary files.
It is opt-in rather than part of the offline test suite. Set `PLAYPETS_PYTHON` to
a Python environment with Pillow when needed. Public install commands require a
published ref containing `assets/creator-skill/playpets-creator/`; no npm package,
Git push, plugin marketplace submission or account setup happens during the build.

For image generators that cannot keep a wide gesture inside a four-column batch,
`creator-workflow.py assemble-row --image SOURCE --columns 3 --rows 2 --frames 0,1,2,3,4,5,5,5 --output ROW`
retiles a newly generated six-pose sheet into the canonical eight-tile source row.
It preserves pixels, common character scale and vertical offsets; it neither draws
nor resizes art. All source gutters and target widths are checked. This suits a
five-frame jump, not an eight-frame walk needing eight distinct generated poses.
See the skill's format reference before using it on accepted art.
