// A card draws its kind from a small preview, but the album's left page draws it two to three times
// larger: there the preview gives way to the drawing itself once the painted sheet it is cut from
// is decoded, so the large one is as sharp as the yard's.
import assert from 'node:assert/strict';
import test from 'node:test';

const { previewSvg, sharpen } = await import('../src/yard/art.js');

// A page with one drawing in the sprite, on the given sheets, and an Image whose decode settles as asked.
function page(ctx, { sheets = ['art/sheet.webp'], decode = () => Promise.resolve() } = {}) {
  const decoded = [];
  const symbol = { querySelectorAll: () => sheets.map(href => ({ getAttribute: () => href })) };
  const was = { document: globalThis.document, Image: globalThis.Image };
  globalThis.document = {
    getElementById: id => (id === 'art-flowers-x' ? symbol : null),
    createElementNS: (_ns, tag) => ({
      tag,
      attrs: {},
      setAttribute(name, value) {
        this.attrs[name] = value;
      },
    }),
  };
  globalThis.Image = class {
    set src(href) {
      this.href = href;
    }
    decode() {
      decoded.push(this.href);
      return decode(this.href);
    }
  };
  ctx.after(() => Object.assign(globalThis, was));
  const svg = {
    dataset: { art: 'flowers/x.svg' },
    isConnected: true,
    swapped: null,
    replaceChildren(...kids) {
      this.swapped = kids;
    },
  };
  return { svg, root: { querySelectorAll: selector => (selector === 'svg[data-art]' ? [svg] : []) }, decoded };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('a preview names the drawing it stands for', () => {
  assert.match(previewSvg('flowers/x.svg'), /data-art="flowers\/x\.svg"/);
});

test('once its sheet is decoded, a large preview is the drawing itself', async ctx => {
  const { svg, root, decoded } = page(ctx);
  sharpen(root);
  assert.equal(svg.swapped, null, 'the preview stays while the sheet decodes');
  await settle();
  assert.deepEqual(decoded, ['art/sheet.webp']);
  assert.equal(svg.swapped.length, 1);
  assert.equal(svg.swapped[0].tag, 'use');
  assert.equal(svg.swapped[0].attrs.href, '#art-flowers-x');
});

test('a sheet decoded once draws the next kind on it sharp at once', async ctx => {
  const first = page(ctx, { sheets: ['art/again.webp'] });
  sharpen(first.root);
  await settle();
  const next = page(ctx, { sheets: ['art/again.webp'] });
  sharpen(next.root);
  assert.equal(next.svg.swapped?.[0].tag, 'use', 'no blurred frame before the swap');
  assert.deepEqual(next.decoded, []);
});

test('a sheet that does not decode leaves the preview, and a page moved on is left alone', async ctx => {
  const broken = page(ctx, { sheets: ['art/broken.webp'], decode: () => Promise.reject(new Error('no')) });
  sharpen(broken.root);
  await settle();
  assert.equal(broken.svg.swapped, null);
  const gone = page(ctx, { sheets: ['art/gone.webp'] });
  sharpen(gone.root);
  gone.svg.isConnected = false;
  await settle();
  assert.equal(gone.svg.swapped, null);
});

// Each press and each push of the state draws the left page again; a sheet still decoding is not
// asked for again (a 1536x1024 sheet each time), and one that failed is tried once more later.
test('a sheet still decoding is decoded once, however often the page is drawn', async ctx => {
  let done;
  const slow = page(ctx, { sheets: ['art/slow.webp'], decode: () => new Promise(resolve => (done = resolve)) });
  sharpen(slow.root);
  sharpen(slow.root);
  sharpen(slow.root);
  assert.deepEqual(slow.decoded, ['art/slow.webp']);
  done();
  await settle();
  assert.equal(slow.svg.swapped?.[0].tag, 'use');
  let fails = true;
  const flaky = page(ctx, {
    sheets: ['art/flaky.webp'],
    decode: () => (fails ? Promise.reject(new Error('no')) : Promise.resolve()),
  });
  sharpen(flaky.root);
  await settle();
  fails = false;
  sharpen(flaky.root);
  await settle();
  assert.deepEqual(flaky.decoded, ['art/flaky.webp', 'art/flaky.webp'], 'a failed one is tried again');
  assert.equal(flaky.svg.swapped?.[0].tag, 'use');
});
