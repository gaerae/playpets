<!-- The end of a release page: the GitHub release and the changelog. -->
<script setup lang="ts">
import { useData } from 'vitepress';
import generated from '../generated.json';
import { useWords } from './words';

defineProps<{ version: string }>();
const { frontmatter } = useData();
const { words } = useWords();
const repo = `https://github.com/${generated.slug}`;
</script>

<template>
  <p class="release-links">
    <a :href="frontmatter.date && !frontmatter.draft ? `${repo}/releases/tag/v${version}` : `${repo}/releases`">{{ words.github }}</a>
    <a :href="`${repo}/blob/main/CHANGELOG.md`">{{ words.changelog }}</a>
  </p>
</template>
