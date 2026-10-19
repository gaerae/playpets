---
title: "キャラクター制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "キャラクターの希望を入力し、SKILLを含む制作KITを一つダウンロードします。ファイルを扱えるAIエージェントにKIT全体を渡し、その環境で画像を制作、確認して、PlayPetsに取り込めるペットZIPを受け取ります。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# キャラクター制作室

<CreationStudio lang="ja" kind="pet" />

<details>
<summary>実行環境とファイル形式</summary>

この無料サイトはブラウザー内でKITを用意します。画像の生成やファイルのアップロードは行いません。画像生成とファイル実行の可否は、選んだAIツールによって異なります。画像だけを生成するツールでは付属の検査、パッケージ作成スクリプトを実行できないため、ファイル作業に対応するAIエージェントを使ってください。

SKILLにはPython 3、Pillow、選んだAI環境で使える画像生成ツールが必要です。開始前に対応機能と提供元の料金を確認してください。依存関係は自動インストールされません。ChatGPTの契約だけで画像APIへのアクセスが提供されるわけではありません。

SKILLに従って4 × 2の元画像バッチ11枚を確認、承認し、付属のPythonスクリプトで1536 × 2288 RGBAの透過v2アトラスに組み立てます。9種類の動作と16方向の視線をAI環境で確認してから、完成ZIPを取り込みます。

季節の服は、春と秋共通の基本服、夏服、冬服の3種類を標準とします。各服に9種類の動作と16方向の視線を含めます。公式の友だちを改善するときも、姿と承認済みの動きを保ちながら同じSKILLを使えます。春や秋の専用服は明示的に希望した場合だけ追加し、背景は従来どおり四季で制作します。

[ペットを取り込む](./import.md), [ペット形式の仕様、英語](/dev/standards/pet-files)

</details>
