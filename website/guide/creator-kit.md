---
title: "Character studio"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "Describe your character and download one creation KIT with its SKILL. Hand the whole KIT to an AI agent that can work with files, make and review the artwork there, and you get a pet ZIP ready to import into PlayPets."
---

<script setup>
import CreationStudio from "../.vitepress/theme/CreationStudio.vue";
</script>

# Character studio

<CreationStudio lang="en" kind="pet" />

## How the app uses the work rows

A friend linked to a coding agent shows the agent's state in what it does, with the sheet's own rows.

| Row | The agent is | Outdoor places and your backgrounds | Garden workshop |
|---|---|---|---|
| `working` | working | Stops and works where it stands | Sits at a table |
| `waiting` | waiting for your approval | Comes to the front, near the middle | Stands by the bell post at the front |
| `done` | finished | Plays it once, then strolls on | Rests in the tea corner |
| `error` | stuck on an error | Stops where it stands | Stays at its table |

- At a table only the upper body shows, so let `working` read from the waist up.
- Keep the four rows easy to tell apart at a small size.

<details>
<summary>Environment and file requirements</summary>

The website only builds the KIT in your browser. It doesn't generate images or upload files; the rest happens in your AI tool.

| You need | Note |
|---|---|
| An AI agent that works with files | An image-only tool can't run the validation and packaging scripts |
| Python 3 and Pillow | Not installed for you |
| An image generation tool | Check its price first. A ChatGPT plan doesn't include image API access |

Steps:
1. Approve eleven 4 × 2 image batches as the SKILL guides you.
2. The supplied Python script assembles them into a transparent 1536 × 2288 RGBA v2 atlas.
3. Check the nine animation rows and sixteen gaze directions.
4. Import the finished ZIP.

| Outfit | Worn in |
|---|---|
| Base | Spring and autumn |
| Summer | Summer |
| Winter | Winter |

- Every outfit has all nine rows and sixteen gaze directions.
- Separate spring or autumn outfits are made only when you ask.
- The same SKILL can improve an official friend and keeps its identity and approved movements.

[Import a pet](./import.md), [Pet format reference](/dev/standards/pet-files)

</details>
