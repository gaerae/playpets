<!-- "macOS only": the start of a release note line about one system, in the page's language.
     The Store's What's new (scripts/store-notes.mjs) leaves out lines for other systems than Windows. -->
<script setup lang="ts">
import { useWords } from './words';

defineProps<{ os: 'macOS' | 'Windows' | 'Linux' }>();
const { words } = useWords();
</script>

<template>
  <span class="only">{{ words.only(os) }}</span>
</template>
