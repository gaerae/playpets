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
    <a :href="withBase(`/${prefix}guide/creator-kit`)" :aria-current="current === 'pet' ? 'page' : undefined"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m8 14-2-8 8 5h4l8-5-2 8v8c-3 6-13 6-16 0Z"/><path d="M12 18v2m8-2v2m-6 4h4"/></svg><span><strong>{{ t.petStudio }}</strong><small>{{ t.petNavHint }}</small></span><span class="studio-nav-arrow" aria-hidden="true">↗</span></a>
    <a :href="withBase(`/${prefix}guide/background-kit`)" :aria-current="current === 'background' ? 'page' : undefined"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 27h24M4 22l8-10 6 6 5-7 5 11"/><circle cx="9" cy="7" r="3"/></svg><span><strong>{{ t.backgroundStudio }}</strong><small>{{ t.backgroundNavHint }}</small></span><span class="studio-nav-arrow" aria-hidden="true">↗</span></a>
  </nav>
</template>
<style scoped>
.studio-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0 28px; }
.studio-nav a { min-height: 78px; display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 12px; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); text-decoration: none; background: var(--vp-c-bg); }
.studio-nav a[aria-current=page] { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.studio-nav a:hover { border-color: var(--vp-c-brand-1); }
.studio-nav svg { width: 32px; height: 32px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.studio-nav strong { display: block; font-size: 15px; font-weight: 600; }
.studio-nav small { display: block; font-size: 12px; color: var(--vp-c-text-2); line-height: 1.5; margin-top: 2px; }
.studio-nav-arrow { margin-left: auto; }
:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
@media (max-width: 640px) { .studio-nav { gap: 8px; } .studio-nav a { padding: 12px; gap: 8px; min-height: 64px; } .studio-nav strong { font-size: 13px; } .studio-nav svg { width: 24px; height: 24px; } .studio-nav small, .studio-nav-arrow { display: none; } }
</style>
