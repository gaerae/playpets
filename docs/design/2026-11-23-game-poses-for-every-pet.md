# Game poses for every pet

## Intent
- Today only the four friends who ship with the app dig, plant, show a find and fish with poses drawn for it.
- Every other pet (made in the creator kit, imported, from Codex) does the same things with its ordinary rows: the working row for digging, a wave for a find, no rod.
- A pet made with the PlayPets creator kit should play the same way as Daisy, Clover, Pip and Miso.
- So the game poses become an optional part of the pet format, and the four friends use that same format.

## Goals
- A pet folder can carry its own game poses: dig, plant, discover, and fishing (cast, wait, reel).
- Any pet with valid poses plays them, wherever it came from: built in, a ZIP, a folder, the Codex folder.
- The four friends move their poses into their own pet folders in this format; nothing about how they look or move changes.
- The creator kit makes the poses for each outfit, and the studio, the request and the skill say so.

## Non-goals
- No new actions beyond the six clips the yard already plays.
- No change to the nine rows, the gaze rows, the cell size or `src/core/animation.js`.
- No poses on the desktop overlay, and none for the realistic style.
- Community sites' pets (Codex format) get no poses; the importer does not invent them.

## Anti-goals
- A pet never plays another pet's poses: poses are read only from the pet's own folder.
- A broken or missing poses file never hides a pet or changes its ordinary animation.
- No work added to the frame loop, and no canvas repaint for a frame that did not change.

## Approaches
| Approach | What it means | Trade-off |
|---|---|---|
| A. Optional poses file in the pet format (chosen) | `pet.json` names an `actions.json`; it lists clips by outfit, each clip an atlas, its cells and timings; the backend validates it like a sheet | One format for all pets; the four friends move with no loss of art. The format carries frame rectangles and timings, so the kit has to write them |
| B. Fixed action grid | A second sheet with fixed rows and fixed frame counts, like the main atlas | Simplest for authors, but Clover's 12-frame clips would lose half their frames, and fixed canvases waste space |
| C. Keep built-in only, explain the gap | The studio says made pets use ordinary rows | Not what was asked: made pets would still play differently |

- The user chose A, with per-outfit poses and the four friends moved to the same format.

## Format
### `pet.json`
- New optional field `actionsPath`: a path inside the folder, like `spritesheetPath`.
- Missing, unreadable or invalid means the pet has no poses; everything else about it is unchanged.

### `actions.json`
```json
{
  "version": 1,
  "outfits": {
    "base": {
      "dig": {
        "image": "actions/base/dig.webp",
        "canvas": [192, 208],
        "anchor": [91, 199],
        "ground": [145, 199],
        "contactAt": 560,
        "tossAt": 1280,
        "frames": [{ "rect": [0, 0, 192, 208], "duration": 280 }]
      },
      "cast": {
        "image": "actions/base/fish.webp",
        "canvas": [240, 216],
        "anchor": [96, 207],
        "frames": [{ "rect": [0, 0, 240, 216], "duration": 300, "tip": [212, 18] }]
      }
    },
    "winter": {}
  }
}
```

| Field | Rule |
|---|---|
| `version` | `1` |
| `outfits` | Keys `base`, `spring`, `summer`, `autumn`, `winter`; `base` is required |
| Clip names | `dig`, `plant`, `discover`, `cast`, `wait`, `reel`; others are ignored |
| `image` | A PNG or WebP inside the folder, 8MB or smaller, at most 4096×4096; the same path gate as sheets |
| `canvas` | Integers, at most 384×416; missing means 192×208 |
| `anchor` | The feet in the canvas |
| `offset` | Optional, where the canvas sits against the 192×208 cell (missing means [0, 0]); kept as written, never worked out from the anchor, because Clover, Daisy and Miso dig with their feet at x 91 and no offset |
| `frames` | 1 to 64; `rect` is four integers, inside the image, the canvas's size; `duration` 1 to 10000 ms |
| `tip` | Fishing frames only, inside the canvas; every frame of `cast`, `wait` and `reel` needs one |
| `ground` | `dig` and `plant`: where the held tool meets the ground, inside the canvas |
| `contactAt`, `tossAt`, `commitAt` | Optional, ms from the start, not decreasing (planting tosses and commits at the same moment), within the clip's length |
| `loop` | Optional boolean; `wait` loops |

- Size limits: `actions.json` 256KB, 24 distinct images.
- A clip that fails is left out; `cast`, `wait` and `reel` are kept or left out together.
- An outfit with no clip left is left out; with no `base` left, the pet has no poses.
- The file holds no text a person reads or an AI sees.

### Which outfit plays
- In a season, the poses of that season's outfit, else `base`, the same rule as the seasonal sheets.
- The realistic style plays no poses.
- A clip the outfit lacks plays the ordinary rows, as today.

## Backend
- `catalog::read_pet` reads `actionsPath`, validates it, and keeps the result on `Asset` (not serialized), like the wardrobes.
- `asset_json` adds `hasActions: true` only when the pet has poses.
- A new command `pet_actions(assetId)` (one row of `COMMANDS`) returns the validated poses, read and checked again when asked for.
  - Not a `fetch` of `pet-asset://`: the page's `connect-src` allows only `'self'` and IPC, and widening it is not worth one JSON file.
- Each clip's `image` becomes `url`: `{sprite url}?action={n}`; `?action={n}` serves the n-th validated image through `open_image`, checked again when served (`img-src` already allows `pet-asset:`).
- The returned clips are what the page reads today, so `sprites.js`, `work.js` and `fishing-rod.js` draw them unchanged:
  - frames gain `foot` (the anchor);
  - clips gain `scale: 1`, `canvas` and `offset` (defaults filled in);
  - `heldTool` is true for every clip but `discover` (without it the rod line has no tip and a second, generic shovel is drawn).
- The ZIP importer already keeps `.json`, `.png` and `.webp` files; folder import copies the folder as it is.
- No new string a person reads: an invalid poses file is dropped quietly, like an invalid wardrobe.

## Page
- `src/core/companion-actions.js` keeps its exports; the registry becomes one entry per asset id, asked for once, when the friend first comes into the yard or asks for a clip.
- The gate is "has `hasActions` and is not realistic", not the four built-in ids.
- `sameCompanionAppearance` also compares `hasActions`.
- Clip image URLs come from the served JSON instead of `../art/companions/…`.
- `src/content/companion-actions.json` and `src/art/companions/` go away.

## The four friends
- Their poses move into their pet folders:

```text
src-tauri/pets/clover/
  pet.json            ("actionsPath": "actions.json")
  actions.json
  actions/base/{dig,plant,discover,fish}.webp
  actions/winter/{dig,plant,discover,fish}.webp
```

- `actions.json` is written from today's registry: the same rectangles, anchors, offsets, tips, timings and loops; Clover's base dig and plant get the 192×208 canvas they use today by default.
- Outfits that shared art per season become `base` plus their own outfits:
  - Daisy, Pip, Miso: `base`, `summer`, `winter`.
  - Clover: `base` and `winter` (its summer poses are its base poses today, as before).
- `builtin.rs` lists the new files; the packing helper writes into the new place.
- The pose sources move from `assets/art/companions/` to `assets/pets/<id>/actions/`; their WebP copies keep today's bytes (near-lossless, level 60), and `assets:webp --check` learns that a built-in folder may hold `actions.json` and `actions/**/*.webp`.
- So the binary does not grow and no pixel changes: the same files move from the page's assets into the pet folders.
- The site's starter downloads (`petDownloads`) add `actions.json` and `actions/`, about 1.5MB more per ZIP, so a friend downloaded and imported plays as it does in the app.

## Creator kit
- Each outfit (base, summer, winter) gets four more source batches: `dig`, `plant`, `discover`, `fish`.
- Each batch is the usual 1536×1024, 4×2 tiles:
  - dig, plant, discover: six frames in order in tiles 0–5;
  - fish: cast 0–1, wait 2–3, reel 4–5;
  - tile 7: the pet standing still, as in its idle row, in the same picture.
- Tile 7 sets the scale: it is brought to the main sheet's idle height (`--idle-height`), so an outfit that came as a finished atlas (`--atlas`, `--season`) needs no source idle batch, and each picture's own drawing scale cancels out.
- `pack-pet --actions <dir>` packs them at that scale, writes `actions/<outfit>/*.png` and `actions.json` with standard canvases and the four friends' timings, and adds `actionsPath`.
- The tool points come from `actions/points.json` (each fishing frame's rod tip, the dig and plant ground points); `render-actions` draws them on a copy for review.
- Without valid tips, the helper refuses the fishing clips instead of packing a rod the line cannot leave from.
- The ZIP adds `actions.json` and `actions/`.
- The site's request, `formats.md`, `SKILL.md` and the studio's text (four languages) describe the poses; the kit can include the starter's own pose atlases as references.

## Tests (each changes first)
- `catalog.rs`: a valid file is read; each rule above drops what it should; a path outside the folder is refused; an invalid file leaves the pet usable.
- `app/sprite.rs` and the command: `hasActions` only with poses; `pet_actions` and `?action={n}` give only validated data.
- `builtin.rs`: each of the four friends has valid poses for every outfit it has today.
- Page tests (`companion-actions`, `planting-actions`, `catch-action`, `fishing-authored`, `discovery-flow`): any pet with `hasActions` plays; realistic does not; outfit fallback by season.
- Creator kit: `pack-pet --actions` output, refusal without tips, the ZIP's files.
- e2e: the bundled wardrobe check reads clips through `pet_actions`.
- `art-webp` check: a built-in folder with poses passes; a stray file still fails.
- `petDownloads`: a starter ZIP holds every file its `pet.json` names.

## Constraints
- Pillow is not installed on this Mac; the creator-kit Python tests run in CI (the 14 known local failures).
- `docs/standards/pet-files.md` gains the optional field; this record and the 2026-10-19 companion design get follow-up notes, not rewrites.
- One PR from `pets/game-poses`, rebased onto `main` once #134 merges.

## Left to the builder
- How `pack-pet --actions` finds each tile's feet (a `foot` in `points.json`, or the centre of the lowest opaque band).
- The exact standard canvases for kit poses, as long as they hold the four friends' clips.
- Whether the poses JSON is cached on `Asset` or re-read on each request, as long as it is validated when served.
