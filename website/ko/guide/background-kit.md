---
title: "배경 제작실"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "원하는 장면을 적고 SKILL이 포함된 제작 KIT 하나를 받아요. 파일을 다룰 수 있는 AI 에이전트에 KIT 전체를 전달하면, 그 환경에서 그림을 만들고 검토한 뒤 PlayPets에 바로 가져올 배경 JSON을 받을 수 있어요."
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 배경 제작실

<CreationStudio lang="ko" kind="background" />

<details>
<summary>실행 환경과 파일 규격 안내</summary>

이 무료 웹사이트는 브라우저 안에서 KIT를 만들어요. 이미지를 생성하거나 파일을 업로드하지 않아요. 이미지 생성과 파일 실행은 선택한 AI 도구의 기능에 따라 달라요. 이미지만 만드는 도구는 제공된 검사·포장 스크립트를 실행할 수 없으므로 파일 작업이 가능한 AI 에이전트를 사용해요.

SKILL에는 Python 3, Pillow와 선택한 AI 환경에서 사용할 수 있는 이미지 생성 도구가 필요해요. 시작 전에 지원 기능과 제공업체의 요금을 확인해요. 의존성은 자동 설치하지 않으며, ChatGPT 구독만으로 이미지 API 사용 권한이 생기지는 않아요.

SKILL은 1536 × 1024 배경 그림과 지원되는 배치·분위기 설정을 준비해요. 걷는 영역, 물, 낚시 위치, 창문 영역, 선택적인 계절 그림을 포함해요. 전체 창과 작은 창 크기로 검토한 뒤 완성 JSON을 장소·분위기에서 가져와요.

[배경 패키지 규격 · 영어](/dev/how-to/add-a-world#portable-backgrounds)

</details>
