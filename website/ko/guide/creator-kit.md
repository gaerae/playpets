---
title: "캐릭터 제작실"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "원하는 캐릭터를 적고 SKILL이 든 제작 KIT를 하나 받아요. 파일을 다루는 AI 에이전트에 KIT를 통째로 맡겨 그림을 만들고 검토하면, PlayPets로 바로 가져올 펫 ZIP이 나와요."
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 캐릭터 제작실

<CreationStudio lang="ko" kind="pet" />

<details>
<summary>실행 환경과 파일 규격 안내</summary>

이 무료 웹사이트는 브라우저 안에서 KIT만 만들어요. 이미지를 생성하거나 파일을 올리지는 않아요. 그다음 작업은 고른 AI 도구에서 하니, 무엇이 되는지는 그 도구의 기능에 달려 있어요.

AI 환경에 필요한 것:
- 파일 작업을 하는 AI 에이전트. 이미지만 만드는 도구로는 함께 든 검사, 포장 스크립트를 돌릴 수 없어요.
- Python 3, Pillow, 이미지 생성 도구

의존성은 자동으로 설치하지 않아요. 시작하기 전에 도구가 지원하는 기능과 제공업체 요금을 확인해 주세요. ChatGPT를 구독한다고 이미지 API 권한이 따라오지는 않아요.

만드는 순서:
1. SKILL 안내를 따라 4 × 2 원본 배치 11개를 검토하고 승인해요.
2. 함께 든 Python 스크립트가 이 배치를 1536 × 2288 RGBA v2 투명 동작 시트로 조립해요.
3. 동작 9종과 시선 16방향을 AI 환경에서 확인해요.
4. 완성된 ZIP을 가져와요.

의상은 기본으로 세 벌이에요. 봄과 가을에 함께 입는 기본 의상, 여름옷, 겨울옷이고, 벌마다 동작 9종과 시선 16방향이 모두 들어가요. 봄이나 가을 전용 의상은 요청할 때만 따로 만들어요. 배경은 지금처럼 사계절로 만들어요.

기본 친구를 다듬을 때도 같은 SKILL을 써요. 친구의 외형과 승인된 동작은 그대로 지켜요.

[펫 가져오기](./import.md), [펫 파일 규격, 영어](/dev/standards/pet-files)

</details>
