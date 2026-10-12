<script setup>
import { computed, ref } from 'vue';
import { extensionPrompts } from '../../../scripts/creator-specs.mjs';

const props = defineProps({ lang: { type: String, default: 'en' } });
const copy = {
  ja: {
    title: '自分のペットを広げる',
    help: '自分が所有するか、使用許可のある参考画像を使います。画風は自由です。画像ツール向けのプロンプトは英語です。指定したファイルを添付し、結果を確認・検証してから読み込んでください。',
    name: 'ペットの名前',
    reference: '使用できる参考ファイル名',
    locks: '維持するキャラクターの特徴',
    wardrobe: '作りたい服装',
    action: '対応する動き・視線の行',
    button: 'プロンプトをコピー',
    copied: 'コピーしました',
    failed: 'コピーできません。下の文章を選択してください。',
    titles: ['キャラクターと各方向図', '顔の詳細', '服装', '動き・視線の行', '書き出しと検証'],
  },
  en: {
    title: 'Extend your own pet',
    help: 'Use an owned or permitted reference in any art direction. Prompts are in English for image tools. Attach the named files; inspect and validate results before importing.',
    name: 'Pet name',
    reference: 'Approved reference filenames',
    locks: 'Identity details to preserve',
    wardrobe: 'Requested clothing',
    action: 'Supported state or gaze row',
    button: 'Copy prompt',
    copied: 'Copied',
    failed: 'Copy unavailable. Select the text below.',
    titles: ['Identity and turnaround', 'Face details', 'Wardrobe', 'Motion or gaze row', 'Export and validation'],
  },
  ko: {
    title: '내 펫을 확장해요',
    help: '소유하거나 사용 허락을 받은 참고 이미지를 사용해요. 그림 스타일은 자유예요. 이미지 도구용 프롬프트는 영어로 제공해요. 적힌 파일을 첨부하고, 결과를 확인·검증한 뒤 가져오세요.',
    name: '펫 이름',
    reference: '승인된 참고 파일 이름',
    locks: '유지할 캐릭터 특징',
    wardrobe: '요청할 의상',
    action: '지원되는 동작 또는 시선 행',
    button: '프롬프트 복사',
    copied: '복사했어요',
    failed: '복사할 수 없어요. 아래 글을 선택해 주세요.',
    titles: ['캐릭터와 턴어라운드', '얼굴 상세도', '의상', '동작 또는 시선 행', '내보내기와 검증'],
  },
  'zh-hans': {
    title: '扩展自己的宠物',
    help: '使用自己拥有或获得许可的参考图片，画风不限。提示词以英语提供给图像工具。附上指定文件，检查并验证结果后再导入。',
    name: '宠物名称',
    reference: '已批准的参考文件名',
    locks: '需要保留的角色特征',
    wardrobe: '需要的服装',
    action: '支持的动作或视线行',
    button: '复制提示词',
    copied: '已复制',
    failed: '无法复制，请选择下方文字。',
    titles: ['角色与转面图', '面部细节', '服装', '动作或视线行', '导出与验证'],
  },
};
const t = computed(() => copy[props.lang] || copy.en);
const inputs = ref({ name: '', reference: '', locks: '', wardrobe: '', action: '' });
const notice = ref('');
const prompts = computed(() =>
  Object.entries(
    extensionPrompts(Object.fromEntries(Object.entries(inputs.value).filter(([, value]) => value.trim()))),
  ),
);
async function copyPrompt(text) {
  try {
    await navigator.clipboard.writeText(text);
    notice.value = t.value.copied;
  } catch {
    notice.value = t.value.failed;
  }
}
</script>
<template>
  <section class="extension-prompts">
    <h2>{{ t.title }}</h2><p>{{ t.help }}</p>
    <div class="extension-fields"><label v-for="field in Object.keys(inputs)" :key="field">{{ t[field] }}<textarea v-model="inputs[field]" rows="2" /></label></div>
    <p role="status">{{ notice }}</p>
    <details v-for="([key, prompt], index) in prompts" :key="key"><summary>{{ t.titles[index] }}</summary><button type="button" @click="copyPrompt(prompt)">{{ t.button }}</button><pre><code>{{ prompt }}</code></pre></details>
  </section>
</template>
<style scoped>
.extension-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
label { display: flex; flex-direction: column; gap: 8px; }
textarea, button { font: inherit; color: var(--vp-c-text-1); background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 10px; }
textarea { width: 100%; resize: vertical; min-height: 64px; }
button { cursor: pointer; min-height: 44px; margin-top: 12px; }
details { border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: 14px; margin: 14px 0; }
summary { cursor: pointer; font-weight: 600; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 420px; overflow: auto; font-size: 13px; line-height: 1.65; }
:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
@media (max-width: 600px) { .extension-fields { grid-template-columns: minmax(0, 1fr); } }
</style>
