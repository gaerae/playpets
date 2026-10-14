import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { createScenery } from '../src/yard/scenery.js';
import { keepGlobals } from './support/dom.mjs';

const artModule = await import('../src/yard/weather-art.js').catch(() => null);
const factory = (...args) => {
  assert.equal(typeof artModule?.createWeatherArt, 'function', 'weather artwork has an inert lazy factory');
  return artModule.createWeatherArt(...args);
};
const context = () =>
  new Proxy(
    {
      calls: [],
      createLinearGradient: () => ({ addColorStop() {} }),
      drawImage(...args) {
        this.calls.push(args);
      },
    },
    {
      get: (target, key) => target[key] ?? (() => {}),
    },
  );

test('seasonal texture waits for decode and selects distinct leaf and petal atlas cells', async () => {
  let resolve,
    loads = 0,
    changed = 0;
  const ready = new Promise(done => {
    resolve = done;
  });
  const art = factory(() => changed++, {
    loadImage: () => {
      loads++;
      return ready;
    },
    makeCanvas: () => null,
  });
  const ctx = context(),
    f = { x: 20, y: 30, size: 7, tint: 0.8, depth: 1, phase: 0, spin: 0 };
  art.use('summer', 'clear', true);
  assert.equal(loads, 0, 'summer does not fetch decorative textures');
  art.use('spring', 'clear', true);
  art.use('autumn', 'clear', true);
  assert.equal(loads, 1);
  assert.equal(art.faller(ctx, f, 'autumn', 1, 0), false, 'no incomplete image is drawn');
  const image = { width: 384, height: 256 };
  resolve(image);
  await ready;
  await Promise.resolve();
  assert.equal(changed, 1);
  assert.equal(art.faller(ctx, f, 'autumn', 1, 0), true);
  assert.equal(art.faller(ctx, f, 'spring', 0.5, 0), true);
  assert.equal(ctx.calls[0][0], image);
  assert.deepEqual(ctx.calls[0].slice(1, 5), [256, 0, 128, 128]);
  assert.deepEqual(ctx.calls[1].slice(1, 5), [256, 128, 128, 128]);
  assert.ok(ctx.calls[1][7] < ctx.calls[0][7], 'mini scale uses a smaller drawn particle');
});

test('late decoded seasonal textures cannot wake an indoor, reduced or different-season scene', async () => {
  for (const [season, active] of [
    ['spring', false],
    ['winter', true],
    ['summer', true],
  ]) {
    let resolve,
      changed = 0;
    const pending = new Promise(done => {
      resolve = done;
    });
    const art = factory(() => changed++, { loadImage: () => pending, makeCanvas: () => null });
    art.use('autumn', 'clear', true);
    art.use(season, 'clear', active);
    resolve({ width: 384, height: 256 });
    await pending;
    await Promise.resolve();
    assert.equal(changed, 0, `${season}/${active} remains asleep`);
  }
});

test('missing texture rejects safely and retains the vector fallback', async () => {
  const art = factory(() => assert.fail('failed artwork cannot invalidate scene'), {
    loadImage: () => Promise.reject(new Error('missing')),
    makeCanvas: () => null,
  });
  art.use('spring', 'clear', true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(art.faller(context(), { tint: 0 }, 'spring', 1, 0), false);
});

test('precipitation builds its materials once, then draws cached near flakes and tapered rain', () => {
  let allocations = 0,
    gradients = 0;
  const makeCanvas = () => {
    allocations++;
    const ctx = context();
    ctx.createLinearGradient = ctx.createRadialGradient = () => {
      gradients++;
      return { addColorStop() {} };
    };
    return { getContext: () => ctx };
  };
  const art = factory(() => {}, { makeCanvas, loadImage: () => assert.fail('winter does not fetch seasonal image') });
  art.use('winter', 'snow', false);
  art.use('winter', 'rain', false);
  const built = [allocations, gradients],
    ctx = context();
  const drop = { x: 30, y: 40, depth: 0.95, size: 4, phase: 1, vx: -0.18, vy: 1 };
  for (let i = 0; i < 100; i++) {
    assert.equal(art.snow(ctx, drop, 0.5), true);
    assert.equal(art.rain(ctx, drop, 0.5, false), true);
  }
  assert.deepEqual([allocations, gradients], built, 'painting creates no canvas, image or gradient');
  assert.equal(ctx.calls.length, 200);
});

test('rain impact uses a depth-scaled cached ring and never paints an expired splash', () => {
  const art = factory(() => {}, { makeCanvas: () => ({ getContext: () => context() }) });
  art.use('summer', 'rain', false);
  const ctx = context(),
    splash = { x: 25, y: 50, depth: 1 };
  assert.equal(typeof art.ripple, 'function', 'rain impacts have a reusable material');
  assert.equal(art.ripple(ctx, splash, 1, 0.5, false), true);
  assert.equal(art.ripple(ctx, splash, 0.5, 0.5, false), true);
  assert.equal(ctx.calls.length, 2);
  assert.ok(ctx.calls[1][3] < ctx.calls[0][3], 'mini impact respects the yard scale');
  assert.equal(art.ripple(ctx, splash, 1, 1, false), false);
  assert.equal(ctx.calls.length, 2, 'expired ripples do not draw');
});

test('scenery ignores a late decorative decode after switching indoors or enabling reduced motion', async t => {
  t.mock.method(Math, 'random', () => 0.5);
  keepGlobals(t, 'window');
  globalThis.window = { devicePixelRatio: 1 };
  for (const indoor of [true, false]) {
    let resolve,
      loads = 0,
      paints = 0;
    const pending = new Promise(done => {
        resolve = done;
      }),
      ctx = context(),
      reduced = { matches: false };
    ctx.clearRect = () => paints++;
    const scene = createScenery(
      { getContext: () => ctx, getBoundingClientRect: () => ({ width: 500, height: 350 }) },
      reduced,
      {
        loadImage: () => {
          loads++;
          return pending;
        },
        makeCanvas: () => null,
      },
    );
    scene.resize();
    assert.equal(loads, 1, 'spring textures begin loading at setup, never in a paint frame');
    if (indoor) scene.set('day', 'clear', 'spring', null, 'studio');
    else {
      reduced.matches = true;
      scene.frame(10, 10);
    }
    const before = paints;
    resolve({ width: 384, height: 256 });
    await pending;
    await Promise.resolve();
    scene.frame(20, 10);
    assert.equal(paints, before, 'a retired texture cannot repaint the current still scene');
    assert.equal(ctx.calls.length, 0);
  }
});

test('seasonal art starts lazily when motion is enabled and the next falling spell begins', t => {
  t.mock.method(Math, 'random', () => 0.5);
  keepGlobals(t, 'window');
  globalThis.window = { devicePixelRatio: 1 };
  let loads = 0;
  const reduced = { matches: true },
    ctx = context();
  const scene = createScenery(
    { getContext: () => ctx, getBoundingClientRect: () => ({ width: 500, height: 350 }) },
    reduced,
    {
      loadImage: () => {
        loads++;
        return new Promise(() => {});
      },
      makeCanvas: () => null,
    },
  );
  scene.resize();
  assert.equal(loads, 0);
  reduced.matches = false;
  scene.frame(1, 1);
  scene.frame(24002, 1);
  scene.frame(69003, 1);
  assert.equal(loads, 1, 'a newly enabled seasonal spell fetches its texture without a resize');
});

test('rain uses one daylight material regardless of the scene', () => {
  let allocations = 0;
  const art = factory(() => {}, {
    makeCanvas: () => {
      allocations++;
      return { getContext: () => context() };
    },
  });
  art.use('summer', 'rain', false);
  assert.equal(allocations, 4, 'two rain and two ripple materials, no dark glass variant');
});
