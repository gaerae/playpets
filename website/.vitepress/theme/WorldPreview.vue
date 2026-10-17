<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { LANDING_PETS } from '../../../scripts/site-content.mjs';
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
    posesLabel: string;
    poses: string[];
    greetings: Record<string, string>;
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
const selected = ref('clover');
const pose = ref('idle');
const tabVisible = ref(true);
const poses = ['idle', 'wave', 'jump'];
const selectedFriend = computed(() => LANDING_PETS.find(pet => pet.id === selected.value));
function tabChanged() {
  tabVisible.value = !document.hidden;
}
let observer: IntersectionObserver | undefined;
let greetingTimer: ReturnType<typeof setTimeout> | undefined;
const image = computed(() => {
  const suffix = ['spring', 'green', 'autumn', 'winter'][season.value];
  const file = place.value === 3 ? 'studio-cozy-day' : `${['', 'courtyard-', 'lakeside-'][place.value]}${suffix}`;
  return art[`../../../src/art/environments/${file}.png`];
});
function greet(id: string, state = 'wave') {
  selected.value = id;
  pose.value = state;
  greeted.value = id;
  clearTimeout(greetingTimer);
  greetingTimer = setTimeout(() => {
    greeted.value = '';
    pose.value = 'idle';
  }, 2200);
}
onMounted(() => {
  tabChanged();
  document.addEventListener('visibilitychange', tabChanged);
  if (!stage.value) return;
  if (!globalThis.IntersectionObserver) {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(entries => {
    visible.value = entries.some(entry => entry.isIntersecting);
  });
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('visibilitychange', tabChanged);
  clearTimeout(greetingTimer);
});
</script>
<template>
  <div class="world-preview">
    <div class="world-picker"><div><h2>{{ words.worldsTitle }}</h2><p>{{ words.worldsLead }}</p></div></div>
    <div ref="stage" class="living-world" :class="{ 'preview-paused': paused || !visible || !tabVisible, indoors: place === 3 }">
      <img class="living-scenery" :src="image" :alt="words.places[place]" width="1536" height="1024" fetchpriority="high" draggable="false" />
      <div class="living-friends">
        <button v-for="(pet, index) in LANDING_PETS" :key="pet.id" type="button" class="living-friend" :class="[`friend-${index}`, { 'friend-selected': selected === pet.id }]" :aria-label="`${pet.displayName} · ${words.greet}`" :aria-pressed="selected === pet.id" @click="greet(pet.id)"><VisibleSprite equal-height :pet="pet.id" :season="['spring', 'summer', 'autumn', 'winter'][season]" :state="greeted === pet.id ? pose : 'idle'" :scale="0.65" /><span class="living-name">{{ pet.displayName }}</span></button>
      </div>
      <button class="world-motion" type="button" :aria-pressed="paused" @click="emit('pause')">{{ paused ? words.resume : words.pause }}</button>
    </div>
    <div class="world-greeting"><p aria-live="polite"><strong>{{ selectedFriend?.displayName }}</strong><span>{{ words.greetings[selected] }}</span></p><div class="pose-controls" role="group" :aria-label="words.posesLabel"><button v-for="(state, index) in poses" :key="state" type="button" :aria-pressed="pose === state" @click="greet(selected, state)">{{ words.poses[index] }}</button></div></div>
    <div class="world-console">
      <div class="scene-choices" role="group" :aria-label="words.sceneLabel"><button v-for="(name, index) in words.places" :key="name" type="button" :aria-pressed="place === index" @click="place = index">{{ name }}</button></div>
      <div v-if="place !== 3" class="season-choices" role="group" :aria-label="words.seasonLabel"><button v-for="(name, index) in words.seasons" :key="name" type="button" :aria-pressed="season === index" @click="season = index">{{ name }}</button></div>
    </div>
    <p class="scene-caption">{{ words.previewNote }}</p>
  </div>
</template>
