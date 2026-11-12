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
// In the yard a firefly is mostly its light: a small body (its yard crop, the bug alone, upright,
// its lantern at the light) that shows most while the light is low, then a soft halo and a
// warm-white core in its own glow. A kind keeps its own size, colour and rhythm.
test('a firefly is drawn and glows at its own size, so a small kind stays small', async () => {
  const entries = [
    { id: 'heike_firefly', kind: 'bugs', atlas: 'bugs/specimens.png', crop: [0, 0, 100, 160], yard: [10, 20, 40, 80] },
  ];
  const art = factory(() => {}, {
    loadBugs: async () => ({ images: new Map([['bugs/specimens.png', { width: 1254 }]]), entries }),
    loadBirds: async () => null,
    makeCanvas: () => ({
      getContext: () =>
        new Proxy({ createRadialGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => t[k] ?? (() => {}) }),
    }),
  });
  const plain = { species: 'heike_firefly', kind: 'firefly', look: { glow: '#c4f07e' }, x: 50, y: 60, light: 1 },
    small = { ...plain, look: { ...plain.look, size: 0.8 } };
  const painter = () =>
    new Proxy(
      {
        calls: [],
        globalAlpha: 1,
        drawImage(...args) {
          this.calls.push({ alpha: this.globalAlpha, args });
        },
      },
      { get: (t, k) => (k in t ? t[k] : () => {}) },
    );
  art.use(true, false, [plain]);
  // Before the specimens are in, the light alone: never a stretched shape.
  const early = painter();
  assert.equal(art.firefly(early, plain, 1, 1), true);
  assert.equal(early.calls.length, 2, 'only its light before its body is in');
  await Promise.resolve();
  await Promise.resolve();
  const lit = painter(),
    dim = painter(),
    half = painter(),
    tiny = painter(),
    faint = painter();
  art.firefly(lit, plain, 1, 1);
  art.firefly(dim, plain, 1, 0);
  art.firefly(half, plain, 1, 0.5);
  art.firefly(tiny, small, 1, 1);
  art.firefly(faint, { ...plain, light: 0.5 }, 1, 1);
  const [body, halo, core] = lit.calls;
  assert.equal(lit.calls.length, 3, 'its body, then its halo and its core over it');
  assert.deepEqual(body.args.slice(1, 5), [10, 20, 40, 80], 'the bug alone, from its yard crop');
  const [, , , , , dx, dy, dw, dh] = body.args;
  assert.equal(dh, 9, 'a small body');
  assert.equal(dw, 4.5, 'at its own proportions, upright');
  assert.equal(dx, 50 - 2.25);
  assert.ok(Math.abs(dy - (60 - 9 * 0.82)) < 1e-9, 'its lantern at the light');
  assert.deepEqual(halo.args.slice(1), [50 - 12, 60 - 12, 24, 24], 'a soft halo');
  assert.deepEqual(core.args.slice(1), [50 - 6.5, 60 - 6.5, 13, 13], 'and a core, a clear point');
  // Quieter than a lantern's pool or the moon: the halo is soft even fully lit and the core is the
  // only bright point. The light follows the blink evenly, so with random phases about half of
  // them show at once, and a dark one is nearly gone.
  assert.ok(Math.abs(halo.alpha - 0.55) < 1e-9, 'the halo stays soft');
  assert.equal(core.alpha, 1, 'the core is the bright point');
  assert.ok(half.calls[1].alpha > 0.25 && half.calls[1].alpha < 0.4, 'half lit still glows');
  assert.ok(half.calls[2].alpha > 0.5 && half.calls[2].alpha < 0.7);
  assert.ok(dim.calls[1].alpha < 0.1 && dim.calls[2].alpha < 0.2, 'a dark one is nearly gone');
  assert.ok(dim.calls[0].alpha > body.alpha, 'the body shows most while the light is low');
  assert.ok(halo.alpha > dim.calls[1].alpha && core.alpha > dim.calls[2].alpha, 'the light is brightest lit');
  for (const [i, part] of lit.calls.entries()) assert.ok(Math.abs(faint.calls[i].alpha - part.alpha / 2) < 1e-9);
  for (const [i, part] of lit.calls.entries())
    assert.ok(Math.abs(tiny.calls[i].args.at(-1) - part.args.at(-1) * 0.8) < 1e-9, 'a small kind stays small');
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
  assert.equal(canvases, 4);
  assert.equal(gradients, 4);
  const ctx = context();
  for (let frame = 0; frame < 100; frame++) {
    assert.equal(art.firefly(ctx, creature, 0.5, 1), true);
    assert.equal(art.star(ctx, { x: 20, y: 30, r: 1 }), true);
    assert.equal(art.streak(ctx, 20, 30, 0.5, 60, 2), true);
  }
  assert.equal(canvases, 4);
  assert.equal(gradients, 4);
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
    { id: 'field_cricket', kind: 'bugs', atlas: 'collection-extension/field-cricket.png', crop: [40, 10, 25, 30] },
  ];
  const art = factory(() => {}, {
    loadBugs: async () => ({
      entries,
      images: new Map([
        ['bugs/specimens.png', original],
        ['collection-extension/wildlife.png', extension],
        ['collection-extension/ground-bugs.png', ground],
        ['collection-extension/field-cricket.png', extension],
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

test('the cricket fallback keeps its jumping legs and its own body', () => {
  const ladybug = bugSvg({ kind: 'beetle', look: { body: '#da493d', edge: '#342a22' } });
  const cricket = bugSvg({ kind: 'cricket', look: { body: '#9a5a34', edge: '#4a2a18' } });
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
