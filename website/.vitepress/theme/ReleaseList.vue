<!-- The releases index: one row per version in the current language, newest first. -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed } from 'vue';
import { data } from '../releases.data';
import { useWords } from './words';

const { lang, words } = useWords();
const items = computed(() => data.filter(r => r.lang === lang.value));
</script>

<template>
  <ul class="release-list">
    <li v-for="r in items" :key="r.version">
      <a :href="withBase(r.url)">
        <b>{{ r.version }}</b>
        <span class="release-date">{{ r.date || words.preparing }}</span>
        <span v-if="r.headline" class="release-headline">{{ r.headline }}</span>
      </a>
    </li>
  </ul>
</template>
