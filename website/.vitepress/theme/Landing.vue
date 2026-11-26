<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed, ref } from 'vue';
import catalog from '../../../src/content/catalog.json';
import { ALBUM_BOOKS } from '../../../src/yard/catalog.js';
import generated from '../generated.json';
import AgentDemo from './AgentDemo.vue';
import { appWord } from './album-art';
import AlbumBooks from './AlbumBooks.vue';
import { AGENT_DEMOS } from './agent-demo.mjs';
import ChatDemo from './ChatDemo.vue';
import Downloads from './Downloads.vue';
import DeskStory from './DeskStory.vue';
import * as en from './landing-en';
import * as ja from './landing-ja';
import * as ko from './landing-ko';
import * as zh from './landing-zh-hans';
import PetGallery from './PetGallery.vue';
import PlaceCards from './PlaceCards.vue';
import PlayReel from './PlayReel.vue';
import SceneChips from './SceneChips.vue';
import VisibleSprite from './VisibleSprite.vue';
import WorldPreview from './WorldPreview.vue';
import YearStory from './YearStory.vue';
import vine from '../../../src/art/ui/title-vine.webp';
import desktopIcon from '../../../src/art/ui/desktop.webp';
import giftIcon from '../../../src/art/ui/gift.webp';
import hourglassIcon from '../../../src/art/ui/hourglass.webp';
import grass from '../../../src/art/ambient/desktop-grass.webp';
import cloud from '../../../src/art/sky/cumulus.webp';
import './landing.css';
import { LANDING_PETS, localePath, SKY_SCENES } from '../../../scripts/site-content.mjs';
import { useWords } from './words';

const { lang } = useWords();
const locales = { en, ko, ja, 'zh-hans': zh };
const t = computed(() => {
  const { copy, worldCopy, sections } = locales[lang.value];
  return { ...copy, ...worldCopy, ...sections };
});
const shotUrl = (name: string) => withBase(`/shots/${generated.captureVersion}/${lang.value}/${name}.webp`);
const filmUrl = computed(() => withBase(`/shots/${generated.captureVersion}/${lang.value}/reel.mp4`));
const path = (page: string) => withBase(localePath(lang.value, page));
const paused = ref(false);
// The desktop story's points, each with the app's own painted icon; the laptop is the site's
// (public/art), painted from the same set.
const DESK_ICONS: Record<string, string> = {
  desktop: desktopIcon,
  gift: giftIcon,
  hourglass: hourglassIcon,
  laptop: withBase('/art/laptop.webp'),
};
// The album's size, as the app counts it: every kind in its books.
const albumCount = ALBUM_BOOKS.reduce((n, book) => n + catalog[book].length, 0);
const counted = (text: string) => text.replace('{count}', String(albumCount));
// Product names, the same in every language; the guide lists what each one reports.
const AGENT_TOOLS = AGENT_DEMOS.map(demo => demo.name);
// A sky scene's row (sky-moments.js) as the chips SceneChips names: the season, the weather or its
// turn, and the times of day it comes at.
const sceneWhen = (scene: { before?: string; weather: string; periods: string[]; seasons?: string[] }) => [
  ...(scene.seasons ?? []).map(season => `season:${season}`),
  scene.before ? `change:${scene.before}>${scene.weather}` : `weather:${scene.weather}`,
  `period:${scene.periods.join('|')}`,
];
</script>
<template>
  <main class="landing" :class="{ 'no-motion': paused }">
    <!-- The first screen is the yard itself, under its sky, with the way in beside it. -->
    <section class="hero" :style="{ '--cloud': `url(${cloud})`, '--grass': `url(${grass})` }">
      <div class="hero-intro">
        <p class="eyebrow">{{ t.eyebrow }}</p>
        <h1><span>{{ t.title[0] }}</span> <span>{{ t.title[1] }}</span></h1>
        <p class="lead">{{ t.lead }}</p>
        <div class="hero-actions"><a class="world-button" href="#download">{{ t.download }} <span aria-hidden="true">↓</span></a><a class="hero-more" href="#desktop">{{ t.meet }} <span aria-hidden="true">↓</span></a></div>
        <ul class="hero-facts"><li v-for="fact in t.heroFacts" :key="fact">{{ fact }}</li></ul>
        <a class="hero-agents" :href="path('/guide/agents')"><span>{{ t.heroAgents }} →</span><b v-for="tool in AGENT_TOOLS" :key="tool">{{ tool }}</b><i>{{ t.heroAgentsMore }}</i></a>
      </div>
      <WorldPreview :words="t" :paused="paused" @pause="paused = !paused" />
    </section>
    <!-- The appeal: they come out of the window and stay on the desktop all day. -->
    <section class="desk-story" id="desktop">
      <header><img class="title-vine" :src="vine" alt="" width="365" height="56" /><h2>{{ t.desk.title }}</h2><p class="section-lead">{{ t.desk.lead }}</p></header>
      <DeskStory :words="t" :paused="paused" />
      <ul class="desk-points"><li v-for="([icon, title, body]) in t.desk.points" :key="icon"><img :src="DESK_ICONS[icon]" alt="" width="64" height="64" loading="lazy" decoding="async" /><h3>{{ title }}</h3><p>{{ body }}</p></li></ul>
      <p class="desk-kind">{{ t.desk.kind }}</p>
      <p class="play-more"><a class="more" :href="path('/guide/desktop')">{{ t.desk.link }} →</a><a class="more" href="#agents">{{ t.desk.agents }} ↓</a></p>
    </section>
    <section class="work-story feature" id="agents">
      <div class="feature-text"><h2>{{ t.workTitle }}</h2><p>{{ t.workBody }}</p><ul class="work-reports"><li v-for="line in t.workReports" :key="line">{{ line }}</li></ul><p class="work-note">{{ t.workNote }}</p><a class="more" :href="path('/guide/agents')">{{ t.agentGuide }} →</a></div>
      <AgentDemo :words="t" :paused="paused" />
    </section>
    <section class="play-story" id="play">
      <header><img class="title-vine" :src="vine" alt="" width="365" height="56" /><h2>{{ t.play.title }}</h2><p class="section-lead">{{ t.play.lead }}</p></header>
      <PlayReel :src="filmUrl" :poster="shotUrl('reel')" :label="t.play.reel" :paused="paused" />
      <!-- Real captures (scripts/shots.mjs, the play pass); the first is the garden they build together. -->
      <ul class="play-shots">
        <li v-for="([name, title, body]) in t.play.shots" :key="name"><figure><a class="play-frame" :href="shotUrl(name)"><img :src="shotUrl(name)" :alt="title" loading="lazy" decoding="async" width="2472" height="1672" /></a><figcaption><b>{{ title }}</b> {{ counted(body) }}</figcaption></figure></li>
      </ul>
      <p class="play-more"><a class="more" :href="path('/guide/play')">{{ t.play.link }} →</a><span>v{{ generated.captureVersion }}</span></p>
    </section>
    <!-- The places the app ships, each in its own art: three outdoors with four seasons, one indoors. -->
    <section class="places-story" id="places">
      <header><h2>{{ t.placeCards.title }}</h2><p class="section-lead">{{ t.placeCards.lead }}</p></header>
      <PlaceCards :names="t.places" :copy="t.placeCards" />
      <p class="play-more places-more"><a class="more" :href="path('/guide/play#places')">{{ t.placeCards.link }} →</a><a class="more" :href="path('/guide/background-kit')">{{ t.placeCards.own }} →</a></p>
    </section>
    <!-- What there is to collect, and the times of year the yard changes: each with how to take part. -->
    <section class="album-story" id="album">
      <header><h2>{{ t.album.title }}</h2><p class="section-lead">{{ counted(t.album.lead) }}</p></header>
      <AlbumBooks :lang="lang" :copy="t.album" />
      <p class="play-more"><a class="more" :href="path('/guide/play#discovery-guide')">{{ t.album.link }} →</a></p>
    </section>
    <section class="seasons-story" id="seasons">
      <header><h2>{{ t.year.title }}</h2><p class="section-lead">{{ t.year.lead }}</p></header>
      <YearStory :lang="lang" :seasons="t.seasons" :copy="t.year" :recipe="t.recipe" />
      <p class="year-south">{{ t.year.gifts }}</p>
      <p class="year-south">{{ t.year.south }}</p>
      <p class="play-more"><a class="more" :href="path('/guide/play#seasonal-events')">{{ t.year.link }} →</a></p>
    </section>
    <!-- What happens without being asked: the weather's moments, and closeness level by level. -->
    <section class="moments-story" id="moments">
      <header><h2>{{ t.moments.title }}</h2><p class="section-lead">{{ t.moments.lead }}</p></header>
      <ul class="moments-list"><li v-for="scene in SKY_SCENES" :key="scene.id"><h3>{{ t.moments.items[scene.id][0] }}</h3><SceneChips :lang="lang" :when="sceneWhen(scene)" :label="t.recipe.when" /><p class="recipe-gives">{{ t.moments.items[scene.id][1] }}</p></li></ul>
      <p class="play-more"><a class="more" :href="path('/guide/play#weather')">{{ t.moments.weatherLink }} →</a></p>
      <div class="closeness">
        <h3>{{ t.moments.closenessTitle }}</h3>
        <p>{{ t.moments.closenessLead }}</p>
        <ol class="closeness-ladder"><li v-for="(text, level) in t.moments.levels" :key="level"><span class="hearts" aria-hidden="true">{{ '♥'.repeat(level + 1) }}</span><b>{{ appWord(lang, `bond.level_${level + 1}`) }}</b><p>{{ text }}</p></li></ol>
        <p class="play-more"><a class="more" :href="path('/guide/play#closeness')">{{ t.moments.link }} →</a></p>
      </div>
      <p class="moments-secret">{{ t.moments.secret }}</p>
    </section>
    <PetGallery :words="t" :guide="path('/guide/first-friend#companion-stories')" :creator="path('/guide/creator-kit')" />
    <section class="together-story feature reverse">
      <ChatDemo :words="t" :paused="paused" />
      <div class="feature-text"><h2>{{ t.togetherTitle }}</h2><p>{{ t.togetherBody }}</p><a class="more" :href="path('/guide/chat')">{{ t.togetherLink }} →</a></div>
    </section>
    <section class="connections">
      <header><h2>{{ t.connectionsTitle }}</h2><p class="section-lead">{{ t.connectionsLead }}</p></header>
      <div class="connection-layout"><div class="connection-options"><article v-for="([title, body, link], index) in t.connections" :key="link"><h3>{{ title }}</h3><p>{{ body }}</p><a class="more" :href="path(link)">{{ t.more }} →</a><a v-if="index === 0" class="more discovery-link" :href="path('/guide/play#discovery-guide')">{{ t.discoveryGuide }} →</a></article><details><summary>{{ t.connectionDetails }}</summary><p>{{ t.connectionSetup }}</p></details></div><figure class="chat-shot"><picture><source media="(max-width: 640px)" :srcset="shotUrl('mini-chat')" width="1032" height="752" /><img :src="shotUrl('friend-chat')" :alt="t.chatAlt" loading="lazy" decoding="async" width="2472" height="1672" /></picture><figcaption>v{{ generated.captureVersion }}</figcaption></figure></div>
    </section>
    <!-- For people who know ChatGPT's pets: what a Codex pet does on its own, and what PlayPets adds. -->
    <section class="codex-plus">
      <header><h2><span>{{ t.codexPlusTitle[0] }}</span> <span>{{ t.codexPlusTitle[1] }}</span></h2><p class="section-lead">{{ t.codexPlusLead }}</p></header>
      <!-- Explicit roles keep each row read as a pair after phones restyle the table as a grid. -->
      <table class="codex-compare" role="table">
        <caption class="visually-hidden">{{ t.compare.caption }}</caption>
        <thead role="rowgroup"><tr role="row"><td role="cell"></td><th scope="col" role="columnheader"><span class="compare-cast one" aria-hidden="true"><VisibleSprite equal-height pet="daisy" :scale="0.24" /></span>{{ t.compare.head[0] }}</th><th scope="col" class="ours" role="columnheader"><span class="compare-cast" aria-hidden="true"><VisibleSprite equal-height v-for="pet in LANDING_PETS" :key="pet.id" :pet="pet.id" state="wave" :scale="0.24" /></span>{{ t.compare.head[1] }}</th></tr></thead>
        <tbody role="rowgroup"><tr role="row" v-for="([label, codex, ours]) in t.compare.rows" :key="label"><th scope="row" role="rowheader">{{ label }}</th><td role="cell">{{ codex }}</td><td class="ours" role="cell">{{ counted(ours) }}</td></tr></tbody>
      </table>
      <p class="codex-source"><a href="https://learn.chatgpt.com/docs/pets">{{ t.compare.source }}</a></p>
      <p class="codex-note">{{ t.diffNote }} <a :href="path('/guide/import')">{{ t.codexPlusLink }} →</a> <a href="#play">{{ t.compare.seePlay }} ↑</a></p>
    </section>
    <section class="creator-story"><div class="creator-friend"><VisibleSprite equal-height v-for="pet in LANDING_PETS" :key="pet.id" :pet="pet.id" state="wave" :scale="0.55" /></div><div><h2>{{ t.creatorTitle }}</h2><p>{{ t.creatorBody }}</p><a class="more" :href="path('/guide/creator-kit')">{{ t.creatorLink }} →</a><p class="discovery">{{ t.discovery }} <a :href="path('/guide/import')">{{ t.discoveryLink }} →</a></p></div></section>
    <section class="quiet-details"><div><h3>{{ t.privacyTitle }}</h3><p>{{ t.privacyBody }}</p></div><details class="developer-note"><summary>{{ t.developerTitle }}</summary><p>{{ t.developerBody }}</p><a :href="withBase('/dev/')">{{ t.developerLink }} →</a></details></section>
    <section class="landing-download" id="download" :style="{ '--grass': `url(${grass})` }"><p class="eyebrow">PlayPets</p><h2>{{ t.finalTitle }}</h2><Downloads><a class="dl-secondary" :href="path('/guide/')">{{ t.guide }}</a></Downloads><div class="start-steps"><h3>{{ t.start.title }}</h3><ol><li v-for="([title, body, link]) in t.start.steps" :key="link"><b>{{ title }}</b><p>{{ body }}</p><a :href="path(link)">{{ t.more }} →</a></li></ol></div><div class="closing-links"><a :href="path(`/releases/${generated.version}`)">{{ t.releaseLabel }}, {{ generated.version }}</a><a href="https://github.com/gaerae/playpets">{{ t.github }} ↗</a></div><div class="download-cast" aria-hidden="true"><VisibleSprite equal-height v-for="pet in LANDING_PETS" :key="pet.id" :pet="pet.id" state="wave" :scale="0.4" /></div></section>
  </main>
</template>
