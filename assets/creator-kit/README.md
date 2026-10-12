# Character design and pet kits

Five independent style kits cover Aria and Noah in illustrated and realistic appearances, plus Clover. Aria is a fictional adult woman, 25; Noah is a fictional adult man, 26. The realistic importable package is a standalone catalog copy using realistic art as its baseline, not a patch to the built-in friend's appearance selector.

## Source files and ownership

- `turnaround.png` is newly generated high-resolution front, profile facing viewer left, back and profile facing viewer right reference art.
- `face-detail.png` is newly generated high-resolution facial reference art. Inspect its eye, nose, mouth, anatomy and material details against the accepted character before creating a variant.
- `turnaround.generation.txt` and `face-detail.generation.txt` (or legacy `.prompt.txt` sidecars), where present, record the original generation provenance.
- `identity-reference.png`, `wardrobe-reference.png`, `expression-reference.png` and `motion-reference.png` are supplemental collages copied from accepted production cells. They do not invent views or raise runtime resolution.
- `identity.json`, `prompts/*.txt` and `kit.json` are generated from `scripts/creator-specs.mjs` and validated source artwork. The structured specification locks identity, anatomy, clothing and accessory handedness. The manifest records file sizes and SHA-256 hashes.

Design images are references, not importable sprites. The current v2 runtime still uses 1536×2288 RGBA, eight columns and eleven rows of 192×208 cells. Extra views and detailed faces do not add runtime states or facial resolution. Every generated change needs manual identity and motion review.

## Two downloads per style

`design-kit.zip` contains high-resolution references, supplemental collages, identity and checksum manifests, five character-specific prompt files, production baseline/summer/winter PNGs, pet.json and usage notes. Original image-generation prompt sidecars are included when supplied. Realistic design kits also include the accepted portrait reference.

`importable-pet.zip` contains only pet.json, spritesheet.png, summer.png and winter.png. Extract it and choose that folder in PlayPets. Direct ZIP import is not required or promised. Its unique `playpets-creator-<kit>` ID avoids claiming to modify an existing built-in asset.

## Rebuild

To regenerate only the supplemental collages from approved production sheets:

```sh
npm ci
node scripts/creator-kit.mjs
```

That maintenance command requires Google Chrome. It never modifies or generates the high-resolution turnaround and face references.

After changing the specification or approved source images, refresh tracked metadata with:

```sh
node scripts/creator-kit.mjs --metadata
```

This Node-only maintenance command formats its generated JSON with the repository’s installed Biome. Regular site builds leave tracked source metadata unchanged.

To validate and publish all five completed kits, including deterministic uncompressed ZIP files:

```sh
npm run site:build
```

Regular site preparation uses only Node. It validates CRCs and decodes PNG scanlines, checks source dimensions and runtime alpha, and validates every kit before writing public output. ZIP entries use safe paths, sorted names and fixed dates. Generated website/public/creator-kit is ignored by Git. Missing or damaged references fail publication rather than silently producing an incomplete kit.

The artwork is from the PlayPets repository under its MIT license. Exact production sprite-generation provenance remains in assets/pets/<character>/; the new reference-image provenance stays beside the reference images.

- [English guide](../../website/guide/creator-kit.md)
- [Korean guide](../../website/ko/guide/creator-kit.md)
- [Simplified Chinese guide](../../website/zh-hans/guide/creator-kit.md)
