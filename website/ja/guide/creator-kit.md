---
title: "キャラクター制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
description: キャラクターの参考画像、プロンプト、すぐ取り込めるペットの制作キット
---

<script setup>
import StudioWorkspace from "../../.vitepress/theme/StudioWorkspace.vue";
import StudioNav from "../../.vitepress/theme/StudioNav.vue";
import ExtensionPrompts from "../../.vitepress/theme/ExtensionPrompts.vue";
import PetPackager from "../../.vitepress/theme/PetPackager.vue";
import CreatorKit from "../../.vitepress/theme/CreatorKit.vue";
</script>

# 制作室

3人の友だちから選び、特徴を保ちながら服や動きを変えてみましょう。画像ツールですぐ使えるプロンプトを用意しました。

<StudioNav lang="ja" current="pet" />

<StudioWorkspace lang="ja">
  <template #sample><CreatorKit lang="ja" /></template>
  <template #custom><ExtensionPrompts lang="ja" /></template>
  <template #package><PetPackager lang="ja" /></template>
</StudioWorkspace>

<details class="studio-reference">
<summary>ファイル仕様と詳しい制作手順</summary>







## ブラウザーで確認して書き出す

下のツールには**完成したv2アトラス**を追加します。PNGファイルを検査・デコードし、使用する動作と視線の73セル、実行時と同じフレーム間隔を確認できます。季節シートを追加し、実際に選んだファイルだけを含むZIPを保存できます。解凍してPlayPetsにフォルダーを取り込んでください。11枚の元画像の組み立てには、下のパッキングツールを使います。



3人のデザインキットには元の画像、キャラクター仕様、5つのプロンプト、動作資料、全身各方向図、顔の詳細図が含まれます。Daisy、Clover、Pipそれぞれに夏と冬の画像もあります。取り込みは既存の友だちや記録を変えず、新しい友だちを追加します。

基本ZIPには`pet.json`と`spritesheet.png`だけが含まれます。

## 対応する実行時の形式

**v2：1536×2288 · 8×11 · 192×208 · 88セル · RGBA / alpha 0**

| 行 | 元ファイル | 使用するフレーム・方向 |
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

## 組み立てて取り込む

リポジトリーを取得し、`npm ci`で依存関係を入れます。既存のブラウザー式の組み立てツールにはGoogle Chromeが必要です。確認済みの1536×1024画像11枚を`my-character-rows/`へ、次の名前で保存します。

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

最後の引数は、最終セル内の最初の待機ポーズのシルエットの高さです。イラストの開始目安は`163`で、既存キャラクターは測定した大きさを保ちます（Cloverは168）。これは絵の大きさの目安で、ファイル規格を変えるものではありません。パッカーは共通の倍率とジャンプの高さを保ち、切れる行は個別に縮めずエラーにします。

完成PNGと次のpet.jsonを同じフォルダーに入れ、[フォルダーから取り込み](./import.md)ます。名前や紹介は自分の架空のキャラクターに合わせてください。任意の服装や見た目の項目はPlayPets拡張で、ほかのアプリでは使わない場合があります。

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

## 品質を確認する

88セルをすべて確認し、通常サイズとミニサイズ、DPR1/2で使用フレームを再生します。透過、手足や持ち物の完全さ、頭の大きさ、左右の特徴、視線順、動作の意味、ループのつなぎ目を見ます。失敗した行は作り直してください。追加の表情や各方向図は参考画像として別に保管します。現在の検証では列・行の追加や任意のセル寸法は使えません。

## PlayPetsの任意の服装

季節の画像はPlayPetsの任意拡張です。ほかのアプリでは無視する場合があるので、基本だけの書き出しも別に保管してください。別の見た目は必須ではなく、リアルな絵も普通のペットの基本画像にできます。従来の`realisticSpritesheets`は互換用で、2種類の画風を必須にするものではありません。提供するファイルだけを記載し、季節画像がなければ基本画像を使います。

PlayPets用パッケージは会話の顔として任意の`portraitPath`を指定できます。実際に提供するPNGを指定してください。アニメーション画像は変わりません。基本ZIPにはポートレートと服装拡張は含みません。

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

</details>
