<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  words: {
    worldsTitle: string;
    worldsLead: string;
    sceneLabel: string;
    scenes: { shot: string; label: string; caption: string }[];
    sceneCaption: (version: string) => string;
  };
  shotUrl: (name: string) => string;
  version: string;
}>();
const selected = ref(0);
const scene = computed(() => props.words.scenes[selected.value]);
</script>
<template>
  <div class="world-preview">
    <figure class="world-frame"><img :src="shotUrl(scene.shot)" :alt="scene.caption" width="2472" height="1672" fetchpriority="high" /><figcaption>{{ words.sceneCaption(version) }}</figcaption></figure>
    <div class="world-picker"><div><h2>{{ words.worldsTitle }}</h2><p>{{ words.worldsLead }}</p></div><div class="scene-choices" role="group" :aria-label="words.sceneLabel"><button v-for="(item, index) in words.scenes" :key="item.shot" type="button" :aria-pressed="selected === index" @click="selected = index">{{ item.label }}</button></div></div>
    <p class="scene-caption" aria-live="polite">{{ scene.caption }}</p>
  </div>
</template>
