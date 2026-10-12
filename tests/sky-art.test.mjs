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

test('the backdrop waits for its picture, keeps it through a change, and tells fishing only when the pond moves', async t => {
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
  globalThis.Image = class {
    width = 1536;
    height = 1024;
    constructor() {
      images.push(this);
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
  const scene = { world: 'woodland', period: 'day', weather: 'clear', season: 'summer' };
  easel.set(scene);
  assert.equal(yard.dataset.environment, undefined, 'nothing painted before the picture is in');
  images.find(image => image.src.endsWith('/green.png')).onload();
  assert.equal(yard.dataset.environment, 'illustrated');
  assert.deepEqual(changed, [], 'the first picture cannot invalidate an existing trip');
  easel.set({ ...scene, period: 'night' });
  easel.set({ ...scene, season: 'winter' });
  assert.equal(yard.dataset.environment, 'illustrated', 'the picture on the wall stays while the next decodes');
  images.find(image => image.src.endsWith('/winter.png')).onload();
  assert.deepEqual(changed, [], 'one picture replacing another leaves the pond where it was');
  easel.set({ ...scene, season: 'spring' });
  images.find(image => image.src.endsWith('/spring.png')).onerror();
  assert.equal(yard.dataset.environment, 'painted');
  assert.deepEqual(changed, ['painted'], 'a picture that fails to load falls back to painted geometry');
  assert.equal(images.filter(image => image.src.includes('/sky/')).length, 4);
});
