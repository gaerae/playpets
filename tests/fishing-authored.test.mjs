import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const requests = [];
globalThis.playPets = {
  catch: () => new Promise(resolve => requests.push(resolve)),
  befriend: async () => ({ ok: true, data: {} }),
};
const fishing = await import('../src/yard/catch.js');
const { setData, setSelected, views } = await import('../src/core/state.js');
const { companionAction, setCompanionSeason, useCompanionActions } = await import('../src/core/companion-actions.js');
const { reduced } = await import('../src/core/sprites.js');
const { measureYard } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');
const settled = async () => {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
};

function page(t, { imported = false, decoded = true, tip = true } = {}) {
  const previousReduced = reduced.matches;
  t.after(() => {
    fishing.endFishing();
    views.clear();
    reduced.matches = previousReduced;
    useCompanionActions({ version: 1, characters: {} });
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installStorage(t);
  keepGlobals(t, 'Image');
  globalThis.Image = class {
    complete = decoded;
    naturalWidth = decoded ? 192 : 0;
  };
  const { nodes } = installDom(t, {
    anyId: true,
    ids: ['yard', 'catch-card', 'fish-tool', 'garden-layer'],
    props: { rect: { width: 800, height: 560 } },
  });
  nodes.get('yard').dataset.environment = 'illustrated';
  nodes.get('catch-card').querySelector = () => element();
  measureYard();
  scene.world = 'woodland';
  const pet = { id: 'angler', size: 112 };
  const v = {
    pet,
    asset: { place: imported ? 'folder' : 'builtin', sourceId: 'playpets-clover' },
    px: 200,
    py: 300,
    z: 45,
    pose: 'idle',
    bubble: element(),
    button: element(),
  };
  views.clear();
  views.set(pet.id, v);
  setSelected(null);
  setData({ pets: [pet], assets: [], statuses: {}, garden: { plants: [], decor: [], trees: [] } });
  const frame = (x, y) => ({ rect: [0, 0, 192, 208], foot: [96, 199], duration: 100, ...(tip ? { tip: [x, y] } : {}) });
  const clip = {
    url: 'art/companions/clover/fishing.png',
    heldTool: true,
    anchor: [96, 199],
    frames: [frame(145, 30), frame(175, 65)],
  };
  useCompanionActions({
    version: 1,
    characters: {
      'playpets-clover': { variants: { spring: { cast: clip, wait: { ...clip, loop: true }, reel: clip } } },
    },
  });
  setCompanionSeason('spring');
  requests.length = 0;
  fishing.setupCatch();
  nodes.get('fish-tool').dispatch('click');
  const trip = v.trip;
  v.trip = null;
  v.target = null;
  trip.arrive(v);
  const [rod, line, float] = nodes.get('garden-layer').children;
  return { v, rod, line, float };
}

test('painted tackle replaces the loose rod and updates its line only when a tip changes', t => {
  const { v, rod, line } = page(t);
  const action = companionAction(v, performance.now());
  fishing.syncFishingArtwork(action.since);
  assert.equal(rod.hasAttribute('hidden'), true);
  assert.ok(line.innerHTML.includes(`M${v.px + (145 * 112) / 192} ${v.py + (30 * 112) / 192}`));
  let writes = 0;
  let markup = line.innerHTML;
  Object.defineProperty(line, 'innerHTML', {
    get: () => markup,
    set: value => {
      markup = value;
      writes++;
    },
  });
  fishing.syncFishingArtwork(action.since + 20);
  assert.equal(writes, 0);
  fishing.soloFishing(action.since + 120);
  assert.equal(writes, 1);
  fishing.syncFishingArtwork(action.since + 130);
  assert.equal(writes, 1);
  const paintedLine = line.innerHTML;
  setCompanionSeason('summer');
  fishing.syncFishingArtwork(action.since + 140);
  assert.equal(rod.hasAttribute('hidden'), false, 'a missing seasonal clip restores the original prop');
  assert.notEqual(line.innerHTML, paintedLine, 'the restored rod also restores its own line geometry');
});

test('reduced motion keeps the line on the first displayed authored frame', t => {
  const { v, rod, line } = page(t);
  reduced.matches = true;
  const action = companionAction(v, performance.now());
  fishing.syncFishingArtwork(action.since + 120);
  assert.equal(rod.hasAttribute('hidden'), true);
  assert.ok(line.innerHTML.includes(`M${v.px + (145 * 112) / 192} ${v.py + (30 * 112) / 192}`));
});
for (const mode of ['imported', 'decoding', 'missing-tip'])
  test(`${mode} fishing keeps the canonical tackle`, t => {
    const { rod } = page(t, {
      imported: mode === 'imported',
      decoded: mode !== 'decoding',
      tip: mode !== 'missing-tip',
    });
    fishing.syncFishingArtwork(performance.now());
    assert.equal(rod.hasAttribute('hidden'), false);
  });

test('authored reeling retains its line until the saved catch is revealed, then clears all tackle', async t => {
  t.mock.method(Math, 'random', () => 0);
  const { v, rod, line, float } = page(t);
  t.mock.timers.tick(3200);
  await float.dispatch('click');
  assert.equal(requests.length, 1);
  assert.notEqual(line.removed, true);
  assert.notEqual(rod.removed, true);
  assert.equal(rod.hasAttribute('hidden'), true);
  t.mock.timers.tick(200);
  requests[0]({ ok: true, data: { first: false } });
  await settled();
  assert.equal(line.removed, true);
  assert.equal(rod.removed, true);
  assert.equal(float.removed, true);
  assert.equal(v.doing, null);
});

test('cancelling authored fishing removes tackle and cannot repaint it later', t => {
  const { rod, line } = page(t);
  fishing.endFishing();
  const markup = line.innerHTML;
  fishing.syncFishingArtwork(performance.now() + 500);
  assert.equal(rod.removed, true);
  assert.equal(line.removed, true);
  assert.equal(line.innerHTML, markup);
});

test('a cast expiry sampled before its wait timer leaves only hidden cached fallback tackle', t => {
  const { v, rod, line } = page(t);
  const cast = companionAction(v, performance.now());
  fishing.syncFishingArtwork(cast.since + cast.duration + 1);
  assert.equal(rod.hasAttribute('hidden'), false, 'an expired action temporarily uses canonical tackle');
  assert.match(rod.innerHTML, /<image /);
  t.mock.timers.tick(cast.duration);
  const wait = companionAction(v, performance.now());
  assert.equal(wait.clip.loop, true);
  fishing.syncFishingArtwork(performance.now());
  assert.equal(rod.hasAttribute('hidden'), true, 'the painted wait hides the whole fallback SVG');
  assert.match(rod.innerHTML, /<image /, 'hidden cached content does not mean a duplicate rod is visible');
  assert.match(line.innerHTML, /<path d="M/);
});
