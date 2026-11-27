<script setup>
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { creationCopy } from './creation-copy.js';

const props = defineProps({ lang: { type: String, default: 'en' }, current: { type: String, required: true } });
const t = computed(() => creationCopy[props.lang] || creationCopy.en);
const prefix = computed(() => (props.lang === 'en' ? '' : `${props.lang}/`));
</script>
<template>
  <nav class="studio-nav" :aria-label="t.studios">
    <a :href="withBase(`/${prefix}guide/creator-kit`)" :aria-current="current === 'pet' ? 'page' : undefined"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m8 14-2-8 8 5h4l8-5-2 8v8c-3 6-13 6-16 0Z"/><path d="M12 18v2m8-2v2m-6 4h4"/></svg><span><strong>{{ t.petStudio }}</strong><small>{{ t.petNavHint }}</small></span><span class="studio-nav-arrow" aria-hidden="true">→</span></a>
    <a :href="withBase(`/${prefix}guide/background-kit`)" :aria-current="current === 'background' ? 'page' : undefined"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 27h24M4 22l8-10 6 6 5-7 5 11"/><circle cx="9" cy="7" r="3"/></svg><span><strong>{{ t.backgroundStudio }}</strong><small>{{ t.backgroundNavHint }}</small></span><span class="studio-nav-arrow" aria-hidden="true">→</span></a>
  </nav>
</template>
<style scoped>
/* Two signboards over the workbench: the one you are at is honey-lit, the other one points across. */
.studio-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0 8px; }
.studio-nav a { min-height: 74px; display: flex; align-items: center; gap: 14px; padding: 12px 18px; border-radius: 14px; border: 1px solid var(--pp-line, var(--vp-c-divider)); color: var(--vp-c-text-1); text-decoration: none; background: var(--vp-c-bg-elv); transition: border-color 0.15s ease, transform 0.15s ease; }
.studio-nav a[aria-current=page] { border-color: var(--pp-wood-edge, var(--vp-c-brand-1)); background: var(--pp-honey-light, var(--vp-c-brand-soft)); color: var(--pp-on-honey, var(--vp-c-brand-1)); box-shadow: inset 0 -3px 0 var(--pp-honey, transparent); }
.studio-nav a:not([aria-current=page]):hover { border-color: var(--pp-wood, var(--vp-c-brand-1)); transform: translateY(-1px); }
.studio-nav svg { width: 32px; height: 32px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.studio-nav strong { display: block; font-size: 15px; font-weight: 700; }
.studio-nav small { display: block; font-size: 12px; color: var(--vp-c-text-2); line-height: 1.5; margin-top: 2px; }
.studio-nav a[aria-current=page] small { color: inherit; opacity: 0.8; }
.studio-nav-arrow { margin-left: auto; color: var(--vp-c-brand-1); }
.studio-nav a[aria-current=page] .studio-nav-arrow { visibility: hidden; }
:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .studio-nav a { transition: none; } .studio-nav a:not([aria-current=page]):hover { transform: none; } }
@media (max-width: 640px) { .studio-nav { gap: 8px; } .studio-nav a { padding: 10px 12px; gap: 8px; min-height: 56px; } .studio-nav strong { font-size: 13px; } .studio-nav svg { display: none; } .studio-nav small, .studio-nav-arrow { display: none; } }
</style>
