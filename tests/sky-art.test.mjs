import assert from 'node:assert/strict';
import test from 'node:test';
import { paintSky } from '../src/yard/clouds.js';

test('illustrated skies keep lighting but do not duplicate the procedural clouds', () => {
  let draws = 0;
  const ctx = {
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    drawImage() {
      draws++;
    },
    save() {},
    restore() {},
  };
  const palette = { 'sky-a': '#aaccee', 'sky-m': '#ccddee', 'sky-b': '#ddeeff' };
  const images = new Map([
    ['cumulus', {}],
    ['small', {}],
    ['overcast', {}],
  ]);
  paintSky(ctx, 1000, 600, palette, { period: 'day', weather: 'clear', season: 'summer' }, images);
  assert.equal(draws, 2);
  draws = 0;
  paintSky(ctx, 1000, 600, palette, { period: 'night', weather: 'clear', season: 'summer' }, images);
  assert.equal(draws, 0);
  paintSky(ctx, 1000, 600, palette, { period: 'day', weather: 'rain', season: 'summer' }, images);
  assert.equal(draws, 3);
});

// An easel on a fake yard: the pictures it asks for (each settled by the test with onload or
// onerror), the yard, and the place modes it reported as changing the land.
// Settles the decoding of the picture whose address ends with `name`, and lets the easel hear it.
async function settle(images, name, ok = true) {
  const image = images.find(image => image.src.endsWith(name));
  if (ok) image.decoded();
  else image.broken();
  await new Promise(resolve => setImmediate(resolve));
}
async function easelOnFakeYard(t) {
  await import('./support/content.mjs');
  const { createEasel } = await import('../src/yard/easel.js');
  const images = [];
  const globals = ['Image', 'ResizeObserver', 'window', 'document', 'getComputedStyle'].map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  t.after(() => {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  // A place's picture is painted once decoded (decode()); the sky's clouds once loaded (onload).
  globalThis.Image = class {
    width = 1536;
    height = 1024;
    constructor() {
      images.push(this);
      this.decoding = new Promise((resolve, reject) => {
        this.decoded = resolve;
        this.broken = () => reject(new Error('not a picture'));
      });
    }
    decode() {
      return this.decoding;
    }
  };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#aabbcc' });
  const ctx = new Proxy(
    { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
    { get: (object, key) => object[key] ?? (() => {}) },
  );
  globalThis.document = {
    createElement: () => ({ getContext: () => ctx, classList: { add() {} } }),
  };
  const slot = { querySelectorAll: () => [], append() {} };
  const yard = {
    clientWidth: 800,
    clientHeight: 560,
    dataset: {},
    querySelector: () => slot,
    querySelectorAll: () => [],
  };
  const changed = [];
  const easel = createEasel(yard, { matches: true }, () => changed.push(yard.dataset.environment));
  return { easel, images, yard, changed };
}

test('the backdrop waits for its picture to decode, keeps it through a change, and tells fishing only when the pond moves', async t => {
  const { easel, images, yard, changed } = await easelOnFakeYard(t);
  const scene = { world: 'woodland', period: 'day', weather: 'clear', season: 'summer' };
  easel.set(scene);
  assert.equal(yard.dataset.environment, undefined, 'nothing painted before the picture is in');
  images.find(image => image.src.endsWith('/green.webp')).onload?.();
  assert.equal(yard.dataset.environment, undefined, 'nor before it is decoded: drawing it would decode it there');
  await settle(images, '/green.webp');
  assert.equal(yard.dataset.environment, 'illustrated');
  assert.deepEqual(changed, [], 'the first picture cannot invalidate an existing trip');
  easel.set({ ...scene, period: 'night' });
  easel.set({ ...scene, season: 'winter' });
  assert.equal(yard.dataset.environment, 'illustrated', 'the picture on the wall stays while the next decodes');
  await settle(images, '/winter.webp');
  assert.deepEqual(changed, [], 'one picture replacing another leaves the pond where it was');
  easel.set({ ...scene, season: 'spring' });
  await settle(images, '/spring.webp', false);
  assert.equal(yard.dataset.environment, 'painted');
  assert.deepEqual(changed, ['painted'], 'a picture that fails to load falls back to painted geometry');
  assert.equal(images.filter(image => image.src.includes('/sky/')).length, 4);
});

test('a first picture that fails lays the field out again on the painted land', async t => {
  // Before anything is painted the field follows the picture's geometry (field.js), so the painted
  // land standing in for it from the start moves where the field begins.
  const { easel, images, yard, changed } = await easelOnFakeYard(t);
  easel.set({ world: 'woodland', period: 'day', weather: 'clear', season: 'summer' });
  await settle(images, '/green.webp', false);
  assert.equal(yard.dataset.environment, 'painted');
  assert.deepEqual(changed, ['painted']);
});
