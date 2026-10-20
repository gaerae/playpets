---
title: "캐릭터 제작실"
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
prev: false
next: false
editLink: false
description: "원하는 캐릭터를 적고 SKILL이 포함된 제작 KIT 하나를 받아요. 파일을 다룰 수 있는 AI 에이전트에 KIT 전체를 전달하면, 그 환경에서 그림을 만들고 검토한 뒤 PlayPets에 바로 가져올 펫 ZIP을 받을 수 있어요."
---

<script setup>
import CreationStudio from "../../.vitepress/theme/CreationStudio.vue";
</script>

# 캐릭터 제작실

<CreationStudio lang="ko" kind="pet" />

<details>
<summary>실행 환경과 파일 규격 안내</summary>

이 무료 웹사이트는 브라우저 안에서 KIT를 만들어요. 이미지를 생성하거나 파일을 업로드하지 않아요. 이미지 생성과 파일 실행은 선택한 AI 도구의 기능에 따라 달라요. 이미지만 만드는 도구는 제공된 검사, 포장 스크립트를 실행할 수 없으므로 파일 작업이 가능한 AI 에이전트를 사용해요.

SKILL에는 Python 3, Pillow와 선택한 AI 환경에서 사용할 수 있는 이미지 생성 도구가 필요해요. 시작 전에 지원 기능과 제공업체의 요금을 확인해요. 의존성은 자동 설치하지 않으며, ChatGPT 구독만으로 이미지 API 사용 권한이 생기지는 않아요.

SKILL 안내에 따라 4 × 2 원본 배치 11개를 검토하고 승인해요. 제공된 Python 스크립트가 이를 1536 × 2288 RGBA v2 투명 동작 시트로 조립해요. 동작 9종과 시선 방향 16개를 AI 환경에서 검토한 뒤 완성 ZIP을 가져와요.

계절 의상은 기본적으로 봄과 가을 공용 기본 의상, 여름, 겨울의 3종으로 만들어요. 각 의상에 동작 9종과 시선 16방향을 모두 담아요. 기본 친구의 외형과 승인된 동작을 유지하며 개선할 때도 같은 SKILL을 사용해요. 별도 봄, 가을 의상은 요청할 때만 추가하고, 배경은 기존처럼 사계절을 만들어요.

[펫 가져오기](./import.md), [펫 파일 규격, 영어](/dev/standards/pet-files)

</details>
