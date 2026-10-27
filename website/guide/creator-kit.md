---
title: "Creator studio"
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

# Creator studio

<CreationStudio lang="en" kind="pet" />

<details>
<summary>Environment and file requirements</summary>

This free website builds the KIT locally in your browser. It doesn't generate images or upload your files. Everything after that happens in the AI tool you choose, so what's possible depends on that tool.

Your AI environment needs:
- An AI agent that can work with files. An image-only tool can't run the supplied validation and packaging scripts.
- Python 3, Pillow and an image generation tool.

Dependencies aren't installed for you. Check what your tool can do and what the provider charges before you start. A ChatGPT subscription doesn't automatically include image API access.

What the SKILL does:
1. Guides you through eleven 4 × 2 image batches, each one for you to approve.
2. Assembles them with the supplied Python script into a transparent 1536 × 2288 RGBA v2 atlas: nine animation states, sixteen gaze directions.

Review the art and animation in your AI environment before you import the final ZIP.

A pet gets three complete outfits by default: a base set for spring and autumn, one for summer and one for winter. Each set has all nine animation states and sixteen gaze directions. Separate spring or autumn outfits are made only when you explicitly ask for them. Backgrounds keep their own four-season workflow.

The same SKILL can also improve an official friend. It keeps the friend's identity and approved movements.

[Import a pet](./import.md), [Pet format reference](/dev/standards/pet-files)

</details>
