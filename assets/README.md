# Artwork sources and accepted exports

| Location | Role |
| --- | --- |
| `icon.png`, `icon-provenance.json` | Accepted illustrated Clover face and its generation record |
| `icon.svg` | Portable embedded-raster export made by `npm run icons`; do not edit by hand |
| `pets/` | Accepted pet manifests, canonical and seasonal sheets, identity references and generation provenance |
| `concepts/` | Approved visual direction and identity source images |
| `sources/` | Generated originals and retired variants of the runtime art in `src/art/`, kept as provenance; the app does not ship them |
| `discovery/` | Accepted tree stages, seasonal variants, keepsakes, shovel and generation provenance; repacked by `scripts/pack-discovery.mjs` |
| `creator-kit/` | Reusable reference sheets and metadata used to build public creator downloads |
| `banner.png`, `demo.gif` | Repository-facing product media |

The app's environment layers, weather, collection artwork and props live in
`src/art/`, near their runtime content definitions in `src/content/`. Installer
exports live under `packaging/`, and public captures and share cards under
`website/public/`. These locations describe their consumer, rather than separate
copies that are edited independently.

Keep accepted generated source images and their provenance: they are not
reproducible build output. Everything under `src/` ships inside the app, so a source image
or a retired variant that the app does not draw goes in `sources/`, not beside its export. Place discarded variants, local review captures and
temporary processing results under ignored `scratch/`. Provenance written before
2026-10-13 names local references under `release/`; those files now live under `scratch/`. Use `npm run assets:audit`
to check dimensions and raster references; visual quality still needs a screen
review. See [companion artwork](pets/README.md) and
[repository ownership](../docs/repository-layout.md).

For smaller accepted PNG exports, install oxipng and run `npm run assets:optimize`.
The command preserves exact pixels and metadata, excludes generation originals,
and saves local backups and a report. See the [storage decision](../docs/decisions/2026-10-12-art-storage.md)
for scope, kit refresh instructions and why source art stays in regular Git.

`creator-skill/playpets-creator/` owns the portable creation skill, its format
reference, MIT license, pinned Python image dependency and executable helper in
its own `scripts/` directory. The repository's `scripts/creator-workflow.py` is a
thin launcher for that canonical helper. `npm run creator:skill` creates portable
skill and plugin ZIPs in the ignored public creator-kit tree. User-created art and drafts do not
belong in this source directory.

The creator skill stays in `creator-skill/playpets-creator/` so app formats and
validation can evolve together. This complete folder is the source for portable
skill downloads, host plugin exports and `npx skills` installation. Host manifests
are generated wrappers, not duplicate skill instructions. See the
[website guide](../docs/how-to/website.md#install-with-the-skills-cli) for local
installation checks and publication boundaries.
