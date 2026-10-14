---
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
description: "角色创作室：详细参考与即用宠物"
---

<script setup>
import ExtensionPrompts from "../../.vitepress/theme/ExtensionPrompts.vue";
import CreatorKit from "../../.vitepress/theme/CreatorKit.vue";
</script>

# 角色制作室

从三位伙伴中选择，保留角色特点，尝试新的服装和动作。这里准备了可直接用于图像工具的提示词。

<CreatorKit lang="zh-hans" />


<ExtensionPrompts lang="zh-hans" />

三位伙伴的设计套件都包含原始图片、角色规格、五份提示词、动作参考、全身转面图和面部细节图。Daisy、Clover和Pip各有夏季与冬季图集。导入会添加新伙伴，不会修改现有伙伴或记录。

基础ZIP只包含`pet.json`和`spritesheet.png`。

## 支持的运行格式

**v2: 1536×2288 · 8×11 · 192×208 · 88 cells · RGBA / alpha 0.**

| Row | Source filename | Used frames / directions |
|---|---|---|
| 0 | `00-idle.png` | 6 |
| 1 | `01-right.png` | 8 |
| 2 | `02-left.png` | 8 |
| 3 | `03-wave.png` | 4 |
| 4 | `04-jump.png` | 5 |
| 5 | `05-error.png` | 8 |
| 6 | `06-waiting.png` | 6 |
| 7 | `07-working.png` | 6 |
| 8 | `08-done.png` | 6 |
| 9 | `09-look.png` | N, NNE, NE, ENE, E, ESE, SE, SSE |
| 10 | `10-look.png` | S, SSW, SW, WSW, W, WNW, NW, NNW |

## 打包与导入

克隆仓库后运行 `npm ci` 安装依赖，并准备 Google Chrome，供现有浏览器打包工具使用。将十一张已审核的 1536×1024 源批次保存到 `my-character-rows/`，使用以下准确文件名：

```plaintext
00-idle.png
01-right.png
02-left.png
03-wave.png
04-jump.png
05-error.png
06-waiting.png
07-working.png
08-done.png
09-look.png
10-look.png
```

```sh
node scripts/pack-companion-batches.mjs my-character-rows my-character/spritesheet.png 163
```

最后一个参数是最终单元中首个待机姿势的剪影高度。插画可从 `163` 开始，已有角色应保持测量出的尺寸（Clover 为 168）。这些是绘制参考，不是新的文件规格。打包器使用统一比例、保留跳跃高度，并对裁切报错，不会单独缩小某一行。

把输出 PNG 与下列 manifest 放进同一个文件夹，再使用[从本机文件夹导入](./import.md)。请修改身份和描述，使其符合自己的虚构角色。可选季节服装与风格字段属于 PlayPets 扩展，其他宠物应用可能忽略这些字段。

```json
{
  "id": "my-fictional-adult",
  "displayName": "My character",
  "kind": "person",
  "description": "A fictional adult companion, age 26.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.png"
}
```

## 质量检查

检查全部 88 个单元，再以普通和迷你尺寸、DPR1/2 播放实际使用的帧。检查透明度、手脚与配饰是否完整、头部大小、左右细节、视线顺序、动作含义及循环衔接。不合格时重新生成对应源行。额外表情和转面图保留为独立参考；当前验证不支持额外行列或任意单元尺寸。

## 可选 PlayPets 季节服装

季节图集是 PlayPets 可选扩展，其他应用可能忽略。另保留仅有基础图集的导出。宠物无需备用外观，写实画风也可作为普通宠物的基础图集。旧 `realisticSpritesheets` 字段是兼容扩展，并非强制两种画风。仅列出实际提供的文件；缺少季节图集时使用基础图集。

PlayPets 扩展包还可用 `portraitPath` 指定提供的聊天头像 PNG。可选头像不会改变动画图集。基础 ZIP 不含头像和服装扩展。

```json
{
  "id": "my-pet",
  "displayName": "My pet",
  "description": "An independently designed companion.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.png",
  "seasonalSpritesheets": {
    "summer": "summer.png",
    "winter": "winter.png"
  }
}
```

[背景制作室](./background-kit)
