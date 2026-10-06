// Every release page, for the lists: version, date, headline and address, newest first.
import { createContentLoader } from 'vitepress';

export interface Release {
  url: string;
  lang: string;
  version: string;
  date: string;
  headline: string;
}

declare const data: Release[];

export { data };

const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map(v => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return 0;
};

export default createContentLoader('**/releases/*.md', {
  transform: pages =>
    pages
      .filter(p => p.frontmatter.version)
      .map(p => ({
        url: p.url,
        lang: p.url.match(/^\/(en|zh-hans)\//)?.[1] ?? 'ko',
        version: String(p.frontmatter.version),
        date: String(p.frontmatter.date ?? ''),
        headline: String(p.frontmatter.headline ?? ''),
      }))
      .sort((a, b) => newer(a.version, b.version)),
});
