import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { environmentLake, environmentLook } from '../src/yard/environment.js';
import { mixFor } from '../src/yard/soundmix.js';
import { worldFor } from '../src/yard/worlds.js';
import { worlds as definitions } from './support/content.mjs';

test('unknown and removed saved worlds fall back to woodland', () => {
  assert.equal(worldFor('missing').id, 'woodland');
  assert.equal(worldFor(null).id, 'woodland');
});

test('studio disables outdoor effects and pond geometry in every light and weather', () => {
  const room = worldFor('studio');
  assert.equal(room.geometry.fieldTop, 0.55);
  assert.equal(room.capabilities.weather, true);
  assert.equal(room.windowPanes.length, 3);
  for (const capability of ['sky', 'wildlife', 'fishing', 'seasonalEffects', 'ambient'])
    assert.equal(room.capabilities[capability], false, capability);
  for (const period of ['morning', 'day', 'evening', 'night'])
    for (const weather of ['clear', 'rain', 'snow']) {
      const scene = { world: 'studio', period, weather, season: 'winter' };
      assert.equal(environmentLook(scene).art, `studio-modern-city-${period}`);
      assert.equal(environmentLake(1000, 700, scene), null);
      assert.deepEqual(mixFor(scene), { breeze: 0, leaves: 0, water: 0, rain: 0, birds: 0, crickets: 0 });
    }
});

test('studio night stays warm and readable rather than applying outdoor moonlight', () => {
  const look = environmentLook({ world: 'studio', period: 'night', weather: 'clear', season: 'summer' });
  assert.equal(look.filter, 'none');
  assert.equal(look.tint, null);
});

test('woodland retains seasonal art, outdoor sounds and the visible pond', () => {
  const scene = { world: 'woodland', period: 'day', weather: 'rain', season: 'summer' };
  assert.equal(environmentLook(scene).art, 'green');
  assert.equal(mixFor(scene).rain, 1);
  assert.equal(environmentLake(1000, 700, scene).onWater(550, 416), true);
  assert.equal(worldFor('woodland').capabilities.fishing, true);
});

test('switching to the clear studio removes existing creatures and stops weather frame work', async () => {
  const { createScenery } = await import('../src/yard/scenery.js');
  let draws = 0;
  const ctx = new Proxy(
    {
      clearRect() {},
      setTransform() {},
    },
    {
      get: (target, key) =>
        target[key] ||
        (() => {
          draws++;
          return { addColorStop() {} };
        }),
    },
  );
  const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width: 1000, height: 700 }) };
  const before = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try {
    const weather = createScenery(canvas, { matches: false });
    weather.set('night', 'clear', 'winter', 'lights', 'studio');
    weather.resize();
    weather.frame(900000, 120);
    assert.equal(draws, 0, 'no weather, stars, leaves or wildlife are painted in the room');
    assert.equal(weather.busy(), false);
    assert.equal(weather.near(500, 500), false);
    assert.equal(weather.catchAt(500, 500), null);
  } finally {
    globalThis.window = before;
  }
});

test('the indoor floor cannot expose an outdoor pond click region', async () => {
  const { onLake } = await import('../src/yard/catch.js');
  const { scene } = await import('../src/yard/world.js');
  const previous = scene.world;
  scene.world = 'studio';
  try {
    for (const [x, y] of [
      [550, 416],
      [250, 200],
      [1000, 700],
    ])
      assert.equal(onLake(x, y), false);
  } finally {
    scene.world = previous;
  }
});

test('each world label is translated and every raster variant exists', async () => {
  const { STRINGS } = await import('../src/core/strings.js');
  for (const world of definitions) {
    for (const table of Object.values(STRINGS)) {
      assert.ok(table[world.label], world.label);
      assert.equal(typeof table[world.about], 'string', `${world.id} activity note`);
      if (!world.capabilities.sky) {
        assert.ok(world.chatter, `${world.id} indoor atmosphere`);
        assert.ok(Array.isArray(table[world.chatter]) && table[world.chatter].length > 0, world.chatter);
      }
    }
    for (const art of Object.values(world.art || {})) {
      const png = readFileSync(new URL(`../src/art/environments/${art}.png`, import.meta.url));
      assert.equal(png.readUInt32BE(16), 1536);
      assert.equal(png.readUInt32BE(20), 1024);
    }
  }
});
