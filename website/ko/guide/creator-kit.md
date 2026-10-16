---
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
description: "캐릭터 제작실: 상세 시트와 바로 쓰는 펫"
---

<script setup>
import StudioNav from "../../.vitepress/theme/StudioNav.vue";
import ExtensionPrompts from "../../.vitepress/theme/ExtensionPrompts.vue";
import PetPackager from "../../.vitepress/theme/PetPackager.vue";
import CreatorKit from "../../.vitepress/theme/CreatorKit.vue";
</script>

# 캐릭터 제작실

세 친구 중에서 골라요. 친구의 특징은 지키면서 옷과 동작을 바꿔 보세요. 이미지 도구에서 바로 쓸 프롬프트를 준비했어요.

<StudioNav lang="ko" current="pet" />

<CreatorKit lang="ko" />


<ExtensionPrompts lang="ko" />

## 브라우저에서 검사하고 내보내요

아래 도구에는 **완성된 v2 시트**를 넣어요. PNG 파일을 검사하고 이미지를 읽은 뒤, 실제 사용하는 동작·시선 셀 73개와 동작 재생을 확인해요. 계절별 시트를 더하고 실제 넣은 파일만 담은 ZIP으로 받을 수 있어요. 압축을 푼 폴더를 PlayPets에서 가져와 주세요. 원본 배치 11개를 조립하는 도구는 아니므로 원본 배치는 아래 패킹 도구를 사용해요.

<PetPackager lang="ko" />

세 친구의 디자인 키트에는 원본 그림, 캐릭터 명세, 프롬프트 5개, 동작 참고 자료, 전신 턴어라운드와 얼굴 상세도가 들어 있어요. Daisy, Clover, Pip 모두 여름·겨울 시트도 제공해요. 가져오기는 기존 친구나 기록을 바꾸지 않고 새 친구를 추가해요.

기본 ZIP에는 `pet.json`과 `spritesheet.png`만 들어 있어요.

## 지원하는 실행 형식

**v2: 1536×2288 · 8×11 · 192×208 · 88 cells · RGBA / alpha 0.**

| Row | Source filename | Used frames / directions |
|---|---|---|
| 0 | `00-idle.png` | 6 |
| 1 | `01-right.png` | 8 |
| 2 | `02-left.png` | 8 |
| 3 | `03-wave.png` | 4 |
| 4 | `04-jump.png` | 5 |
| 5 | `05-error.png` | 8 |
| 6 | `06-waiting.png` | 6 |
| 7 | `07-working.png` | 6 |
| 8 | `08-done.png` | 6 |
| 9 | `09-look.png` | N, NNE, NE, ENE, E, ESE, SE, SSE |
| 10 | `10-look.png` | S, SSW, SW, WSW, W, WNW, NW, NNW |

## 패킹하고 가져오기

저장소를 복제하고 `npm ci`로 의존성을 설치하세요. 기존 브라우저 기반 패커에는 Google Chrome이 필요해요. 승인한 1536×1024 원본 배치 11개를 `my-character-rows/`에 아래 파일명으로 저장하세요.

```plaintext
00-idle.png
01-right.png
02-left.png
03-wave.png
04-jump.png
05-error.png
06-waiting.png
07-working.png
08-done.png
09-look.png
10-look.png
```

```sh
node scripts/pack-companion-batches.mjs my-character-rows my-character/spritesheet.png 163
```

마지막 인수는 최종 셀에서 첫 대기 포즈의 실루엣 높이예요. 일러스트의 시작 기준으로 `163`을 사용하고, 기존 캐릭터는 측정된 크기를 유지해요(Clover는 168). 이는 그림의 크기 기준이며 파일 규격을 바꾸지 않아요. 패커는 같은 배율을 적용하고 점프 높이를 보존하며, 잘리는 행을 임의로 줄이지 않고 오류로 알려줘요.

완성된 PNG와 아래 manifest를 한 폴더에 넣고 [컴퓨터 폴더에서 가져오기](./import.md)를 사용하세요. 자신의 가상 캐릭터에 맞게 이름과 설명을 바꾸세요. 선택적 계절 의상·스타일 필드는 PlayPets 확장 규격이라 다른 펫 앱에서는 무시할 수 있어요.

```json
{
  "id": "my-fictional-adult",
  "displayName": "My character",
  "kind": "person",
  "description": "A fictional adult companion, age 26.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.png"
}
```

## 최종 품질 확인

88개 셀을 모두 보고, 실제 사용하는 프레임을 일반·미니 크기와 DPR1/2에서 재생해 보세요. 투명도, 손발과 액세서리의 잘림, 머리 크기, 좌우 방향, 시선 순서, 동작의 의미, 반복 연결을 확인하세요. 문제가 있으면 해당 원본 행을 다시 생성하세요. 추가 표정과 턴어라운드는 별도 참고 자료로 보관해요. 현재 검증기는 임의의 행·열 추가나 셀 크기 변경을 지원하지 않아요.

## 선택 사항인 PlayPets 계절 의상

계절 시트는 PlayPets 선택 확장이며 다른 앱에서는 무시될 수 있어요. 기본 펫 내보내기는 별도로 유지해요. 다른 모습은 필수가 아니고, 실사 그림도 일반 펫의 기본 그림이 될 수 있어요. 기존 `realisticSpritesheets` 필드는 호환용 확장이지 두 가지 스타일을 강제하는 형식이 아니에요. 제공하는 파일만 적어요. 없는 계절은 기본 시트를 사용해요.

PlayPets 확장 패키지는 채팅 얼굴용 PNG를 제공하고 `portraitPath`에 적을 수 있어요. 선택 사항인 초상화는 애니메이션 시트를 바꾸지 않아요. 기본 ZIP에는 초상화와 의상 확장이 없어요.

```json
{
  "id": "my-pet",
  "displayName": "My pet",
  "description": "An independently designed companion.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.png",
  "seasonalSpritesheets": {
    "summer": "summer.png",
    "winter": "winter.png"
  }
}
```

[배경 제작실](./background-kit)
