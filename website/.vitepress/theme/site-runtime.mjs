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

export function forgetRelease(slug) {
  releases.delete(slug);
  settled.delete(slug);
}
export function watchRelease(slug, update) {
  if (!listeners.has(slug)) listeners.set(slug, new Set());
  listeners.get(slug).add(update);
  if (settled.has(slug)) update(settled.get(slug));
  return () => {
    listeners.get(slug)?.delete(update);
    if (!listeners.get(slug)?.size) listeners.delete(slug);
  };
}
export function latestRelease(slug, fetcher = globalThis.fetch) {
  if (!releases.has(slug))
    releases.set(
      slug,
      (async () => {
        try {
          const response = await fetcher(`https://api.github.com/repos/${slug}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (response.status === 404) return { status: 'missing', version: '', files: [] };
          if (!response.ok) throw new Error('Release lookup failed');
          const payload = await response.json(),
            version = String(payload.tag_name || '').replace(/^v/, '');
          if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid release tag');
          return {
            status: 'ready',
            version,
            files: Array.isArray(payload.assets)
              ? payload.assets.map(a => a.name).filter(name => typeof name === 'string')
              : [],
          };
        } catch {
          return { status: 'error', version: '', files: [] };
        }
      })().then(result => {
        settled.set(slug, result);
        for (const update of listeners.get(slug) || []) update(result);
        return result;
      }),
    );
  return releases.get(slug);
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

// Approved 2× idle silhouette heights, measured at alpha > 64; keep pose motion intact.
export function castHeightFactor(pet) {
  const heights = { daisy: 326, clover: 337, pip: 329 };
  return heights[pet] ? 326 / heights[pet] : 1;
}
