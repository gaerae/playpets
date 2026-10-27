---
title: "角色制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "描述想要的角色，下载一个包含SKILL的制作KIT。将整个KIT交给能处理文件的AI智能体，在该环境中创作并检查图片，最后获得可直接导入PlayPets的宠物ZIP。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 角色制作室

<CreationStudio lang="zh-hans" kind="pet" />

<details>
<summary>运行环境与文件格式</summary>

- 这个免费网站在浏览器本地准备KIT，不生成图片，也不上传文件。
- 能否生成图片、运行文件，取决于你选的AI工具。
- 只能生成图片的工具无法运行附带的验证和打包脚本，请用支持文件操作的AI智能体。
- SKILL需要Python 3、Pillow，以及所选AI环境中可用的图片生成工具。
- 开始前先确认工具能力和提供商的费用。
- 依赖不会自动安装。订阅ChatGPT也不代表自动获得图片API访问权限。

制作步骤：

1. 按SKILL检查并确认11张4 × 2原始批次图。
2. 用附带的Python脚本组装成1536 × 2288 RGBA透明v2图集。
3. 在AI环境中检查9种动画状态和16个视线方向。
4. 导入完成的ZIP。

季节服装：

- 默认三套：春秋共用的基础服装、夏装、冬装。每套都有9种动画状态和16个视线方向。
- 改善官方伙伴也用同一个SKILL，保留其身份特征和已确认的动作。
- 只有明确要求时才加春季或秋季专属服装；背景仍按四季制作。

[导入宠物](./import.md), [宠物格式规范、英文](/dev/standards/pet-files)

</details>
