---
title: "Background studio"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "Describe your scene and download one creation KIT with its SKILL. Hand the whole KIT to an AI agent that can work with files, make and review the artwork there, and you get a background JSON ready to import into PlayPets."
---

<script setup>
import CreationStudio from "../.vitepress/theme/CreationStudio.vue";
</script>

# Background studio

<CreationStudio lang="en" kind="background" />

## Built-in places and yours

| | Built-in places | Your background |
|---|---|---|
| Places | Hill garden, stone courtyard, lakeside cottage, garden workshop | One for each file you import |
| Live sky | Through a transparent sky outdoors, and through the workshop's glass | Through real transparency above the skyline (outdoors) |
| Weather indoors | Inside the workshop's glass | Inside up to twelve window rectangles |
| Fishing | The three outdoor places | A water ellipse and a dry fishing stance |
| Seasons | Four pictures outdoors, one for the workshop | Optional seasonal pictures |
| Coding-agent friends | Workshop: tables, a bench with a bell at the front, a tea corner | Work where they stand; a waiting friend comes to the front |

- Tables, the approval bench and the tea corner (`geometry.stations`) are the built-in workshop's. A background file doesn't have them yet.
- Keep the whole floor clear: a friend can stroll anywhere on it.

<details>
<summary>Environment and file requirements</summary>

The website only builds the KIT in your browser. It doesn't generate images or upload files; the rest happens in your AI tool.

| You need | Note |
|---|---|
| An AI agent that works with files | An image-only tool can't run the validation and packaging scripts |
| Python 3 and Pillow | Not installed for you |
| An image generation tool | Check its price first. A ChatGPT plan doesn't include image API access |

The SKILL prepares:
- 1536 × 1024 artwork
- the walking floor, water, fishing stance and window rectangles
- optional seasonal pictures

Then:
1. Review the scene at full and small window sizes.
2. Import the JSON with **Import background** in **Place & atmosphere**.

[Background package reference](/dev/how-to/add-a-world#portable-backgrounds)

</details>
