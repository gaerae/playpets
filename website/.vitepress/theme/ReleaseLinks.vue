<!-- The end of a release page: the GitHub release and the changelog. -->
<script setup lang="ts">
import generated from '../generated.json';
import { useWords } from './words';

defineProps<{ version: string }>();
const { words } = useWords();
const repo = `https://github.com/${generated.slug}`;
</script>

<template>
  <p class="release-links">
    <a :href="`${repo}/releases/tag/v${version}`">{{ words.github }}</a>
    <a :href="`${repo}/blob/main/CHANGELOG.md`">{{ words.changelog }}</a>
  </p>
</template>
