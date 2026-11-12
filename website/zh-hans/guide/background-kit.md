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

## 内置场景和你的背景

| | 内置场景 | 你的背景 |
|---|---|---|
| 场景 | 山丘花园、石板庭院、湖畔小屋、花园工坊 | 每导入一个文件就多一个 |
| 实时天空 | 户外透过透明的天空，工坊透过玻璃 | 透过天际线以上真正透明的区域（户外） |
| 室内天气 | 只在工坊的玻璃里 | 只在窗户矩形里（最多 12 个） |
| 钓鱼 | 三处户外场景 | 一个水面椭圆和一处干地上的钓鱼位置 |
| 季节 | 户外四张图，工坊一张 | 季节图可选 |
| 连着编码代理的伙伴 | 工坊：桌子、前面带铃铛的长椅、喝茶的角落 | 原地干活，等批准时走到前面 |

- 桌子、批准长椅和喝茶角落（`geometry.stations`）只有内置工坊有，背景文件暂时还没有。
- 伙伴会在地面上到处散步，整块地面都要留空。

<details>
<summary>运行环境与文件格式</summary>

这个网站只在浏览器里准备KIT，不生成图片，也不上传文件，后面的工作在你的AI工具里完成。

| 需要 | 说明 |
|---|---|
| 能处理文件的AI智能体 | 只会生成图片的工具跑不了验证和打包脚本 |
| Python 3和Pillow | 不会自动安装 |
| 图片生成工具 | 先确认价格。订阅ChatGPT不等于拥有图片API权限 |

SKILL会准备：
- 1536 × 1024的背景图
- 行走地面、水面、钓鱼位置、窗户矩形
- 可选的季节图

然后：
1. 用完整窗口和小窗口两种尺寸检查画面。
2. 在**场景与氛围**里用**导入背景**导入完成的JSON。

[背景包规范、英文](/dev/how-to/add-a-world#portable-backgrounds)

</details>
