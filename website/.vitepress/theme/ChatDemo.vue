<!-- Friends chatting in the yard: plays one of the copy table's sample scenes when it comes into
     view, and the next one each time the visitor presses the button. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { LANDING_PETS } from '../../../scripts/site-content.mjs';
import VisibleSprite from './VisibleSprite.vue';

const props = defineProps<{
  words: { chatPlay: string; chatAgain: string; chatNote: string; chats: [string, string][][] };
  paused: boolean;
}>();
const scenery = Object.values(
  import.meta.glob('../../../src/art/environments/courtyard-autumn.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>,
)[0];
// Where each friend stands, as a share of the scene's width.
const SPOTS = [17, 39, 61, 83];
const stage = ref<HTMLElement | null>(null);
const visible = ref(false);
const scene = ref(0);
const said = ref(0);
const played = ref(false);
let observer: IntersectionObserver | undefined;
let lineTimer: ReturnType<typeof setTimeout> | undefined;
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const lines = computed(() => props.words.chats[scene.value]);
const spotOf = (id: string) => SPOTS[LANDING_PETS.findIndex(pet => pet.id === id)];
// The newest line and the one before it stay up, older above newer, like bubbles in the yard.
const bubbles = computed(() =>
  lines.value
    .slice(Math.max(0, said.value - 2), said.value)
    .map(([speaker, text], index, shown) => ({ speaker, text, older: index < shown.length - 1 })),
);
function poseOf(id: string) {
  const speaker = lines.value[said.value - 1]?.[0];
  if (!speaker || !lines.value.some(([who]) => who === id)) return { state: 'idle' };
  if (speaker === id) return { state: said.value === 1 ? 'wave' : 'idle' };
  // The listener turns toward whoever is talking (gaze directions 4 and 12: right and left).
  return spotOf(speaker) > spotOf(id) ? { state: 'look-0', frame: 4 } : { state: 'look-1', frame: 4 };
}
// A bubble starts over its speaker; near an edge it grows inward so it stays in the scene.
function anchor(id: string) {
  const spot = spotOf(id);
  if (spot < 30) return { alignSelf: 'flex-start', marginLeft: `${spot - 12}%`, '--tail-left': 'calc(12cqw - 5px)' };
  if (spot > 70) return { alignSelf: 'flex-end', marginRight: `${88 - spot}%`, '--tail-right': 'calc(12cqw - 5px)' };
  return { alignSelf: 'flex-start', marginLeft: `${spot}%`, translate: '-50% 0', '--tail-left': 'calc(50% - 5px)' };
}
function next() {
  said.value += 1;
  if (said.value < lines.value.length) lineTimer = setTimeout(next, 2300);
}
function play() {
  clearTimeout(lineTimer);
  if (played.value) scene.value = (scene.value + 1) % props.words.chats.length;
  played.value = true;
  said.value = 0;
  next();
}
onMounted(() => {
  if (!stage.value || !globalThis.IntersectionObserver) return;
  observer = new IntersectionObserver(
    entries => {
      visible.value = entries.some(entry => entry.isIntersecting);
      // Starts once by itself; never for paused or reduced motion, where the button starts it.
      if (visible.value && !played.value && !props.paused && !reducedMotion()) play();
    },
    { threshold: 0.6 },
  );
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(lineTimer);
});
</script>
<template>
  <figure class="chat-demo">
    <div ref="stage" class="chat-stage" :class="{ 'preview-paused': paused || !visible }">
      <img class="chat-scenery" :src="scenery" alt="" width="1536" height="1024" loading="lazy" decoding="async" draggable="false" />
      <div v-for="(pet, index) in LANDING_PETS" :key="pet.id" class="chat-friend" :style="{ left: `${SPOTS[index]}%` }">
        <VisibleSprite equal-height :pet="pet.id" :state="poseOf(pet.id).state" :frame="poseOf(pet.id).frame" :scale="0.5" />
        <span class="chat-name">{{ pet.displayName }}</span>
      </div>
      <div class="chat-bubbles" aria-live="polite">
        <div v-for="bubble in bubbles" :key="bubble.text" class="chat-bubble" :class="{ older: bubble.older }" :style="anchor(bubble.speaker)">
          <b class="visually-hidden">{{ LANDING_PETS.find(pet => pet.id === bubble.speaker)?.displayName }}: </b>{{ bubble.text }}
        </div>
      </div>
    </div>
    <figcaption class="demo-controls">
      <button type="button" class="demo-button" @click="play">{{ played ? words.chatAgain : words.chatPlay }}</button>
      <span>{{ words.chatNote }}</span>
    </figcaption>
  </figure>
</template>
