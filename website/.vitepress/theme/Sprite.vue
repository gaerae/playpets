<!-- A sample pet drawn from its real sprite sheet (the file the app uses), playing one row.
     Rows and frame counts follow src/core/animation.js. `scale` sizes the 192×208 cell. -->
<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { MOTION_ROWS } from '../../../scripts/site-preview-lib.mjs';
import { animationSpec } from '../../../src/core/animation.js';
import { whenDecoded } from './site-runtime.mjs';
import { sheetFor } from './sprite-sheet';

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
const sheet = computed(() => sheetFor(props.pet, props.state, props.season));
const next = computed(() => ({
  state: props.state,
  still: props.frame !== undefined,
  style: {
    '--sheet': `url(${sheet.value.url})`,
    '--row': sheet.value.strip ? '0' : String(row.value.row),
    '--sheet-size': sheet.value.strip ? '1536px 208px' : '1536px 2288px',
    '--frames': String(row.value.frames),
    '--loop': `${row.value.seconds}s`,
    '--scale': String(props.scale),
    ...(props.frame === undefined ? {} : { '--frame': String(props.frame) }),
  },
}));
// Each pose is its own file, so a new one replaces the shown pose only once it is decoded; the
// friend never blinks out while a strip downloads. A later change wins over a slower earlier one.
const shown = shallowRef(next.value);
let latest = 0;
watch(next, pose => {
  const ticket = ++latest;
  whenDecoded(sheet.value.url).then(() => {
    if (ticket === latest) shown.value = pose;
  });
});
</script>

<template>
  <span class="sprite" :class="{ 'sprite-still': shown.still }" :style="shown.style" :data-state="shown.state" role="img" aria-hidden="true"><i /></span>
</template>
