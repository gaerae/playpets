# Standard: Pet file format

## Applies to
- Every pet file PlayPets reads:
  - The starter pets bundled with the app: packed into the executable and unpacked into `builtin/` in the data folder. `assets/pets/` is the source.
  - The Codex pet folder (`~/.codex/pets`; `CODEX_HOME` can change it).
  - Pets imported from an address and saved in `pets/` in the data folder.
  - Folders a person picks.
- The required baseline follows the Codex pet format.
- Optional PlayPets artwork fields are described below; other hosts may ignore them.
- Not covered: the source web pages and per-site JSON during import. `pets/importer/` turns those into pet folders, and the saved result follows this format.

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

- `pet.json` is a regular file inside the folder, 64KB or smaller.
- `id` and `displayName` are non-empty strings.
- `spriteVersionNumber` is `1` or `2`. Missing means `1`.
- `spritesheetPath` points inside the folder. A path that points outside through a symbolic link or `..` is rejected.
- The sprite sheet is a regular PNG or WebP file, 32MB or smaller.
- Sheet size:

| Version | Width | Height | Rows |
|---|---|---|---|
| v1 | 1536px | 1872px | 9 |
| v2 | 1536px | 2288px | 11 |

- One cell is 192×208px; a row has 8 cells.

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

### Pet identity value
- A pet's identity value is the first 24 characters of its folder path's SHA-256.
- Friends refer to pets by this value. If a pet folder moves, its existing friends are parked at the next start.
- Parked friends keep their saved records and closeness. Returning the folder to its original path makes them available again.
- This calculation is tied to saved state and does not change.
- Built-in Aria/Noah entries also have an explicit legacy asset/style migration. It does not merge independently invited friends.

## Identity and optional artwork

### Pets and friends
- A drawing style is not a pet type. An ordinary baseline sheet may be pixel
  art, paper, plush, sculpted or realistic.
- The four bundled pets, Daisy, Clover, Pip and Miso, are defined by
  `assets/pets/{daisy,clover,pip,miso}/pet.json` and embedded by
  `src-tauri/src/pets/builtin.rs`.
- Each invitation creates an independent friend, including another invitation
  of the same pet.
- Names, relationships, personality and closeness belong to that friend.
- Conversations belong to the current app session and are not written to saved
  state. Restarting or migrating saved assets does not restore chat logs.
- Every pet supports the yard at every size and the desktop.

### Optional fields
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

- `seasonalSpritesheets`:
  - Recognizes `spring`, `summer`, `autumn` and `winter`.
  - The official creator workflow defaults to three complete outfits: a base
    shared by spring and autumn, plus summer and winter atlases.
  - Each outfit contains all nine animation states and sixteen gaze directions.
  - Separate spring or autumn outfits remain optional extensions. This does not
    reduce the background format's four-season support.
  - Each sheet has the baseline's version and dimensions.
  - Missing or invalid entries use the baseline, without making the pet
    unavailable.
- `realisticSpritesheets`:
  - A legacy compatibility field, not a general appearance contract.
  - Recognizes `default`, `summer` and `winter`.
  - Needs a valid `default` before its alternate appearance is offered.
  - A missing seasonal sheet uses that appearance's default.
  - Friend settings offer this control only for a pet with a usable alternate
    baseline.
- `portraitPath`:
  - An optional baseline PNG/WebP chat portrait, at most 8 MiB, each dimension
    from 1 to 4096 pixels.
  - An ordinary pet needs no portrait.
- `realisticPortraitPath` applies the same validation to a legacy alternate
  portrait.
- Optional paths stay relative and inside the pet folder, with the same file and
  symlink checks as the baseline.
- Invalid optional material is ignored.
- Sprite serving checks the files again, because they can change after scanning.

### Appearances
- Changing a supported alternate appearance keeps the same friend and its
  current-session chat.
- Importing a different pet folder adds another asset. It does not replace an
  existing friend's look.
- The runtime currently has nine action states and, in v2, sixteen gaze
  directions. Additional design poses do not add runtime states.
- Creator-named arbitrary appearance IDs remain a proposal in the
  [companions design](../design/2026-10-11-companions.md).

### Portable downloads
- Provide `pet.json` and its canonical baseline sheet as an independent package.
- Rich PlayPets wardrobes and portraits do not establish support in another
  host.
- For generated materials, preserve source attribution and the source images,
  prompts and packing metadata.
- Detailed turnaround and face references are design sources, not playable
  sheets.

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Include `description` and `kind`. A new friend's starting personality becomes `description (kind)`.
- For imported pets, record the site, address, creator and license in `source`. The Invite tab shows them on the card.

## Exceptions
| When | How |
|---|---|
| Pets from a community site with a different format | Not imported. The discovery registry in `src/content/communities.json` can list a browse-only site; `importer/sites.rs` derives `importable` from the trusted adapter ID and address. A discovery link does not add an importer or alter the generic importer’s security checks |
| The Codex pet format changes | Accept it in a PR that adds a new version number. The `SHEET_VERSIONS` table in `pets/catalog.rs` is the single source for versions and row counts (reading and importing both use it). If the meaning of a row changes, also update `src/core/animation.js` and this document |

## Rationale
- The same format as Codex pets means existing community pets work as they are.
- The app opens files other people made, so it rejects paths that point outside the folder and large files.
- Based on: design record “[Stronger agent integration, community import, personality and activity memory](../design/2026-09-29-agent-link-import-persona.md)”

## Automated checks
- Rust `pets::catalog::tests`: size per version, rejecting paths outside the folder, required fields, reading the size from the file header alone, and source information.
- Rust `pets::importer::tests`: per-site address parsing and the saved result. Real site responses are checked with `npm run test:live-import`.

## Change history
- 2026-10-01 First version
- 2026-10-11 Document optional wardrobes, legacy appearances, separate named pets and parked identities
