// Shared lookups keep the hero and footer from requesting the same release twice.
const releases = new Map();
const settled = new Map();
const listeners = new Map();
const localeKey = 'playpets-locale';
const supportedLocales = new Set(['en', 'ko', 'ja', 'zh-hans']);

export function chooseSiteLocale(languages = []) {
  for (const language of languages) {
    const code = String(language).toLowerCase();
    if (code.startsWith('ko')) return 'ko';
    if (code.startsWith('ja')) return 'ja';
    if (code.startsWith('zh')) return 'zh-hans';
  }
  return 'en';
}

const siteRoot = base => (base.endsWith('/') ? base : `${base}/`);

export function localeRedirect({ base, pathname, languages = [], saved, search = '', hash = '' }) {
  const root = siteRoot(base);
  if (pathname !== root && pathname !== `${root}index.html`) return null;
  const locale = supportedLocales.has(saved) ? saved : chooseSiteLocale(languages);
  return locale === 'en' ? null : `${root}${locale}/${search}${hash}`;
}

export function localeFromTranslationLink(href, base, origin) {
  const url = new URL(href, origin);
  if (url.origin !== origin) return null;
  const root = siteRoot(base);
  if (!url.pathname.startsWith(root)) return null;
  const relative = url.pathname.slice(root.length).replace(/\/$/, '');
  if (!relative) return 'en';
  return supportedLocales.has(relative) ? relative : null;
}

export function setupSiteLocale({
  base,
  location = globalThis.location,
  navigator = globalThis.navigator,
  storage = globalThis.localStorage,
  document = globalThis.document,
}) {
  let saved;
  try {
    saved = storage.getItem(localeKey);
  } catch {}
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const redirect = localeRedirect({
    base,
    pathname: location.pathname,
    languages,
    saved,
    search: location.search,
    hash: location.hash,
  });
  if (redirect) {
    location.replace(redirect);
    return () => {};
  }
  const remember = event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor?.closest?.('.translations')) return;
    const locale = localeFromTranslationLink(anchor.href, base, location.origin);
    if (!locale) return;
    try {
      storage.setItem(localeKey, locale);
    } catch {}
  };
  document.addEventListener('click', remember, true);
  return () => document.removeEventListener('click', remember, true);
}

const releaseKey = (slug, version) => (version ? `${slug}@${version}` : slug);

export function forgetRelease(slug, version) {
  const key = releaseKey(slug, version);
  releases.delete(key);
  settled.delete(key);
}
export function watchRelease(slug, update, version) {
  const key = releaseKey(slug, version);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(update);
  if (settled.has(key)) update(settled.get(key));
  return () => {
    listeners.get(key)?.delete(update);
    if (!listeners.get(key)?.size) listeners.delete(key);
  };
}

const validVersion = version => /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version);

/** One release as the API returns it, as the pages read it; null for a tag that isn't a version. */
export function releaseFrom(payload) {
  const version = String(payload?.tag_name || '').replace(/^v/, '');
  if (!validVersion(version)) return null;
  return {
    status: 'ready',
    version,
    publishedAt: typeof payload.published_at === 'string' ? payload.published_at : '',
    files: Array.isArray(payload.assets)
      ? payload.assets.map(a => a.name).filter(name => typeof name === 'string')
      : [],
  };
}

const MISSING = { status: 'missing', version: '', files: [], publishedAt: '' };
// Slugs whose published releases the site was built with: a version not among them isn't out yet.
const known = new Set();
const settle = (key, result) => {
  settled.set(key, result);
  releases.set(key, Promise.resolve(result));
};
/** Takes the releases the site was built with (scripts/site-releases.mjs), so their lookups answer at
 * once and the browser never asks GitHub. Null (GitHub couldn't be reached then) leaves them to the browser. */
export function seedReleases(slug, built) {
  if (!built) return;
  known.add(slug);
  settle(releaseKey(slug), built.latest ?? MISSING);
  for (const result of Object.values(built.tagged)) settle(releaseKey(slug, result.version), result);
}
/** What a lookup would answer without waiting: a release the site was built with, or nothing yet. */
export const knownRelease = (slug, version) =>
  settled.get(releaseKey(slug, version)) ?? (known.has(slug) ? MISSING : undefined);

function fetchRelease(slug, version, fetcher) {
  const key = releaseKey(slug, version);
  if (!releases.has(key) && known.has(slug)) settle(key, MISSING);
  if (!releases.has(key))
    releases.set(
      key,
      (async () => {
        try {
          if (version && !validVersion(version)) throw new Error('Invalid release version');
          const endpoint = version ? `releases/tags/v${version}` : 'releases/latest';
          const response = await fetcher(`https://api.github.com/repos/${slug}/${endpoint}`, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (response.status === 404) return MISSING;
          if (!response.ok) throw new Error('Release lookup failed');
          const found = releaseFrom(await response.json());
          if (!found || (version && found.version !== version)) throw new Error('Invalid release tag');
          return found;
        } catch {
          return { status: 'error', version: '', files: [], publishedAt: '' };
        }
      })().then(result => {
        settled.set(key, result);
        for (const update of listeners.get(key) || []) update(result);
        return result;
      }),
    );
  return releases.get(key);
}

export function latestRelease(slug, fetcher = globalThis.fetch) {
  return fetchRelease(slug, undefined, fetcher);
}

export function taggedRelease(slug, version, fetcher = globalThis.fetch) {
  return fetchRelease(slug, version, fetcher);
}

export function watchReducedMotion(media, update) {
  const changed = () => update(media.matches);
  changed();
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
}

// Preserve a sprite's layout box without fetching its atlas until it approaches the viewport.
export function whenVisible(target, load, Observer = globalThis.IntersectionObserver) {
  let stopped = false;
  if (!Observer) {
    load();
    return () => {};
  }
  const observer = new Observer(
    entries => {
      if (stopped || !entries.some(entry => entry.isIntersecting)) return;
      stopped = true;
      observer.disconnect();
      load();
    },
    { rootMargin: '80px' },
  );
  observer.observe(target);
  return () => {
    stopped = true;
    observer.disconnect();
  };
}

// A pose shows its sheet only once the file is decoded; until then the friend keeps the pose it
// has, rather than an empty cell while a new strip downloads.
const decodedSheets = new Set();
export function whenDecoded(url, Picture = globalThis.Image) {
  if (!Picture || decodedSheets.has(url)) return Promise.resolve();
  const picture = new Picture();
  picture.src = url;
  return Promise.resolve()
    .then(() => picture.decode())
    .then(
      () => {
        decodedSheets.add(url);
      },
      () => {},
    );
}

// Approved 2× idle silhouette heights, measured at alpha > 64; keep pose motion intact.
export function castHeightFactor(pet) {
  const heights = { daisy: 326, clover: 337, pip: 329, miso: 325 };
  return heights[pet] ? 326 / heights[pet] : 1;
}
