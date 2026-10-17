# Miso, the pond listener

Miso joins Daisy, Clover and Pip as the fourth official illustrated companion.
Clover remains the mascot. The accepted outfit follows option B in
`../miso-outfits-concept.png`; `../four-friends-concept.png` records the shared
white-petal, golden-centred daisy and the four-character composition.

`base`, `summer` and `winter` hold eleven generated 1536x1024 source batches each.
They cover nine action states and sixteen clockwise head/eye directions. The
summer outfit is a lighter lavender vest and linen shorts; winter uses a fitted
lavender wool cardigan and warm-grey trousers. The rounded otter ears, cream
muzzle and eyebrow markings, brown nose and attentive face stay consistent.

The built-in image generation tool made every pose. Seasonal edit candidates
with a semi-opaque backdrop were rejected and replaced or repaired through the
same image tool. No old realistic otter artwork is part of these sources. The
rejected candidates and review proofs are local working material, not inputs.
`generation.json` records the accepted raw source hashes and direction.

Each season's `canonical` directory preserves the approved complete silhouettes
in clean, centred 384x512 source tiles. Connected-component extraction uses the
existing `atlasPoses` and `isolatePose` helpers over the entire image so an
off-centre tail is not cut at a nominal column boundary. The same 0.8 source
scale is used for every figure; jumping retains its vertical displacement.
This is technical assembly only: it changes no colours, clothing or drawing.

Run the standalone creation skill's `pack-pet --rows` on these canonical rows
with `--idle-height 163` to reproduce an app atlas. The three accepted runtime
atlases live in `assets/pets/miso`; all pass its alpha, used-cell and margin
checks. The high-resolution website strips use the accepted base, summer and
winter idle, wave and jump batches at twice the app resolution, without
inventing new poses. Each seasonal strip uses its own season's idle reference.

The turnaround and face-detail images in `assets/creator-kit/miso` are separate
high-resolution generated model references. A back view is a new, consistent
design proposal, not a view recovered from a runtime sprite. The other creator
reference collages are generated from the shipped atlases by the existing
creator-kit builder.
