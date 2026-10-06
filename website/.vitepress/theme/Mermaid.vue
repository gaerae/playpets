<!-- Renders a ```mermaid block. The library (about 700KB) loads only on pages that have one. -->
<script setup lang="ts">
import { useData } from 'vitepress';
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{ code: string; id: string }>();
const svg = ref('');
const { isDark } = useData();

async function render() {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false, theme: isDark.value ? 'dark' : 'neutral', securityLevel: 'strict' });
  svg.value = (await mermaid.render(`m-${props.id}`, decodeURIComponent(props.code))).svg;
}
onMounted(render);
watch(isDark, render);
</script>

<template>
  <div class="mermaid" v-html="svg" />
</template>
