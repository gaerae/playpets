import assert from 'node:assert/strict';
import test from 'node:test';
import { catalog } from './support/content.mjs';
import { installDom, installStorage } from './support/dom.mjs';

const catches = [];
globalThis.playPets = {
  catch: () => new Promise(resolve => catches.push(resolve)),
  befriend: async () => ({ ok: true, data: { up: false } }),
};
globalThis.matchMedia = () => ({ matches: true });
installStorage();
const { setData, views } = await import('../src/core/state.js');
const { setupCatch, endFishing } = await import('../src/yard/catch.js');
const { setScenery } = await import('../src/yard/world.js');

test('a saved bug catch has a decorative net that expires or clears on a scene transition', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes, element } = installDom(context, {
    ids: ['yard', 'catch-card', 'toast', 'yard-hint', 'agent-summary'],
    props: { rect: { width: 800, height: 560 } },
  });
  nodes.get('catch-card').querySelector = () => element();
  const pet = { id: 'friend', size: 112 },
    view = { pet, px: 100, py: 200, z: 40, pose: 'idle', bubble: element(), button: element() };
  views.set(pet.id, view);
  setData({ pets: [pet], assets: [], statuses: {} });
  setScenery({ catchAt: () => ({ species: catalog.bugs[0].id, x: 100, y: 200 }) });
  setupCatch();
  try {
    for (const cleanup of ['timeout', 'transition']) {
      const yard = nodes.get('yard');
      yard.dispatch('click', { clientX: 100, clientY: 200 });
      assert.ok(
        view.button.children.every(node => node.removed),
        'pending saves do not display a success net',
      );
      catches.shift()({ ok: true, data: { first: false, entry: { count: 1 } } });
      for (let turn = 0; turn < 6; turn++) await Promise.resolve();
      const net = view.button.children.at(-1);
      assert.equal(net?.className, 'bug-net', 'the saved catch has a visible net beside its friend');
      assert.equal(net.getAttribute('aria-hidden'), 'true');
      assert.equal(net.removed, undefined);
      if (cleanup === 'timeout') context.mock.timers.tick(900);
      else endFishing();
      assert.equal(net.removed, true, `${cleanup} removes the capture tool`);
    }
  } finally {
    endFishing();
    views.clear();
  }
});
