<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed, ref } from 'vue';
import generated from '../generated.json';
import Downloads from './Downloads.vue';
import { copy as enCopy, worldCopy as enWorld } from './landing-en';
import { copy as jaCopy, worldCopy as jaWorld } from './landing-ja';
import { copy as koCopy, worldCopy as koWorld } from './landing-ko';
import { copy as zhCopy, worldCopy as zhWorld } from './landing-zh-hans';
import PetGallery from './PetGallery.vue';
import VisibleSprite from './VisibleSprite.vue';
import WorldPreview from './WorldPreview.vue';
import './landing.css';
import { localePath } from '../../../scripts/site-content.mjs';
import { sections } from './landing-sections.mjs';
import { useWords } from './words';

const { lang } = useWords();
const localizedCopy = { en: enCopy, ko: koCopy, ja: jaCopy, 'zh-hans': zhCopy };
const localizedWorld = { en: enWorld, ko: koWorld, ja: jaWorld, 'zh-hans': zhWorld };
const t = computed(() => ({ ...localizedCopy[lang.value], ...localizedWorld[lang.value], ...sections[lang.value] }));
const shotUrl = (name: string) => withBase(`/shots/${generated.version}/${lang.value}/${name}.webp`);
const path = (page: string) => withBase(localePath(lang.value, page));
const paused = ref(false);
</script>
<template>
  <main class="landing" :class="{ 'no-motion': paused }">
    <section class="hero">
      <p class="eyebrow">{{ t.eyebrow }}</p>
      <h1><span>{{ t.title[0] }}</span><span>{{ t.title[1] }}</span></h1>
      <p class="lead">{{ t.lead }}</p>
      <div class="hero-actions"><a class="world-button" href="#download">{{ t.start }} <span aria-hidden="true">↗</span></a><a href="#companions">{{ t.meet }} <span aria-hidden="true">↓</span></a></div>
      <p class="platform-note">macOS · Windows · Linux</p>
      <WorldPreview :words="t" :shot-url="shotUrl" :version="generated.version" />
    </section>
    <PetGallery :words="t" :guide="path('/guide/first-friend')" :creator="path('/guide/creator-kit')" />
    <div class="motion-row"><button type="button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? t.resume : t.pause }}</button></div>
    <section class="mini-story feature">
      <div class="feature-text"><h2>{{ t.miniTitle }}</h2><p>{{ t.miniBody }}</p><a class="more" :href="path('/guide/desktop')">{{ t.miniLink }} →</a></div>
      <figure class="feature-shot"><img :src="shotUrl('desktop')" :alt="t.miniTitle" loading="lazy" decoding="async" width="2472" height="1672" /></figure>
    </section>
    <section class="connections">
      <header><h2>{{ t.connectionsTitle }}</h2><p class="section-lead">{{ t.connectionsLead }}</p></header>
      <div class="connection-layout"><div class="connection-options"><article v-for="[title, body, link] in t.connections" :key="link"><h3>{{ title }}</h3><p>{{ body }}</p><a class="more" :href="path(link)">{{ t.more }} →</a></article><details><summary>{{ t.connectionDetails }}</summary><p>{{ t.connectionSetup }}</p></details></div><figure class="chat-shot"><img :src="shotUrl('friend-chat')" :alt="t.chatAlt" loading="lazy" decoding="async" width="2472" height="1672" /></figure></div>
    </section>
    <section class="creator-story"><div class="creator-friend"><VisibleSprite pet="clover" state="wave" :scale="0.9" /></div><div><h2>{{ t.creatorTitle }}</h2><p>{{ t.creatorBody }}</p><a class="more" :href="path('/guide/creator-kit')">{{ t.creatorLink }} →</a><p class="discovery">{{ t.discovery }}</p></div></section>
    <section class="quiet-details"><div><h3>{{ t.privacyTitle }}</h3><p>{{ t.privacyBody }}</p></div><details class="developer-note"><summary>{{ t.developerTitle }}</summary><p>{{ t.developerBody }}</p><a :href="withBase('/dev/')">{{ t.developerLink }} →</a></details></section>
    <section class="landing-download" id="download"><p class="eyebrow">PlayPets</p><h2>{{ t.finalTitle }}</h2><Downloads><a class="dl-secondary" :href="path('/guide/')">{{ t.guide }}</a></Downloads><div class="closing-links"><a :href="path(`/releases/${generated.version}`)">{{ t.releaseLabel }} · {{ generated.version }}</a><a href="https://github.com/gaerae/playpets">{{ t.github }} ↗</a></div></section>
  </main>
</template>
