<!-- The year on the landing: each season's events and other times the yard changes, when they come
     (events.json, or the item's own days) and what to do then, pictured with the album kinds they bring.
     One card each, tinted by its season, so a season with more to do takes more cards, not a longer column. -->
<script setup lang="ts">
import events from '../../../src/content/events.json';
import { YEAR } from '../../../scripts/site-content.mjs';
import { appWord, dayRange, kindArt, kindName } from './album-art';

const props = defineProps<{
  lang: string;
  seasons: string[];
  copy: { letter: string; christmas: string; items: Record<string, string> };
}>();
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const cards = YEAR.flatMap(({ season, items }) => items.map(item => ({ season, ...item })));
const title = (id: string, event: boolean) =>
  event
    ? appWord(props.lang, `event.${id}.name`)
    : {
        snowman: appWord(props.lang, 'game.snowman'),
        shoots: appWord(props.lang, 'album.shoots'),
        footprints: appWord(props.lang, 'album.tracks'),
        letter: props.copy.letter,
        christmas: props.copy.christmas,
      }[id] || id;
const when = (item: { id: string; event?: boolean; from?: string; to?: string }) => {
  const days = item.event ? events.events.find(e => e.id === item.id) : item;
  return days?.from && days?.to ? dayRange(props.lang, days.from, days.to) : '';
};
</script>

<template>
  <ol class="year-story">
    <li v-for="item in cards" :key="item.id" :class="`season-${item.season}`">
      <div class="year-art">
        <template v-for="[book, id] in item.art" :key="id">
          <img v-if="kindArt(book, id)" v-bind="kindArt(book, id)" :alt="kindName(props.lang, book, id)" :title="kindName(props.lang, book, id)" loading="lazy" decoding="async" />
        </template>
      </div>
      <p class="year-when"><b>{{ props.seasons[SEASONS.indexOf(item.season)] }}</b><span v-if="when(item)">{{ when(item) }}</span></p>
      <h3>{{ title(item.id, !!item.event) }}</h3>
      <p>{{ props.copy.items[item.id] }}</p>
    </li>
  </ol>
</template>
