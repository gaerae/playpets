<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed, ref } from 'vue';
import generated from '../generated.json';
import AgentDemo from './AgentDemo.vue';
import { AGENT_DEMOS } from './agent-demo.mjs';
import ChatDemo from './ChatDemo.vue';
import Downloads from './Downloads.vue';
import * as en from './landing-en';
import * as ja from './landing-ja';
import * as ko from './landing-ko';
import * as zh from './landing-zh-hans';
import PetGallery from './PetGallery.vue';
import VisibleSprite from './VisibleSprite.vue';
import WorldPreview from './WorldPreview.vue';
import './landing.css';
import { LANDING_PETS, localePath } from '../../../scripts/site-content.mjs';
import { useWords } from './words';

const { lang } = useWords();
const locales = { en, ko, ja, 'zh-hans': zh };
const t = computed(() => {
  const { copy, worldCopy, sections } = locales[lang.value];
  return { ...copy, ...worldCopy, ...sections };
});
const shotUrl = (name: string) => withBase(`/shots/${generated.captureVersion}/${lang.value}/${name}.webp`);
const path = (page: string) => withBase(localePath(lang.value, page));
const paused = ref(false);
// Product names, the same in every language; the guide lists what each one reports.
const AGENT_TOOLS = AGENT_DEMOS.map(demo => demo.name);
</script>
<template>
  <main class="landing" :class="{ 'no-motion': paused }">
    <section class="hero">
      <div class="hero-intro">
      <p class="eyebrow">{{ t.eyebrow }}</p>
      <h1><span>{{ t.title[0] }}</span> <span>{{ t.title[1] }}</span></h1>
      <p class="lead">{{ t.lead }}</p>
      <div class="hero-actions"><a class="world-button" href="#download">{{ t.download }} <span aria-hidden="true">↓</span></a><a href="#companions">{{ t.meet }} <span aria-hidden="true">↓</span></a></div>
      <ul class="hero-facts"><li v-for="fact in t.heroFacts" :key="fact">{{ fact }}</li></ul>
      <a class="hero-agents" :href="path('/guide/agents')"><span>{{ t.heroAgents }} →</span><b v-for="tool in AGENT_TOOLS" :key="tool">{{ tool }}</b></a>
      </div>
      <WorldPreview :words="t" :paused="paused" @pause="paused = !paused" />
    </section>
    <PetGallery :words="t" :guide="path('/guide/first-friend#companion-stories')" :creator="path('/guide/creator-kit')" />
    <section class="mini-story feature">
      <div class="feature-text"><h2>{{ t.miniTitle }}</h2><p>{{ t.miniBody }}</p><a class="more" :href="path('/guide/play')">{{ t.miniLink }} →</a><a class="more" :href="path('/guide/desktop')">{{ t.miniDesktop }} →</a></div>
      <figure class="feature-shot"><img :src="shotUrl('mini')" :alt="t.miniTitle" loading="lazy" decoding="async" width="1032" height="752" /><figcaption>v{{ generated.captureVersion }}</figcaption></figure>
    </section>
    <section class="together-story feature reverse">
      <ChatDemo :words="t" :paused="paused" />
      <div class="feature-text"><h2>{{ t.togetherTitle }}</h2><p>{{ t.togetherBody }}</p><a class="more" :href="path('/guide/chat')">{{ t.togetherLink }} →</a></div>
    </section>
    <section class="connections">
      <header><h2>{{ t.connectionsTitle }}</h2><p class="section-lead">{{ t.connectionsLead }}</p></header>
      <div class="connection-layout"><div class="connection-options"><article v-for="([title, body, link], index) in t.connections" :key="link"><h3>{{ title }}</h3><p>{{ body }}</p><a class="more" :href="path(link)">{{ t.more }} →</a><a v-if="index === 0" class="more discovery-link" :href="path('/guide/play#discovery-guide')">{{ t.discoveryGuide }} →</a></article><details><summary>{{ t.connectionDetails }}</summary><p>{{ t.connectionSetup }}</p></details></div><figure class="chat-shot"><picture><source media="(max-width: 640px)" :srcset="shotUrl('mini-chat')" width="1032" height="752" /><img :src="shotUrl('friend-chat')" :alt="t.chatAlt" loading="lazy" decoding="async" width="2472" height="1672" /></picture><figcaption>v{{ generated.captureVersion }}</figcaption></figure></div>
    </section>
    <section class="work-story feature">
      <div class="feature-text"><h2>{{ t.workTitle }}</h2><p>{{ t.workBody }}</p><p class="work-note">{{ t.workNote }}</p><a class="more" :href="path('/guide/agents')">{{ t.agentGuide }} →</a></div>
      <AgentDemo :words="t" :paused="paused" />
    </section>
    <section class="creator-story"><div class="creator-friend"><VisibleSprite equal-height v-for="pet in LANDING_PETS" :key="pet.id" :pet="pet.id" state="wave" :scale="0.55" /></div><div><h2>{{ t.creatorTitle }}</h2><p>{{ t.creatorBody }}</p><a class="more" :href="path('/guide/creator-kit')">{{ t.creatorLink }} →</a><p class="discovery">{{ t.discovery }} <a :href="path('/guide/import')">{{ t.discoveryLink }} →</a></p></div></section>
    <section class="quiet-details"><div><h3>{{ t.privacyTitle }}</h3><p>{{ t.privacyBody }}</p></div><details class="developer-note"><summary>{{ t.developerTitle }}</summary><p>{{ t.developerBody }}</p><a :href="withBase('/dev/')">{{ t.developerLink }} →</a></details></section>
    <section class="landing-download" id="download"><p class="eyebrow">PlayPets</p><h2>{{ t.finalTitle }}</h2><Downloads><a class="dl-secondary" :href="path('/guide/')">{{ t.guide }}</a></Downloads><div class="closing-links"><a :href="path(`/releases/${generated.version}`)">{{ t.releaseLabel }}, {{ generated.version }}</a><a href="https://github.com/gaerae/playpets">{{ t.github }} ↗</a></div></section>
  </main>
</template>
