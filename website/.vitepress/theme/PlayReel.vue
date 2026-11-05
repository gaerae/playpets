<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

// The film of play cut from the real app (scripts/reel.mjs). It loads and plays only while it is on
// screen and motion is welcome; otherwise it waits on its still. Its own controls pause or start it.
const props = defineProps<{ src: string; poster: string; label: string; paused: boolean }>();
const video = ref<HTMLVideoElement>();
const visible = ref(false);
let observer: IntersectionObserver | undefined;
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function update() {
  const film = video.value;
  if (!film) return;
  if (visible.value && !props.paused && !reducedMotion()) film.play().catch(() => {});
  // A film started by hand under reduced motion keeps playing until it leaves the screen.
  else if (!visible.value || props.paused) film.pause();
}
watch(() => props.paused, update);
onMounted(() => {
  if (!video.value || !globalThis.IntersectionObserver) return;
  observer = new IntersectionObserver(
    entries => {
      visible.value = entries.some(entry => entry.isIntersecting);
      update();
    },
    { threshold: 0.4 },
  );
  observer.observe(video.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <figure class="play-reel">
    <video ref="video" :src="src" :poster="poster" :aria-label="label" controls muted loop playsinline preload="none" width="1280" height="846"></video>
    <figcaption>{{ label }}</figcaption>
  </figure>
</template>
