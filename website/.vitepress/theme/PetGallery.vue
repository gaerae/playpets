<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { LANDING_PETS } from '../../../scripts/site-content.mjs';
import VisibleSprite from './VisibleSprite.vue';

const props = defineProps<{
  words: {
    galleryTitle: string;
    galleryLead: string;
    galleryLabel: string;
    posesLabel: string;
    poses: string[];
    selectedLead: string;
    petNotes: Record<string, string>;
    galleryGuide: string;
    galleryCreate: string;
  };
  guide: string;
  creator: string;
}>();
const selectedId = ref('clover');
const selected = computed(() => LANDING_PETS.find(pet => pet.id === selectedId.value) ?? LANDING_PETS[0]);
const poses = ['idle', 'wave', 'jump'];
const pose = ref('idle');
const portrait = ref<HTMLElement | null>(null);
const portraitVisible = ref(false);
let observer: IntersectionObserver | undefined;
onMounted(() => {
  if (!portrait.value) return;
  if (!globalThis.IntersectionObserver) {
    portraitVisible.value = true;
    return;
  }
  observer = new IntersectionObserver(entries => {
    portraitVisible.value = entries.some(entry => entry.isIntersecting);
  });
  observer.observe(portrait.value);
});
onBeforeUnmount(() => observer?.disconnect());
const select = (id: string) => {
  selectedId.value = id;
  pose.value = 'idle';
};
</script>
<template>
  <section class="pet-gallery" id="companions">
    <header>
      <h2>{{ words.galleryTitle }}</h2>
      <p class="section-lead">{{ words.galleryLead }}</p>
    </header>
    <div class="pet-detail">
      <div ref="portrait" class="pet-portrait pet-shelf" :class="{ 'preview-paused': !portraitVisible }" role="group" :aria-label="words.galleryLabel">
        <button v-for="pet in LANDING_PETS" :key="pet.id" class="pet-choice" type="button" :aria-pressed="selected.id === pet.id" @click="select(pet.id)">
          <VisibleSprite equal-height :pet="pet.id" :state="selected.id === pet.id ? pose : 'idle'" :scale="0.65" />
          <span>{{ pet.displayName }}</span>
        </button>
      </div>
      <div class="pet-description">
        <h3>{{ selected.displayName }}</h3>
        <p>{{ words.petNotes[selected.id] }}</p>
        <p>{{ words.selectedLead }}</p>
        <div class="choice-group pose-controls" role="group" :aria-label="words.posesLabel">
          <button v-for="(state, i) in poses" :key="state" type="button" :aria-pressed="pose === state" @click="pose = state">{{ words.poses[i] }}</button>
        </div>
        <div class="pet-actions"><a class="pet-create" :href="`${props.creator}?kit=${encodeURIComponent(selected.kit)}`">{{ words.galleryCreate }} ↗</a><a class="more" :href="props.guide">{{ words.galleryGuide }} →</a></div>
      </div>
    </div>
  </section>
</template>
