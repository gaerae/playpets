// Shared lookups keep the hero and footer from requesting the same release twice.
const releases = new Map();
const settled = new Map();
const listeners = new Map();
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
