<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Sprite from './Sprite.vue';
import { whenVisible } from './site-runtime.mjs';

withDefaults(defineProps<{ pet: string; state?: string; scale?: number }>(), { state: 'idle', scale: 0.6 });
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
  <span ref="element" class="sprite" aria-hidden="true" :style="{ '--scale': String(scale) }">
    <Sprite v-if="loaded" :pet="pet" :state="state" :scale="scale" />
  </span>
</template>
