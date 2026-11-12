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

## 앱에서 작업 동작이 쓰이는 곳

코딩 에이전트와 연결한 친구는 에이전트의 상태를 행동으로 보여 줘요. 동작 시트에 있는 줄을 그대로 써요.

| 동작 줄 | 에이전트 상태 | 야외 장소와 내 배경 | 정원 공방 |
|---|---|---|---|
| `working` | 일하는 중 | 그 자리에 멈춰서 일해요 | 탁자에 앉아요 |
| `waiting` | 승인을 기다리는 중 | 앞쪽 가운데로 나와요 | 앞쪽 종 기둥 옆에 서요 |
| `done` | 작업을 마침 | 한 번 보여 주고 다시 산책해요 | 차 마시는 구석에서 쉬어요 |
| `error` | 오류로 막힘 | 그 자리에 멈춰요 | 자기 탁자에 머물러요 |

- 탁자에 앉으면 상반신만 보여요. `working`은 허리 위만으로도 알아보게 그려요.
- 작은 크기에서도 네 동작이 서로 구별되게 해요.

<details>
<summary>실행 환경과 파일 규격 안내</summary>

이 웹사이트는 브라우저 안에서 KIT만 만들어요. 이미지를 생성하거나 파일을 올리지 않고, 나머지는 내 AI 도구에서 해요.

| 필요한 것 | 참고 |
|---|---|
| 파일을 다루는 AI 에이전트 | 이미지만 만드는 도구로는 검사, 포장 스크립트를 돌릴 수 없어요 |
| Python 3와 Pillow | 자동으로 설치하지 않아요 |
| 이미지 생성 도구 | 요금을 먼저 확인해요. ChatGPT 구독에 이미지 API 권한은 들어 있지 않아요 |

만드는 순서:
1. SKILL 안내를 따라 4 × 2 원본 배치 11개를 승인해요.
2. 함께 든 Python 스크립트가 1536 × 2288 RGBA v2 투명 동작 시트로 조립해요.
3. 동작 9종과 시선 16방향을 확인해요.
4. 완성된 ZIP을 가져와요.

| 의상 | 입는 계절 |
|---|---|
| 기본 | 봄, 가을 |
| 여름옷 | 여름 |
| 겨울옷 | 겨울 |

- 벌마다 동작 9종과 시선 16방향이 모두 들어가요.
- 봄이나 가을 전용 의상은 요청할 때만 만들어요.
- 기본 친구를 다듬을 때도 같은 SKILL을 쓰고, 외형과 승인된 동작은 그대로 지켜요.

[펫 가져오기](./import.md), [펫 파일 규격, 영어](/dev/standards/pet-files)

</details>
