<script setup>
import { withBase } from 'vitepress';
import { computed, onMounted, ref, watch } from 'vue';
import { kitEntries, kitFromQuery, kitPrompts, kitSpec } from '../../../scripts/creator-specs.mjs';
import VisibleSprite from './VisibleSprite.vue';

const props = defineProps({ lang: { type: String, default: 'en' } });
const words = {
  ja: {
    taskHints: [
      'デザインキットをダウンロードし、identity-reference.pngと用意された各方向図を画像ツールに添付してから貼り付けます。新たに推定された背面などの特徴を確認してください。',
      'キットのidentity-reference.pngとexpression-reference.pngを添付します。face-detail.pngがあれば追加し、生成後に元の顔と比較してください。',
      'まず「動きや視線の1行」で8ポーズの元画像を作成して確認します。承認した元画像とキャラクター参考画像を添付して服を変更します。この元画像はZIPに含まれません。',
      '[STATE]と[EIGHT POSES]を記入してから貼り付けます。キットのキャラクター・動作資料と、用意された顔の詳細図・各方向図を添付し、画像ツールで元画像を作成して確認します。',
      '承認した11行の元画像をすべて準備し、下のパッキング手順を使います。画像生成ではなく組み立てと検証の工程です。この11行の元画像はZIPに含まれません。',
    ],
    task: '作りたいものを選ぶ',
    notReady:
      'このペットの全身各方向図と顔の詳細図はまだありません。下の元の動作資料を参考に、プロンプトで新しい詳細図を作れます。',
    download: '3. 友だちを迎える',
    references: '参考資料を見る',
    basicDesign:
      '元の画像、動作の参考資料、キャラクター仕様と5つのプロンプトを含みます。全身各方向図と顔の詳細図は含みません。',
    basicPet:
      '解凍したフォルダーをPlayPetsに取り込むと新しい友だちが増えます。このペットは全季節で基本の姿を使います。',
    promptLanguage: '画像ツールで使いやすい英語のプロンプトです。結果を確認してから取り込んでください。',
    preview: '選んだ友だち',
    promptText: 'プロンプト本文',

    character: '1. ペットを選ぶ',
    style: '2. 見た目を選ぶ',
    illustrated: 'Mini',
    animalStyle: 'キャラクター',
    realistic: 'リアル',
    design: '完全なデザインキットをダウンロード',
    pet: '取り込み用ペットをダウンロード',
    designHelp:
      'デザインZIPには全身の各方向図、顔の詳細、キャラクター仕様、専用プロンプト5つ、参考画像と標準の画像が入っています。',
    petHelp:
      'ZIPを展開し、PlayPetsでフォルダーを取り込んでください。pet.jsonと基本・夏・冬の画像を含みます。付属の友だちとは別の制作キットのコピーとして追加します。',
    turnaround: '全身の各方向図',
    face: '目・鼻・口の詳細',
    refs: 'デザインの参考用です。詳細画像は実行時の小さなアニメーションセルを置き換えません。',
    prompts: '2. 次の作業のプロンプトをコピー',
    copy: 'プロンプトをコピー',
    copied: 'コピーしました',
    failed: 'コピー機能を使えません。下の文章を選択してコピーしてください。',
    titles: ['キャラクターと4方向', '顔の詳細', '季節の服装', '動きや視線の1行', '標準形式への書き出し'],
    supplemental: '実行時の参考画像',
    wardrobe: '服装の比較',
    motion: 'すべてのアニメーションセル',
    identity: 'キャラクターJSON',
    metadata: 'パッケージ一覧',
    baseline: '基本ペットだけをダウンロード',
    baselineHelp: '最小構成のpet.jsonとspritesheet.pngです。季節の服装は任意のPlayPets拡張です。',
  },
  en: {
    taskHints: [
      'Download the design kit. Attach its identity-reference.png and any existing turnaround to your image tool, then paste this prompt. Check newly inferred hidden details before accepting them.',
      'Attach the kit’s identity-reference.png and expression-reference.png, plus face-detail.png when available. Compare the face with the original after generation.',
      'First use “One motion or gaze row” to create and approve an eight-pose source image. Attach that image and your approved character references before changing clothing. This source image is not included in the ZIP.',
      'Fill in [STATE] and [EIGHT POSES] before pasting. Attach the kit’s identity and motion references, plus approved face or turnaround images if available. Generate and review the source image in your image tool.',
      'Prepare all eleven approved source rows, then use the packing instructions below. This is an assembly and validation step, not an image-generation prompt; the ZIP does not include those eleven source rows.',
    ],
    task: 'Choose what to make',
    notReady:
      'Detailed turnaround and face sheets have not been made for this pet yet. Start from the original animation references below; the prompts help you create new design references.',
    download: '3. Take your friend with you',
    references: 'Reference library',
    basicDesign:
      'Includes the original sheets, animation references, identity notes and five prompts. Detailed turnaround and face sheets are not included.',
    basicPet:
      'Unzip, then import the folder into PlayPets as a new friend. This pet uses its original appearance in every season.',
    promptLanguage: 'Prompts are in English for reuse with image tools. Review the result before importing it.',
    preview: 'Selected pet',
    promptText: 'Prompt text',

    character: '1. Choose a pet',
    style: '2. Choose an appearance',
    illustrated: 'Mini',
    animalStyle: 'Character',
    realistic: 'Realistic',
    design: 'Download complete design kit',
    pet: 'Download importable pet',
    designHelp:
      'Design ZIP: full turnaround, detailed face, identity specification, five character-specific prompts, reference collages and canonical artwork.',
    petHelp:
      'Pet ZIP: unzip it, then import the extracted folder in PlayPets. Includes pet.json and baseline, summer and winter sheets. This is a separate creator-kit copy, not a change to your built-in friend.',
    turnaround: 'Full-body turnaround',
    face: 'Eyes, nose and mouth details',
    refs: 'Design references only: these detailed images do not replace the small runtime animation cells.',
    prompts: '2. Copy the prompt for your next step',
    copy: 'Copy prompt',
    copied: 'Copied',
    failed: 'Copy was unavailable. Select and copy the text below.',
    titles: [
      'Identity and four views',
      'Face details',
      'Seasonal wardrobe',
      'One motion or gaze row',
      'Canonical export',
    ],
    supplemental: 'Additional runtime references',
    wardrobe: 'Wardrobe comparison',
    motion: 'All animation cells',
    identity: 'Identity JSON',
    metadata: 'Bundle manifest',
    baseline: 'Download baseline only',
    baselineHelp: 'Minimal pet.json and spritesheet.png; seasonal wardrobes are optional PlayPets additions.',
  },
  ko: {
    taskHints: [
      '디자인 키트를 받고 identity-reference.png와 준비된 턴어라운드를 이미지 도구에 첨부한 뒤 프롬프트를 붙여 넣으세요. 새로 추정한 뒷모습 등의 특징은 직접 확인해요.',
      '키트의 identity-reference.png와 expression-reference.png를 첨부해요. face-detail.png가 있으면 함께 넣고, 생성 후 원본 얼굴과 비교해요.',
      '먼저 “동작 또는 시선 한 행”으로 여덟 포즈 원본을 만들고 확인해요. 승인한 원본과 캐릭터 참고 이미지를 첨부한 뒤 옷을 바꿔요. 이 여덟 포즈 원본은 ZIP에 들어 있지 않아요.',
      '[STATE]와 [EIGHT POSES]를 채운 뒤 붙여 넣으세요. 키트의 캐릭터·동작 참고 자료와 준비된 얼굴 상세도·턴어라운드를 첨부해요. 이미지 도구에서 원본을 만들고 직접 확인해요.',
      '승인한 원본 행 11개를 모두 준비한 뒤 아래 패킹 안내를 따라요. 이미지 생성이 아니라 조립·검증 단계예요. ZIP에는 이 원본 행 11개가 들어 있지 않아요.',
    ],
    task: '만들고 싶은 것을 골라요',
    notReady:
      '이 친구의 전신 턴어라운드와 얼굴 상세도는 아직 없어요. 아래 원본 동작 자료를 참고해요. 프롬프트로 새 상세 시트를 만들 수 있어요.',
    download: '3. 내 친구로 데려가요',
    references: '참고 자료 펼쳐보기',
    basicDesign:
      '원본 시트, 동작 참고 자료, 캐릭터 명세와 프롬프트 5개가 들어 있어요. 전신 턴어라운드와 얼굴 상세도는 포함되지 않아요.',
    basicPet: '압축을 푼 뒤 PlayPets에서 폴더를 가져오면 새 친구가 생겨요. 이 친구는 모든 계절에 기본 모습을 사용해요.',
    promptLanguage: '다양한 이미지 도구에서 쓰기 좋게 프롬프트는 영어로 제공해요. 결과를 확인한 뒤 가져오세요.',
    preview: '고른 친구',
    promptText: '프롬프트 내용',

    character: '1. 펫을 골라요',
    style: '2. 모습을 골라요',
    illustrated: '미니',
    animalStyle: '캐릭터형',
    realistic: '실사형',
    design: '전체 디자인 키트 받기',
    pet: '가져오기용 펫 받기',
    designHelp:
      '디자인 ZIP에는 전신 턴어라운드, 얼굴 상세도, 캐릭터 명세, 캐릭터별 프롬프트 5개, 참고 콜라주와 표준 그림이 들어 있어요.',
    petHelp:
      '펫 ZIP의 압축을 푼 뒤 PlayPets에서 폴더를 가져오세요. pet.json과 기본·여름·겨울 시트가 들어 있어요. 기본 친구를 바꾸는 것이 아니라 별도의 제작 키트 복사본을 추가해요.',
    turnaround: '전신 턴어라운드',
    face: '눈·코·입 상세도',
    refs: '디자인용 참고 이미지예요. 이 상세도가 작은 실행용 애니메이션 셀을 대체하지는 않아요.',
    prompts: '2. 다음 작업에 맞는 프롬프트를 복사해요',
    copy: '프롬프트 복사',
    copied: '복사했어요',
    failed: '복사 기능을 사용할 수 없어요. 아래 글을 선택해서 복사해 주세요.',
    titles: ['캐릭터와 네 방향', '얼굴 상세도', '계절 의상', '동작 또는 시선 한 행', '표준 규격 내보내기'],
    supplemental: '실행용 그림 참고 자료',
    wardrobe: '계절 의상 비교',
    motion: '전체 애니메이션 셀',
    identity: '캐릭터 JSON',
    metadata: '번들 명세',
    baseline: '기본 펫만 받기',
    baselineHelp: '최소 구성인 pet.json과 spritesheet.png예요. 계절 의상은 PlayPets의 선택 확장이에요.',
  },
  'zh-hans': {
    taskHints: [
      '下载设计套件，把identity-reference.png和已有的转面图附加到图像工具，再粘贴提示词。请检查新推测的背面等细节。',
      '附加套件中的identity-reference.png和expression-reference.png。如有face-detail.png，也一并附加。生成后请与原始面部对比。',
      '先用“一行动作或视线”生成并确认八姿势源图，再附加这张源图和已认可的角色参考图来修改服装。ZIP不包含这张八姿势源图。',
      '填写[STATE]和[EIGHT POSES]后再粘贴。附加套件的角色与动作参考，以及已有的面部细节图和转面图，在图像工具中生成并检查源图。',
      '准备好已认可的全部11行源图，再按照下方打包说明操作。这是组装和验证步骤，不是图像生成提示词。ZIP不包含这11行源图。',
    ],
    task: '选择想制作的内容',
    notReady: '这位伙伴还没有全身转面图和面部细节图。请参考下面的原始动作资料，用提示词制作新的设计参考图。',
    download: '3. 带走你的伙伴',
    references: '查看参考资料',
    basicDesign: '包含原始图集、动作参考、角色规格和五份提示词。不含全身转面图和面部细节图。',
    basicPet: '解压后在PlayPets中导入文件夹，即可添加新伙伴。这位伙伴在所有季节使用基本外观。',
    promptLanguage: '提示词以英语提供，方便用于图像工具。导入前请检查生成结果。',
    preview: '已选伙伴',
    promptText: '提示词正文',

    character: '1. 选择宠物',
    style: '2. 选择外观',
    illustrated: '迷你',
    animalStyle: '角色风格',
    realistic: '写实风格',
    design: '下载完整设计套件',
    pet: '下载可导入宠物',
    designHelp: '设计 ZIP 包含全身转面图、面部细节、角色规格、五份角色专用提示词、参考拼图与标准图集。',
    petHelp:
      '解压宠物 ZIP 后，在 PlayPets 中导入解压后的文件夹。包含 pet.json 与基础、夏季、冬季图集。这是独立的创作套件副本，不会修改内置伙伴。',
    turnaround: '全身转面图',
    face: '眼睛、鼻子与嘴部细节',
    refs: '仅用于设计参考：这些细节图不会替代小尺寸运行时动画单元。',
    prompts: '2. 复制下一步的提示词',
    copy: '复制提示词',
    copied: '已复制',
    failed: '无法使用复制功能，请选择并复制下方文字。',
    titles: ['角色与四个视角', '面部细节', '季节服装', '一行动作或视线', '标准格式导出'],
    supplemental: '其他运行时参考',
    wardrobe: '季节服装对比',
    motion: '全部动画单元',
    identity: '角色 JSON',
    metadata: '套件清单',
    baseline: '仅下载基础宠物',
    baselineHelp: '最简 pet.json 与 spritesheet.png；季节服装是 PlayPets 的可选扩展。',
  },
};
const t = computed(() => words[props.lang] || words.en);
const promptIndex = ref(0);
const id = ref('aria'),
  notice = ref('');
watch(id, () => {
  notice.value = '';
});
onMounted(() => {
  id.value = kitFromQuery(location.search);
  watch(id, value => {
    const url = new URL(location.href);
    url.searchParams.set('kit', value);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  });
});
const spec = computed(() => kitSpec(id.value));
const entry = computed(() => kitEntries.find(pet => pet.id === id.value));
const prompts = computed(() => Object.entries(kitPrompts(spec.value)));
watch(promptIndex, () => {
  notice.value = '';
});
const selectedPrompt = computed(() => prompts.value[promptIndex.value]?.[1] || '');
const file = name => withBase(`/creator-kit/${id.value}/${name}`);
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notice.value = t.value.copied;
  } catch {
    notice.value = t.value.failed;
  }
}
</script>

<template>
  <section class="creator-kit" :aria-label="t.character">
    <fieldset class="kit-entries"><legend>{{ t.character }}</legend>
      <label v-for="entry in kitEntries" :key="entry.id" :class="{ selected: id === entry.id }">
        <input v-model="id" type="radio" name="creator-entry" :value="entry.id">
        <VisibleSprite :pet="entry.pet" state="idle" :scale="0.42" />
        <span>{{ entry.name }}</span>
      </label>
    </fieldset>
    <div class="kit-workbench">
      <div class="kit-character">
        <span class="kit-eyebrow">{{ t.preview }}</span>
        <div class="kit-portrait"><VisibleSprite :key="id" :pet="entry.pet" state="idle" :scale="0.95" /></div>
        <h3>{{ entry.name }}</h3>
        <a class="kit-primary" :href="file('design-kit.zip')" :download="`${id}-design-kit.zip`">{{ t.design }} <span aria-hidden="true">↓</span></a>
        <details class="kit-contents"><summary>{{ t.metadata }}</summary><p>{{ entry.hasDetailSheets ? t.designHelp : t.basicDesign }}</p></details>
      </div>
      <div class="kit-prompt">
        <h3>{{ t.prompts }}</h3>
        <label class="kit-task" for="creator-task">{{ t.task }}</label>
        <select id="creator-task" v-model="promptIndex"><option v-for="(title, index) in t.titles" :key="index" :value="index">{{ title }}</option></select>
        <div class="kit-copy-row"><button type="button" @click="copy(selectedPrompt)">{{ t.copy }} <span aria-hidden="true">↗</span></button><span class="kit-notice" role="status" aria-live="polite">{{ notice }}</span></div>
        <p class="kit-attach">{{ t.taskHints[promptIndex] }}</p>
        <pre tabindex="0" :aria-label="t.promptText"><code>{{ selectedPrompt }}</code></pre>
        <p class="kit-hint">{{ t.promptLanguage }}</p>
      </div>
    </div>
    <details class="kit-library">
      <summary>{{ t.references }}</summary>
      <template v-if="entry.hasDetailSheets">
        <figure><a :href="file('turnaround.png')" target="_blank" rel="noopener"><img :src="file('turnaround.png')" :alt="`${entry.name}: ${t.turnaround}`" loading="lazy"></a><figcaption>{{ t.turnaround }}</figcaption></figure>
        <figure><a :href="file('face-detail.png')" target="_blank" rel="noopener"><img :src="file('face-detail.png')" :alt="`${entry.name}: ${t.face}`" loading="lazy"></a><figcaption>{{ t.face }}</figcaption></figure>
        <p>{{ t.refs }}</p>
      </template>
      <p v-else>{{ t.notReady }}</p>
      <figure><a :href="file('identity-reference.png')" target="_blank" rel="noopener"><img :src="file('identity-reference.png')" :alt="`${entry.name}: ${t.supplemental}`" loading="lazy"></a><figcaption>{{ t.supplemental }}</figcaption></figure>
      <figure v-if="entry.seasons.length"><img :src="file('wardrobe-reference.png')" :alt="t.wardrobe" width="624" height="288" loading="lazy"><figcaption>{{ t.wardrobe }}</figcaption></figure>
      <p><a :href="file('motion-reference.png')" download>{{ t.motion }}</a> · <a :href="file('identity.json')" download>{{ t.identity }}</a> · <a :href="file('kit.json')" download>{{ t.metadata }}</a></p>
    </details>
    <div class="kit-takeaway">
      <div><h3>{{ t.download }}</h3><p>{{ entry.seasons.length ? t.petHelp : t.basicPet }}</p></div>
      <div class="kit-package-actions"><a class="kit-primary" :href="file('importable-pet.zip')" :download="`${id}-importable-pet.zip`">{{ t.pet }} <span aria-hidden="true">↓</span></a><a :href="file('baseline-pet.zip')" :download="`${id}-baseline-pet.zip`">{{ t.baseline }}</a><p>{{ t.baselineHelp }}</p></div>
    </div>
  </section>
</template>

<style scoped>
:global(.Layout.creator-studio-page .VPDoc:not(.has-sidebar) > .container) { max-width: 1120px; }
:global(.Layout.creator-studio-page .VPDoc:not(.has-sidebar) > .container > .content) { max-width: 100%; width: 100%; }
:global(.creator-studio-page .VPDoc .content-container) { max-width: 100%; }
.creator-kit { --kit-button-bg: #315d4b; --kit-button-hover: #284d3f; --kit-button-text: #fff; min-width: 0; margin: 32px 0 48px; }
:global(.dark .creator-kit) { --kit-button-bg: #b8d2a5; --kit-button-hover: #cde4be; --kit-button-text: #25352f; }
.creator-kit :deep(.sprite i) { animation: none; }
.kit-entries { border: 0; padding: 0; margin: 0 0 28px; min-width: 0; display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 8px; }
.kit-entries legend { margin-bottom: 16px; font-size: 17px; font-weight: 650; }
.kit-entries label { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px 10px; border: 1px solid transparent; border-radius: 18px; cursor: pointer; font-size: 12px; line-height: 1.4; text-align: center; }
.kit-entries label.selected { background: var(--vp-c-brand-soft); border-color: var(--vp-c-brand-1); }
.kit-entries label:hover { background: var(--vp-c-bg-soft); }
.kit-entries input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.kit-entries label:has(input:focus-visible) { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
.kit-workbench { display: grid; grid-template-columns: minmax(220px, .8fr) minmax(0, 1.4fr); border: 1px solid var(--vp-c-divider); border-radius: 28px; overflow: hidden; background: var(--vp-c-bg); }
.kit-character { display: flex; flex-direction: column; align-items: center; padding: 30px 24px; background: var(--vp-c-bg-soft); text-align: center; }
.kit-eyebrow { color: var(--vp-c-text-2); font-size: 12px; }
.kit-contents { margin-top: 14px; font-size: 13px; }
.kit-portrait { display: grid; place-items: center; width: 218px; height: 235px; max-width: 100%; border-radius: 48% 48% 36% 36%; background: radial-gradient(ellipse at 50% 65%, var(--vp-c-brand-soft), transparent 72%); }
.kit-character h3 { margin: 4px 0 24px; font-family: 'Gowun Dodum', var(--vp-font-family-base); font-size: 30px; }
.kit-character p, .kit-hint, .kit-takeaway p { color: var(--vp-c-text-2); font-size: 13px; line-height: 1.7; }
.kit-prompt { min-width: 0; padding: 28px; }
.kit-prompt h3 { margin: 0 0 20px; font-size: 20px; }
.kit-task { display: block; font-size: 13px; margin-bottom: 8px; color: var(--vp-c-text-2); }
select { width: 100%; min-height: 46px; border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: 10px 14px; color: var(--vp-c-text-1); background: var(--vp-c-bg-soft); font: inherit; }
.kit-attach { font-size: 14px; line-height: 1.7; }
.kit-copy-row { display: flex; align-items: center; gap: 16px; margin: 16px 0 12px; }
button { flex-shrink: 0; min-height: 44px; border-radius: 10px; padding: 10px 16px; background: var(--kit-button-bg); color: var(--kit-button-text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.kit-notice { color: var(--vp-c-text-2); font-size: 12px; line-height: 1.5; }
pre { margin: 0; height: 228px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft); }
pre code { background: none; font-size: 12px; line-height: 1.75; padding: 0; }
.kit-hint { margin-bottom: 0; }
.kit-primary { display: flex; justify-content: space-between; gap: 16px; align-items: center; min-height: 48px; padding: 12px 18px; border-radius: 12px; background: var(--kit-button-bg); color: var(--kit-button-text); text-decoration: none; font-size: 14px; font-weight: 600; }
.kit-primary:hover, button:hover { color: var(--kit-button-text); background: var(--kit-button-hover); }
.kit-library { margin: 20px 0; padding: 18px 22px; border: 1px solid var(--vp-c-divider); border-radius: 16px; }
summary { cursor: pointer; font-weight: 600; }
figure { margin: 24px 0; }
figure img { max-width: 100%; height: auto; border-radius: 12px; }
figcaption { margin-top: 8px; color: var(--vp-c-text-2); font-size: 13px; }
.kit-takeaway { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 26px; border-radius: 20px; background: var(--vp-c-bg-soft); }
.kit-takeaway h3 { margin: 0 0 12px; }
.kit-package-actions { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.kit-package-actions p { margin: 0; }
:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
@media (max-width: 960px) { .kit-entries { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (max-width: 640px) { .kit-workbench, .kit-takeaway { grid-template-columns: minmax(0, 1fr); } .kit-prompt { padding: 22px 18px; } .kit-character { padding: 16px 18px; display: grid; grid-template-columns: 88px minmax(0, 1fr); column-gap: 12px; text-align: left; } .kit-eyebrow { grid-column: 2; grid-row: 1; align-self: end; } .kit-portrait { grid-column: 1; grid-row: 1 / 3; width: 88px; height: 96px; } .kit-portrait :deep(.sprite) { --display-scale: .44; } .kit-character h3 { grid-column: 2; grid-row: 2; margin: 0; align-self: start; font-size: 26px; } .kit-character > .kit-primary, .kit-contents { grid-column: 1 / -1; } .kit-entries { gap: 2px; } .kit-entries :deep(.sprite) { --display-scale: .28; } .kit-entries label { font-size: 11px; } .kit-copy-row { align-items: flex-start; flex-direction: column; gap: 6px; } }
</style>
