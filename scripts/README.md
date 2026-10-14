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
| Website preparation | `site-prepare.mjs`, `site-lib.mjs`, `site-content.mjs` via `site:prepare` | Generated docs, downloads, artwork and metadata under `website/` |
| Releases | `release.mjs`, `release-lib.mjs`, `release-notes.mjs` | Version changes, a commit and a tag; see the release procedure before running |
| Distribution metadata | `distribute.mjs`, `distribute-lib.mjs` | Updater, Homebrew and winget manifests |
| Brand exports | `make-icons.mjs`, `make-installer-art.mjs`, `make-og.mjs` via `icons`, `art`, `og` | Tracked native, installer and site artwork; `icons` includes the illustrated Clover face for the app and every platform’s tray; it needs macOS (`iconutil` makes the `.icns`) |
| Native captures | `shots.mjs`, `shots-lib.mjs`, `shot-windows.swift` via `shots` | Localized captures and listing media; macOS capture host required |
| Performance and visual review | `measure.mjs`, `visual-audit.mjs`, `asset-audit.mjs` | Local measurements and review evidence; asset inventory defaults to `scratch/asset-audit/` |
| Creator references | `creator-kit.mjs`, `creator-specs.mjs`, `creator-bundle-lib.mjs` | Accepted reference sheets, metadata and downloadable bundles |
| Atlas preparation | `pack-*.mjs`, `normalize-cat-row.mjs`, atlas/art/normalization helpers | Explicit destination files from approved image sources |
| Historical sample generator | `make-mascot-pet.mjs` via `mascot-pet` | `scratch/legacy-pets/`; does not replace accepted companions |

Website preparation packages existing references; it does not invent missing
character views. Art tools can overwrite their documented outputs, so compare
results with the accepted files before keeping a change. Exact character prompts
and sources are in `assets/pets/` and `src/art/`.

Tool checks belong in `tests/*.test.mjs`. Export pure transformations where useful;
keep process execution behind the command entry point. See
[repository tooling](../docs/repository-layout.md) and
[release instructions](../docs/how-to/release.md).

The default `npm run shots` capture includes seasonal scenes, all four places, mini mode
and the app panels in every language. Set `SKIP_GIF=1` to keep the existing GIF.

To refresh only seasonal landing scenes in every language:

```bash
SHOT_SCENE=seasons SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

To refresh seasonal scenes, all four places and mini mode together (without the GIF):

```bash
SHOT_SCENE=places SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

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

`background-specs.mjs` supplies the background studio's copyable prompt and geometric
layout sheet. The site component rasterizes that SVG guide to a downloadable PNG and
packages user-selected images locally; it does not generate or upload artwork.
`src/yard/background-pack.js` validates the same package in the site and app.

The guide uses the selected floor, water, fishing stance and window coordinates;
no common pond position is imposed on imported places. Keep the shared validator
and its `src/core/season.js` dependency in the Pages workflow's path filters when
changing the package contract. Accepted built-in image provenance is recorded in
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
character's provenance. `site:prepare` validates and exports available states
into generated `website/public/pets/previews/` and records availability in
`generated.json`. Missing states use the runtime atlas. Logical display size,
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

Brand groups use Daisy on the left, Clover in the middle and Pip on the right.
`art-lib.mjs` normalizes their approved idle silhouettes to the same visible
height for installer and sharing art; `shots-lib.mjs` applies the same rule to
native captures. Recheck silhouette measurements when replacing starter art.
