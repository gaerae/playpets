<!-- What has to come together for a scene, as a row of chips named with the app's own words: a
     season, the time of day, the weather or its turn, a gift out in the yard, a Play menu item.
     Tokens are site-content.mjs's (`type:value`); a gift chip carries the album's picture of it. -->
<script setup lang="ts">
import { computed } from 'vue';
import { appWord, kindArt, kindName } from './album-art';

const props = defineProps<{ lang: string; when: string[]; label: string }>();
const SEASON_KEY: Record<string, string> = {
  spring: 'catch.season_spring',
  summer: 'catch.season_summer',
  autumn: 'catch.season_autumn',
  winter: 'catch.season_winter',
};
const word = (key: string) => appWord(props.lang, key);
function chip(token: string) {
  const [type, value] = token.split(':');
  if (type === 'season') return { type, icon: value, text: word(SEASON_KEY[value]) };
  if (type === 'period')
    return {
      type,
      icon: value.split('|')[0],
      text: new Intl.ListFormat(props.lang, { type: 'disjunction' }).format(value.split('|').map(p => word(`period.${p}`))),
    };
  if (type === 'weather') return { type, icon: value, text: word(`weather.${value}`) };
  if (type === 'change') {
    const [from, to] = value.split('>');
    return { type, icon: from, text: `${word(`weather.${from}`)} → ${word(`weather.${to}`)}` };
  }
  if (type === 'gift') return { type, art: kindArt('gifts', value), text: kindName(props.lang, 'gifts', value) };
  return { type, icon: 'play', text: `${word('controls.play')} → ${word(value)}` };
}
const chips = computed(() => props.when.map(token => ({ token, ...chip(token) })));
</script>

<template>
  <ul class="scene-chips" :aria-label="props.label">
    <li v-for="c in chips" :key="c.token" :class="[`chip-${c.type}`, `chip-${c.icon ?? 'art'}`]">
      <img v-if="c.art" v-bind="c.art" alt="" loading="lazy" decoding="async" />
      <svg v-else viewBox="0 0 16 16" aria-hidden="true">
        <template v-if="c.icon === 'night'"><path d="M10.5 2.5a5.5 5.5 0 1 0 3 9.6A6 6 0 0 1 10.5 2.5Z" /></template>
        <template v-else-if="c.icon === 'morning' || c.icon === 'evening'"><path d="M2 11.5h12M4.5 11.5a3.5 3.5 0 0 1 7 0" /><path v-if="c.icon === 'morning'" d="M8 3.5V5.5M3.8 5.8l1.3 1.3M12.2 5.8l-1.3 1.3" /></template>
        <template v-else-if="c.icon === 'rain'"><path d="M4.5 9.5h7a2.5 2.5 0 0 0 0-5 3.5 3.5 0 0 0-6.8.8A2.1 2.1 0 0 0 4.5 9.5ZM5.5 11.5l-.8 2M8.5 11.5l-.8 2M11.5 11.5l-.8 2" /></template>
        <template v-else-if="c.icon === 'snow'"><path d="M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6" /></template>
        <template v-else-if="c.icon === 'play'"><path d="M5.5 3.5v9l7-4.5Z" /></template>
        <template v-else-if="c.type === 'season'"><circle cx="8" cy="8" r="3.5" /></template>
        <template v-else><circle cx="8" cy="8" r="2.8" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></template>
      </svg>
      <span>{{ c.text }}</span>
    </li>
  </ul>
</template>
