---
title: "角色制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "描述你想要的角色，下载一个带SKILL的制作KIT。把整个KIT交给能处理文件的AI智能体，在那里创作并检查图片，最后得到可以直接导入PlayPets的宠物ZIP。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 角色制作室

<CreationStudio lang="zh-hans" kind="pet" />

<details>
<summary>运行环境与文件格式</summary>

这个免费网站只在浏览器本地准备KIT，不生成图片，也不上传文件。后面的工作都在你选的AI工具里完成，能做到什么取决于这个工具。

AI环境需要：
- 能处理文件的AI智能体。只会生成图片的工具跑不了附带的验证和打包脚本。
- Python 3、Pillow和图片生成工具。

依赖不会自动安装。开始前先确认工具支持哪些功能，以及提供商怎么收费。订阅了ChatGPT，也不等于自动拥有图片API访问权限。

制作步骤：

1. 按SKILL的引导，检查并确认11张4 × 2原始批次图。
2. 用附带的Python脚本组装成1536 × 2288 RGBA透明v2图集。
3. 在AI环境中检查9种动画状态和16个视线方向。
4. 导入完成的ZIP。

默认做三套衣服：春秋共用的基础款、夏装和冬装，每套都有9种动画状态和16个视线方向。春季或秋季专属服装只在你明确要求时才加，背景照旧按四季制作。

改进官方伙伴也用同一个SKILL，它的身份特征和已确认的动作都会保留。

[导入宠物](./import.md), [宠物格式规范、英文](/dev/standards/pet-files)

</details>
