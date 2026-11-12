<script setup lang="ts">
import { PREVIEW_PLACES } from '../../../scripts/site-content.mjs';
import { sceneryUrl, sceneSrcset } from './scenery';

defineProps<{
  names: string[];
  copy: { about: Record<string, string>; seasonal: string; indoor: string };
}>();
// Each place in its summer picture, or its one picture indoors: the same art the app draws.
const picture = (place: { seasons?: string; still?: string }) => place.still ?? `${place.seasons}green`;
</script>
<template>
  <ul class="place-cards">
    <li v-for="(place, index) in PREVIEW_PLACES" :key="place.id" :class="`place-${place.id}`">
      <div class="place-art"><img :src="sceneryUrl(picture(place))" :srcset="sceneSrcset(picture(place))" sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 1100px) calc(50vw - 42px), 510px" :alt="names[index]" loading="lazy" decoding="async" width="1536" height="1024" draggable="false" /></div>
      <h3>{{ names[index] }}<span class="place-tag">{{ place.still ? copy.indoor : copy.seasonal }}</span></h3>
      <p>{{ copy.about[place.id] }}</p>
    </li>
  </ul>
</template>
