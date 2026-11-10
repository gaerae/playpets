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

test('night stars and shooting stars are drawn behind the land, not over it', t => {
  t.mock.method(Math, 'random', () => 0.5);
  t.mock.method(performance, 'now', () => 0);
  globalThis.window = { devicePixelRatio: 1 };
  const counting = () => {
    const calls = { arcs: 0, strokes: 0, clears: 0 };
    const ctx = new Proxy(
      {
        arc() {
          calls.arcs++;
        },
        stroke() {
          calls.strokes++;
        },
        clearRect() {
          calls.clears++;
        },
        createLinearGradient: () => ({ addColorStop() {} }),
      },
      { get: (object, key) => object[key] ?? (() => {}) },
    );
    return { calls, canvas: { getContext: () => ctx, getBoundingClientRect: () => ({ width: 1000, height: 600 }) } };
  };
  const weather = counting(),
    sky = counting();
  const scene = createScenery(weather.canvas, { matches: false }, undefined, undefined, sky.canvas);
  scene.resize();
  scene.set('night', 'clear', 'winter');
  assert.ok(sky.calls.arcs > 0, 'stars are on the sky layer');
  assert.equal(weather.calls.arcs, 0, 'no star is painted over the hills and trees');
  // The first streak is only scheduled; the next one crosses the sky layer.
  scene.frame(1, 1);
  scene.frame(60000, 1);
  assert.ok(sky.calls.strokes > 0, 'a shooting star crosses the sky layer');
  const clears = sky.calls.clears;
  scene.set('night', 'rain', 'winter');
  assert.ok(sky.calls.clears > clears, 'rain clears the stars away');
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
    [0.82, 'ladybug', 'beetle'],
    [0.92, 'field_cricket', 'cricket'],
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

// A yard with its sky layer, counting what each canvas draws.
function layered(t, reduce = false) {
  t.mock.method(Math, 'random', () => 0.5);
  t.mock.method(performance, 'now', () => 0);
  globalThis.window = { devicePixelRatio: 1 };
  const counting = () => {
    const calls = { arcs: 0, strokes: 0, clears: 0 };
    const ctx = new Proxy(
      {
        arc() {
          calls.arcs++;
        },
        stroke() {
          calls.strokes++;
        },
        clearRect() {
          calls.clears++;
        },
        createLinearGradient: () => ({ addColorStop() {} }),
      },
      { get: (object, key) => object[key] ?? (() => {}) },
    );
    return { calls, canvas: { getContext: () => ctx, getBoundingClientRect: () => ({ width: 1000, height: 600 }) } };
  };
  const weather = counting(),
    sky = counting(),
    reduced = { matches: reduce };
  const scene = createScenery(weather.canvas, reduced, undefined, undefined, sky.canvas);
  scene.resize();
  return { scene, sky: sky.calls, reduced };
}
// How many shooting stars begin across the frames from `from` to `to`, 100 ms apart.
function crossings(scene, sky, from, to) {
  let count = 0,
    crossing = false;
  for (let now = from; now <= to; now += 100) {
    const before = sky.strokes;
    scene.frame(now, 100);
    const drawn = sky.strokes > before;
    if (drawn && !crossing) count++;
    crossing = drawn;
  }
  return count;
}

test('in a meteor shower a shooting star crosses every few seconds, and only now and then after it', t => {
  const { scene, sky } = layered(t);
  scene.set('night', 'clear', 'summer');
  scene.shower(true);
  assert.ok(crossings(scene, sky, 1, 20000) >= 3);
  scene.shower(false);
  assert.ok(crossings(scene, sky, 20100, 40000) <= 1);
});

test('a wish can be sent from the moon across a clear night sky at once, never by day or without motion', t => {
  const { scene, sky, reduced } = layered(t);
  scene.set('night', 'clear', 'winter');
  scene.frame(1, 1);
  assert.equal(scene.shoot({ x: 200, y: 60 }), true);
  assert.equal(scene.busy(), true);
  let before = sky.strokes;
  scene.frame(101, 100);
  assert.ok(sky.strokes > before);
  assert.equal(scene.shoot({ x: 200, y: 60 }), false, 'one wish at a time');
  scene.frame(1000, 100);
  before = sky.strokes;
  scene.frame(2600, 100);
  assert.ok(sky.strokes > before, 'its dust glitters after it has gone');
  scene.frame(6000, 100);
  before = sky.strokes;
  scene.frame(6100, 100);
  assert.equal(sky.strokes, before, 'then the sky is left as it was');
  scene.set('day', 'clear', 'winter');
  assert.equal(scene.shoot({ x: 200, y: 60 }), false);
  scene.set('night', 'clear', 'winter');
  reduced.matches = true;
  scene.frame(7000, 100);
  assert.equal(scene.shoot({ x: 200, y: 60 }), false);
});

test('sparks flare on the sky layer while they last, then the layer is left as it was', t => {
  const { scene, sky, reduced } = layered(t);
  scene.set('day', 'clear', 'summer');
  scene.frame(1, 1);
  const spark = { cx: 500, cy: 100, tx: 560, ty: 80, fall: 10, since: 100, life: 1000, color: '#ffd27a' };
  assert.equal(
    scene.flare(() => [spark]),
    true,
  );
  assert.equal(scene.busy(), true);
  const before = sky.strokes;
  scene.frame(600, 100);
  assert.ok(sky.strokes > before, 'drawn while it lasts');
  scene.frame(1200, 100);
  assert.equal(scene.busy(), false);
  const clears = sky.clears,
    strokes = sky.strokes;
  scene.frame(1300, 100);
  assert.equal(sky.clears, clears, 'nothing to draw once it is over');
  assert.equal(sky.strokes, strokes);
  reduced.matches = true;
  scene.frame(1400, 100);
  assert.equal(
    scene.flare(() => [{ ...spark, since: 1500 }]),
    false,
  );
});

test('a window resized in the middle of a show (the panel opening) keeps the sparks in the sky', t => {
  const { scene, sky } = layered(t);
  scene.set('night', 'clear', 'summer');
  scene.frame(1, 1);
  scene.flare(() => [{ cx: 500, cy: 100, tx: 560, ty: 80, fall: 10, since: 100, life: 4000, color: '#ffd27a' }]);
  scene.frame(200, 100);
  scene.resize();
  const before = sky.strokes;
  scene.frame(1000, 100);
  assert.ok(sky.strokes > before);
  assert.equal(scene.busy(), true);
});

// What one frame paints, in rotations (one per petal), or null when the canvas rested.
function petalsAt(scene, draws, now, dt = 16) {
  const paints = draws.paints,
    rotations = draws.rotations;
  scene.frame(now, dt);
  return draws.paints > paints ? draws.rotations - rotations : null;
}
// Runs frames from `from` to `to` ms in steps of `step`.
function run(scene, from, to, step = 500) {
  for (let now = from; now <= to; now += step) scene.frame(now, step);
}

test("a gathering's band adds a few petals near the tree, through the rest between spells", t => {
  const { scene, draws } = yard(t, false);
  scene.set('day', 'clear', 'spring', 'blossom');
  const base = petalsAt(scene, draws, 16);
  assert.ok(base > 0);
  scene.gather({ x: 300, width: 200 });
  const banded = petalsAt(scene, draws, 32) - base;
  assert.ok(banded >= 3 && banded <= 6, `${banded} banded petals`);
  // A resize (the panel opening) draws the scene again; the band is still there.
  const before = draws.rotations;
  scene.resize();
  assert.equal(draws.rotations - before, base + banded, 'a resize keeps the band');
  // The spell ends and its petals land; by 60 s only the band falls, and the canvas still paints.
  run(scene, 500, 60000);
  assert.equal(petalsAt(scene, draws, 60500), banded, 'the rest draws the banded ones');
});

test('a new spell during a gathering keeps its band', t => {
  const { scene, draws } = yard(t, false);
  scene.set('day', 'clear', 'spring', 'blossom');
  const base = petalsAt(scene, draws, 16);
  scene.gather({ x: 300, width: 200 });
  const banded = petalsAt(scene, draws, 32) - base;
  // The rest is 45 s here (random 0.5): the next spell starts at about 69 s and spawns its own petals.
  run(scene, 500, 68000);
  assert.equal(petalsAt(scene, draws, 68500), banded);
  run(scene, 69000, 69500);
  assert.equal(petalsAt(scene, draws, 70000), base + banded, "the new spell's petals and the band");
});

test('the band stops with the gathering', t => {
  const { scene, draws } = yard(t, false);
  scene.set('day', 'clear', 'spring', 'blossom');
  const base = petalsAt(scene, draws, 16);
  scene.gather({ x: 300, width: 200 });
  const banded = petalsAt(scene, draws, 32) - base;
  assert.ok(banded >= 3);
  scene.gather(null);
  // They are still falling, and nothing new joins them.
  run(scene, 500, 20000);
  assert.equal(petalsAt(scene, draws, 20500), base + banded, 'still on their way down');
  // A banded petal starts about 100 px above the yard and falls 0.022 px/ms at this depth: it lands
  // after about 26 s, and the spell's own petals, not recycled after 24 s, are down by about 37 s.
  // The next spell is not before 69 s.
  run(scene, 21000, 45000);
  assert.equal(petalsAt(scene, draws, 45500) ?? 0, 0, 'every petal landed');
});

test('the band adds nothing at night, in rain or with reduced motion', t => {
  for (const [period, weather] of [
    ['night', 'clear'],
    ['day', 'rain'],
  ]) {
    const { scene, draws } = yard(t, false);
    scene.set(period, weather, 'spring', 'blossom');
    const before = draws.rotations;
    scene.gather({ x: 300, width: 200 });
    run(scene, 16, 5000);
    assert.equal(draws.rotations, before, `${period} ${weather}`);
  }
  const { scene, draws } = yard(t, true);
  scene.gather({ x: 300, width: 200 });
  scene.frame(100, 100);
  assert.equal(draws.rotations, 0, 'reduced motion');
});
