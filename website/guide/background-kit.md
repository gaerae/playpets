---
title: "Background studio"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "Describe your scene and download one creation KIT with its SKILL. Give the whole KIT to a file-capable AI agent, create and review the artwork there, and receive a background JSON ready to import into PlayPets."
---

<script setup>
import CreationStudio from "../.vitepress/theme/CreationStudio.vue";
</script>

# Background studio

<CreationStudio lang="en" kind="background" />

<details>
<summary>Environment and file requirements</summary>

This free website prepares the KIT locally in your browser. It does not generate images or upload your files. Image generation and file execution depend on the AI tool you choose. An image-only tool cannot run the supplied validation and packaging scripts; use an AI agent that can work with files.

The SKILL needs Python 3, Pillow and an image generation tool available in your chosen AI environment. Check those capabilities and any provider charges before starting. Dependencies are not installed automatically, and a ChatGPT subscription does not automatically provide image API access.

The SKILL prepares 1536 × 1024 artwork and the supported layout and atmosphere settings: walking area, water, fishing stance, window regions and optional seasonal images. Review the scene at full and small window sizes, then import the final JSON with **Import background** in Place & atmosphere.

[Background package reference](/dev/how-to/add-a-world#portable-backgrounds)

</details>
