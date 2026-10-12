---
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
description: "Creator studio: character sheets and ready-to-use pets"
---

<script setup>
import ExtensionPrompts from "../.vitepress/theme/ExtensionPrompts.vue";
import CreatorKit from "../.vitepress/theme/CreatorKit.vue";
</script>

# Creator studio

Choose from ten friends. Keep their character, try a new outfit or motion, and take the prompt straight to your image tool.

<CreatorKit lang="en" />

Aria and Noah are fictional adults, ages 25 and 26. Each entry is a separate pet. Mini in a name describes the character; every pet works in the mini window.

<ExtensionPrompts lang="en" />

Each design kit includes the original artwork, character specification, five prompts and animation references. Detailed turnaround and face sheets are available for Aria, Aria Mini, Noah, Noah Mini and Clover; the other five start from original animation references. Check the selected kit before downloading. Seasonal sheets are included only where available. Importing a pet creates a separate friend and preserves existing history.

The baseline ZIP contains only `pet.json` and `spritesheet.png`.

## Supported runtime format

**v2: 1536×2288 · 8×11 · 192×208 · 88 cells · RGBA / alpha 0.**

| Row | Source filename | Used frames / directions |
|---|---|---|
| 0 | `00-idle.png` | 6 |
| 1 | `01-right.png` | 8 |
| 2 | `02-left.png` | 8 |
| 3 | `03-wave.png` | 4 |
| 4 | `04-jump.png` | 5 |
| 5 | `05-error.png` | 8 |
| 6 | `06-waiting.png` | 6 |
| 7 | `07-working.png` | 6 |
| 8 | `08-done.png` | 6 |
| 9 | `09-look.png` | N, NNE, NE, ENE, E, ESE, SE, SSE |
| 10 | `10-look.png` | S, SSW, SW, WSW, W, WNW, NW, NNW |

## Pack and import

Clone the repository, install its dependencies with `npm ci`, and have Google Chrome available for the existing browser-based packer. Save eleven approved 1536×1024 source batches under `my-character-rows/`, using these exact filenames:

```plaintext
00-idle.png
01-right.png
02-left.png
03-wave.png
04-jump.png
05-error.png
06-waiting.png
07-working.png
08-done.png
09-look.png
10-look.png
```

```sh
node scripts/pack-companion-batches.mjs my-character-rows my-character/spritesheet.png 176
```

The last argument is the first idle silhouette height in the final cell: use `176` for these realistic adult examples, or `163` as the illustrated starting target. Preserve an established character’s measured scale (Clover uses 168); these are art targets, not new format dimensions. The packer shares one scale, preserves jump lift, and rejects clipping instead of shrinking individual rows.

Put the resulting PNG and this manifest in one folder, then use [Import from a folder](./import.md). Change the identity and description to match your own fictional character. Optional wardrobe/style fields are PlayPets extensions; other pet applications may ignore them.

```json
{
  "id": "my-fictional-adult",
  "displayName": "My character",
  "kind": "person",
  "description": "A fictional adult companion, age 26.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.png"
}
```

## Quality gate

Inspect all 88 cells, then play the consumed frames at normal and mini sizes with DPR1/2. Check alpha, complete hands/feet/accessories, unchanged head size, handed details, gaze order, action meaning and smooth loop seams. Regenerate a failed source row. More expressions or turnaround views stay separate references: current validation does not accept extra columns, rows or arbitrary cell sizes.

## Optional PlayPets wardrobes

Seasonal sheets are optional PlayPets extensions; other hosts may ignore them. Keep a baseline-only export separately. A pet needs no alternate appearance, and realistic artwork can be the baseline of an ordinary pet. The legacy `realisticSpritesheets` field is a compatibility extension, not a mandatory two-style model. Include only files you actually provide. Missing seasonal sheets fall back to the baseline.

A richer PlayPets package may also set `portraitPath` to a provided PNG for the chat face. This optional portrait does not change the animation sheet. The baseline-only ZIP omits both portrait and wardrobe extensions.

```json
{
  "id": "my-pet",
  "displayName": "My pet",
  "description": "An independently designed companion.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.png",
  "seasonalSpritesheets": {
    "summer": "summer.png",
    "winter": "winter.png"
  }
}
```
