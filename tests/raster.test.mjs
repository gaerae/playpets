import assert from 'node:assert/strict';
import test from 'node:test';
import { canvasFor, decodeImage, materialCache } from '../src/yard/raster.js';
import { keepGlobals } from './support/dom.mjs';

test('a material is drawn once on its own 64 by 64 canvas, and a missing canvas or context is remembered', () => {
  const made = [];
  const cache = materialCache(() => {
    const canvas = { getContext: () => ({ canvas }) };
    made.push(canvas);
    return canvas;
  });
  let draws = 0;
  const first = cache.material('star', ctx => {
    draws++;
    assert.equal(ctx.canvas, made[0]);
  });
  assert.equal(
    cache.material('star', () => draws++),
    first,
  );
  assert.equal(cache.get('star'), first);
  assert.deepEqual([draws, made.length, first.width, first.height], [1, 1, 64, 64]);

  let asked = 0;
  const bare = materialCache(() => {
    asked++;
    return null;
  });
  assert.equal(
    bare.material('rain', () => assert.fail('nothing to draw on')),
    null,
  );
  assert.equal(
    bare.material('rain', () => assert.fail('nothing to draw on')),
    null,
  );
  assert.equal(asked, 1);
  const blind = materialCache(() => ({ getContext: () => null }));
  assert.equal(
    blind.material('snow', () => assert.fail('no context')),
    null,
  );
  assert.equal(blind.get('snow'), null);
});

test('without a page there is no canvas and no image, and nothing is fetched', async t => {
  keepGlobals(t, 'Image', 'document');
  delete globalThis.Image;
  delete globalThis.document;
  assert.equal(canvasFor(), null);
  assert.equal(await decodeImage('../art/none.png'), null);
});

test('an image is decoded once per address, and a failed one is null', async t => {
  keepGlobals(t, 'Image');
  const made = [];
  globalThis.Image = class {
    constructor() {
      made.push(this);
    }
    decode() {
      return this.src.endsWith('broken.png') ? Promise.reject(new Error('broken')) : Promise.resolve();
    }
  };
  const image = await decodeImage('../art/test/good.png');
  assert.equal(await decodeImage('../art/test/good.png'), image);
  assert.equal(made.length, 1);
  assert.equal(image.src, new URL('../art/test/good.png', new URL('../src/yard/', import.meta.url)).href);
  assert.equal(await decodeImage('../art/test/broken.png'), null);
  assert.equal(made.length, 2);
});
