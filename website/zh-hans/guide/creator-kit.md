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

## 应用怎样用到工作动作

连接了编码代理的伙伴，会用行动表现代理的状态，用的就是动作图集里已有的行。

| 动作行 | 代理状态 | 户外场景和你的背景 | 花园工坊 |
|---|---|---|---|
| `working` | 工作中 | 原地停下来干活 | 坐到桌边 |
| `waiting` | 等你批准 | 走到前面正中间 | 站在前面的铃铛柱旁 |
| `done` | 完成了 | 播一遍，然后继续散步 | 去喝茶的角落休息 |
| `error` | 出错卡住 | 原地停下 | 留在自己的桌边 |

- 坐在桌边时只露出上半身，所以 `working` 从腰部以上就要看得出来。
- 缩小显示时，这四行也要分得清。

<details>
<summary>运行环境与文件格式</summary>

这个网站只在浏览器里准备KIT，不生成图片，也不上传文件，后面的工作在你的AI工具里完成。

| 需要 | 说明 |
|---|---|
| 能处理文件的AI智能体 | 只会生成图片的工具跑不了验证和打包脚本 |
| Python 3和Pillow | 不会自动安装 |
| 图片生成工具 | 先确认价格。订阅ChatGPT不等于拥有图片API权限 |

制作步骤：
1. 按SKILL的引导，确认11张4 × 2原始批次图。
2. 附带的Python脚本把它们组装成1536 × 2288 RGBA透明v2图集。
3. 检查9种动作和16个视线方向。
4. 导入完成的ZIP。

| 服装 | 穿的季节 |
|---|---|
| 基础款 | 春、秋 |
| 夏装 | 夏 |
| 冬装 | 冬 |

- 每套都有9种动作和16个视线方向。
- 春季或秋季专属服装只在你要求时才做。
- 改进官方伙伴也用同一个SKILL，它的外形和已确认的动作都会保留。

[导入宠物](./import.md), [宠物格式规范、英文](/dev/standards/pet-files)

</details>
