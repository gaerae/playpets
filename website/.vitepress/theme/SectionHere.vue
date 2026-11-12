<!-- Below the width that shows the outline beside the page, the bar under the menu names the section
     being read, so a reader on a phone always knows where they are. It is placed in that bar once the
     page is in the browser, reads the page's own second-level headings and measures only on scroll,
     at most once a frame. -->
<script setup lang="ts">
import { onContentUpdated } from 'vitepress';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const target = ref<Element | null>(null);
const here = ref('');
let heads: HTMLElement[] = [];
let frame = 0;

// A heading's words without its anchor sign or version badge.
function words(heading: HTMLElement) {
  const copy = heading.cloneNode(true) as HTMLElement;
  for (const extra of copy.querySelectorAll('.header-anchor, .since')) extra.remove();
  return copy.textContent?.trim() ?? '';
}
function measure() {
  frame = 0;
  const bar = target.value?.getBoundingClientRect();
  if (!bar || !bar.height) {
    here.value = '';
    return;
  }
  let current = '';
  for (const heading of heads) {
    if (heading.getBoundingClientRect().top > bar.bottom + 40) break;
    current = words(heading);
  }
  here.value = current;
}
const onScroll = () => {
  if (!frame) frame = requestAnimationFrame(measure);
};
function collect() {
  target.value = document.querySelector('.VPLocalNav .container');
  heads = [...document.querySelectorAll<HTMLElement>('.vp-doc h2')];
  measure();
}

onMounted(() => {
  collect();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
});
onContentUpdated(collect);
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <Teleport v-if="target && here" :to="target">
    <span class="section-here">{{ here }}</span>
  </Teleport>
</template>
