# Clover seasonal wardrobe source prompts

Generated with the built-in imagegen tool on 2026-10-11. The original main spritesheet is unchanged. Spring and autumn use the original outfit.

The edit targets are the corresponding eleven rows in `release/sprite-clarity/clover-hd-source/`. Each season's accepted `00-idle.png` supplies its clothing reference for subsequent rows. Generated sources, rejected variants, per-call prompts, packing audits, and browser evidence live under `release/seasonal-companions/clover/`.

Pack with `node scripts/pack-companion-batches.mjs release/seasonal-companions/clover/<season> assets/pets/clover/seasonal/<season>.png 168`. Each output is 1536 × 2288, with unchanged v2 192 × 208 cells and a shared per-sheet scale. Both use the approved frame map `{ "8": { "4": 2 } }` to avoid the mirrored celebration pose.

QA checked all 88 cells per sheet for nonempty silhouettes and three-pixel clipping margins, plus actual renderer playback at 176, 110, and 75 CSS pixels at DPR 1 and 2. All nine animation states, sixteen gaze cells, and reduced motion passed. Both first-idle silhouettes remain 168 pixels high. Summer is 4,332,880 bytes; winter is 4,073,094 bytes. Each decoded sheet uses 14,057,472 bytes, with only the active wardrobe loaded.

Targeted imagegen corrections restored two unintended closed-eye directional cells, removed the opaque summer row-10 background, and removed winter walking motion streaks. Rejected sources are preserved beside corrected sources. No scripted clothing drawing or color filters were used.

## Exact prompts

### summer/00-idle.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the SAME viewer-left hat decoration side as original. Bare furry arms and paws; cool airy fabric.
```

### summer/01-right.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve all eight rightward walking gait frames exactly.
```

### summer/02-left.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve all eight LEFTWARD walking gait frames exactly, never flip toward the right. Hat daisy side follows the original left-facing orientation.
```

### summer/03-wave.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve the clear raised paw greeting wave sequence.
```

### summer/04-jump.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve jump anticipation crouch cells0/1, very clearly airborne BOTH PAWS UP open joyful mouth cells2/3, landing cell4, then recovery5/6/7; exact original vertical lift and floor offsets.
```

### summer/05-error.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve concerned/downcast eyebrows and worried mouth throughout, paw touching chest/chin and bowed or closed eyes. No happy idle substitute.
```

### summer/06-waiting.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve paw under chin and thoughtful upward gaze in every frame, with subtle blink.
```

### summer/07-working.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve SEATED full-body cat with the obvious small silver laptop on lap and paws typing on its keyboard in all eight frames. Laptop MUST remain.
```

### summer/08-done.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve jubilant BOTH PAWS raised wide, open delighted smile, bouncy one-foot celebration poses. Never replace by idle.
```

### summer/09-look-correction.prompt.txt

```text
Use case: precise-object-edit. Edit this transparent Clover directional gaze atlas, exactly 1536x1024, four columns two rows. ONE CELL ONLY: bottom row fourth/rightmost cell (zero-based frame 7) currently has eyes shut. OPEN BOTH EYES, same green eyes as all other cells, aimed down and to viewer-right (south-southeast). Preserve EVERY OTHER pixel, pose, outfit, identity, size, position, original transparent alpha and every other cell. This is a fixed mouse-tracking gaze atlas, no blinking allowed. No floor, shadow, text, extra decorations.
```

### summer/09-look.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve exact clockwise head/eye orientations N,NNE,NE,ENE,E,ESE,SE,SSE in row-major order. Body orientation is unchanged; no generic repeated gaze.
```

### summer/10-look-correction.prompt.txt

```text
Use case: background-extraction. Remove the brown studio background from this eight-Clover sprite atlas, preserving every exact kitten and outfit pixel, all eight expressions/leftward and upward-left head gazes, 4x2 grid and exact1536x1024 placement. Output genuine RGBA PNG with alpha ZERO in all spaces outside figures and between cells. No backdrop color, floor, shadow, checkerboard or glow. Keep fur edges clean with soft natural antialiasing. Do not redraw or change the figures, their sizes, outfit, or expressions.
```

### summer/10-look.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Summer outfit: pale mint lightweight linen SHORT overalls with gold buttons and a tiny white daisy on chest pocket. Light sage straw sunhat with sage band and small white daisy on the same anatomical hat side as original (its screen side follows the preserved facing direction). Bare furry arms and paws; cool airy fabric. Image 1 is the exact pose/layout edit target. Image 2 is the accepted summer clothing reference only; keep image 1 poses. Preserve exact head/eye orientations S,SSW,SW,WSW,W,WNW,NW,NNW in row-major order. Especially LEFTWARD side gazes then upward-left final frames. Do not turn these right.
```

### winter/00-idle.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the SAME viewer-left side as original hat decoration. Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat.
```

### winter/01-right-correction.prompt.txt

```text
Use case: precise-object-edit. This 1536x1024 four-column two-row transparent sprite atlas is final except for unwanted WHITE HORIZONTAL MOTION STREAKS extending to the right of the lifted foot in top-row second and fourth cells. REMOVE ONLY these extraneous streaks, making those pixels transparent. Retain all eight kittens, every exact paw position and full paw, tail, winter outfit, faces, proportions, original pixel placement and transparent alpha. No floor, no shadows, no motion lines. Do not shrink or redraw figures. Keep eight poses, same clean transparency.
```

### winter/01-right.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve all eight rightward walking gait frames exactly.
```

### winter/02-left.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve all eight LEFTWARD walking gait frames exactly, never flip toward the right. Hat daisy side follows the original left-facing orientation.
```

### winter/03-wave.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve the clear raised paw greeting wave sequence.
```

### winter/04-jump.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve jump anticipation crouch cells0/1, very clearly airborne BOTH PAWS UP open joyful mouth cells2/3, landing cell4, then recovery5/6/7; exact original vertical lift and floor offsets.
```

### winter/05-error.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve concerned/downcast eyebrows and worried mouth throughout, paw touching chest/chin and bowed or closed eyes. No happy idle substitute.
```

### winter/06-waiting.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve paw under chin and thoughtful upward gaze in every frame, with subtle blink.
```

### winter/07-working.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve SEATED full-body cat with the obvious small silver laptop on lap and paws typing on its keyboard in all eight frames. Laptop MUST remain.
```

### winter/08-done.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve jubilant BOTH PAWS raised wide, open delighted smile, bouncy one-foot celebration poses. Never replace by idle.
```

### winter/09-look-correction.prompt.txt

```text
Use case: precise-object-edit. Edit this transparent Clover directional gaze atlas, exactly 1536x1024, four columns two rows. ONE CELL ONLY: bottom row first/leftmost cell (zero-based frame 4) currently has eyes shut. OPEN BOTH EYES, same green eyes as all other cells, aimed toward viewer-right (east). Preserve EVERY OTHER pixel, pose, outfit, identity, size, position, original transparent alpha and every other cell. This is a fixed mouse-tracking gaze atlas, no blinking allowed. No floor, shadow, text, extra decorations.
```

### winter/09-look.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve exact clockwise head/eye orientations N,NNE,NE,ENE,E,ESE,SE,SSE in row-major order. Body orientation is unchanged; no generic repeated gaze.
```

### winter/10-look.prompt.txt

```text
Use case: identity-preserve. Edit target: attached Clover 8-pose game sprite source. Output exactly 1536x1024 RGBA, four equal 384x512 columns by two rows, exactly eight figures in unchanged row-major poses. Change clothing ONLY. Preserve the exact orange-and-white kitten identity, huge round head/short chibi body ratio, green eyes, pink nose, fur, paws, tail, expression, camera, scale, figure center, feet baseline, and breathing/blinking differences in all eight cells. Keep all figures entirely inside cells with transparent gutters. Genuine transparent background alpha zero: no brown backdrop, floor, shadow, checkerboard, labels or text. Crisp softly sculpted material details suitable for downsampling to 192x208. Winter outfit: fitted quilted teal short coat, ivory knitted scarf tucked neatly without obscuring paws or muzzle, sage knit beanie with small white daisy on the same anatomical side as the original hat decoration (its screen side follows the preserved facing direction). Ears remain fully visible, huge face uncovered. Keep original body silhouette; no oversized gloves, boots or bulky coat. Image 1 is the exact pose/layout edit target. Image 2 is the accepted winter clothing reference only; keep image 1 poses. Preserve exact head/eye orientations S,SSW,SW,WSW,W,WNW,NW,NNW in row-major order. Especially LEFTWARD side gazes then upward-left final frames. Do not turn these right.
```
