import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { bugSvg } = await import('../src/yard/creatures.js');
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

test('each species selects its own atlas and ground bugs retain their shape', async () => {
  const original = { width: 1254 },
    extension = { width: 1024 },
    ground = { width: 1024 };
  const entries = [
    { id: 'swallowtail', kind: 'bugs', atlas: 'bugs/specimens.png', crop: [1, 2, 30, 40] },
    { id: 'painted_lady', kind: 'bugs', atlas: 'collection-extension/wildlife.png', crop: [5, 6, 40, 30] },
    { id: 'ladybug', kind: 'bugs', atlas: 'collection-extension/ground-bugs.png', crop: [9, 10, 20, 30] },
    { id: 'field_cricket', kind: 'bugs', atlas: 'collection-extension/green-cricket.png', crop: [40, 10, 25, 30] },
  ];
  const art = factory(() => {}, {
    loadBugs: async () => ({
      entries,
      images: new Map([
        ['bugs/specimens.png', original],
        ['collection-extension/wildlife.png', extension],
        ['collection-extension/ground-bugs.png', ground],
        ['collection-extension/green-cricket.png', extension],
      ]),
    }),
    loadBirds: async () => null,
    makeCanvas: () => null,
  });
  art.use(true, false);
  await Promise.resolve();
  await Promise.resolve();
  const ctx = context();
  for (const [species, kind] of [
    ['swallowtail', 'butterfly'],
    ['painted_lady', 'butterfly'],
    ['ladybug', 'beetle'],
    ['field_cricket', 'cricket'],
  ])
    assert.equal(art.bug(ctx, { species, kind, x: 0, y: 0, phase: 0, heading: 0 }, 1), true);
  assert.deepEqual(
    ctx.calls.map(call => call[0]),
    [original, extension, ground, extension],
  );
  assert.ok(ctx.calls[2][7] < ctx.calls[0][7], 'ladybug remains smaller than a butterfly');
});

test('green cricket fallback preserves its jumping legs and leaf-green body', () => {
  const ladybug = bugSvg({ kind: 'beetle', look: { body: '#da493d', edge: '#342a22' } });
  const cricket = bugSvg({ kind: 'cricket', look: { body: '#7b9e57', edge: '#3f5732' } });
  assert.match(cricket, /M24 29L12 18L8 41/);
  assert.notEqual(ladybug, cricket);
});

test('living-yard preparation decodes each distinct bug atlas once across scenes', async t => {
  const entries = [
    { id: 'loader_beetle', kind: 'bugs', atlas: 'test/beetles.png', crop: [0, 0, 20, 20] },
    { id: 'loader_cricket', kind: 'bugs', atlas: 'test/beetles.png', crop: [20, 0, 20, 20] },
    { id: 'loader_butterfly', kind: 'bugs', atlas: 'test/wings.png', crop: [0, 0, 20, 20] },
    { id: 'loader_fish', kind: 'fish', atlas: 'test/fish.png', crop: [0, 0, 20, 20] },
  ];
  const decoded = [];
  const previous = globalThis.Image;
  globalThis.Image = class {
    decode() {
      decoded.push(this.src);
      return Promise.resolve();
    }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.Image;
    else globalThis.Image = previous;
  });
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return { ok: true, json: async () => entries };
  });
  const first = factory(() => {}, { loadBirds: async () => null, makeCanvas: () => null });
  const second = factory(() => {}, { loadBirds: async () => null, makeCanvas: () => null });
  first.use(false, false);
  assert.equal(requests, 0);
  first.use(true, false);
  second.use(true, false);
  await new Promise(setImmediate);
  assert.equal(requests, 1);
  assert.deepEqual(decoded.map(path => new URL(path).pathname.split('/').at(-1)).sort(), ['beetles.png', 'wings.png']);
  for (const art of [first, second])
    assert.equal(art.bug(context(), { species: 'loader_cricket', kind: 'cricket', x: 0, y: 0, heading: 0 }, 1), true);
});
