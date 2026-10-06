import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Downloads from './Downloads.vue';
import Landing from './Landing.vue';
import Mermaid from './Mermaid.vue';
import ReleaseLinks from './ReleaseLinks.vue';
import ReleaseList from './ReleaseList.vue';
import ReleaseMeta from './ReleaseMeta.vue';
import Shot from './Shot.vue';
import Since from './Since.vue';
import Sprite from './Sprite.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router }) {
    // The developer docs moved to /en/dev/ when they became English-only. Old addresses (/dev/…, and
    // the language menu's /zh-hans/dev/…) lead there, whether typed, linked or clicked in the site.
    const moved = (to: string) => to.replace(/^(\/playpets)\/(?:zh-hans\/)?dev(\/|$)/, '$1/en/dev$2');
    if (typeof window !== 'undefined') {
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
    app.component('Downloads', Downloads);
    app.component('ReleaseMeta', ReleaseMeta);
    app.component('ReleaseLinks', ReleaseLinks);
    app.component('ReleaseList', ReleaseList);
  },
} satisfies Theme;
