import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Downloads from './Downloads.vue';
import Landing from './Landing.vue';
import Mermaid from './Mermaid.vue';
import Only from './Only.vue';
import ReleaseLinks from './ReleaseLinks.vue';
import ReleaseList from './ReleaseList.vue';
import ReleaseMeta from './ReleaseMeta.vue';
import Shot from './Shot.vue';
import Since from './Since.vue';
import Sprite from './Sprite.vue';
import { setupSiteLocale } from './site-runtime.mjs';
import './style.css';
import './studio.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router, siteData }) {
    // The developer docs exist only in English, under /dev/. On a /dev/ page the language menu
    // offers translated /dev/ paths, which have no pages; this sends them to the English
    // page, whether typed, linked or clicked in the site, so the menu keeps working there.
    const base = siteData.value.base;
    const moved = (to: string) =>
      to.startsWith(base) ? base + to.slice(base.length).replace(/^(?:ko|ja|zh-hans)\/dev(\/|$)/, 'dev$1') : to;
    if (typeof window !== 'undefined') {
      setupSiteLocale({ base });
      const now = moved(location.pathname);
      if (now !== location.pathname) location.replace(now + location.search + location.hash);
      router.onBeforeRouteChange = to => {
        const next = moved(to);
        if (next === to) return;
        router.go(next);
        return false;
      };
    }
    app.component('Mermaid', Mermaid);
    app.component('Shot', Shot);
    app.component('Sprite', Sprite);
    app.component('Landing', Landing);
    app.component('Since', Since);
    app.component('Only', Only);
    app.component('Downloads', Downloads);
    app.component('ReleaseMeta', ReleaseMeta);
    app.component('ReleaseLinks', ReleaseLinks);
    app.component('ReleaseList', ReleaseList);
  },
} satisfies Theme;
