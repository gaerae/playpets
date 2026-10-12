# Tabby sculpted sprite sources

The eleven source rows were generated with the built-in OpenAI image generator from the approved Tabby identity reference. They preserve the ginger coat, three forehead stripes, pink nose and ears, cream belly, and dark-tipped tail. Exact prompts and original generated output filenames are retained beside each source PNG. The source rows are the high-resolution originals; the production sheet downsamples them to the unchanged v2 cells.

`ART-SOURCES.json` records hashes, the 150-pixel idle-height target, the reproducible packing command, and the one curated gait frame. Packing requires Chrome through the repository Playwright dependency. The source art is not repainted or sharpened by scripts.

All 88 packed cells were inspected, including the nine active animation states and sixteen gaze directions. Before/after browser evidence at 176, 110, and 75 CSS pixels at DPR 1 and 2 is generated under `release/legacy-cats/tabby/`. The original flat sprite remains recoverable in Git and the legacy generator.

`identity-reference.png` retains the original canonical idle-cell reference. Subsequent generated rows use the accepted `source-rows/00-idle.png` identity lock. The walk is a modest alternating-foot shuffle, not a fast run.
