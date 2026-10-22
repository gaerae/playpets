import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const commands = [];
let resolveDig;
globalThis.playPets = {
  dig: async (...args) => {
    commands.push(args);
    return new Promise(resolve => {
      resolveDig = resolve;
    });
  },
};
const { sendDiscovery, setupDiscovery, beginDiscovery, cancelDiscovery, syncDiscovery } = await import(
  '../src/yard/discovery.js'
);
const state = await import('../src/core/state.js');
const { setData, setSelected, views } = state;
const { measureYard } = await import('../src/yard/field.js');
const { release } = await import('../src/yard/trips.js');
const { useWorlds } = await import('../src/yard/worlds.js');
const { scene } = await import('../src/yard/world.js');

function fixture(t) {
  let v;
  t.after(() => {
    if (v) release(v);
    views.clear();
    cancelDiscovery();
  });
  installDom(t, { anyId: true });
  installStorage(t);
  keepGlobals(t, 'setTimeout', 'clearTimeout');
  const timers = [];
  globalThis.setTimeout = fn => {
    timers.push(fn);
    return timers.length;
  };
  globalThis.clearTimeout = () => {};
  document.getElementById('yard').getBoundingClientRect = () => ({ width: 1000, height: 700, left: 0, top: 0 });
  measureYard();
  useWorlds([{ id: 'woodland', capabilities: { soil: true, sky: true, fishing: false }, geometry: { fieldTop: 0.6 } }]);
  scene.world = 'woodland';
  const pet = { id: 'friend', size: 112, name: 'Clover' };
  v = { pet, px: 200, py: 400, x: 0.2, y: 0.5, pose: 'idle', bubble: element('span') };
  views.clear();
  views.set(pet.id, v);
  setData({
    pets: [pet],
    garden: { plants: [], decor: [], trees: [] },
    album: { treasures: {} },
    statuses: {},
    busy: [],
  });
  setSelected(pet.id);
  commands.length = 0;
  return { v, timers };
}

test('walking or cancelling before arrival never rolls or awards a discovery', async t => {
  const { v } = fixture(t);
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const trip = v.trip;
  assert.ok(v.target);
  assert.equal(commands.length, 0);
  release(v);
  await trip.arrive();
  assert.equal(commands.length, 0);
});

test('arrival commits once and cancellation during the backend wait removes presentation only', async t => {
  const { v } = fixture(t);
  scene.season = 'summer';
  scene.weather = 'snow';
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].slice(0, 4), ['friend', 'woodland', 0.5, 0.5]);
  assert.equal(commands[0][4].soil, true);
  assert.deepEqual(commands[0][5], { season: 'summer', weather: 'snow' });
  assert.equal(v.pose, 'idle', 'digging never selects a coding sprite with a laptop');
  const effect = document.getElementById('garden-layer').children.at(-1);
  assert.match(effect.innerHTML, /dig-soil/);
  release(v);
  resolveDig({ ok: true, data: { outcome: 'empty', attemptId: 'once' } });
  await pending;
  assert.equal(commands.length, 1);
  assert.equal(effect.removed, true);
  assert.equal(v.doing, null);
  assert.equal(v.bubble.textContent, '');
});

test('ground selection refuses sky clicks and Escape cancels the armed tool', async t => {
  const { v } = fixture(t);
  setupDiscovery();
  beginDiscovery('dig');
  assert.equal(state.aiming, 'dig');
  await document.getElementById('yard').dispatch('click', { clientX: 500, clientY: 20 });
  assert.equal(v.trip, undefined);
  assert.equal(commands.length, 0);
  await document.dispatch('keydown', { key: 'Escape' });
  assert.equal(state.aiming, false);
  assert.equal(document.getElementById('discovery-target').hidden, true);
});

test('a layout change cancels a discovery trip before stale geometry can award it', async t => {
  const { v } = fixture(t);
  const { cancelDiscoveryWork } = await import('../src/yard/discovery.js');
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  cancelDiscoveryWork();
  await arrive();
  assert.equal(v.target, null);
  assert.equal(commands.length, 0);
});

test('tree choices show owned saplings and never default to an unavailable species', t => {
  fixture(t);
  state.data.garden.saplings = { maple: 2 };
  beginDiscovery('tree');
  const choices = document.getElementById('discovery-tree-choices').children;
  const maple = choices.find(button => button.dataset.treeKind === 'maple');
  assert.ok(maple);
  assert.equal(maple.disabled, false);
  assert.equal(maple.getAttribute('aria-pressed'), 'true');
  assert.ok(choices.filter(button => button.dataset.treeKind !== 'maple').every(button => button.disabled));
  assert.match(maple.textContent, /2/);
});

test('a state change keeps keyboard focus on the chosen tree choice', t => {
  fixture(t);
  state.data.garden.saplings = { maple: 2, oak: 1 };
  beginDiscovery('tree');
  const choices = document.getElementById('discovery-tree-choices');
  const maple = choices.children.find(button => button.dataset.treeKind === 'maple');
  maple.focus();
  state.data.garden.saplings = { maple: 1, oak: 1 };
  syncDiscovery();
  assert.equal(document.activeElement, maple);
  assert.equal(maple.parentNode, choices);
  assert.match(maple.textContent, /1/);
});

test('an empty sapling pocket offers digging instead of allowing free planting', async t => {
  const { v } = fixture(t);
  setupDiscovery();
  beginDiscovery('tree');
  assert.equal(document.getElementById('discovery-find-saplings').hidden, false);
  await document.getElementById('yard').dispatch('click', { clientX: 500, clientY: 620 });
  assert.equal(v.trip, undefined);
  document.getElementById('discovery-find-saplings').onclick();
  assert.equal(state.aiming, 'dig');
});

test('a fast discovery result waits for the complete tool action before its reveal', async t => {
  const { v, timers } = fixture(t);
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  const effect = document.getElementById('garden-layer').children.at(-1);
  assert.equal(timers.length, 2, 'contact and action clocks start at arrival, before the backend responds');
  resolveDig({ ok: true, data: { outcome: 'empty', attemptId: 'once' } });
  await pending;
  assert.notEqual(effect.removed, true, 'an early result cannot cut a shovel stroke short');
  timers.at(-1)();
  assert.equal(effect.removed, true);
});

test('a slow discovery result reveals immediately after the result, without another action delay', async t => {
  const { v, timers } = fixture(t);
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  const effect = document.getElementById('garden-layer').children.at(-1);
  assert.equal(timers.length, 2);
  timers.at(-1)();
  assert.notEqual(effect.removed, true, 'an unfinished request cannot reveal a fabricated result');
  resolveDig({ ok: true, data: { outcome: 'empty', attemptId: 'once' } });
  await pending;
  assert.equal(effect.removed, true);
});

test('bundled digging uses its authored tool and waits for its actual action duration', async t => {
  const { useCompanionActions, setCompanionSeason, companionAction } = await import('../src/core/companion-actions.js');
  const { v } = fixture(t);
  keepGlobals(t, 'Image');
  globalThis.Image = class {
    complete = true;
    naturalWidth = 1024;
  };
  v.asset = { place: 'builtin', sourceId: 'playpets-clover' };
  useCompanionActions({
    version: 1,
    characters: {
      'playpets-clover': {
        variants: {
          spring: {
            dig: {
              url: 'art/companions/clover/dig.png',
              heldTool: true,
              anchor: [96, 199],
              ground: [168, 199],
              contactAt: 500,
              tossAt: 1500,
              frames: [{ rect: [0, 0, 192, 208], foot: [96, 200], duration: 2400 }],
            },
          },
        },
      },
    },
  });
  setCompanionSeason('spring');
  const waits = [];
  globalThis.setTimeout = (_fn, ms) => {
    waits.push(ms);
    return waits.length;
  };
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const { fieldToYard, footTarget } = await import('../src/yard/field.js');
  const destination = fieldToYard({ x: 0.5, y: 0.5 });
  assert.ok(v.target.x < footTarget(v, destination.x, destination.y).x, 'stand beside the tool contact');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  const effect = document.getElementById('garden-layer').children.at(-1);
  assert.doesNotMatch(effect.innerHTML, /<svg/);
  assert.match(effect.className, /authored/);
  assert.equal(effect.style['--dig-contact'], '500ms');
  assert.ok(companionAction(v, performance.now()));
  assert.ok(waits.includes(2400));
  release(v);
  assert.equal(companionAction(v, performance.now()), null);
  resolveDig({ ok: true, data: { outcome: 'empty' } });
  await pending;
  useCompanionActions({ version: 1, characters: {} });
});

test('cancelling authored tree placement before contact does not spend a sapling', async t => {
  const { useCompanionActions, setCompanionSeason } = await import('../src/core/companion-actions.js');
  const { v, timers } = fixture(t);
  keepGlobals(t, 'Image');
  let planted = 0;
  const previousPlant = state.api.plantTree;
  state.api.plantTree = async () => {
    planted++;
    return { ok: true, data: {} };
  };
  t.after(() => {
    if (previousPlant) state.api.plantTree = previousPlant;
    else delete state.api.plantTree;
  });
  globalThis.Image = class {
    complete = true;
    naturalWidth = 192;
  };
  v.asset = { place: 'builtin', sourceId: 'playpets-clover' };
  useCompanionActions({
    version: 1,
    characters: {
      'playpets-clover': {
        variants: {
          spring: {
            plant: {
              url: 'art/companions/clover/plant.png',
              anchor: [96, 199],
              ground: [149, 199],
              commitAt: 600,
              frames: [{ rect: [0, 0, 192, 208], foot: [96, 199], duration: 1200 }],
            },
          },
        },
      },
    },
  });
  setCompanionSeason('spring');
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'tree', 'oak');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  assert.equal(planted, 0);
  release(v);
  for (const timer of timers) timer();
  await pending;
  assert.equal(planted, 0);
  useCompanionActions({ version: 1, characters: {} });
});

test('dug soil opens at ground contact behind the friend and uses the selected season', async t => {
  const { v } = fixture(t);
  const previousSeason = scene.season;
  const previousWeather = scene.weather;
  t.after(() => {
    scene.season = previousSeason;
    scene.weather = previousWeather;
  });
  scene.season = 'summer';
  scene.weather = 'snow';
  const scheduled = [];
  globalThis.setTimeout = (fn, ms) => {
    scheduled.push({ fn, ms });
    return scheduled.length;
  };
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  const effect = document.getElementById('garden-layer').children.at(-1);
  assert.ok(effect, 'soil shares the garden depth layer');
  assert.equal(effect.dataset.soil, 'base', 'snow weather does not select a winter outfit or turf rim');
  assert.ok(Number(effect.style.zIndex) < 1 + Math.round(v.y * 100), 'soil stays behind paws');
  assert.equal(effect.classList.contains('contact'), false);
  const contact = scheduled.find(timer => timer.ms === 300);
  assert.ok(contact, 'the fallback shovel has an explicit ground contact');
  contact.fn();
  assert.equal(effect.classList.contains('contact'), true);
  release(v);
  assert.equal(effect.removed, true);
  resolveDig({ ok: true, data: { outcome: 'empty' } });
  await pending;
});

test('winter soil opens without motion and cancelled contact cannot reopen it', async t => {
  const { reduced } = await import('../src/core/sprites.js');
  const { v } = fixture(t);
  const previousSeason = scene.season;
  const previousReduced = reduced.matches;
  t.after(() => {
    scene.season = previousSeason;
    reduced.matches = previousReduced;
  });
  scene.season = 'winter';
  reduced.matches = true;
  const scheduled = [];
  globalThis.setTimeout = (fn, ms) => {
    scheduled.push({ fn, ms });
    return scheduled.length;
  };
  const cleared = [];
  globalThis.clearTimeout = id => cleared.push(id);
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  const effect = document.getElementById('garden-layer').children.at(-1);
  assert.ok(effect);
  assert.equal(effect.dataset.soil, 'winter');
  const contact = scheduled.find(timer => timer.ms === 300);
  assert.ok(contact);
  contact.fn();
  assert.equal(effect.classList.contains('contact'), true, 'contact remains visible with motion disabled');
  release(v);
  assert.ok(cleared.includes(scheduled.indexOf(contact) + 1), 'cleanup clears the soil contact');
  effect.classList.remove('contact');
  contact.fn();
  assert.equal(effect.classList.contains('contact'), false, 'a stale callback cannot reopen a cancelled effect');
  resolveDig({ ok: true, data: { outcome: 'empty' } });
  await pending;
});

test('authored planting rechecks current ground and ownership at contact before spending', async t => {
  const { useCompanionActions, setCompanionSeason } = await import('../src/core/companion-actions.js');
  for (const invalidation of ['overlap', 'world', 'friend']) {
    await t.test(invalidation, async t => {
      const { v, timers } = fixture(t);
      keepGlobals(t, 'Image');
      globalThis.Image = class {
        complete = true;
        naturalWidth = 192;
      };
      let planted = 0;
      const previous = state.api.plantTree;
      state.data.garden.saplings = { oak: 1 };
      state.api.plantTree = async () => {
        planted++;
        state.data.garden.saplings.oak--;
        return { ok: true, data: {} };
      };
      t.after(() => {
        if (previous) state.api.plantTree = previous;
        else delete state.api.plantTree;
        useCompanionActions({ version: 1, characters: {} });
      });
      v.asset = { place: 'builtin', sourceId: 'playpets-clover' };
      useCompanionActions({
        version: 1,
        characters: {
          'playpets-clover': {
            variants: {
              spring: {
                plant: {
                  url: 'art/companions/clover/plant.png',
                  anchor: [96, 199],
                  ground: [149, 199],
                  commitAt: 600,
                  frames: [{ rect: [0, 0, 192, 208], foot: [96, 199], duration: 1200 }],
                },
              },
            },
          },
        },
      });
      setCompanionSeason('spring');
      sendDiscovery(v, { x: 0.5, y: 0.5 }, 'tree', 'oak');
      const arrive = v.trip.arrive;
      v.trip = null;
      v.target = null;
      const pending = arrive();
      const effect = document.getElementById('garden-layer').children.at(-1);
      assert.equal(planted, 0);
      if (invalidation === 'overlap') state.data.garden.plants.push({ x: 0.5, y: 0.5 });
      else if (invalidation === 'world') scene.world = 'courtyard';
      else views.delete(v.pet.id);
      timers.at(-1)();
      await pending;
      assert.equal(planted, 0, 'invalidated contact never calls the backend');
      assert.equal(state.data.garden.saplings.oak, 1);
      assert.equal(effect.removed, true);
      assert.equal(v.doing, null);
    });
  }
});

test('the dig tool stays in hand: each spot sends the next free friend until Escape', async t => {
  const { v } = fixture(t);
  t.mock.method(performance, 'now', () => 1e9);
  const other = {
    pet: { id: 'second', size: 112, name: 'Pip' },
    px: 600,
    py: 400,
    x: 0.6,
    y: 0.5,
    pose: 'idle',
    bubble: element('span'),
  };
  views.set(other.pet.id, other);
  state.data.pets.push(other.pet);
  t.after(() => release(other));
  setupDiscovery();
  beginDiscovery('dig');
  await document.getElementById('yard').dispatch('click', { clientX: 500, clientY: 620 });
  assert.ok(v.trip, 'the selected friend goes first');
  assert.equal(state.aiming, 'dig', 'the tool stays in hand after the first spot');
  await document.getElementById('yard').dispatch('click', { clientX: 540, clientY: 620 });
  assert.ok(other.trip, 'the next spot goes to the friend who is free');
  await document.getElementById('yard').dispatch('click', { clientX: 520, clientY: 620 });
  assert.equal(document.getElementById('toast').textContent, 'Every friend is busy right now');
  await document.dispatch('keydown', { key: 'Escape' });
  assert.equal(state.aiming, false);
});

test('the tool strip switches between digging, trees and seeds without reopening Play', async t => {
  fixture(t);
  state.data.garden.saplings = { maple: 1 };
  state.data.garden.seeds = 2;
  setupDiscovery();
  beginDiscovery('dig');
  const tool = name => document.getElementById('discovery-tools').children.find(b => b.dataset.tool === name);
  assert.equal(tool('dig').getAttribute('aria-pressed'), 'true');
  tool('tree').onclick();
  assert.equal(state.aiming, 'tree');
  assert.equal(document.getElementById('discovery-target').hidden, false);
  assert.equal(tool('tree').getAttribute('aria-pressed'), 'true');
  document.getElementById('discovery-cancel').onclick();
  assert.equal(state.aiming, false);
  assert.equal(document.getElementById('discovery-target').hidden, true);
});

test('digging at a right-clicked spot needs no trip through Play', async t => {
  const { v } = fixture(t);
  t.mock.method(performance, 'now', () => 2e9);
  setupDiscovery();
  const { canDigAt, digAt } = await import('../src/yard/discovery.js');
  assert.equal(canDigAt(500, 20), false, 'the sky is not ground');
  assert.equal(canDigAt(500, 620), true);
  digAt(500, 620);
  assert.ok(v.trip);
  assert.equal(state.aiming, 'dig', 'the dig tool stays ready for the next spot');
});

test('with a tool in hand, 1, 2 and 3 switch tools unless a person is typing', async t => {
  fixture(t);
  state.data.garden.saplings = { maple: 1 };
  setupDiscovery();
  beginDiscovery('dig');
  await document.dispatch('keydown', { key: '2', target: document.body });
  assert.equal(state.aiming, 'tree');
  const field = document.createElement('input');
  await document.dispatch('keydown', { key: '1', target: field });
  assert.equal(state.aiming, 'tree', 'typing a digit in a field changes nothing');
  await document.dispatch('keydown', { key: '1', target: document.body });
  assert.equal(state.aiming, 'dig');
  const strip = document.getElementById('discovery-tools').children;
  assert.deepEqual(
    strip.map(button => button.getAttribute('aria-keyshortcuts')),
    ['1', '2', '3'],
  );
});

test('with Let them dig on, an idle friend digs a spot of its own, never during a game or a tool in hand', async t => {
  const { v } = fixture(t);
  t.mock.method(performance, 'now', () => 3e9);
  const { autoDig } = await import('../src/yard/discovery.js');
  const { setGame } = state;
  setGame({ kind: 'tag' });
  assert.equal(
    autoDig(() => 0.5),
    false,
    'a game is not interrupted',
  );
  setGame(null);
  state.setAiming('tree');
  assert.equal(
    autoDig(() => 0.5),
    false,
    'a tool in the person’s hand comes first',
  );
  state.setAiming(false);
  assert.equal(
    autoDig(() => 0.5),
    true,
  );
  assert.ok(v.trip, 'the idle friend walks to its spot');
  assert.equal(
    autoDig(() => 0.5),
    false,
    'a friend already digging is left alone',
  );
});
