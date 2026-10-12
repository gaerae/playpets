# New Year's dawn glyph

The built-in image generation tool created `newyear-source.png` on 2026-10-11 (kept in `assets/sources/events/`, with the vector reference beside it).
The reference was the project's own `src/art/environments/green.png`; transparency
was enabled. The exact generated 1536 × 1024 source is retained. A browser canvas
only downsamples it to `newyear.png` at 384 × 256; no shapes are drawn or repaired
by code. `newyear.svg` displays it in the existing 60 × 40 event slot. The previous
native vector is preserved in `reference/newyear-vector.svg` for comparison.

## Exact prompt

```text
Use case: stylized-concept. Asset type: PlayPets game event-card glyph, displayed at60x40pixels, original source landscape1536x1024. Create a genuinely transparent isolated compact dawn diorama icon, soft sculpted game illustration matching the reference forest's warm greens and natural material richness. One luminous warm golden rising sun at center upper half with five broad short rounded gold rays, above two overlapping sage-green rolling hill forms; three tiny simplified evergreen trees spaced near the hill horizon, a few restrained grass tufts, fine soft material grain visible at large scale, clean solid silhouette easy to recognize at60x40. Gold/apricot light, sage and deep forest greens. Front view, centered, entire diorama visible with generous transparent gutter; flat base edge gently rounded, no cast shadow outside silhouette, no detached fragments, no floating sparkles, no sky background, no backdrop, no words, no letters, no UI panels or label. The sun is round and soft with subtle surface variation, not shiny metal. The reference is style/material inspiration only: do not copy a whole background scene. This is a polished single sunrise glyph for New Year's dawn, not a square photograph.
```

The compact silhouette is intentional. Inspect it at the actual 60 × 40 slot on
light and dark surfaces; the source dimensions alone do not establish quality.
