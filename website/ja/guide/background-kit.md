---
title: "背景制作室"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
---

<script setup>
import StudioNav from "../../.vitepress/theme/StudioNav.vue";
import BackgroundKit from "../../.vitepress/theme/BackgroundKit.vue";
</script>

# 制作室

配置シートとプロンプトで空間を作り、PlayPetsに背景パッケージを読み込みます。

<StudioNav lang="ja" current="background" />

<BackgroundKit lang="ja" />

<details class="studio-reference">
<summary>ファイル仕様と詳しい制作手順</summary>



## アプリが加えるもの

アプリは画像の上にフレンドと操作画面を重ねます。歩く床を空けておき、
水面と釣りをするときの立ち位置を背景ごとに指定してください。
雨や雪は屋外、または指定した窓の領域に表示されます。空を透明にすると、
アプリの太陽や雲、時間によって変わる空の色が見えます。

季節ごとに風景を変えるには、四季の画像を追加してください。
未指定の季節は基本画像を使います。雪の日は冬の画像があれば使います。
このパッケージ形式ではアプリが時間帯の色調を加えます。朝や夜の画像を
個別に指定することはできません。花、魚、虫、遊び道具は取り込んだ画像とは
別に、PlayPets共通の素材を使います。

## ファイルを保存し、二つのサイズで確認

JSONパッケージをダウンロードし、アプリの**場所と雰囲気**から背景を読み込みます。
背景は端末のこのアプリプロファイルに保存されるため、ダウンロードしたファイルも
バックアップとして保管してください。このページが画像をアップロードすることはありません。

通常のウィンドウとミニモードの両方で、フレンドが家具に重ならないか、
釣り糸が見えている水面に届くか、雨や雪が窓枠からはみ出さないかを確認してください。
配置シートは空けておく床を指定します。画像内の障害物を自動検出するものではありません。

</details>
