# Daisy at 11–12 (2026-11-24)

Daisy's new face and three outfits in palette A ([the yard plays like a game](../../../docs/design/2026-11-24-the-yard-plays-like-a-game.md), G6). Every sheet keeps the old cells, timings and proportions; only how she looks changed. The prompts and references are in `accepted-art.json`.

| Folder | What it holds |
|---|---|
| `look/` | The approved look of each outfit; `summer.png` is also the approved face |
| `base/`, `summer/`, `winter/` | The eleven state rows of each outfit, cleaned, with `pack-settings.json` |
| `actions/` | The redrawn dig, plant, fish and discover sheets and the scripts that lay them out and cut them back |

- The built-in image generation tool, through the Codex CLI, redrew each row of [companions-2026-10-14](../companions-2026-10-14/daisy) and each action strip as an edit of the old one, with the outfit's new idle row and the approved face as references.
- `clean.py <in> <out>` drops the low-alpha haze the tool leaves around a figure. Each row was cleaned before packing.
- Pack each sheet from the repository root:

```sh
node scripts/pack-companion-batches.mjs assets/sources/daisy-2026-11-24/base assets/pets/daisy/spritesheet.png 163
node scripts/pack-companion-batches.mjs assets/sources/daisy-2026-11-24/summer assets/pets/daisy/seasonal/summer.png 163
node scripts/pack-companion-batches.mjs assets/sources/daisy-2026-11-24/winter assets/pets/daisy/seasonal/winter.png 163
```

- The site's preview strips come from the same rows: `pnpm run preview:pack <outfit>/03-wave.png <outfit>/00-idle.png assets/pets/daisy/preview/[<outfit>/]wave.png wave 163`, and the same for `idle` and `jump`.
- Actions:
  - `actions/sheets.py` lays each shipped strip out as six frames in 512px cells, enlarged, as the sheet to redraw (`actions/ref/`, not kept);
  - `actions/unpack.py <outfit> <action>` fits each redrawn pose to the strip as it was before: one scale per sheet, the median of each pose's height against the old one, and the feet where the old feet were. A pose that reaches further than the old one is nudged back inside its frame;
  - `actions.json` did not change.
- The sit and stretch clips are in [rest-2026-11-24](../rest-2026-11-24).
- The creator kit's `turnaround.png` and `face-detail.png` were redrawn the same way; its collages come from the new sheets (`node scripts/creator-kit.mjs`).
- Then run `pnpm run assets:webp`.
- The visible figures are accepted originals; generation is not reproducible.
