<script setup>
import { computed, ref } from 'vue';
import { studioCopy } from './studio-copy.js';

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  lang: { type: String, default: 'en' },
  accept: { type: String, required: true },
  disabled: Boolean,
  invalid: Boolean,
  describedby: { type: String, default: undefined },
});
const emit = defineEmits(['change']);
const input = ref(null);
const t = computed(() => studioCopy[props.lang] || studioCopy.en);
</script>
<template>
  <div class="studio-file-control">
    <label :for="id">{{ label }}</label>
    <button type="button" :disabled="disabled" :aria-label="`${t.chooseFile}: ${label}`" :aria-describedby="describedby" @click="input?.click()">{{ t.chooseFile }} <span aria-hidden="true">↑</span></button>
    <input :id="id" ref="input" type="file" :accept="accept" :disabled="disabled" :aria-invalid="invalid" :aria-describedby="describedby" hidden @change="emit('change', $event)">
  </div>
</template>
<style scoped>
.studio-file-control { display: grid; gap: 8px; }
.studio-file-control label { font-size: 14px; font-weight: 600; }
.studio-file-control button { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 44px; padding: 10px 14px; border: 1px dashed var(--vp-c-divider); border-radius: var(--studio-radius, 10px); color: var(--vp-c-brand-1); background: var(--vp-c-bg-soft); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.studio-file-control button:hover { border-color: var(--vp-c-brand-1); }
.studio-file-control button:disabled { opacity: .5; cursor: default; }
.studio-file-control button:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
</style>
