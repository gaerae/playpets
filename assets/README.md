# Artwork sources and accepted exports

| Location | Role |
| --- | --- |
| `icon.png`, `icon-provenance.json` | Accepted illustrated Clover face and its generation record |
| `icon.svg` | Portable embedded-raster export made by `pnpm run icons`; do not edit by hand |
| `pets/` | Accepted pet manifests, canonical and seasonal sheets, identity references and generation provenance |
| `concepts/` | Approved visual direction and identity source images |
| `sources/` | Generated originals and retired variants of the runtime art in `src/art/`, kept as provenance; the app does not ship them |
| `discovery/` | Accepted tree stages, seasonal variants, keepsakes, shovel and generation provenance; repacked by `scripts/pack-discovery.mjs` |
| `creator-kit/` | Reusable reference sheets and metadata used to build public creator downloads |
| `banner.png`, `demo.gif` | Repository-facing product media |

- Environment layers, weather, collection artwork and props: `src/art/`, near
  their runtime content definitions in `src/content/`.
- Installer exports: `packaging/`. Public captures and share cards:
  `website/public/`.
- These locations name their consumer; they are not separate copies edited
  independently.

Keeping sources:
- Keep accepted generated source images and their provenance: they are not
  reproducible build output.
- Everything under `src/` ships inside the app. A source image or retired
  variant the app does not draw goes in `sources/`, not beside its export.
- Discarded variants, local review captures and temporary processing results go
  under ignored `scratch/`.
- Provenance written before 2026-10-13 names local references under `release/`;
  those files now live under `scratch/`.
- `pnpm run assets:audit` checks dimensions and raster references; visual quality
  still needs a screen review.
- See [companion artwork](pets/README.md) and
  [repository ownership](../docs/repository-layout.md).

Smaller PNG exports:
- Install oxipng and run `pnpm run assets:optimize`.
- It keeps exact pixels and metadata, skips generation originals, and saves local
  backups and a report.
- The [storage decision](../docs/decisions/2026-10-12-art-storage.md) covers
  scope, kit refresh instructions and why source art stays in regular Git.

Creator skill:
- `creator-skill/playpets-creator/` owns the portable creation skill, its format
  reference, MIT license, pinned Python image dependency and executable helper
  in its own `scripts/` directory.
- The repository's `scripts/creator-workflow.py` is a thin launcher for that
  canonical helper.
- `pnpm run creator:skill` creates portable skill and plugin ZIPs in the ignored
  public creator-kit tree.
- User-created art and drafts do not belong in this source directory.
- The skill stays in `creator-skill/playpets-creator/` so app formats and
  validation evolve together.
- This complete folder is the source for portable skill downloads, host plugin
  exports and `npx skills` installation.
- Host manifests are generated wrappers, not duplicate skill instructions.
- Local installation checks and publication boundaries:
  [website guide](../docs/how-to/website.md#install-with-the-skills-cli).
