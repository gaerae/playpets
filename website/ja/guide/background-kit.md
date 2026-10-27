---
title: "背景制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "場面の希望を書いて、SKILL入りの制作KITを一つダウンロードします。ファイルを扱えるAIエージェントにKITをまるごと渡し、そこで画像を作って確認すると、PlayPetsに取り込める背景JSONができあがります。"
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 背景制作室

<CreationStudio lang="ja" kind="background" />

<details>
<summary>実行環境とファイル形式</summary>

この無料サイトは、ブラウザーの中でKITを用意するだけです。画像を生成したり、ファイルをアップロードしたりはしません。その先は選んだAIツールでの作業になるので、何ができるかはツールしだいです。

AI環境に必要なもの：
- ファイルを扱えるAIエージェント。画像を作るだけのツールでは、付属の検査スクリプトやパッケージ作成スクリプトを動かせません。
- Python 3、Pillow、画像生成ツール

依存関係は自動でインストールされません。始める前に、ツールの対応機能と提供元の料金を確かめてください。ChatGPTの契約だけでは、画像APIは使えるようになりません。

SKILLは1536 × 1024の背景画像と、アプリが対応する配置や雰囲気の設定を用意します。
- 歩く範囲、水、釣りの立ち位置、窓の領域
- 任意の季節画像

そのあと：
1. 通常のウィンドウと小さなウィンドウのサイズで確認します。
2. 完成したJSONを、**場所と雰囲気**の**背景を読み込む**から取り込みます。

[背景パッケージの仕様、英語](/dev/how-to/add-a-world#portable-backgrounds)

</details>
