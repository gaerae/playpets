// The published releases the download buttons point at, looked up once while the site is built
// (with the workflow's token, so the browser's lookup limit never applies). The pages workflow runs
// again when a release is published, so the links name its files from then on.
import { releaseFrom } from '../website/.vitepress/theme/site-runtime.mjs';

/** { latest, tagged: { version: release } } of the published releases, or null when GitHub can't
 * be reached: the pages then look the release up in the browser. Drafts are left out. */
export async function publishedReleases(slug, { fetcher = globalThis.fetch, token = '' } = {}) {
  const get = async path => {
    const response = await fetcher(`https://api.github.com/repos/${slug}/${path}`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`);
    return response.json();
  };
  try {
    const tagged = {};
    for (let page = 1; ; page++) {
      const list = (await get(`releases?per_page=100&page=${page}`)) ?? [];
      for (const item of list) {
        const release = !item.draft && releaseFrom(item);
        if (release) tagged[release.version] = release;
      }
      if (list.length < 100) break;
    }
    const latest = await get('releases/latest');
    return { latest: latest && releaseFrom(latest), tagged };
  } catch (error) {
    console.warn(`Release lookup skipped, the pages will look it up in the browser: ${error.message}`);
    return null;
  }
}
