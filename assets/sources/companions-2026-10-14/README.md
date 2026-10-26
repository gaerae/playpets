# Illustrated companion source rows

- Accepted generation sources for the October 14, 2026 character redesign.
- They keep the exact illustration direction instead of adding outlines to the
  old soft 3D sprites.
- The original generated files stay unmodified.

Layout:
- Each character uses eleven 1536×1024 transparent images, four columns and two
  rows.
- Read poses left to right across the first row, then the second.
- Rows 00–08: idle, right walk, left walk, wave, jump, error, waiting, laptop
  work and done.
- Rows 09–10: sixteen clockwise gaze directions beginning at north.

Records:
- `generation.json` records the tool, references and reconstructed prompting
  intent. It does not claim to keep a verbatim transcript of every generation
  or repair.
- `pack-settings.json` records the whole-row scale adjustments that keep the
  model size stable between poses, and explicit jump lifts in canonical cell
  pixels that keep crouch and landing grounded despite source gutter
  differences.
- Generated pixels are extracted and packed, not redrawn.
- Output: the standard 1536×2288, 192×208-cell runtime sheet. High-resolution
  website previews are separate 3072×416 exports from the same original rows.
- No missing source row is replaced by repeated idle frames.

Rebuild from the repository root with:

```sh
node scripts/pack-companion-batches.mjs assets/sources/companions-2026-10-14/daisy scratch/daisy.png 163
node scripts/pack-companion-batches.mjs assets/sources/companions-2026-10-14/clover scratch/clover.png 168
node scripts/pack-companion-batches.mjs assets/sources/companions-2026-10-14/pip scratch/pip.png 164
```

- `concept.png` is the exact approved illustration reference.
- Clover's final gaze row is reordered by its frame map to run from downward
  gaze through screen-left to upward-left. Source pixels stay unmodified.

Seasons:
- Summer and winter subdirectories hold the matching eight-pose costume rows.
- Pack them with the same command, that subdirectory and the same idle height.
- `seasonal-prompts.json` keeps the exact wardrobe edit prompts.
- `repair-prompts.json` records later hat-consistency and alpha repairs and the
  updated Clover turnaround/face references.
- The inferred back view is an extension reference, not an extra runtime
  animation.

Pip:
- Uses the approved A wardrobe in `pip/wardrobe-concept.png`, plus the shared
  flower motif the user requested.
- Outfit: a butter-yellow varsity jacket with ivory sleeves, a small blue
  five-petal flower with a cream center on the anatomical left chest, and navy
  shorts.
- Summer: a matching round-neck short-sleeve T-shirt. Winter: a padded jacket
  with navy trousers.
- `pip/generation.json` keeps the exact costume-edit and detail sheet prompts,
  including the flower replacement and seasonal sleeve and quilting
  corrections.
- The courier rows were an intermediate revision and are not part of this
  accepted source set.
- Daisy and Pip now include matching turnaround and face-detail references;
  their exact prompts are recorded alongside Pip's wardrobe generation.
