<!-- "0.2.0부터": the version a feature arrived in, next to its heading. -->
<script setup lang="ts">
import { useWords } from './words';

defineProps<{ v: string }>();
const { words } = useWords();
</script>

<template>
  <span class="since">{{ words.since(v) }}</span>
</template>
