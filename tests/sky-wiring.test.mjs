// The scene module (yard/sky.js) owns the scene; what a new place or a new season means for games,
// fishing, the garden and the friends is the entry point's, handed in through setupSky.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { installDom, installStorage, keepGlobals } from './support/dom.mjs';

// The app keeps the choices (setScene, in state.json); this records what it was given.
const kept = {};
globalThis.playPets = {
  setScene: async (key, value) => {
    kept[key] = value;
    return { ok: true, data: null };
  },
};
const settled = () => new Promise(resolve => setImmediate(resolve));

test('the scene module does not reach into games, fishing, the garden or the friends', async () => {
  const source = await readFile('src/yard/sky.js', 'utf8');
  for (const module of ['play', 'catch', 'garden', 'decor', 'hint', 'views', 'trips'])
    assert.ok(!source.includes(`from './${module}.js'`), `sky.js imports ${module}.js`);
});

test("the yard has the app's state before the sky reads the place and weather saved in it", async () => {
  const source = await readFile('src/app.js', 'utf8');
  // At the top level, as the module starts; refresh() calls it too, later.
  const loaded = source.search(/^setData\(await call\('bootstrap'\)/m),
    content = source.search(/^await loadContent\(/m),
    sky = source.search(/^setupSky\(/m);
  assert.ok(loaded >= 0 && content >= 0 && sky >= 0);
  assert.ok(loaded < sky, 'setupSky runs before the first bootstrap, so a restart forgets the scene');
  // The old backgrounds are moved by loadContent, which has to know whose they are.
  assert.ok(loaded < content, 'loadContent runs before the first bootstrap');
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
  assert.equal((await import('../src/core/state.js')).api, globalThis.playPets);
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
  await settled();
  assert.equal(kept.world, 'studio');
  assert.equal(storage.getItem('world'), null, 'not in the webview');
  assert.ok(nodes.get('yard').classList.contains('world-studio'));

  log.length = 0;
  nodes.get('scene-season').value = 'winter';
  nodes.get('scene-season').onchange();
  assert.deepEqual(log, ['picked', 'season:winter']);
  await settled();
  assert.equal(kept.season, 'winter');
  assert.equal(nodes.get('scene-season').value, 'winter');
  nodes.get('scene-season').value = 'spring';
  nodes.get('scene-season').onchange();
  assert.equal(document.getElementById('season'), null, 'the Settings duplicate is absent');
  await settled();
  assert.equal(kept.season, 'spring');
  assert.equal(scene.season, 'spring');
  nodes.get('weather').value = 'snow';
  nodes.get('weather').onchange();
  assert.equal(scene.weather, 'snow');
  assert.equal(scene.season, 'spring');
  await settled();
  assert.equal(kept.season, 'spring');
  assert.equal(nodes.get('scene-season').value, 'spring');
  nodes.get('scene-season').value = 'winter';
  nodes.get('scene-season').onchange();
  nodes.get('weather').value = 'clear';
  nodes.get('weather').onchange();
  assert.equal(scene.season, 'winter');
  assert.equal(scene.weather, 'clear');
});
