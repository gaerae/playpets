<!-- A sample pet drawn from its real sprite sheet (the file the app uses), playing one row.
     Rows and frame counts follow src/core/animation.js. `scale` sizes the 192×208 cell. -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { animationSpec } from '../../../src/core/animation.js';

const props = withDefaults(defineProps<{ state?: string; scale?: number; pet?: string }>(), {
  state: 'idle',
  scale: 0.6,
  pet: 'tabby',
});
const row = computed(() => animationSpec(props.state));
const style = computed(() => ({
  '--sheet': `url(${withBase(`/pets/${props.pet}.png`)})`,
  '--row': String(row.value.row),
  '--frames': String(row.value.frames),
  '--loop': `${row.value.seconds}s`,
  '--scale': String(props.scale),
}));
</script>

<template>
  <span class="sprite" :style="style" :data-state="state" role="img" aria-hidden="true"><i /></span>
</template>
