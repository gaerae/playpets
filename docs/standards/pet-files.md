# Standard: Pet file format

## Applies to
Every pet file PlayPets reads. This covers the starter pets bundled with the app (packed into the executable and unpacked into `builtin/` in the data folder; `assets/pets/` is the source), the Codex pet folder (`~/.codex/pets`, which `CODEX_HOME` can change), pets imported from an address and saved in `pets/` in the data folder, and folders a person picks. The required baseline follows the Codex pet format. Optional PlayPets artwork fields are described below; other hosts may ignore them.

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

The value that identifies a pet is made from its folder path (the first 24 characters of the path's SHA-256). Friends refer to pets by this value, so if a pet folder moves, its existing friends are parked at the next start. Their saved records and closeness remain; returning the folder to its original path makes them available again. This calculation is tied to saved state and does not change. Built-in Aria/Noah entries also have an explicit legacy asset/style migration; this does not merge independently invited friends.

## Identity and optional artwork

A drawing style is not a pet type. An ordinary baseline sheet may be pixel art,
paper, plush, sculpted or realistic. The three bundled pets are Daisy, Clover and
Pip, defined by `assets/pets/{daisy,clover,pip}/pet.json` and embedded by
`src-tauri/src/pets/builtin.rs`. Each invitation creates an independent friend,
including another invitation of the same pet. Names, relationships, personality
and closeness belong to that friend. Conversations belong to the current app
session and are not written to saved state. Restarting or migrating saved assets
does not restore chat logs. Every pet supports the yard, mini window and desktop.

The reader accepts these optional PlayPets fields without requiring them for an
ordinary import:

```json
{
  "portraitPath": "portrait.png",
  "seasonalSpritesheets": {
    "summer": "seasonal/summer.png",
    "winter": "seasonal/winter.png"
  },
  "realisticSpritesheets": {
    "default": "alternate/spritesheet.png",
    "summer": "alternate/summer.png",
    "winter": "alternate/winter.png"
  },
  "realisticPortraitPath": "alternate/portrait.png"
}
```

- `seasonalSpritesheets` recognizes `spring`, `summer`, `autumn` and `winter`.
  Each sheet has the baseline's version and dimensions. Missing or invalid
  entries use the baseline, without making the pet unavailable.
- `realisticSpritesheets` is a legacy compatibility field, not a general
  appearance contract. It recognizes `default`, `summer` and `winter` and needs
  a valid `default` before its alternate appearance is offered. A missing
  seasonal sheet uses that appearance's default. Friend settings offer this
  control only for a pet with a usable alternate baseline.
- `portraitPath` is an optional baseline PNG/WebP chat portrait, at most 8 MiB,
  with each dimension from 1 to 4096 pixels. An ordinary pet needs no portrait.
  `realisticPortraitPath` applies the same validation to a legacy alternate portrait.
- Optional paths stay relative and inside the pet folder, with the same file and
  symlink checks as the baseline. Invalid optional material is ignored. Sprite
  serving checks the files again because they can change after scanning.

Changing a supported alternate appearance keeps the same friend and its current-session chat.
Importing a different pet folder adds another asset; it does not replace an
existing friend's look. The runtime currently has nine action states and, in v2,
sixteen gaze directions. Additional design poses do not add runtime states.
Creator-named arbitrary appearance IDs remain a proposal in the
[companions design](../design/2026-10-11-companions.md).

For a portable download, provide `pet.json` and its canonical baseline sheet as
an independent package. Rich PlayPets wardrobes and portraits do not establish
support in another host. Preserve source attribution and the source images,
prompts and packing metadata for generated materials; detailed turnaround and
face references are design sources, not playable sheets.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Include `description` and `kind`. A new friend's starting personality becomes `description (kind)`.
- For imported pets, record the site, address, creator, and license in `source`. The Invite tab shows them on the card.

## Exceptions
| When | How |
|---|---|
| Pets from a community site with a different format | Not imported. The discovery registry in `src/content/communities.json` can list a browse-only site; `importer/sites.rs` derives `importable` from the trusted adapter ID and address. A discovery link does not add an importer or alter the generic importer’s security checks |
| The Codex pet format changes | Accept it in a PR that adds a new version number. The `SHEET_VERSIONS` table in `pets/catalog.rs` is the single source for versions and row counts (reading and importing both use it). If the meaning of a row changes, also update `src/core/animation.js` and this document |

## Rationale
Using the same format as Codex pets means existing community pets work as they are. The app rejects paths that point outside the folder and large files because it opens files other people made.
Based on: design record “[Stronger agent integration · community import · personality and activity memory](../design/2026-09-29-agent-link-import-persona.md)”

## Automated checks
- Rust `pets::catalog::tests` — size per version, rejecting paths outside the folder, required fields, reading the size from the file header alone, and source information.
- Rust `pets::importer::tests` — per-site address parsing and the saved result. Real site responses are checked with `npm run test:live-import`.

## Change history
- 2026-10-01 First version
- 2026-10-11 Document optional wardrobes, legacy appearances, separate named pets and parked identities
