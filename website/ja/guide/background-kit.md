---
title: "背景制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "場面の希望を入力し、SKILLを含む制作KITを一つダウンロードします。ファイルを扱えるAIエージェントにKIT全体を渡し、その環境で画像を制作、確認して、PlayPetsに取り込める背景JSONを受け取ります。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 背景制作室

<CreationStudio lang="ja" kind="background" />

<details>
<summary>実行環境とファイル形式</summary>

この無料サイトはブラウザー内でKITを用意します。画像の生成やファイルのアップロードは行いません。画像生成とファイル実行の可否は、選んだAIツールによって異なります。画像だけを生成するツールでは付属の検査、パッケージ作成スクリプトを実行できないため、ファイル作業に対応するAIエージェントを使ってください。

SKILLにはPython 3、Pillow、選んだAI環境で使える画像生成ツールが必要です。開始前に対応機能と提供元の料金を確認してください。依存関係は自動インストールされません。ChatGPTの契約だけで画像APIへのアクセスが提供されるわけではありません。

SKILLは1536 × 1024の背景画像と、歩く範囲、水、釣りの立ち位置、窓の領域、任意の季節画像など、対応する配置、雰囲気設定を用意します。通常ウィンドウと小さなウィンドウサイズで確認し、完成JSONを場所、雰囲気から取り込みます。

[背景パッケージの仕様、英語](/dev/how-to/add-a-world#portable-backgrounds)

</details>
