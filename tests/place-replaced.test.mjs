// A place that gave way to another (yard/worlds.js): a choice saved there opens the place that
// replaced it, and is saved again as that place.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom, installStorage, keepGlobals } from './support/dom.mjs';

const kept = {};
globalThis.playPets = {
  setScene: async (key, value) => {
    kept[key] = value;
    return { ok: true, data: null };
  },
};
const settled = () => new Promise(resolve => setImmediate(resolve));
const anything = () => new Proxy(() => anything(), { get: (_, key) => (key === 'then' ? undefined : anything()) });

test('the living room opens as the garden workshop, which replaced it', async () => {
  const { replacedBy, worldFor } = await import('../src/yard/worlds.js');
  assert.equal(worldFor('studio').id, 'workshop');
  assert.equal(worldFor('workshop').id, 'workshop');
  // Only a replaced place is saved over (sky.js setupSky); one never released keeps its save.
  assert.equal(replacedBy('studio'), 'workshop');
  assert.equal(replacedBy('workshop'), null);
  assert.equal(replacedBy('nowhere'), null);
});

test('a scene saved in the living room starts in the garden workshop and is saved there', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { nodes } = installDom(t, { anyId: true, props: { getContext: () => anything() } });
  installStorage(t);
  keepGlobals(t, 'ResizeObserver', 'Image', 'window');
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.Image = class {
    set src(_) {}
    decode() {
      return Promise.reject(new Error('no pictures here'));
    }
  };
  globalThis.window = { devicePixelRatio: 1 };
  const { setData } = await import('../src/core/state.js');
  setData({ scene: { world: 'studio' } });
  const { setupSky } = await import('../src/yard/sky.js');
  const { scene } = await import('../src/yard/world.js');
  setupSky();
  assert.equal(scene.world, 'workshop');
  assert.equal(nodes.get('world').value, 'workshop');
  await settled();
  assert.equal(kept.world, 'workshop');
});
