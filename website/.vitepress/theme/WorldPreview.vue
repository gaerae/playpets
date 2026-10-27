<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { LANDING_PETS } from '../../../scripts/site-content.mjs';
import { lookFrame } from '../../../src/core/animation.js';
import { whenDecoded } from './site-runtime.mjs';
import { sheetFor } from './sprite-sheet';
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
// Each friend strolls a little way around its own spot (a share of the scene's width), so the
// four never bump into each other.
const HOMES = [20, 41, 62, 82];
const spots = ref([...HOMES]);
const strides = ref(HOMES.map(() => 0));
const walking = ref<Record<string, string>>({});
const gazes = ref<Record<string, { state: string; frame: number }>>({});
const friendElements: HTMLElement[] = [];
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const still = computed(() => props.paused || !visible.value || !tabVisible.value);
let strollTimer: ReturnType<typeof setTimeout> | undefined;
let gazeTimer: ReturnType<typeof setTimeout> | undefined;
let lookPending = false;
const arrivals = new Map<string, ReturnType<typeof setTimeout>>();
function poseOf(id: string) {
  if (greeted.value === id) return { state: pose.value };
  if (walking.value[id]) return { state: walking.value[id] };
  return gazes.value[id] ?? { state: 'idle' };
}
function stroll() {
  const resting = LANDING_PETS.map((pet, index) => ({ pet, index })).filter(
    ({ pet }) => !walking.value[pet.id] && greeted.value !== pet.id,
  );
  if (!still.value && !reducedMotion() && resting.length) {
    const { pet, index } = resting[Math.floor(Math.random() * resting.length)];
    const target = HOMES[index] + Math.round((Math.random() * 2 - 1) * 8);
    const distance = Math.abs(target - spots.value[index]);
    if (distance >= 2) {
      // About five percent of the scene a second, the pace of a stroll in the yard.
      strides.value[index] = distance / 5;
      walking.value = { ...walking.value, [pet.id]: target > spots.value[index] ? 'right' : 'left' };
      spots.value[index] = target;
      arrivals.set(
        pet.id,
        setTimeout(() => {
          const { [pet.id]: _, ...rest } = walking.value;
          walking.value = rest;
        }, strides.value[index] * 1000),
      );
    }
  }
  strollTimer = setTimeout(stroll, 2600 + Math.random() * 3400);
}
// Friends turn their heads toward the pointer with the app's own gaze rows.
function look(event: PointerEvent) {
  clearTimeout(gazeTimer);
  if (lookPending) return;
  lookPending = true;
  requestAnimationFrame(() => {
    lookPending = false;
    const next: Record<string, { state: string; frame: number }> = {};
    LANDING_PETS.forEach((pet, index) => {
      const box = friendElements[index]?.getBoundingClientRect();
      if (!box) return;
      const dx = event.clientX - (box.left + box.width / 2),
        dy = event.clientY - (box.top + box.height * 0.3);
      if (Math.abs(dx) < box.width / 2 && Math.abs(dy) < box.height / 2) return;
      const { row, column } = lookFrame(dx, dy);
      if (row) next[pet.id] = { state: `look-${row - 9}`, frame: column };
    });
    gazes.value = next;
  });
}
function lookAway() {
  clearTimeout(gazeTimer);
  gazeTimer = setTimeout(() => {
    gazes.value = {};
  }, 900);
}
// Walking and glancing load as soon as the scene is in view, so a friend's first step or turn of
// the head plays at once instead of waiting for its file.
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
watch([visible, season], () => {
  if (!visible.value) return;
  for (const pet of LANDING_PETS)
    for (const state of ['right', 'left', 'look-0', 'look-1'])
      whenDecoded(sheetFor(pet.id, state, SEASONS[season.value]).url);
});
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
  strollTimer = setTimeout(stroll, 1800);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('visibilitychange', tabChanged);
  clearTimeout(greetingTimer);
  clearTimeout(strollTimer);
  clearTimeout(gazeTimer);
  for (const timer of arrivals.values()) clearTimeout(timer);
});
</script>
<template>
  <div class="world-preview">
    <div class="world-picker"><div><h2>{{ words.worldsTitle }}</h2><p>{{ words.worldsLead }}</p></div></div>
    <div ref="stage" class="living-world" :class="{ 'preview-paused': still, indoors: place === 3 }" @pointermove="look" @pointerleave="lookAway">
      <img class="living-scenery" :src="image" :alt="words.places[place]" width="1536" height="1024" fetchpriority="high" draggable="false" />
      <div class="living-friends">
        <button v-for="(pet, index) in LANDING_PETS" :key="pet.id" :ref="element => { friendElements[index] = element as HTMLElement }" type="button" class="living-friend" :class="[`friend-${index}`, { 'friend-selected': selected === pet.id }]" :style="{ left: `${spots[index]}%`, transitionDuration: `${strides[index]}s` }" :aria-label="`${pet.displayName}, ${words.greet}`" :aria-pressed="selected === pet.id" @click="greet(pet.id)"><span v-if="greeted === pet.id" class="living-bubble" aria-hidden="true">{{ words.greetings[pet.id] }}</span><VisibleSprite equal-height :pet="pet.id" :season="['spring', 'summer', 'autumn', 'winter'][season]" :state="poseOf(pet.id).state" :frame="poseOf(pet.id).frame" :scale="0.65" /><span class="living-name">{{ pet.displayName }}</span></button>
      </div>
      <button class="world-motion" type="button" :aria-pressed="paused" @click="emit('pause')">{{ paused ? words.resume : words.pause }}</button>
    </div>
    <!-- One dock under the scene: the first row picks the world, the second plays with a friend. -->
    <div class="world-dock">
      <div class="dock-row" role="group" :aria-label="words.sceneLabel">
        <div class="choice-group place-choices"><button v-for="(name, index) in words.places" :key="name" type="button" :aria-pressed="place === index" @click="place = index">{{ name }}</button></div>
        <div class="choice-group" role="group" :aria-label="words.seasonLabel"><button v-for="(name, index) in words.seasons" :key="name" type="button" :aria-pressed="place !== 3 && season === index" :disabled="place === 3" @click="season = index">{{ name }}</button></div>
      </div>
      <div class="dock-row">
        <p class="dock-friend" aria-live="polite"><strong>{{ selectedFriend?.displayName }}</strong><span>{{ words.greetings[selected] }}</span></p>
        <div class="choice-group" role="group" :aria-label="words.posesLabel"><button v-for="(state, index) in poses" :key="state" type="button" :aria-pressed="pose === state" @click="greet(selected, state)">{{ words.poses[index] }}</button></div>
      </div>
    </div>
    <p class="scene-caption">{{ words.previewNote }}</p>
  </div>
</template>
