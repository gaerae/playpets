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

<details>
<summary>Environment and file requirements</summary>

This free website builds the KIT locally in your browser. It doesn't generate images or upload your files. Everything after that happens in the AI tool you choose, so what's possible depends on that tool.

Your AI environment needs:
- An AI agent that can work with files. An image-only tool can't run the supplied validation and packaging scripts.
- Python 3, Pillow and an image generation tool.

Dependencies aren't installed for you. Check what your tool can do and what the provider charges before you start. A ChatGPT subscription doesn't automatically include image API access.

The SKILL prepares 1536 × 1024 artwork along with the layout and atmosphere settings PlayPets supports:
- walking area, water, fishing stance, window regions
- optional seasonal images

Then:
1. Review the scene at full and small window sizes.
2. Import the final JSON with **Import background** in **Place & atmosphere**.

[Background package reference](/dev/how-to/add-a-world#portable-backgrounds)

</details>
