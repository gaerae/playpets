<!-- "macOS only": the start of a release note line about some systems, in the page's language.
     os is one system or a comma-separated list ("macOS, Linux"). The Store's What's new
     (scripts/store-notes.mjs) leaves out lines that are not for Windows. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useWords } from './words';

const props = defineProps<{ os: string }>();
const { words } = useWords();
const names = computed(() => props.os.split(',').map(name => name.trim()));
</script>

<template>
  <span class="only">{{ words.only(names) }}</span>
</template>
