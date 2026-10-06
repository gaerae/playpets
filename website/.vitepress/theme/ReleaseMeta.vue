<!-- Under a release page's title: the date and the headline from its front matter. -->
<script setup lang="ts">
import { useData } from 'vitepress';
import { useWords } from './words';

const { frontmatter } = useData();
const { words } = useWords();
</script>

<template>
  <p class="release-meta">
    <time v-if="frontmatter.date" :datetime="frontmatter.date">{{ words.released }} {{ frontmatter.date }}</time>
    <span v-else class="since">{{ words.preparing }}</span>
    <span v-if="frontmatter.headline" class="release-headline">{{ frontmatter.headline }}</span>
  </p>
</template>
