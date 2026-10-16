<script setup>
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { studioCopy } from './studio-copy.js';
import { replaceStudioHash, studioPanelForHash } from './studio-flow.mjs';

const props = defineProps({ lang: { type: String, default: 'en' } });
const t = computed(() => studioCopy[props.lang] || studioCopy.en);
const selected = ref('sample');
provide('studioPanel', selected);
const panels = ['sample', 'custom', 'package'];
const anchors = ['#official-kit', '#custom-prompts', '#pet-package-title'];
const restore = () => {
  selected.value = studioPanelForHash(location.hash, 'pet');
};
function change(value) {
  selected.value = value;
  replaceStudioHash(anchors[panels.indexOf(value)]);
}
onMounted(() => {
  restore();
  window.addEventListener('hashchange', restore);
});
onBeforeUnmount(() => window.removeEventListener('hashchange', restore));
</script>
<template>
  <TabsRoot class="studio-workspace" :model-value="selected" @update:model-value="change">
    <TabsList class="studio-tabs" :aria-label="t.start">
      <TabsTrigger v-for="(panel,i) in panels" :key="panel" :value="panel" class="studio-tab"><strong>{{ t.paths[i] }}</strong><span>{{ t.pathHints[i] }}</span></TabsTrigger>
    </TabsList>
    <TabsContent v-for="panel in panels" :key="panel" :value="panel" force-mount :hidden="selected !== panel" class="studio-tab-panel"><slot :name="panel" /></TabsContent>
  </TabsRoot>
</template>
