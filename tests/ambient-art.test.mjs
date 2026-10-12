import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const module = await import('../src/yard/ambient-art.js').catch(() => null);
const factory = (...args) => {
  assert.equal(typeof module?.createAmbientArt, 'function');
  return module.createAmbientArt(...args);
};
const context = () =>
  new Proxy(
    {
      calls: [],
      drawImage(...args) {
        this.calls.push(args);
      },
    },
    { get: (t, k) => t[k] ?? (() => {}) },
  );
test('species art decodes once, draws the actual catchable species and keeps mini scale', async () => {
  let loads = 0,
    changed = 0;
  const image = { width: 1254, height: 1254 },
    entries = JSON.parse(readFileSync(new URL('../src/art/collection.json', import.meta.url)));
  const art = factory(() => changed++, {
    loadBugs: async () => {
      loads++;
      return { image, entries };
    },
    loadBirds: async () => null,
    makeCanvas: () => null,
  });
  art.use(false, false);
  assert.equal(loads, 0);
  art.use(true, false);
  art.use(true, false);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(loads, 1);
  assert.equal(changed, 1);
  const ctx = context(),
    bug = { species: 'swallowtail', kind: 'butterfly', x: 20, y: 30, heading: 0, phase: 0, light: 1 };
  assert.equal(art.bug(ctx, bug, 1), true);
  assert.deepEqual(ctx.calls[0].slice(1, 5), [943, 39, 301, 272]);
  assert.equal(art.bug(ctx, bug, 0.5), true);
  assert.equal(ctx.calls[1][7], ctx.calls[0][7] / 2);
  assert.equal(art.bug(ctx, { ...bug, species: 'missing' }, 1), false);
});
test('late artwork cannot invalidate a world after wildlife was disabled', async () => {
  let resolve,
    changed = 0;
  const ready = new Promise(done => {
    resolve = done;
  });
  const art = factory(() => changed++, { loadBugs: () => ready, loadBirds: async () => null, makeCanvas: () => null });
  art.use(true, false);
  art.use(false, false);
  resolve({ image: { width: 1254, height: 1254 }, entries: [] });
  await ready;
  await Promise.resolve();
  assert.equal(changed, 0);
});
test('bird wingbeat selects authored states without stretching the body', async () => {
  const image = { width: 384, height: 128 };
  const art = factory(() => {}, { loadBugs: async () => null, loadBirds: async () => image, makeCanvas: () => null });
  art.use(false, true);
  await Promise.resolve();
  await Promise.resolve();
  const ctx = context();
  for (const now of [0, 100, 200, 300]) assert.equal(art.bird(ctx, 20, 30, 0, 1, 1, now), true);
  assert.deepEqual(
    ctx.calls.map(c => c[1]),
    [0, 128, 256, 128],
  );
  assert.ok(
    ctx.calls.every(c => c[7] === c[8]),
    'whole body uses a fixed aspect ratio',
  );
});

test('glows and celestial materials allocate only during scene preparation, never while painting', () => {
  let canvases = 0,
    gradients = 0;
  const makeCanvas = () => {
    canvases++;
    return {
      getContext: () =>
        new Proxy(
          { createRadialGradient: gradient, createLinearGradient: gradient },
          { get: (target, key) => target[key] ?? (() => {}) },
        ),
    };
  };
  const gradient = () => {
    gradients++;
    return { addColorStop() {} };
  };
  const art = factory(() => {}, { loadBugs: async () => null, loadBirds: async () => null, makeCanvas });
  const creature = { kind: 'firefly', look: { glow: '#ffd84a' }, x: 20, y: 30 };
  art.use(true, true, [creature]);
  assert.equal(canvases, 3);
  assert.equal(gradients, 3);
  const ctx = context();
  for (let frame = 0; frame < 100; frame++) {
    assert.equal(art.glow(ctx, creature, 0.5), true);
    assert.equal(art.star(ctx, { x: 20, y: 30, r: 1 }), true);
    assert.equal(art.streak(ctx, 20, 30, 50, 80), true);
  }
  assert.equal(canvases, 3);
  assert.equal(gradients, 3);
});
test('failed artwork is a quiet fallback and never interrupts the living scene', async () => {
  const art = factory(() => assert.fail('missing artwork cannot trigger redraw'), {
    loadBugs: async () => {
      throw Error('missing');
    },
    loadBirds: async () => null,
    makeCanvas: () => null,
  });
  art.use(true, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(art.bug(context(), { species: 'swallowtail' }, 1), false);
  assert.equal(art.bird(context(), 1, 1, 0, 1, 1, 0), false);
});
