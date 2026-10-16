<!-- The end of a release page: the GitHub release and the changelog. -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import generated from '../generated.json';
import { taggedRelease, watchRelease } from './site-runtime.mjs';
import { useWords } from './words';

const props = defineProps<{ version: string }>();
const { words } = useWords();
const repo = `https://github.com/${generated.slug}`;
const published = ref(false);
let active = true;
let detach: (() => void) | undefined;
const update = (result: { status: string }) => {
  if (active) published.value = result.status === 'ready';
};
onMounted(async () => {
  detach = watchRelease(generated.slug, update, props.version);
  update(await taggedRelease(generated.slug, props.version));
});
onBeforeUnmount(() => {
  active = false;
  detach?.();
});
</script>

<template>
  <p class="release-links">
    <a :href="published ? `${repo}/releases/tag/v${version}` : `${repo}/releases`">{{ words.github }}</a>
    <a :href="`${repo}/blob/main/CHANGELOG.md`">{{ words.changelog }}</a>
  </p>
</template>
