import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { setAiming, setData, setGame, views } from '../src/core/state.js';
import { endFishing, setupCatch, syncFishingAction } from '../src/yard/catch.js';
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
    syncFishingAction();
    assert.equal(button.disabled, true, 'the shared board does not offer a silent no-op during a game');
    button.dispatch('click');
    assert.equal(v.trip, undefined);
    setGame(null);
    syncFishingAction();
    assert.equal(button.disabled, false);
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
    assert.equal(button.hidden, false, 'the canonical board keeps all four destinations visible');
    assert.equal(button.disabled, true);
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
  // A chosen friend that is busy (digging, planting) keeps at it; the nearest free one goes.
  endFishing();
  chosen.trip = undefined;
  chosen.target = null;
  chosen.doing = { end() {} };
  await nodes.get('fish-tool').dispatch('click');
  assert.equal(chosen.trip, undefined, 'its dig is not called off');
  assert.equal(typeof nearer.trip?.arrive, 'function');
});

test('bundled fishing moves from its cast to a looping wait and clears on cancellation', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  installStorage(context);
  const { nodes } = installDom(context, {
    ids: ['yard', 'garden-layer', 'fish-tool', 'world', 'yard-hint', 'agent-summary', 'toast'],
    props: { rect: { width: 480, height: 320 } },
  });
  nodes.get('yard').dataset.environment = 'illustrated';
  measureYard();
  const { useCompanionActions, setCompanionSeason, companionAction } = await import('../src/core/companion-actions.js');
  const descriptor = {
    url: 'art/companions/clover/cast.png',
    frames: [{ rect: [0, 0, 192, 208], foot: [96, 200], duration: 500 }],
  };
  useCompanionActions({
    version: 1,
    characters: {
      'playpets-clover': { variants: { spring: { cast: descriptor, wait: { ...descriptor, loop: true } } } },
    },
  });
  setCompanionSeason('spring');
  const previousImage = globalThis.Image;
  context.after(() => {
    globalThis.Image = previousImage;
  });
  globalThis.Image = class {
    complete = true;
    naturalWidth = 192;
  };
  const pet = { id: 'cast-friend', size: 112 };
  const v = {
    pet,
    asset: { place: 'builtin', sourceId: 'playpets-clover' },
    px: 200,
    py: 150,
    bubble: element(),
    button: element(),
  };
  views.clear();
  views.set(pet.id, v);
  setData({ pets: [pet], assets: [], statuses: {} });
  scene.world = 'woodland';
  try {
    setupCatch();
    nodes.get('fish-tool').dispatch('click');
    const trip = v.trip;
    v.trip = null;
    v.target = null;
    trip.arrive(v);
    assert.equal(companionAction(v, performance.now())?.clip, descriptor);
    context.mock.timers.tick(500);
    assert.equal(companionAction(v, performance.now())?.clip.loop, true);
    endFishing();
    assert.equal(companionAction(v, performance.now()), null);
  } finally {
    endFishing();
    views.clear();
    useCompanionActions({ version: 1, characters: {} });
  }
});
