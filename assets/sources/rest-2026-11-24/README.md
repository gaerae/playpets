# Sitting and stretching (2026-11-24)

The `sit` and `stretch` clips of Pip, Miso, Clover and Daisy, for each outfit they wear ([the yard plays like a game](../../../docs/design/2026-11-24-the-yard-plays-like-a-game.md), G4).

- The built-in image generation tool, through the Codex CLI, drew one sheet per friend and outfit: four columns by two rows of 384×512 tiles on white. The prompts are in `accepted-art.json`; the reference was the friend's own idle and wave cells from the sheet that outfit walks in, and for Daisy the first tile of her new idle row (G6).
- Tiles 0–2: sitting down, sitting, resting with eyes closed. Tiles 3–5: a stretch, a yawn, settling. Tile 6 is empty; tile 7 stands still and sets the scale.
- `prep.py` keys out the white that touches the border, keeps the figures' edges by how far they are from white, and writes `<friend>/<outfit>/rest-source.png` with `rest-plan.json`:
  - one shared scale, the tile 7 figure's height to the sheet's idle height;
  - each frame's foot under its head, offset as the standing tile's head is from its feet, so sitting down does not slide the friend sideways.
- Pack each from the repository root:

```sh
pnpm run companions:pack assets/sources/rest-2026-11-24/pip/base/rest-plan.json assets/pets/pip/actions/base/rest.png
```

- `merge.py <friend> <outfit>...` adds the two clips to the friend's `actions.json`: `sit` plays tiles 0, 1, 2, 1, 0 (6.2 s) and `stretch` tiles 3, 4, 5 (2.9 s). Then run `pnpm run assets:webp`.
- The visible figures are accepted originals; generation is not reproducible.
