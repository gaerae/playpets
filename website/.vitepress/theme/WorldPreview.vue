<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import VisibleSprite from './VisibleSprite.vue';

const props = defineProps<{
  words: {
    worldsTitle: string;
    worldsLead: string;
    sceneLabel: string;
    places: string[];
    seasons: string[];
    seasonLabel: string;
    previewNote: string;
    greet: string;
    pause: string;
    resume: string;
  };
  paused: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();
const art = import.meta.glob('../../../src/art/environments/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const place = ref(0);
const season = ref(0);
const stage = ref<HTMLElement | null>(null);
const visible = ref(false);
const greeted = ref('');
let observer: IntersectionObserver | undefined;
let greetingTimer: ReturnType<typeof setTimeout> | undefined;
const image = computed(() => {
  const suffix = ['spring', 'green', 'autumn', 'winter'][season.value];
  const file = place.value === 3 ? 'studio-cozy-day' : `${['', 'courtyard-', 'lakeside-'][place.value]}${suffix}`;
  return art[`../../../src/art/environments/${file}.png`];
});
function greet(id: string) {
  greeted.value = id;
  clearTimeout(greetingTimer);
  greetingTimer = setTimeout(() => {
    greeted.value = '';
  }, 2200);
}
onMounted(() => {
  if (!stage.value) return;
  observer = new IntersectionObserver(entries => {
    visible.value = entries.some(entry => entry.isIntersecting);
  });
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(greetingTimer);
});
</script>
<template>
  <div class="world-preview">
    <div class="world-picker"><div><h2>{{ words.worldsTitle }}</h2><p>{{ words.worldsLead }}</p></div></div>
    <div ref="stage" class="living-world" :class="{ 'preview-paused': paused || !visible, indoors: place === 3 }">
      <img class="living-scenery" :src="image" :alt="words.places[place]" width="1536" height="1024" fetchpriority="high" />
      <div class="living-friends">
        <button v-for="(pet, index) in ['daisy', 'clover', 'pip']" :key="pet" type="button" class="living-friend" :class="`friend-${index}`" :aria-label="`${['Daisy', 'Clover', 'Pip'][index]} · ${words.greet}`" @click="greet(pet)"><VisibleSprite equal-height :pet="pet" :state="greeted === pet ? 'wave' : 'idle'" :scale="0.65" /></button>
      </div>
      <button class="world-motion" type="button" :aria-pressed="paused" @click="emit('pause')">{{ paused ? words.resume : words.pause }}</button>
    </div>
    <div class="world-console">
      <div class="scene-choices" role="group" :aria-label="words.sceneLabel"><button v-for="(name, index) in words.places" :key="name" type="button" :aria-pressed="place === index" @click="place = index">{{ name }}</button></div>
      <div v-if="place !== 3" class="season-choices" role="group" :aria-label="words.seasonLabel"><button v-for="(name, index) in words.seasons" :key="name" type="button" :aria-pressed="season === index" @click="season = index">{{ name }}</button></div>
    </div>
    <p class="scene-caption">{{ words.previewNote }}</p>
  </div>
</template>
