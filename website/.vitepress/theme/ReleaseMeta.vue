<!-- Under a release page's title: the date and the headline from its front matter. -->
<script setup lang="ts">
import { useData } from 'vitepress';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import generated from '../generated.json';
import { taggedRelease, watchRelease } from './site-runtime.mjs';
import { useWords } from './words';

const { frontmatter } = useData();
const { words } = useWords();
const publishedAt = ref('');
let active = true;
let detach: (() => void) | undefined;
const update = (result: { status: string; publishedAt?: string }) => {
  if (active && result.status === 'ready') publishedAt.value = result.publishedAt ?? '';
};
onMounted(async () => {
  const version = String(frontmatter.value.version ?? '');
  detach = watchRelease(generated.slug, update, version);
  update(await taggedRelease(generated.slug, version));
});
onBeforeUnmount(() => {
  active = false;
  detach?.();
});
</script>

<template>
  <p class="release-meta">
    <time v-if="publishedAt" :datetime="publishedAt">{{ words.released }} {{ publishedAt.slice(0, 10) }}</time>
    <span v-else class="since">{{ words.preparing }}</span>
    <span v-if="frontmatter.headline" class="release-headline">{{ frontmatter.headline }}</span>
  </p>
</template>
