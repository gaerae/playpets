---
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
description: キャラクターの参考画像、プロンプト、すぐ取り込めるペットの制作キット
---

<script setup>
import ExtensionPrompts from "../../.vitepress/theme/ExtensionPrompts.vue";
import CreatorKit from "../../.vitepress/theme/CreatorKit.vue";
</script>

# キャラクター制作室

10人の友だちから選び、特徴を保ちながら服や動きを変えてみましょう。画像ツールですぐ使えるプロンプトを用意しました。

<CreatorKit lang="ja" />

AriaとNoahは25歳と26歳の架空の成人です。それぞれ独立したペットです。名前のMiniはキャラクター名を指し、ミニウィンドウはすべてのペットで使えます。

<ExtensionPrompts lang="ja" />

すべてのデザインキットに元の画像、キャラクター仕様、5つのプロンプト、動作の参考資料が含まれます。Aria、Aria Mini、Noah、Noah Mini、Cloverには全身各方向図と顔の詳細図もあります。残りの5人は元の動作資料から始めます。ダウンロードする前に、選んだキットの内容を確認してください。季節の画像は用意されているペットのみ含まれます。取り込みは既存の友だちや履歴を変更せず、新しい友だちを追加します。

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
node scripts/pack-companion-batches.mjs my-character-rows my-character/spritesheet.png 176
```

最後の数は完成セルの最初の休憩ポーズの高さです。リアルな成人の例は`176`、イラストの開始目標は`163`です。既存のキャラクターは測った大きさを維持してください（Cloverは168）。これは作画の目標で、ファイル形式の寸法は変わりません。全行で同じ倍率を使い、跳ぶ高さを保ち、個別に縮める代わりにはみ出しを拒否します。

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
