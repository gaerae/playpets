---
title: "背景制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "描述想要的场景，下载一个包含SKILL的制作KIT。将整个KIT交给能处理文件的AI智能体，在该环境中创作并检查图片，最后获得可直接导入PlayPets的背景JSON。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 背景制作室

<CreationStudio lang="zh-hans" kind="background" />

<details>
<summary>运行环境与文件格式</summary>

- 这个免费网站在浏览器本地准备KIT，不生成图片，也不上传文件。
- 能否生成图片、运行文件，取决于你选的AI工具。
- 只能生成图片的工具无法运行附带的验证和打包脚本，请用支持文件操作的AI智能体。
- SKILL需要Python 3、Pillow，以及所选AI环境中可用的图片生成工具。
- 开始前先确认工具能力和提供商的费用。
- 依赖不会自动安装。订阅ChatGPT也不代表自动获得图片API访问权限。
- SKILL会准备1536 × 1024背景图片和支持的布局、氛围设置：行走区域、水域、钓鱼站位、窗户区域和可选的季节图片。
- 检查完整窗口和小窗口尺寸的效果后，在**场景与氛围**中用**导入背景**导入完成的JSON。

[背景资源包规范、英文](/dev/how-to/add-a-world#portable-backgrounds)

</details>
