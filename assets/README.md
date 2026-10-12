# Artwork sources and accepted exports

| Location | Role |
| --- | --- |
| `icon.svg` | Brand source for native icons and website favicon exports |
| `pets/` | Accepted pet manifests, canonical and seasonal sheets, identity references and generation provenance |
| `concepts/` | Approved visual direction and identity source images |
| `sources/` | Generated originals and retired variants of the runtime art in `src/art/`, kept as provenance; the app does not ship them |
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
temporary processing results under ignored `release/`. Use `npm run assets:audit`
to check dimensions and raster references; visual quality still needs a screen
review. See [companion artwork](pets/README.md) and
[repository ownership](../docs/repository-layout.md).

For smaller accepted PNG exports, install oxipng and run `npm run assets:optimize`.
The command preserves exact pixels and metadata, excludes generation originals,
and saves local backups and a report. See the [storage decision](../docs/decisions/2026-10-12-art-storage.md)
for scope, kit refresh instructions and why source art stays in regular Git.
