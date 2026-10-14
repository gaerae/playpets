# Illustrated companion source rows

These accepted generation sources belong to the October 14, 2026 character redesign.
They retain the exact illustration direction instead of adding outlines to the old
soft 3D sprites. The original generated files remain unmodified.

Each character uses eleven 1536×1024 transparent images with four columns and two
rows. Read poses left to right across the first row, then the second. Rows 00–08
are idle, right walk, left walk, wave, jump, error, waiting, laptop work and done.
Rows 09–10 hold sixteen clockwise gaze directions beginning at north.

`generation.json` records the tool, references and reconstructed prompting intent.
It is not a claim to preserve a verbatim transcript of every generation or repair.
`pack-settings.json` records the whole-row scale adjustments used to keep the model
size stable between poses and explicit jump lifts in canonical cell pixels to
keep crouch and landing grounded despite source gutter differences. Generated pixels are extracted and packed, not redrawn.
The output is the standard 1536×2288, 192×208-cell runtime sheet; high-resolution
website previews are separate 3072×416 exports from the same original rows.

No missing source row is replaced by repeated idle frames.

Rebuild from the repository root with:

```sh
node scripts/pack-companion-batches.mjs assets/sources/companions-2026-10-14/daisy scratch/daisy.png 163
node scripts/pack-companion-batches.mjs assets/sources/companions-2026-10-14/clover scratch/clover.png 168
node scripts/pack-companion-batches.mjs assets/sources/companions-2026-10-14/pip scratch/pip.png 164
```

`concept.png` is the exact approved illustration reference. Clover's final gaze
row is reordered by its frame map to run from downward gaze through screen-left
to upward-left. Source pixels remain unmodified.

Summer and winter subdirectories contain the corresponding eight-pose costume
rows. Use the same packing command with that subdirectory and the same idle
height. `seasonal-prompts.json` preserves the exact wardrobe edit prompts;
`repair-prompts.json` records later hat-consistency and alpha repairs and the
updated Clover turnaround/face references. The inferred back view is an
extension reference, not an additional runtime animation.

Pip uses the approved A wardrobe in `pip/wardrobe-concept.png`, followed by
the shared flower motif requested by the user: a butter-yellow varsity
jacket with ivory sleeves, a small blue five-petal flower with a cream center on the anatomical left chest and navy
shorts. Summer uses a matching round-neck short-sleeve T-shirt and winter a padded jacket with
navy trousers. `pip/generation.json` preserves the exact costume-edit and detail
sheet prompts, including the flower replacement and seasonal sleeve and quilting corrections. The courier rows
were an intermediate revision and are not part of this accepted source set.
Daisy and Pip now include matching turnaround and face-detail references; their
exact prompts are recorded alongside Pip's wardrobe generation.
