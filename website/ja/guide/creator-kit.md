---
title: "キャラクター制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "キャラクターの希望を書いて、SKILL入りの制作KITを一つダウンロードします。ファイルを扱えるAIエージェントにKITをまるごと渡し、そこで画像を作って確認すると、PlayPetsに取り込めるペットZIPができあがります。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# キャラクター制作室

<CreationStudio lang="ja" kind="pet" />

<details>
<summary>実行環境とファイル形式</summary>

この無料サイトは、ブラウザーの中でKITを用意するだけです。画像を生成したり、ファイルをアップロードしたりはしません。その先は選んだAIツールでの作業になるので、何ができるかはツールしだいです。

AI環境に必要なもの：
- ファイルを扱えるAIエージェント。画像を作るだけのツールでは、付属の検査スクリプトやパッケージ作成スクリプトを動かせません。
- Python 3、Pillow、画像生成ツール

依存関係は自動でインストールされません。始める前に、ツールの対応機能と提供元の料金を確かめてください。ChatGPTの契約だけでは、画像APIは使えるようになりません。

SKILLの流れ：
1. 4 × 2の元画像バッチ11枚を、確認して承認しながら進めます。
2. 付属のPythonスクリプトで、1536 × 2288 RGBAの透過v2アトラスに組み立てます（9種類の動作、16方向の視線）。

完成ZIPを取り込む前に、9種類の動作と16方向の視線をAI環境で確認してください。

服は標準で3着です。春と秋に着る基本の服、夏服、冬服で、どの服にも9種類の動作と16方向の視線がそろいます。春や秋だけの服は、はっきり頼んだときだけ追加します。背景はこれまでどおり四季で作ります。

公式の友だちを手直しするときも、同じSKILLが使えます。姿と承認済みの動きはそのまま保ちます。

[ペットを取り込む](./import.md), [ペット形式の仕様、英語](/dev/standards/pet-files)

</details>
