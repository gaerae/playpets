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

## 기본 장소와 내 배경

| | 기본 장소 | 내 배경 |
|---|---|---|
| 장소 | 언덕 정원, 돌집 안뜰, 호숫가 집, 정원 공방 | 가져온 파일마다 하나씩 |
| 실시간 하늘 | 야외는 투명한 하늘로, 공방은 유리 너머로 보여요 | 스카이라인 위의 진짜 투명 영역으로 보여요(야외) |
| 실내 날씨 | 공방 유리 안에만 | 창문 사각형 안에만(최대 12개) |
| 낚시 | 야외 장소 세 곳 | 물 타원과 마른 땅의 낚시 자리 |
| 계절 | 야외는 그림 넷, 공방은 그림 하나 | 계절 그림은 선택 |
| 코딩 에이전트 친구 | 공방: 탁자, 앞쪽의 종 달린 벤치, 차 마시는 구석 | 그 자리에서 일하고, 승인을 기다리면 앞쪽으로 나와요 |

- 탁자, 승인 벤치, 차 마시는 구석(`geometry.stations`)은 기본 공방에만 있어요. 배경 파일에는 아직 없어요.
- 친구가 바닥 어디든 산책하니 바닥 전체를 비워 둬요.

<details>
<summary>실행 환경과 파일 규격 안내</summary>

이 웹사이트는 브라우저 안에서 KIT만 만들어요. 이미지를 생성하거나 파일을 올리지 않고, 나머지는 내 AI 도구에서 해요.

| 필요한 것 | 참고 |
|---|---|
| 파일을 다루는 AI 에이전트 | 이미지만 만드는 도구로는 검사, 포장 스크립트를 돌릴 수 없어요 |
| Python 3와 Pillow | 자동으로 설치하지 않아요 |
| 이미지 생성 도구 | 요금을 먼저 확인해요. ChatGPT 구독에 이미지 API 권한은 들어 있지 않아요 |

SKILL이 준비하는 것:
- 1536 × 1024 배경 그림
- 걷는 바닥, 물, 낚시 자리, 창문 사각형
- 선택해서 넣는 계절 그림

그다음:
1. 전체 창과 작은 창 크기로 장면을 검토해요.
2. 완성된 JSON을 **배경과 분위기**의 **배경 가져오기**로 가져와요.

[배경 패키지 규격, 영어](/dev/how-to/add-a-world#portable-backgrounds)

</details>
