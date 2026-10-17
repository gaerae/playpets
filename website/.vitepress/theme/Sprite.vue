<!-- A sample pet drawn from its real sprite sheet (the file the app uses), playing one row.
     Rows and frame counts follow src/core/animation.js. `scale` sizes the 192×208 cell. -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { previewSource } from '../../../scripts/site-preview-lib.mjs';
import { animationSpec } from '../../../src/core/animation.js';
import generated from '../generated.json';

const props = withDefaults(defineProps<{ state?: string; season?: string; scale?: number; pet?: string }>(), {
  state: 'idle',
  season: 'base',
  scale: 0.6,
  pet: 'tabby',
});
const row = computed(() => animationSpec(props.state));
const preview = computed(() =>
  previewSource(
    props.pet,
    props.state,
    (generated as { petPreviews?: Record<string, string[]> }).petPreviews,
    props.season,
    (generated as { petSeasonalPreviews?: Record<string, Record<string, string[]>> }).petSeasonalPreviews,
  ),
);
const strip = computed(() => preview.value?.startsWith('/pets/previews/'));
const style = computed(() => ({
  '--sheet': `url(${withBase(preview.value || `/pets/${props.pet}.png`)})`,
  '--row': strip.value ? '0' : String(row.value.row),
  '--sheet-size': strip.value ? '1536px 208px' : '1536px 2288px',
  '--frames': String(row.value.frames),
  '--loop': `${row.value.seconds}s`,
  '--scale': String(props.scale),
}));
</script>

<template>
  <span class="sprite" :style="style" :data-state="state" role="img" aria-hidden="true"><i /></span>
</template>
