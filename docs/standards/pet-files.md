# Standard: Pet file format

## Applies to
Every pet file PlayPets reads. This covers the starter pets bundled with the app (packed into the executable and unpacked into `builtin/` in the data folder; `assets/pets/` is the source), the Codex pet folder (`~/.codex/pets`, which `CODEX_HOME` can change), pets imported from an address and saved in `pets/` in the data folder, and folders a person picks. The format is the same as the Codex pet format.

Not covered: the source web pages and per-site JSON during import. `pets/importer/` turns those into pet folders, and the saved result follows this format.

## Rules
A pet is one folder containing `pet.json` and a sprite sheet.

```json
{
  "id": "white",
  "displayName": "White",
  "kind": "animal",
  "description": "A puppy.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp",
  "source": { "name": "Awesome Codex Pet", "url": "https://…", "creator": "lingxiaotian", "license": "CC BY-NC 4.0" }
}
```

- `pet.json` is a regular file inside the folder and is 64KB or smaller.
- `id` and `displayName` are non-empty strings.
- `spriteVersionNumber` is `1` or `2`. If missing, it is treated as `1`.
- `spritesheetPath` points inside the folder. A path that points outside the folder through a symbolic link or `..` is rejected.
- The sprite sheet is a regular PNG or WebP file of 32MB or smaller.
- The sheet is 1536px wide; its height is 1872px (9 rows) for v1 and 2288px (11 rows) for v2. One cell is 192×208px, and a row has 8 cells.

The animation in each row. `src/core/animation.js` is the source for how many cells each row uses and how long each cell lasts.

| Row | Animation | Cells used |
|---|---|---|
| 0 | Idle | 6 |
| 1, 2 | Walk right, walk left | 8 |
| 3 | Wave | 4 |
| 4 | Jump | 5 |
| 5 | Error | 8 |
| 6 | Waiting | 6 |
| 7 | Working | 6 |
| 8 | Done | 6 |
| 9, 10 | Gaze in 16 directions (v2 only) | 8 |

The value that identifies a pet is made from its folder path (the first 24 characters of the path's SHA-256). Friends refer to pets by this value, so if a pet folder moves, that pet's friends leave the yard at the next start. This calculation is tied to saved state and does not change.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Include `description` and `kind`. A new friend's starting personality becomes `description (kind)`.
- For imported pets, record the site, address, creator, and license in `source`. The Invite tab shows them on the card.

## Exceptions
| When | How |
|---|---|
| Pets from a community site with a different format | Not imported. Listing the site with `importable: false` in the site list (`COMMUNITIES` in `importer/`) shows it as "browse only" in the Invite tab (no site in the current list is like this) |
| The Codex pet format changes | Accept it in a PR that adds a new version number. The `SHEET_VERSIONS` table in `pets/catalog.rs` is the single source for versions and row counts (reading and importing both use it). If the meaning of a row changes, also update `src/core/animation.js` and this document |

## Rationale
Using the same format as Codex pets means existing community pets work as they are. The app rejects paths that point outside the folder and large files because it opens files other people made.
Based on: design record “[Stronger agent integration · community import · personality and activity memory](../design/2026-09-29-agent-link-import-persona.md)”

## Automated checks
- Rust `pets::catalog::tests` — size per version, rejecting paths outside the folder, required fields, reading the size from the file header alone, and source information.
- Rust `pets::importer::tests` — per-site address parsing and the saved result. Real site responses are checked with `npm run test:live-import`.

## Change history
- 2026-10-01 First version
