# Maintainer tools

Run tools from the repository root. Prefer the named npm command when there is
one. `*-lib.mjs` files and the content/specification modules are reusable helpers;
import them instead of importing a command that writes files.

The tools that draw pictures (icons, share cards, installer art, creator kits, captures) drive
an installed Google Chrome through Playwright (`channel: 'chrome'`).

| Area | Commands and sources | Outputs |
| --- | --- | --- |
| Local execution and Docker builds | `local.mjs` via `npm start`, `dist:linux`, `dist:windows` | Native app process or ignored `release/<platform>/` |
| Website preparation | `site-prepare.mjs`, `site-lib.mjs`, `site-content.mjs` via `site:prepare` | Generated docs, downloads, artwork and metadata under `website/` |
| Releases | `release.mjs`, `release-lib.mjs`, `release-notes.mjs` | Version changes, a commit and a tag; see the release procedure before running |
| Distribution metadata | `distribute.mjs`, `distribute-lib.mjs` | Updater, Homebrew and winget manifests |
| Brand exports | `make-icons.mjs`, `make-installer-art.mjs`, `make-og.mjs` via `icons`, `art`, `og` | Tracked native, installer and site artwork; `icons` needs macOS (`iconutil` makes the `.icns`) |
| Native captures | `shots.mjs`, `shots-lib.mjs`, `shot-windows.swift` via `shots` | Localized captures and listing media; macOS capture host required |
| Performance and visual review | `measure.mjs`, `visual-audit.mjs`, `asset-audit.mjs` | Local measurements and review evidence; asset inventory defaults to `release/asset-audit/` |
| Creator references | `creator-kit.mjs`, `creator-specs.mjs`, `creator-bundle-lib.mjs` | Accepted reference sheets, metadata and downloadable bundles |
| Atlas preparation | `pack-*.mjs`, `normalize-cat-row.mjs`, atlas/art/normalization helpers | Explicit destination files from approved image sources |
| Historical sample generator | `make-mascot-pet.mjs` via `mascot-pet` | `release/legacy-pets/`; does not replace accepted companions |

Website preparation packages existing references; it does not invent missing
character views. Art tools can overwrite their documented outputs, so compare
results with the accepted files before keeping a change. Exact character prompts
and sources are in `assets/pets/` and `src/art/`.

Tool checks belong in `tests/*.test.mjs`. Export pure transformations where useful;
keep process execution behind the command entry point. See
[repository tooling](../docs/repository-layout.md) and
[release instructions](../docs/how-to/release.md).

To refresh only seasonal landing scenes in every language:

```bash
SHOT_SCENE=seasons SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

## Lossless PNG size checks

Install `oxipng` separately (`brew install oxipng` on macOS), then run:

```bash
node scripts/optimize-png.mjs --report-dir release/asset-size/review-1
# Narrow a run to selected runtime artwork:
node scripts/optimize-png.mjs --report-dir release/asset-size/review-2 assets/pets/clover
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
