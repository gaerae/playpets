import assert from 'node:assert/strict';
import test from 'node:test';
import { studioPanelForHash } from '../website/.vitepress/theme/studio-flow.mjs';

test('existing studio deep links open the matching tool rather than a hidden panel', () => {
  assert.equal(studioPanelForHash('#pet-package-title', 'pet'), 'package');
  assert.equal(studioPanelForHash('#custom-prompts', 'pet'), 'custom');
  assert.equal(studioPanelForHash('#official-kit', 'pet'), 'sample');
  assert.equal(studioPanelForHash('#studio-images', 'background'), 'images');
  assert.equal(studioPanelForHash('#studio-export', 'background'), 'export');
  assert.equal(studioPanelForHash('#unrelated', 'background'), 'layout');
  assert.equal(studioPanelForHash('', 'pet'), 'sample');
});

test('pet IDs are automatic, portable and distinct from the starter identity', async () => {
  const { petIdFromName } = await import('../website/.vitepress/theme/studio-flow.mjs');
  assert.equal(petIdFromName('My Friend', 'abcd1234'), 'my-friend-abcd1234');
  assert.equal(petIdFromName('新しい友達', 'abcd1234'), 'pet-abcd1234');
  assert.notEqual(petIdFromName('Clover', 'abcd1234'), 'playpets-clover');
  assert.match(petIdFromName('A'.repeat(100), 'abcd1234'), /^[a-z0-9][a-z0-9_-]{0,63}$/);
});

test('studio tabs retain the router entry state and existing query when changing anchors', async () => {
  const { replaceStudioHash } = await import('../website/.vitepress/theme/studio-flow.mjs');
  const state = { scrollPosition: [0, 200] };
  let entry;
  const history = {
    state,
    replaceState: (...args) => {
      entry = args;
    },
  };
  replaceStudioHash('#pet-package-title', {
    history,
    location: { pathname: '/ko/guide/creator-kit', search: '?kit=clover' },
  });
  assert.equal(entry[0], state);
  assert.equal(entry[2], '/ko/guide/creator-kit?kit=clover#pet-package-title');
});

test('background starters provide valid independent layouts without pretending to provide artwork', async () => {
  const { backgroundStarter } = await import('../website/.vitepress/theme/studio-flow.mjs');
  const { validateBackgroundGeometry } = await import('../src/yard/background-pack.js');
  for (const id of ['garden', 'lakeside', 'interior']) {
    const layout = backgroundStarter(id);
    validateBackgroundGeometry(layout);
    assert.ok(!('images' in layout));
    assert.ok(!('name' in layout));
  }
  assert.equal(backgroundStarter('garden').water, null);
  assert.ok(backgroundStarter('lakeside').fishingSpot);
  assert.equal(backgroundStarter('interior').sky, false);
  assert.ok(backgroundStarter('interior').windows.length);
  const original = backgroundStarter('interior');
  original.windows[0].x = 0;
  assert.notEqual(backgroundStarter('interior').windows[0].x, 0);
  assert.throws(() => backgroundStarter('unknown'));
});

test('background export readiness points to the field that needs attention', async () => {
  const { backgroundReadiness } = await import('../website/.vitepress/theme/studio-flow.mjs');
  const result = backgroundReadiness({ name: ' ', base: null, geometryError: 'invalid', bytes: 33, maxBytes: 32 });
  assert.deepEqual(
    result.map(row => [row.key, row.phase, row.ok]),
    [
      ['name', 'layout', false],
      ['image', 'images', false],
      ['geometry', 'layout', false],
      ['budget', 'images', false],
    ],
  );
  assert.ok(
    backgroundReadiness({ name: 'Garden', base: 'png', geometryError: '', bytes: 32, maxBytes: 32 }).every(
      row => row.ok,
    ),
  );
});

test('background import instructions use the same menu names as the app', async () => {
  const { backgroundCopy } = await import('../website/.vitepress/theme/background-copy.js');
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    const { strings } = await import(`../src/core/strings/${lang}.js`);
    assert.ok(backgroundCopy[lang].ready.includes(strings['controls.scene']), lang);
    assert.ok(backgroundCopy[lang].ready.includes(strings['background.import']), lang);
  }
});
