import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { createScenery, stepGroundBug } from '../src/yard/scenery.js';

function yard(t, reduce = true, random = 0.5) {
  t.mock.method(Math, 'random', () => random);
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

test('ground bugs crawl or briefly hop within the walkable field', () => {
  const bounds = { width: 1000, top: 450, bottom: 570, scale: 1 };
  for (const kind of ['beetle', 'cricket']) {
    const c = { kind, x: 500, y: 500, groundY: 500, heading: 0, phase: 0 };
    const heights = [];
    for (let frame = 0; frame < 200; frame++) {
      assert.equal(
        stepGroundBug(c, 16, bounds, false, () => 0.5),
        true,
      );
      heights.push(c.groundY - c.y);
      assert.ok(c.y >= bounds.top && c.y <= bounds.bottom);
    }
    assert.ok(c.x > 500 && c.x < 550, 'ground movement is slower than flight');
    if (kind === 'beetle') assert.ok(heights.every(height => height === 0));
    else {
      assert.ok(heights.some(height => height > 0 && height <= 3));
      assert.ok(
        heights.some(height => height === 0),
        'cricket rests between hops',
      );
    }
  }
});

test('new ground families spawn on land and stay catchable with reduced motion', t => {
  for (const [random, species, kind] of [
    [0.85, 'ladybug', 'beetle'],
    [0.95, 'field_cricket', 'cricket'],
  ]) {
    const { scene, draws } = yard(t, true, random);
    scene.set('day', 'clear', 'summer');
    const y = 600 * (0.695 + (0.94 - 0.695) * random);
    const caught = scene.catchAt(1000 * random, y);
    assert.equal(caught?.species, species);
    assert.equal(caught?.kind, kind);
    scene.frame(1, 1);
    const before = draws.paints;
    scene.frame(100, 99);
    assert.equal(draws.paints, before);
    assert.equal(scene.busy(), false);
  }
});
