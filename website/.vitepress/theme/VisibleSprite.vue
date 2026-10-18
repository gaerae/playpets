<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Sprite from './Sprite.vue';
import { castHeightFactor, whenVisible } from './site-runtime.mjs';

withDefaults(defineProps<{ pet: string; state?: string; season?: string; scale?: number; equalHeight?: boolean }>(), {
  state: 'idle',
  season: 'base',
  scale: 0.6,
});
const element = ref<HTMLElement | null>(null);
const loaded = ref(false);
let detach: (() => void) | undefined;
onMounted(() => {
  if (element.value)
    detach = whenVisible(element.value, () => {
      loaded.value = true;
    });
});
onBeforeUnmount(() => detach?.());
</script>
<template>
  <span ref="element" class="sprite" aria-hidden="true" :style="{ '--scale': String(scale), '--height-factor': equalHeight ? String(castHeightFactor(pet)) : '1' }">
    <Sprite v-if="loaded" :pet="pet" :state="state" :season="season" :scale="scale" />
  </span>
</template>
