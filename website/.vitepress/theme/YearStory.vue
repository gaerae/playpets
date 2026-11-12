<!-- The year on the landing: each season's events and other times the yard changes, when they come
     (events.json, or the item's own days), pictured with the album kinds they bring. An event also
     shows the scene that calls it up on any day when the season is picked by hand (its "scene" in
     events.json). What has to come together is a row of chips and what happens is one short line, so a
     card reads at a glance.
     One card each, tinted by its season, so a season with more to do takes more cards, not a longer column. -->
<script setup lang="ts">
import events from '../../../src/content/events.json';
import { YEAR } from '../../../scripts/site-content.mjs';
import { appWord, dayRange, kindArt, kindName } from './album-art';
import SceneChips from './SceneChips.vue';

const props = defineProps<{
  lang: string;
  seasons: string[];
  copy: { letter: string; christmas: string; pick: string; gives: Record<string, string> };
  recipe: { when: string; or: string; also: string };
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
// The card's season badge already says its season, so a recipe leaves its chip out; the any-day row
// keeps it, since that season is the one to pick.
const chips = (item: { season: string }, recipe: { when: string[] }) =>
  recipe.when.filter(token => token !== `season:${item.season}`);
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
      <div v-if="item.event" class="year-pick">
        <p class="recipe-or">{{ props.copy.pick }}</p>
        <SceneChips :lang="props.lang" :event="item.id" :label="props.copy.pick" />
      </div>
      <div v-for="(r, i) in item.recipes ?? [{ when: [] }]" :key="i" class="year-recipe" :class="{ also: r.also }">
        <p v-if="r.or" class="recipe-or">{{ props.recipe.or }}</p>
        <p v-if="r.also" class="recipe-also">{{ props.recipe.also }}</p>
        <SceneChips v-if="chips(item, r).length" :lang="props.lang" :when="chips(item, r)" :label="props.recipe.when" />
        <p v-if="!item.recipes?.[i + 1]?.or" class="recipe-gives">{{ props.copy.gives[r.gives ?? item.id] }}</p>
      </div>
    </li>
  </ol>
</template>
