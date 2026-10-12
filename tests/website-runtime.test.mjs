import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgetRelease,
  latestRelease,
  watchReducedMotion,
  watchRelease,
  whenVisible,
} from '../website/.vitepress/theme/site-runtime.mjs';

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
