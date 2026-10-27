---
title: "背景制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "描述你想要的场景，下载一个带SKILL的制作KIT。把整个KIT交给能处理文件的AI智能体，在那里创作并检查图片，最后得到可以直接导入PlayPets的背景JSON。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 背景制作室

<CreationStudio lang="zh-hans" kind="background" />

<details>
<summary>运行环境与文件格式</summary>

这个免费网站只在浏览器本地准备KIT，不生成图片，也不上传文件。后面的工作都在你选的AI工具里完成，能做到什么取决于这个工具。

AI环境需要：
- 能处理文件的AI智能体。只会生成图片的工具跑不了附带的验证和打包脚本。
- Python 3、Pillow和图片生成工具。

依赖不会自动安装。开始前先确认工具支持哪些功能，以及提供商怎么收费。订阅了ChatGPT，也不等于自动拥有图片API访问权限。

SKILL会准备1536 × 1024的背景图片，以及应用支持的布局和氛围设置：

- 行走区域、水域、钓鱼站位、窗户区域
- 可选的季节图片

然后：

1. 用完整窗口和小窗口两种尺寸检查效果。
2. 在**场景与氛围**中用**导入背景**导入完成的JSON。

[背景资源包规范、英文](/dev/how-to/add-a-world#portable-backgrounds)

</details>
