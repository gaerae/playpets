# Natural walks (2026-11-26)

The four friends' walks ([natural walking](../../../docs/design/2026-11-26-natural-walking.md), B). The side walks are redrawn so the legs pass each other and the arms swing against them: only sheet rows 1 (right) and 2 (left) of each outfit changed; the other rows, the game poses and their timings stay. The walks toward and away from the viewer and the runs a game uses are new clips, `walk-front`, `walk-back`, `run-right` and `run-left` in each friend's `actions.json`. The prompts, references and tries are in `accepted-art.json`.

| Path | What it holds |
|---|---|
| `<friend>/<outfit>/01-right.png`, `02-left.png` | The accepted rows, cleaned, eight poses in four columns and two rows |
| `<friend>/<outfit>/03-front.png`, `04-back.png` | The accepted walks toward and away from the viewer, as generated (`pack_clip.py` cleans them) |
| `<friend>/<outfit>/05-run-right.png`, `06-run-left.png` | The accepted runs, as generated (`pack_run.py` cleans them) |
| `<friend>/<outfit>/row-scales.json` | The pack scale of each walk row, so its median height is the idle row's |
| `guides/` | The grey mannequin guides of the eight poses (side, front, back, run) and the scripts that draw them (`gait_guide.py walk` or `run`, `gait_guide_front.py`) |
| `handed-details.json` | Which side of the body each flower, bow and bag is on, and how each view shows it |
| `prep.py`, `gate.py`, `mirror.py` | Cleaning (`clean()`, also used by `pack_clip.py`), the acceptance gate, and the in-place mirror used for the left rows |
| `pack_clip.py`, `alternate.py` | The packer and the leg check for the front and back walks |
| `pack_run.py`, `headsize.py` | The packer for the runs, and the head width it is matched by |
| `turnaround/` | The edited profiles set into Daisy's and Clover's kit turnarounds, and `paste.py` that set them in |

- The eight poses: 1 contact (near leg forward, far arm forward), 2 down, 3 passing, 4 up, then the same with the other leg. The app measures the contact and passing cells from the feet (`src/core/gait.js`).
- Handed details are read from the front-facing idle row: walking right shows the right side, walking left the left side, and a detail on the far side is hidden or only peeks. The rows the walks replaced broke this, so every accepted row had one detail-only edit.
- To pack a sheet, copy the friend's source rows (`daisy-2026-11-24`, `companions-2026-10-14/clover`, `companions-2026-10-17/pip-denim` or `companions-2026-10-17/miso`, by outfit) into a folder, replace `01-right.png` and `02-left.png` with these, merge `row-scales.json` into its `pack-settings.json`, and run `node scripts/pack-companion-batches.mjs <folder> <out.png> <idle height>` (Daisy and Miso 163, Clover 168, Pip 164).
  - Daisy's and Clover's sheets are that pack. Pip's and Miso's shipped sheets came from `pack-pet`, so only rows 1 and 2 of the pack were set into them.
- `gate.py <sheet> 1 2` checks a packed sheet: heights within 3 % of the idle row, feet on one baseline (±3 px), and the passing cells' feet at most three quarters as far apart as the contact cells'.
- A front or back walk: `pack_clip.py <03-front.png> <the outfit's sheet> <strip.png>` packs the grid into eight 192×208 cells at the sheet's idle height, the feet at x 96 on its baseline, and prints the heights. Copy the strip to `assets/pets/<friend>/actions/<outfit>/walk-front.png` (or `walk-back.png`); its clip has eight 100 ms cells, `loop: true` and the anchor [96, 199].
  - `alternate.py <strip.png>` checks that the legs alternate: below 1 means cell 5 mirrors cell 1 (and 7 mirrors 3). Every cell stays within 5 % of the idle height, the art's own bob.
  - Clover has no summer clips: his summer outfit is his base one, so he walks on the base clips.
- A run: `pack_run.py <05-run-right.png> <the outfit's sheet> <strip.png> <share>` packs the grid at `share` of the idle height, the torso and head at x 96, grounded feet on the baseline and the flight cells 4 and 8 as high as drawn, and prints the lifts, clipped cells, stride and pass.
  - The share is 0.95 × the walk row's head width over the run's, both from `headsize.py <idle height> <strip>`, so a running friend is as big as a walking one.
  - Copy the strip to `actions/<outfit>/run-right.png` (or `run-left.png`); its clip is like a walk's, with the printed `stride`.
- Then run `pnpm run assets:webp`; a new atlas is also named in `src-tauri/src/pets/builtin.rs`.
- The kit turnarounds showed a far-side detail in one profile each (Daisy's flower facing right, Clover's bow facing left); only that view was edited and set back (`accepted-art.json` `turnaround`).
- The visible figures are accepted originals; generation is not reproducible.
