<script setup>
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { studioCopy } from './studio-copy.js';

const props = defineProps({ lang: { type: String, default: 'en' }, current: { type: String, required: true } });
const t = computed(() => studioCopy[props.lang] || studioCopy.en);
const prefix = computed(() => (props.lang === 'en' ? '' : `${props.lang}/`));
</script>
<template>
  <nav class="studio-nav" :aria-label="t.studios">
    <a :href="withBase(`/${prefix}guide/creator-kit`)" :aria-current="current === 'pet' ? 'page' : undefined">{{ t.petStudio }}</a>
    <a :href="withBase(`/${prefix}guide/background-kit`)" :aria-current="current === 'background' ? 'page' : undefined">{{ t.backgroundStudio }}</a>
  </nav>
</template>
<style scoped>
.studio-nav { display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 10px; border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); margin: 24px 0 28px; }
.studio-nav a { flex: 1; min-height: 44px; display: grid; place-items: center; padding: 8px 12px; border-radius: 9px; color: var(--vp-c-text-2); font-weight: 600; text-decoration: none; font-size: 14px; }
.studio-nav a[aria-current=page] { background: var(--vp-c-bg); color: var(--vp-c-text-1); box-shadow: 0 1px 4px #0000000a; }
.studio-nav a:hover, .studio-shortcuts a:hover { color: var(--vp-c-brand-1); }
.studio-shortcuts { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 0 0 24px; }
.studio-shortcuts a { display: flex; align-items: center; min-height: 44px; font-size: 13px; color: var(--vp-c-text-2); text-decoration: underline; text-underline-offset: 4px; }
:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
</style>
