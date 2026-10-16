---
sidebar: false
outline: false
aside: false
pageClass: creator-studio-page
---

<script setup>
import StudioNav from "../../.vitepress/theme/StudioNav.vue";
import BackgroundKit from "../../.vitepress/theme/BackgroundKit.vue";
</script>

# 배경 제작실

배치 시트와 프롬프트로 공간을 만들고, PlayPets에 배경 패키지를 가져와요.

<StudioNav lang="ko" current="background" />

<BackgroundKit lang="ko" />


## 앱이 더해 주는 요소

앱은 그림 위에 친구와 조작 화면을 올려요. 친구가 걸을 바닥을 비워 두고,
물 영역과 낚시할 때 서는 자리를 배경마다 따로 지정해 주세요.
비와 눈은 야외나 지정한 창문 영역에 표시돼요. 하늘을 투명하게 만들면
앱의 해와 구름, 시간에 따른 하늘색이 보여요.

계절마다 풍경을 바꾸려면 사계절 이미지를 추가해 주세요.
빠진 계절은 기본 이미지를 사용하고, 눈이 오면 겨울 이미지가 있을 때 그 이미지를 사용해요.
이 패키지 형식은 앱의 시간대 색조를 사용하며, 아침이나 밤 이미지를 따로 받지는 않아요.
꽃, 물고기, 곤충과 놀이 소품은 가져온 그림과 별개로 PlayPets의 공통 요소를 사용해요.

## 파일을 보관하고 두 크기로 확인해요

JSON 패키지를 내려받은 뒤 앱의 **배경과 분위기**에서 **배경 가져오기**를 선택해 주세요.
배경은 기기의 이 앱 프로필에 저장되므로, 내려받은 파일도 백업으로 보관해 주세요.
이 페이지는 이미지를 서버로 올리지 않아요.

전체 창과 미니 모드에서 모두 확인해 주세요. 친구가 가구와 겹치지 않는지,
낚싯줄이 보이는 물에 닿는지, 날씨가 창틀 밖으로 새어 나오지 않는지 살펴봐요.
배치 시트는 비워 둘 바닥을 지정해 주며, 생성된 그림 속 장애물을 자동으로 인식하지는 않아요.
