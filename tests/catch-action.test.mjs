import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { setAiming, setData, setGame, views } from '../src/core/state.js';
import { endFishing, setupCatch } from '../src/yard/catch.js';
import { measureYard } from '../src/yard/field.js';
import { scene } from '../src/yard/world.js';
import { element, installDom, installStorage } from './support/dom.mjs';

test('fishing action works in mini without a water click, guards tasks and follows place capability', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  installStorage(context);
  const { nodes } = installDom(context, {
    ids: ['yard', 'fish-tool', 'world', 'yard-hint', 'agent-summary', 'toast'],
    props: { rect: { width: 480, height: 320 } },
  });
  nodes.get('yard').dataset.environment = 'illustrated';
  measureYard();
  const pet = { id: 'friend', size: 112 };
  const v = { pet, px: 200, py: 150, bubble: element(), button: element() };
  views.clear();
  views.set(pet.id, v);
  setData({ pets: [pet], assets: [], statuses: {} });
  scene.world = 'woodland';
  setupCatch();
  const button = nodes.get('fish-tool');
  assert.equal(button.hidden, false);
  try {
    setGame({});
    button.dispatch('click');
    assert.equal(v.trip, undefined);
    setGame(null);
    setAiming(true);
    button.dispatch('click');
    assert.equal(v.trip, undefined);
    setAiming(false);
    button.dispatch('click');
    assert.equal(typeof v.trip?.arrive, 'function');
    const trip = v.trip;
    button.dispatch('click');
    assert.equal(v.trip, trip, 'repeated activation does not restart a trip');
    endFishing();
    scene.world = 'studio';
    nodes.get('world').dispatch('change');
    assert.equal(button.hidden, true);
    button.dispatch('click');
    assert.equal(v.trip, null);
    scene.world = 'lakeside';
    nodes.get('world').dispatch('change');
    assert.equal(button.hidden, false);
    button.dispatch('click');
    assert.equal(typeof v.trip?.arrive, 'function');
  } finally {
    endFishing();
    scene.world = 'woodland';
    setGame(null);
    setAiming(false);
    views.clear();
  }
});

test('the fishing tool sends the chosen friend rather than a nearer unselected friend', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { setSelected } = await import('../src/core/state.js');
  context.after(() => {
    endFishing();
    views.clear();
    setSelected(null);
  });
  installStorage(context);
  const { nodes } = installDom(context, {
    ids: ['yard', 'fish-tool', 'world', 'yard-hint', 'agent-summary', 'toast'],
    props: { rect: { width: 480, height: 320 } },
  });
  nodes.get('yard').dataset.environment = 'illustrated';
  measureYard();
  const chosen = { pet: { id: 'chosen', size: 112 }, px: 0, py: 0, bubble: element(), button: element() };
  const nearer = { pet: { id: 'nearer', size: 112 }, px: 340, py: 180, bubble: element(), button: element() };
  views.clear();
  views.set('chosen', chosen);
  views.set('nearer', nearer);
  setData({ pets: [chosen.pet, nearer.pet], assets: [], statuses: {} });
  setSelected('chosen');
  scene.world = 'woodland';
  setupCatch();
  await nodes.get('fish-tool').dispatch('click');
  assert.equal(typeof chosen.trip?.arrive, 'function');
  assert.equal(nearer.trip, undefined);
});
