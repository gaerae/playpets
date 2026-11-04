# Character design and pet kits

- Four kits, one per starter companion: Daisy, Clover, Pip and Miso (`kitEntries` in `scripts/creator-specs.mjs`).
- Every kit has high-resolution turnaround and face-detail sheets (`"detail": "available"` in `kit.json`) and summer and winter sheets.
- All four use the illustrated style. Fictional characters only.
- Retired kit folders stay tracked as history and are not published: `aria`, `aria-realistic`, `noah`, `noah-realistic`, `tabby`, `smoky`, `mochi`.
  - The site build removes their old public output.

## Source files and ownership

| File | What it is |
| --- | --- |
| `turnaround.png` | High-resolution reference: front, profile facing viewer left, back, profile facing viewer right |
| `face-detail.png` | High-resolution facial reference. Check eyes, nose, mouth, anatomy and materials against the accepted character before making a variant |
| `turnaround.generation.txt`, `face-detail.generation.txt` (or legacy `.prompt.txt`) | Original generation provenance, where present (Clover and Pip) |
| `identity-reference.png`, `wardrobe-reference.png`, `expression-reference.png`, `motion-reference.png` | Supplemental collages copied from accepted production cells. They add no views and no runtime resolution |
| `identity.json`, `prompts/*.txt`, `kit.json` | Generated from `scripts/creator-specs.mjs` and validated source art. The spec locks identity, anatomy, clothing and accessory side; the manifest records file sizes and SHA-256 hashes |

- Design images are references, not importable sprites.
- The runtime is still v2: 1536×2288 RGBA, 8 columns × 11 rows of 192×208 cells.
- Extra views and detailed faces add no runtime states or facial resolution.
- Every generated change needs a manual identity and motion review.

## What is published

- Each kit's references, `identity.json`, `prompts/`, `pet.json` (ID `playpets-creator-<kit>`), sheets and `kit.json` are served one by one from `website/public/creator-kit/<kit>/`.
- The character studio packs its creation kit from those files in the browser.
- A friend to use as it is comes from `website/public/pets/playpets-<id>.zip` instead: the files in `assets/pets/<id>/` as the app ships them ([website how-to](../../docs/how-to/website.md)).

## Rebuild

Regenerate only the supplemental collages from approved production sheets:

```sh
pnpm install --frozen-lockfile
node scripts/creator-kit.mjs
```

- Needs Google Chrome.
- Never changes or generates the high-resolution turnaround and face references.

After changing the spec or approved source images, refresh tracked metadata:

```sh
node scripts/creator-kit.mjs --metadata
```

- Node only; formats its JSON with the repository's installed Oxfmt.
- Regular site builds leave tracked metadata unchanged.

Validate and publish all four kits, and each starter friend's deterministic uncompressed ZIP:

```sh
pnpm run site:build
```

- Node only.
- Checks CRCs, PNG scanlines, source sizes and runtime alpha, and validates every kit before writing anything.
- ZIP entries use safe paths, sorted names and fixed dates.
- Output goes to `website/public/creator-kit` and `website/public/pets`, which Git ignores.
- A missing or damaged reference fails publication instead of shipping an incomplete kit.

## Licensing and provenance
- The artwork is from the PlayPets repository, under its MIT license.
- Production sprite provenance: `assets/pets/<character>/`.
- Reference-image provenance: beside the reference images.

## User guides
- [English](../../website/guide/creator-kit.md)
- [Korean](../../website/ko/guide/creator-kit.md)
- [Japanese](../../website/ja/guide/creator-kit.md)
- [Simplified Chinese](../../website/zh-hans/guide/creator-kit.md)
