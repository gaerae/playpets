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

// The bugs and petals on the scenery canvas are cut from atlases up to 2172 pixels wide, drawn
// every frame while they fly: drawn from the image, WebKit decodes the atlas again for each (see
// src/core/pixels.js). A decoded picture is handed out as an ImageBitmap where there is one.
test('a decoded picture is handed out as one bitmap of it, or the image where none can be made', async t => {
  keepGlobals(t, 'Image', 'createImageBitmap');
  globalThis.Image = class {
    decode() {
      return Promise.resolve();
    }
  };
  const made = [];
  globalThis.createImageBitmap = async image => {
    if (image.src.endsWith('refused.png')) throw new Error('refused');
    const bitmap = { of: image.src, width: 384, height: 128 };
    made.push(bitmap);
    return bitmap;
  };
  const bitmap = await decodeImage('../art/test/atlas.png');
  assert.equal(bitmap.of, new URL('../art/test/atlas.png', new URL('../src/yard/', import.meta.url)).href);
  assert.equal(await decodeImage('../art/test/atlas.png'), bitmap);
  assert.equal(made.length, 1);
  const image = await decodeImage('../art/test/refused.png');
  assert.ok(image instanceof globalThis.Image, 'a bitmap refused leaves the image');
});

// A sheet is complete (loaded) before WebKit has decoded it, and a bitmap made from it then comes
// out empty: drawn from that, three of four friends sent to a new desktop window stayed unseen
// until their outfit's sheet changed. The bitmap is made once the sheet is decoded.
test('a sheet is made into a bitmap only once it is decoded', async t => {
  keepGlobals(t, 'createImageBitmap');
  const { pixels } = await import('../src/core/pixels.js');
  let decoded;
  const image = { complete: true, naturalWidth: 1536, decode: () => new Promise(resolve => (decoded = resolve)) };
  const made = [];
  globalThis.createImageBitmap = async from => {
    const bitmap = { from };
    made.push(bitmap);
    return bitmap;
  };
  assert.equal(pixels(image), image, 'drawn from the image meanwhile');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(made.length, 0, 'no bitmap before the sheet is decoded');
  decoded();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(made.length, 1);
  assert.equal(pixels(image), made[0], 'drawn from the bitmap once it is made');
});
