<!-- A sample pet drawn from its real sprite sheet (the file the app uses), playing one row.
     Rows and frame counts follow src/core/animation.js. `scale` sizes the 192×208 cell. -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { MOTION_ROWS, previewSource } from '../../../scripts/site-preview-lib.mjs';
import { animationSpec } from '../../../src/core/animation.js';
import generated from '../generated.json';

// `frame` holds one column still, as the gaze rows are eight directions rather than an animation.
const props = withDefaults(
  defineProps<{ state?: string; season?: string; scale?: number; pet?: string; frame?: number }>(),
  {
    state: 'idle',
    season: 'base',
    scale: 0.6,
    pet: 'tabby',
  },
);
const row = computed(() =>
  props.state in MOTION_ROWS && props.state.startsWith('look-')
    ? { row: MOTION_ROWS[props.state as keyof typeof MOTION_ROWS], frames: 8, seconds: 1 }
    : animationSpec(props.state),
);
const preview = computed(() =>
  previewSource(
    props.pet,
    props.state,
    (generated as { petPreviews?: Record<string, string[]> }).petPreviews,
    props.season,
    (generated as { petSeasonalPreviews?: Record<string, Record<string, string[]>> }).petSeasonalPreviews,
    (generated as { petMotions?: Record<string, Record<string, string[]>> }).petMotions,
  ),
);
const strip = computed(() => /^\/pets\/(previews|motion)\//.test(preview.value || ''));
const style = computed(() => ({
  '--sheet': `url(${withBase(preview.value || `/pets/${props.pet}.png`)})`,
  '--row': strip.value ? '0' : String(row.value.row),
  '--sheet-size': strip.value ? '1536px 208px' : '1536px 2288px',
  '--frames': String(row.value.frames),
  '--loop': `${row.value.seconds}s`,
  '--scale': String(props.scale),
  ...(props.frame === undefined ? {} : { '--frame': String(props.frame) }),
}));
</script>

<template>
  <span class="sprite" :class="{ 'sprite-still': frame !== undefined }" :style="style" :data-state="state" role="img" aria-hidden="true"><i /></span>
</template>
