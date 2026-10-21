import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const planted = [];
globalThis.playPets = {
  plant: async (...args) => {
    planted.push(args);
    return { ok: true, data: {} };
  },
};
const { setupGarden } = await import('../src/yard/garden.js');
const state = await import('../src/core/state.js');
const { setAiming, setData, setSelected, views } = state;
const { useCompanionActions, setCompanionSeason, companionAction } = await import('../src/core/companion-actions.js');
const { EDGE, geometry, measureYard, sizeOf } = await import('../src/yard/field.js');
const { release } = await import('../src/yard/trips.js');
const { scene } = await import('../src/yard/world.js');

function page(t, { builtin = true, decoded = true } = {}) {
  const { nodes } = installDom(t, { anyId: true, props: { rect: { width: 800, height: 560, left: 0, top: 0 } } });
  installStorage(t);
  keepGlobals(t, 'Image');
  globalThis.Image = class {
    complete = decoded;
    naturalWidth = decoded ? 192 : 0;
  };
  const pet = { id: 'planter', size: 112 };
  const v = {
    pet,
    asset: { place: builtin ? 'builtin' : 'folder', sourceId: 'playpets-clover' },
    px: 100,
    py: 300,
    pose: 'idle',
    bubble: element(),
  };
  scene.world = 'woodland';
  scene.season = 'spring';
  measureYard();
  views.clear();
  views.set(pet.id, v);
  setSelected(pet.id);
  setData({ pets: [pet], assets: [], garden: { seeds: 1, plants: [] }, statuses: {} });
  useCompanionActions({
    version: 1,
    characters: {
      'playpets-clover': {
        variants: {
          spring: {
            plant: {
              url: 'art/companions/clover/plant.png',
              anchor: [96, 200],
              ground: [150, 200],
              frames: [{ rect: [0, 0, 192, 208], foot: [96, 200], duration: 1800 }],
            },
          },
        },
      },
    },
  });
  setCompanionSeason('spring');
  planted.length = 0;
  setupGarden();
  setAiming('seed');
  t.after(() => {
    release(v);
    views.clear();
    setAiming(false);
    useCompanionActions({ version: 1, characters: {} });
  });
  return { nodes, v, click: () => nodes.get('yard').dispatch('click', { clientX: 400, clientY: 450 }) };
}
const settled = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

test('authored planting walks and completes its action before the existing seed command', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { v, click } = page(t);
  await click();
  assert.equal(planted.length, 0);
  assert.ok(v.trip);
  const trip = v.trip;
  v.trip = null;
  v.target = null;
  trip.arrive(v);
  assert.ok(companionAction(v, performance.now()));
  t.mock.timers.tick(1799);
  await settled();
  assert.equal(planted.length, 0);
  t.mock.timers.tick(1);
  await settled();
  assert.equal(planted.length, 1);
  assert.equal(v.doing, null);
});
test('a seed promised to a walking friend cannot be planted again by a second click', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { v, click } = page(t);
  await click();
  assert.equal(state.aiming, false);
  setAiming('seed');
  await click();
  assert.equal(planted.length, 0);
  const trip = v.trip;
  v.trip = null;
  v.target = null;
  trip.arrive(v);
  t.mock.timers.tick(1800);
  await settled();
  assert.equal(planted.length, 1);
});
test('aiming stays on while seeds remain beyond the ones already promised', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { click } = page(t);
  setData({ ...state.data, garden: { seeds: 2, plants: [] } });
  await click();
  assert.equal(state.aiming, 'seed');
});
test('a second keyboard press of the seed tool plants beside the selected friend', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes } = page(t, { builtin: false });
  await nodes.get('plant-tool').onclick({ detail: 0 });
  assert.equal(planted.length, 1, 'no pointer is needed to choose the spot');
});
for (const phase of ['walking', 'planting'])
  test(`cancelling while ${phase} never spends a seed`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { v, click } = page(t);
    await click();
    if (phase === 'planting') {
      const trip = v.trip;
      v.trip = null;
      v.target = null;
      trip.arrive(v);
    }
    release(v);
    t.mock.timers.tick(3000);
    await settled();
    assert.equal(planted.length, 0);
    assert.equal(companionAction(v, performance.now()), null);
  });
for (const mode of ['imported', 'decoding'])
  test(`${mode} friends keep the existing direct planting path`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { v, click } = page(t, { builtin: mode !== 'imported', decoded: mode !== 'decoding' });
    await click();
    assert.equal(planted.length, 1);
    assert.equal(v.trip, undefined);
  });
test('changing places before planting finishes never commits a flower elsewhere', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { v, click } = page(t);
  await click();
  const trip = v.trip;
  v.trip = null;
  v.target = null;
  trip.arrive(v);
  scene.world = 'studio';
  t.mock.timers.tick(2000);
  await settled();
  assert.equal(planted.length, 0);
});

test('Escape releases an authored planting task without spending inventory', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { v, click } = page(t);
  await click();
  const trip = v.trip;
  v.trip = null;
  v.target = null;
  trip.arrive(v);
  await document.dispatch('keydown', { key: 'Escape' });
  t.mock.timers.tick(2000);
  await settled();
  assert.equal(planted.length, 0);
  assert.equal(v.doing, null);
});
test('a failed planting save releases its actor and leaves backend inventory authoritative', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { v, click, nodes } = page(t);
  const previous = globalThis.playPets.plant;
  t.after(() => {
    globalThis.playPets.plant = previous;
  });
  globalThis.playPets.plant = async () => ({ ok: false, error: 'No seed was spent.' });
  await click();
  const trip = v.trip;
  v.trip = null;
  v.target = null;
  trip.arrive(v);
  t.mock.timers.tick(1800);
  await settled();
  assert.equal(v.doing, null);
  assert.equal(nodes.get('toast').textContent, 'No seed was spent.');
});

test('the seedling contact point reaches the chosen ground instead of the actor feet', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { v, click } = page(t);
  await click();
  const actor = geometry(v.pet);
  const footX = EDGE + v.target.x * actor.w + sizeOf(v.pet) / 2;
  const handOffset = (54 * sizeOf(v.pet)) / 192;
  assert.ok(Math.abs(footX + handOffset - 400) < 0.01);
});

test('changing season during the action cancels the old outfit placement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { v, click } = page(t);
  await click();
  const trip = v.trip;
  v.trip = null;
  v.target = null;
  trip.arrive(v);
  scene.season = 'summer';
  t.mock.timers.tick(2000);
  await settled();
  assert.equal(planted.length, 0);
});
