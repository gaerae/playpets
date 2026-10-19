// The scene module (yard/sky.js) owns the scene; what a new place or a new season means for games,
// fishing, the garden and the friends is the entry point's, handed in through setupSky.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { installDom, installStorage, keepGlobals } from './support/dom.mjs';

test('the scene module does not reach into games, fishing, the garden or the friends', async () => {
  const source = await readFile('src/yard/sky.js', 'utf8');
  for (const module of ['play', 'catch', 'garden', 'decor', 'hint', 'views', 'trips'])
    assert.ok(!source.includes(`from './${module}.js'`), `sky.js imports ${module}.js`);
});

// A canvas context that accepts any drawing call and gives back another such object.
const anything = () => new Proxy(() => anything(), { get: (_, key) => (key === 'then' ? undefined : anything()) });

test('setupSky hands world and season changes to the entry point, around its own work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { nodes } = installDom(t, { anyId: true, props: { getContext: () => anything() } });
  const lookup = document.getElementById;
  document.getElementById = id => (id === 'season' ? null : lookup(id));
  const storage = installStorage(t);
  keepGlobals(t, 'ResizeObserver', 'Image', 'window');
  globalThis.ResizeObserver = class {
    observe() {}
  };
  // No picture ever loads here: the yard keeps its painted fallback.
  globalThis.Image = class {
    set src(_) {}
    decode() {
      return Promise.reject(new Error('no pictures here'));
    }
  };
  globalThis.window = { devicePixelRatio: 1 };
  const { setupSky } = await import('../src/yard/sky.js');
  const { scene } = await import('../src/yard/world.js');
  const log = [];
  setupSky({
    seasonChanged: season => log.push(`season:${season}`),
    seasonPicked: () => log.push('picked'),
    worldChanged: enter => {
      log.push(`leaving:${scene.world}`);
      enter();
      log.push(`entered:${scene.world}`);
    },
  });
  assert.equal(scene.world, 'woodland');
  assert.equal(scene.season, 'spring');
  assert.equal(scene.period, 'day');
  assert.equal(scene.weather, 'clear');
  log.length = 0;

  nodes.get('world').value = 'studio';
  nodes.get('world').onchange();
  assert.equal(log[0], 'leaving:woodland');
  assert.equal(log.at(-1), 'entered:studio');
  assert.ok(
    log.slice(1, -1).every(entry => entry.startsWith('season:')),
    'the scene repaints between the two halves',
  );
  assert.equal(storage.getItem('world'), 'studio');
  assert.ok(nodes.get('yard').classList.contains('world-studio'));

  log.length = 0;
  nodes.get('scene-season').value = 'winter';
  nodes.get('scene-season').onchange();
  assert.deepEqual(log, ['picked', 'season:winter']);
  assert.equal(storage.getItem('season'), 'winter');
  assert.equal(nodes.get('scene-season').value, 'winter');
  nodes.get('scene-season').value = 'spring';
  nodes.get('scene-season').onchange();
  assert.equal(document.getElementById('season'), null, 'the Settings duplicate is absent');
  assert.equal(storage.getItem('season'), 'spring');
  assert.equal(scene.season, 'spring');
  nodes.get('weather').value = 'snow';
  nodes.get('weather').onchange();
  assert.equal(scene.weather, 'snow');
  assert.equal(scene.season, 'spring');
  assert.equal(storage.getItem('season'), 'spring');
  assert.equal(nodes.get('scene-season').value, 'spring');
  nodes.get('scene-season').value = 'winter';
  nodes.get('scene-season').onchange();
  nodes.get('weather').value = 'clear';
  nodes.get('weather').onchange();
  assert.equal(scene.season, 'winter');
  assert.equal(scene.weather, 'clear');
});
