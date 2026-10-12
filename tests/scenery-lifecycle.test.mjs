import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { createScenery } from '../src/yard/scenery.js';

function yard(t, reduce = true) {
  t.mock.method(Math, 'random', () => 0.5);
  t.mock.method(performance, 'now', () => 0);
  globalThis.window = { devicePixelRatio: 1 };
  const draws = { paints: 0, rotations: 0 };
  const context = new Proxy(
    {
      clearRect() {
        draws.paints++;
      },
      rotate() {
        draws.rotations++;
      },
      createLinearGradient: () => ({ addColorStop() {} }),
    },
    { get: (object, key) => object[key] ?? (() => {}) },
  );
  const reduced = { matches: reduce };
  const scene = createScenery(
    {
      getContext: () => context,
      getBoundingClientRect: () => ({ width: 1000, height: 600 }),
    },
    reduced,
  );
  scene.resize();
  return { scene, reduced, draws };
}

test('reduced motion keeps butterflies and fireflies catchable without animating or drawing falling petals', t => {
  const { scene, draws } = yard(t);
  assert.equal(scene.near(500, 420), true);
  assert.equal(draws.rotations, 0, 'decorative falling petals are absent');
  assert.equal(scene.catchAt(500, 420)?.kind, 'butterfly');
  scene.frame(10, 10);
  const before = draws.paints;
  for (const now of [100, 1000, 30000, 60000]) scene.frame(now, 100);
  assert.equal(draws.paints, before, 'static scenery does not repaint with time');
  assert.equal(scene.busy(), false);
  scene.set('night', 'clear', 'summer');
  assert.equal(scene.catchAt(500, 420)?.kind, 'firefly');
});

test('catching an existing bug after enabling reduced motion repaints it away once', t => {
  const { scene, reduced, draws } = yard(t, false);
  reduced.matches = true;
  let caught = 0;
  while (scene.catchAt(500, 420)) caught++;
  assert.equal(caught, 3);
  const before = draws.paints;
  scene.frame(100, 40);
  assert.equal(draws.paints, before + 1);
  scene.frame(200, 40);
  assert.equal(draws.paints, before + 1, 'no repeated drawing after the dirty frame');
  assert.equal(scene.near(500, 420), false);
});

test('reduced rain and snow stay still without requesting a busy frame cadence', t => {
  const { scene, draws } = yard(t);
  for (const weather of ['rain', 'snow']) {
    scene.set('day', weather, 'winter');
    const before = draws.paints;
    scene.frame(100, 40);
    scene.frame(200, 40);
    assert.equal(draws.paints, before);
    assert.equal(scene.busy(), false);
  }
});

test('catching every stationary bug replenishes them after the normal rest without idle animation', t => {
  const { scene, draws } = yard(t);
  let caught = 0;
  while (scene.catchAt(500, 420)) caught++;
  assert.equal(caught, 3);
  scene.frame(10, 10);
  assert.equal(scene.near(500, 420), false, 'the caught bugs disappear immediately');
  const before = draws.paints;
  scene.frame(44999, 100);
  assert.equal(scene.near(500, 420), false, 'the yard waits for the rest period');
  assert.equal(draws.paints, before);
  scene.frame(45000, 1);
  assert.equal(scene.near(500, 420), true, 'new stationary bugs can be caught');
  assert.equal(draws.paints, before + 1);
  assert.equal(draws.rotations, 0);
  assert.equal(scene.busy(), false);
  scene.frame(90000, 100);
  assert.equal(draws.paints, before + 1, 'the replenished bugs remain still');
  assert.equal(scene.catchAt(500, 420)?.kind, 'butterfly');
});

test('enabling reduced motion during a natural firefly rest schedules stationary replacements', t => {
  const { scene, reduced, draws } = yard(t, false);
  scene.set('night', 'clear', 'summer');
  assert.equal(scene.near(500, 420), true);
  scene.frame(1, 1);
  scene.frame(24002, 1);
  scene.frame(25503, 1501);
  assert.equal(scene.near(500, 420), false);
  reduced.matches = true;
  scene.frame(25504, 1);
  const before = draws.paints;
  scene.frame(70503, 100);
  assert.equal(draws.paints, before);
  scene.frame(70504, 1);
  assert.equal(scene.near(500, 420), true);
  assert.equal(draws.paints, before + 1);
  assert.equal(scene.catchAt(500, 420)?.kind, 'firefly');
});
