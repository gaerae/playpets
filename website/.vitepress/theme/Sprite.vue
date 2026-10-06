<!-- A sample pet drawn from its real sprite sheet (the file the app uses), playing one row.
     Rows and frame counts follow src/core/animation.js. `scale` sizes the 192×208 cell. -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';

const ROWS: Record<string, [number, number, number]> = {
  // state: [row, frames, seconds per loop]
  idle: [0, 6, 1.1],
  right: [1, 8, 1.1],
  left: [2, 8, 1.1],
  wave: [3, 4, 0.7],
  jump: [4, 5, 0.85],
  error: [5, 8, 1.2],
  waiting: [6, 6, 1.0],
  working: [7, 6, 0.85],
  done: [8, 6, 1.1],
};
const props = withDefaults(defineProps<{ state?: string; scale?: number; pet?: string }>(), {
  state: 'idle',
  scale: 0.6,
  pet: 'tabby',
});
const row = computed(() => ROWS[props.state] ?? ROWS.idle);
const style = computed(() => ({
  '--sheet': `url(${withBase(`/pets/${props.pet}.png`)})`,
  '--row': String(row.value[0]),
  '--frames': String(row.value[1]),
  '--loop': `${row.value[2]}s`,
  '--scale': String(props.scale),
}));
</script>

<template>
  <span class="sprite" :style="style" :data-state="state" role="img" aria-hidden="true"><i /></span>
</template>
