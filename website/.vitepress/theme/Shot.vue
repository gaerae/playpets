<!-- A screenshot of the app: website/public/shots/<version>/<language>/<name>.webp, taken by npm run shots. -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed, ref } from 'vue';
import generated from '../generated.json';
import { useWords } from './words';

const props = defineProps<{ name: string; version?: string; caption?: string }>();
const { lang, words } = useWords();
const missing = ref(false);
// The frame each capture is taken in (window plus margin), so the page reserves the space
// before the picture arrives and nothing jumps.
const RATIO: Record<string, string> = { mini: '516 / 376', 'mini-chat': '516 / 376', desktop: '820 / 480' };
const ratio = computed(() => RATIO[props.name] ?? '1236 / 836');
const captureVersion = computed(() => props.version ?? generated.captureVersion);
const src = computed(() => withBase(`/shots/${captureVersion.value}/${lang.value}/${props.name}.webp`));
</script>

<template>
  <figure class="shot" :class="{ missing }">
    <img
      v-if="!missing"
      :src="src"
      :alt="caption || name"
      :style="{ aspectRatio: ratio }"
      loading="lazy"
      decoding="async"
      @error="missing = true"
    />
    <div v-else class="shot-placeholder">{{ words.missingShot }}</div>
    <figcaption>{{ caption }}<span v-if="caption">, </span>v{{ captureVersion }}</figcaption>
  </figure>
</template>
