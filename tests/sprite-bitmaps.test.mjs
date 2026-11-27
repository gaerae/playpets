// WebKit lets go of a big image's decoded pixels while it is not on screen and decodes the whole
// sheet again for each cell drawn from it: 4.5 ms a cell in the yard, against 0.04 ms from an
// ImageBitmap (src/core/sprites.js pixels). A sheet that is in is drawn from a bitmap of it, made
// once; until then, and where there is none, from the image; and the bitmap goes with its sheet.
import assert from 'node:assert/strict';
import test from 'node:test';

class Sheet {
  static loaded = [];
  complete = true;
  naturalWidth = 1536;
  set src(value) {
    this.url = value;
    Sheet.loaded.push(this);
  }
}
const made = [];
const surface = () => {
  const drawn = [];
  return {
    drawn,
    getContext: () => ({
      clearRect() {},
      drawImage(source) {
        drawn.push(source.bitmapOf ? `bitmap:${source.bitmapOf}` : source.url);
      },
    }),
  };
};
globalThis.Image = Sheet;
globalThis.createImageBitmap = async image => {
  const bitmap = {
    bitmapOf: image.url,
    closed: false,
    close() {
      this.closed = true;
    },
  };
  made.push(bitmap);
  return bitmap;
};
const sprites = await import('../src/core/sprites.js');
const settle = () => new Promise(resolve => setImmediate(resolve));

test('a sheet is drawn from one bitmap of it once that is made, and lets it go with the sheet', async () => {
  const pet = { id: 'bitmap-pet', spriteUrl: 'sheet' };
  const first = surface();
  sprites.drawSprite(first, pet);
  assert.deepEqual(first.drawn, ['sheet'], 'the image is drawn while the bitmap is being made');
  await settle();
  const second = surface();
  sprites.drawSprite(second, pet);
  sprites.drawSprite(second, pet, 'jump', 400);
  assert.deepEqual(second.drawn, ['bitmap:sheet', 'bitmap:sheet']);
  assert.equal(made.filter(b => b.bitmapOf === 'sheet').length, 1, 'made once for the sheet');
  sprites.release(new Set());
  assert.equal(made.find(b => b.bitmapOf === 'sheet').closed, true, 'released with its sheet');
});

test('a season’s sheet lets go of the bitmap of the one it replaced once it is shown', async () => {
  const pet = { id: 'bitmap-wardrobe', spriteUrl: 'base', seasonalSpriteUrls: { winter: 'winter' } };
  const c = surface();
  sprites.setSpriteSeason('');
  sprites.drawSprite(c, pet);
  await settle();
  const base = made.find(b => b.bitmapOf === 'base');
  sprites.setSpriteSeason('winter');
  sprites.drawSprite(c, pet);
  assert.equal(base.closed, true);
  await settle();
  sprites.drawSprite(c, pet, 'jump', 400);
  assert.equal(c.drawn.at(-1), 'bitmap:winter');
  sprites.setSpriteSeason('');
  sprites.release(new Set());
});

test('a bitmap made after its sheet was let go is closed at once', async () => {
  const pet = { id: 'bitmap-late', spriteUrl: 'late' };
  sprites.drawSprite(surface(), pet);
  sprites.release(new Set());
  await settle();
  assert.equal(made.find(b => b.bitmapOf === 'late').closed, true);
});
