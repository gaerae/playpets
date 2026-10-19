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

This free website prepares the KIT locally in your browser. It does not generate images or upload your files. Image generation and file execution depend on the AI tool you choose. An image-only tool cannot run the supplied validation and packaging scripts; use an AI agent that can work with files.

The SKILL needs Python 3, Pillow and an image generation tool available in your chosen AI environment. Check those capabilities and any provider charges before starting. Dependencies are not installed automatically, and a ChatGPT subscription does not automatically provide image API access.

The SKILL guides eleven approved 4 × 2 image batches, then uses the supplied Python script to assemble a transparent 1536 × 2288 RGBA v2 atlas with nine animation states and sixteen gaze directions. Review the art and animation in your AI environment before importing the final ZIP.

Seasonal pet clothing uses three complete sets by default: base for both spring and autumn, summer, and winter. Each set includes all nine animation states and sixteen gaze directions. Use the same SKILL to improve an official friend while preserving its identity and approved movements. Separate spring or autumn outfits are optional when explicitly requested; backgrounds keep their four-season workflow.

[Import a pet](./import.md), [Pet format reference](/dev/standards/pet-files)

</details>
