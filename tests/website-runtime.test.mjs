import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseSiteLocale,
  forgetRelease,
  knownRelease,
  latestRelease,
  localeFromTranslationLink,
  localeRedirect,
  seedReleases,
  setupSiteLocale,
  taggedRelease,
  watchReducedMotion,
  watchRelease,
  whenDecoded,
  whenVisible,
} from '../website/.vitepress/theme/site-runtime.mjs';

test('the first root visit follows the first supported browser language', () => {
  assert.equal(chooseSiteLocale(['fr-FR', 'ko-KR']), 'ko');
  assert.equal(chooseSiteLocale(['ja-JP']), 'ja');
  assert.equal(chooseSiteLocale(['zh-TW']), 'zh-hans');
  assert.equal(chooseSiteLocale(['de-DE']), 'en');
  assert.equal(
    localeRedirect({ base: '/', pathname: '/', languages: ['ko-KR'], search: '?from=readme', hash: '#download' }),
    '/ko/?from=readme#download',
  );
  assert.equal(localeRedirect({ base: '/', pathname: '/guide/', languages: ['ko-KR'] }), null);
  assert.equal(localeRedirect({ base: '/', pathname: '/', languages: ['en-US'] }), null);
});

test('a saved language outranks browser languages and translation links record only supported site homes', () => {
  assert.equal(localeRedirect({ base: '/', pathname: '/', languages: ['ko-KR'], saved: 'ja' }), '/ja/');
  assert.equal(localeRedirect({ base: '/', pathname: '/', languages: ['ko-KR'], saved: 'en' }), null);
  assert.equal(
    localeRedirect({ base: '/playpets/', pathname: '/playpets/', languages: ['zh-CN'] }),
    '/playpets/zh-hans/',
  );
  assert.equal(localeFromTranslationLink('/ko/', '/', 'https://playpets.gaerae.com'), 'ko');
  assert.equal(localeFromTranslationLink('/', '/', 'https://playpets.gaerae.com'), 'en');
  assert.equal(localeFromTranslationLink('/ko/guide/', '/', 'https://playpets.gaerae.com'), null);
  assert.equal(localeFromTranslationLink('https://example.com/ko/', '/', 'https://playpets.gaerae.com'), null);
});

test('site locale setup redirects the root and remembers an explicit language-menu choice', () => {
  let replaced = '';
  const stopAfterRedirect = setupSiteLocale({
    base: '/',
    location: {
      pathname: '/',
      search: '',
      hash: '',
      origin: 'https://playpets.gaerae.com',
      replace: to => (replaced = to),
    },
    navigator: { languages: ['ko-KR'] },
    storage: { getItem: () => null, setItem: () => assert.fail('an automatic choice is not saved') },
    document: { addEventListener: () => assert.fail('a redirect does not need a click listener') },
  });
  assert.equal(replaced, '/ko/');
  stopAfterRedirect();

  let listener, removed, saved;
  const document = {
    addEventListener: (name, fn, capture) => {
      assert.deepEqual([name, capture], ['click', true]);
      listener = fn;
    },
    removeEventListener: (name, fn, capture) => (removed = [name, fn, capture]),
  };
  const stop = setupSiteLocale({
    base: '/',
    location: { pathname: '/', search: '', hash: '', origin: 'https://playpets.gaerae.com', replace: () => {} },
    navigator: { languages: ['en-US'] },
    storage: { getItem: () => null, setItem: (key, value) => (saved = [key, value]) },
    document,
  });
  const anchor = {
    href: 'https://playpets.gaerae.com/ja/',
    closest: selector => (selector === '.translations' ? {} : null),
  };
  listener({ target: { closest: selector => (selector === 'a[href]' ? anchor : null) } });
  assert.deepEqual(saved, ['playpets-locale', 'ja']);
  stop();
  assert.deepEqual(removed, ['click', listener, true]);
});

test('offscreen sprites retain placeholders until visible and observers detach on teardown', () => {
  let entered,
    options,
    observed,
    disconnects = 0,
    loads = 0;
  class Observer {
    constructor(callback, config) {
      entered = callback;
      options = config;
    }
    observe(target) {
      observed = target;
    }
    disconnect() {
      disconnects++;
    }
  }
  const target = {};
  const detach = whenVisible(target, () => loads++, Observer);
  assert.equal(loads, 0);
  assert.equal(observed, target);
  assert.equal(options.rootMargin, '80px');
  entered([{ isIntersecting: false }]);
  assert.equal(loads, 0);
  entered([{ isIntersecting: true }]);
  entered([{ isIntersecting: true }]);
  assert.equal(loads, 1);
  detach();
  assert.ok(disconnects > 0);
  let late;
  class Later {
    constructor(callback) {
      late = callback;
    }
    observe() {}
    disconnect() {}
  }
  const stop = whenVisible(target, () => loads++, Later);
  stop();
  late([{ isIntersecting: true }]);
  assert.equal(loads, 1);
  whenVisible(target, () => loads++, null)();
  assert.equal(loads, 2, 'older browsers load the original sprite');
});

test('a sprite sheet is decoded once before a pose shows it, and a failed one still lets the pose change', async () => {
  const made = [];
  class Picture {
    constructor() {
      made.push(this);
    }
    decode() {
      return this.src.includes('broken') ? Promise.reject(new Error('decode')) : Promise.resolve();
    }
  }
  await whenDecoded('/pets/motion/pip/base/right.webp', Picture);
  assert.equal(made.length, 1);
  assert.equal(made[0].src, '/pets/motion/pip/base/right.webp');
  await whenDecoded('/pets/motion/pip/base/right.webp', Picture);
  assert.equal(made.length, 1, 'a decoded sheet is not fetched again');
  await whenDecoded('/pets/motion/pip/base/broken.webp', Picture);
  await whenDecoded('/pets/motion/pip/base/broken.webp', Picture);
  assert.equal(made.length, 3, 'a failed sheet is tried again next time');
  await whenDecoded('/pets/motion/pip/base/left.webp', null);
  assert.equal(made.length, 3, 'without images (the build) nothing waits');
});

test('duplicate download components share one lookup and accept only valid release tags', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v0.2.0', assets: [{ name: 'PlayPets_0.2.0_macos-universal.dmg' }] }),
    };
  };
  const [first, second] = await Promise.all([
    latestRelease('test/shared', fetcher),
    latestRelease('test/shared', fetcher),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.version, '0.2.0');
  assert.deepEqual(first.files, ['PlayPets_0.2.0_macos-universal.dmg']);
  for (const tag of [undefined, '', '../../other', 'vundefined']) {
    const result = await latestRelease(`test/${String(tag)}`, async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: tag, assets: [] }),
    }));
    assert.equal(result.status, 'error');
    assert.equal(result.version, '');
  }
});

test('missing and offline releases retain distinct fallback states and retry can recover', async () => {
  assert.equal((await latestRelease('test/missing', async () => ({ status: 404 }))).status, 'missing');
  const offline = async () => {
    throw new Error('offline');
  };
  assert.equal((await latestRelease('test/retry', offline)).status, 'error');
  forgetRelease('test/retry');
  assert.equal(
    (
      await latestRelease('test/retry', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: 'v1.0.0-rc.1', assets: [] }),
      }))
    ).version,
    '1.0.0-rc.1',
  );
});

test('a version page activates only the matching public tag and shares its lookup', async () => {
  let calls = 0;
  const fetcher = async url => {
    calls++;
    assert.equal(url, 'https://api.github.com/repos/test/tagged/releases/tags/v0.1.0');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.1.0',
        published_at: '2026-10-15T12:34:56Z',
        assets: [{ name: 'PlayPets_0.1.0_macos-universal.dmg' }],
      }),
    };
  };
  const [first, second] = await Promise.all([
    taggedRelease('test/tagged', '0.1.0', fetcher),
    taggedRelease('test/tagged', '0.1.0', fetcher),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.version, '0.1.0');
  assert.equal(first.publishedAt, '2026-10-15T12:34:56Z');

  let fetched = false;
  const invalid = await taggedRelease('test/tagged', '../latest', async () => {
    fetched = true;
  });
  assert.equal(invalid.status, 'error');
  assert.equal(fetched, false);
});

test('tag lookups keep separate cache and listener state from the latest release', async () => {
  const states = [];
  const stop = watchRelease('test/scoped', result => states.push(result.version), '0.1.0');
  await taggedRelease('test/scoped', '0.1.0', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ tag_name: 'v0.1.0', assets: [] }),
  }));
  await latestRelease('test/scoped', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ tag_name: 'v0.2.0', assets: [] }),
  }));
  assert.deepEqual(states, ['0.1.0']);
  forgetRelease('test/scoped', '0.1.0');
  stop();
});

test('reduced motion updates immediately, follows preference changes and detaches on teardown', () => {
  const values = [];
  let listener;
  const media = {
    matches: true,
    addEventListener: (_, fn) => {
      listener = fn;
    },
    removeEventListener: (_, fn) => {
      assert.equal(fn, listener);
      listener = undefined;
    },
  };
  const detach = watchReducedMotion(media, value => values.push(value));
  media.matches = false;
  listener();
  assert.deepEqual(values, [true, false]);
  detach();
  assert.equal(listener, undefined);
});

test('a retried release updates both download surfaces and detached listeners stop receiving results', async () => {
  const hero = [],
    footer = [];
  const detachHero = watchRelease('test/subscribed', result => hero.push(result.status));
  const detachFooter = watchRelease('test/subscribed', result => footer.push(result.status));
  await latestRelease('test/subscribed', async () => {
    throw new Error('offline');
  });
  forgetRelease('test/subscribed');
  await latestRelease('test/subscribed', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ tag_name: 'v1.0.0', assets: [] }),
  }));
  assert.deepEqual(hero, ['error', 'ready']);
  assert.deepEqual(footer, hero);
  detachHero();
  detachFooter();
  forgetRelease('test/subscribed');
  await latestRelease('test/subscribed', async () => ({ status: 404 }));
  assert.deepEqual(hero, ['error', 'ready']);
});

test('releases the site was built with answer at once, and a version not among them is not out yet', async () => {
  const release = {
    status: 'ready',
    version: '1.3.0',
    publishedAt: '2026-10-20',
    files: ['PlayPets_1.3.0_macos-universal.dmg'],
  };
  const asked = async () => {
    throw new Error('the browser asked GitHub');
  };
  seedReleases('test/built', { latest: release, tagged: { '1.3.0': release } });
  assert.deepEqual(knownRelease('test/built'), release);
  assert.deepEqual(await latestRelease('test/built', asked), release);
  assert.deepEqual(await taggedRelease('test/built', '1.3.0', asked), release);
  assert.equal(knownRelease('test/built', '1.4.0').status, 'missing');
  assert.equal((await taggedRelease('test/built', '1.4.0', asked)).status, 'missing');
  // Built while GitHub couldn't be reached: the browser looks it up.
  seedReleases('test/unbuilt', null);
  assert.equal(knownRelease('test/unbuilt'), undefined);
  assert.equal(
    (
      await latestRelease('test/unbuilt', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: 'v1.3.0', assets: [] }),
      }))
    ).version,
    '1.3.0',
  );
});
