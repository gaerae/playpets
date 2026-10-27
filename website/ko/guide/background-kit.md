---
title: "배경 제작실"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "원하는 장면을 적고 SKILL이 든 제작 KIT를 하나 받아요. 파일을 다루는 AI 에이전트에 KIT를 통째로 맡겨 그림을 만들고 검토하면, PlayPets로 바로 가져올 배경 JSON이 나와요."
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 배경 제작실

<CreationStudio lang="ko" kind="background" />

<details>
<summary>실행 환경과 파일 규격 안내</summary>

이 무료 웹사이트는 브라우저 안에서 KIT만 만들어요. 이미지를 생성하거나 파일을 올리지는 않아요. 그다음 작업은 고른 AI 도구에서 하니, 무엇이 되는지는 그 도구의 기능에 달려 있어요.

AI 환경에 필요한 것:
- 파일 작업을 하는 AI 에이전트. 이미지만 만드는 도구로는 함께 든 검사, 포장 스크립트를 돌릴 수 없어요.
- Python 3, Pillow, 이미지 생성 도구

의존성은 자동으로 설치하지 않아요. 시작하기 전에 도구가 지원하는 기능과 제공업체 요금을 확인해 주세요. ChatGPT를 구독한다고 이미지 API 권한이 따라오지는 않아요.

SKILL은 1536 × 1024 배경 그림과 함께, 앱이 지원하는 배치와 분위기 설정을 준비해요.
- 걷는 영역, 물, 낚시 위치, 창문 영역
- 선택해서 넣는 계절 그림

그다음:
1. 전체 창과 작은 창 크기로 장면을 검토해요.
2. 완성된 JSON을 **배경과 분위기**의 **배경 가져오기**로 가져와요.

[배경 패키지 규격, 영어](/dev/how-to/add-a-world#portable-backgrounds)

</details>
