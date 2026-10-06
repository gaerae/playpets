<!-- "Since 0.2.0": the version a feature arrived in, next to its heading, in the page's language. -->
<script setup lang="ts">
import { useWords } from './words';

defineProps<{ v: string }>();
const { words } = useWords();
</script>

<template>
  <span class="since">{{ words.since(v) }}</span>
</template>
