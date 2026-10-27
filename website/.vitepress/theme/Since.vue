<!-- "Since 0.2.0": the version a feature arrived in, next to its heading, in the page's language.
     Features from the first release show nothing: they have always been there. `ignore-header`
     keeps the badge out of the page outline, so the outline lists headings only. -->
<script setup lang="ts">
import { useWords } from './words';

defineProps<{ v: string }>();
const FIRST_RELEASE = '0.1.0';
const { words } = useWords();
</script>

<template>
  <span v-if="v !== FIRST_RELEASE" class="since ignore-header">{{ words.since(v) }}</span>
</template>
