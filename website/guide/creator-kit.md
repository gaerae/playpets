---
title: "Creator studio"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "Describe your character and download one creation KIT with its SKILL. Give the whole KIT to a file-capable AI agent, create and review the artwork there, and receive a pet ZIP ready to import into PlayPets."
---

<script setup>
import CreationStudio from "../.vitepress/theme/CreationStudio.vue";
</script>

# Creator studio

<CreationStudio lang="en" kind="pet" />

<details>
<summary>Environment and file requirements</summary>

- This free website prepares the KIT locally in your browser.
- It does not generate images or upload your files.
- Image generation and file execution depend on the AI tool you choose.
- Use an AI agent that can work with files. An image-only tool cannot run the supplied validation and packaging scripts.
- The SKILL needs, in your chosen AI environment: Python 3, Pillow and an image generation tool.
- Check those capabilities and any provider charges before starting.
- Dependencies are not installed automatically.
- A ChatGPT subscription does not automatically provide image API access.
- What the SKILL does:
  1. Guides eleven approved 4 × 2 image batches.
  2. Assembles them with the supplied Python script into a transparent 1536 × 2288 RGBA v2 atlas: nine animation states, sixteen gaze directions.
- Review the art and animation in your AI environment before importing the final ZIP.
- Seasonal pet clothing: three complete sets by default.
  - Base (spring and autumn), summer, winter.
  - Each set includes all nine animation states and sixteen gaze directions.
  - Separate spring or autumn outfits are optional, only when explicitly requested.
  - Backgrounds keep their four-season workflow.
- The same SKILL can improve an official friend while keeping its identity and approved movements.

[Import a pet](./import.md), [Pet format reference](/dev/standards/pet-files)

</details>
