import assert from 'node:assert/strict';
import test from 'node:test';

class Sheet extends EventTarget {
  static loaded = [];
  static pending = false;
  complete = true;
  naturalWidth = 1536;
  set src(value) {
    this.url = value;
    if (Sheet.pending) this.complete = false;
    Sheet.loaded.push(this);
  }
  fail() {
    this.complete = true;
    this.naturalWidth = 0;
    this.onerror?.();
    this.dispatchEvent(new Event('error'));
  }
}
const surface = () => {
  const drawn = [];
  return {
    drawn,
    getContext: () => ({
      clearRect() {},
      drawImage(image) {
        drawn.push(image.url);
      },
    }),
  };
};

test('wardrobes load only the active sheet, repaint unchanged cells, and leave baseline pets cached', async () => {
  globalThis.Image = Sheet;
  const sprites = await import('../src/core/sprites.js');
  const pet = { id: 'wardrobe', spriteUrl: 'base', seasonalSpriteUrls: { spring: 'spring', winter: 'winter' } };
  const plain = { id: 'plain', spriteUrl: 'plain' };
  sprites.setSpriteSeason('spring');
  const a = surface();
  const b = surface();
  sprites.drawSprite(a, pet);
  sprites.drawSprite(b, plain);
  assert.deepEqual(
    Sheet.loaded.map(i => i.url),
    ['spring', 'plain'],
  );
  sprites.drawSprite(a, pet);
  assert.equal(a.drawn.length, 1);
  assert.equal(sprites.setSpriteSeason('winter'), true);
  sprites.drawSprite(a, pet);
  sprites.drawSprite(b, plain);
  assert.deepEqual(a.drawn, ['spring', 'winter']);
  assert.deepEqual(b.drawn, ['plain']);
  assert.deepEqual(
    Sheet.loaded.map(i => i.url),
    ['spring', 'plain', 'winter'],
  );
  assert.equal(sprites.setSpriteSeason('winter'), false);
  sprites.setSpriteSeason('summer');
  sprites.drawSprite(a, pet);
  assert.equal(a.drawn.at(-1), 'base');
  sprites.release(new Set());
});

test('late failures cannot resurrect another season and failed variants use the baseline once', async () => {
  const sprites = await import('../src/core/sprites.js');
  const pet = { id: 'errors', spriteUrl: 'base', seasonalSpriteUrls: { spring: 'spring', winter: 'winter' } };
  const c = surface();
  sprites.setSpriteSeason('spring');
  sprites.drawSprite(c, pet);
  const spring = Sheet.loaded.at(-1);
  sprites.setSpriteSeason('winter');
  const beforeLateError = Sheet.loaded.length;
  spring.fail();
  assert.equal(Sheet.loaded.length, beforeLateError, 'a season change alone makes old retries stale');
  sprites.drawSprite(c, pet);
  const winter = Sheet.loaded.at(-1);
  spring.fail();
  sprites.drawSprite(c, pet);
  assert.equal(Sheet.loaded.at(-1), winter);
  winter.fail(); // CORS retry.
  Sheet.loaded.at(-1).fail(); // Baseline fallback.
  sprites.drawSprite(c, pet);
  assert.equal(c.drawn.at(-1), 'base');
  const count = Sheet.loaded.length;
  sprites.drawSprite(c, pet);
  assert.equal(Sheet.loaded.length, count);
  sprites.release(new Set());
});

test('two friends sharing one pet can retain different appearances without reloading each frame', async () => {
  const sprites = await import('../src/core/sprites.js');
  sprites.setSpriteSeason('spring');
  const toon = { id: 'shared-style', spriteUrl: 'toon' };
  const real = { id: 'shared-style', spriteStyle: 'realistic', spriteUrl: 'real' };
  const a = surface(),
    b = surface();
  const before = Sheet.loaded.length;
  sprites.drawSprite(a, toon);
  sprites.drawSprite(b, real);
  sprites.drawSprite(a, toon);
  sprites.drawSprite(b, real);
  assert.equal(Sheet.loaded.length - before, 2);
  assert.deepEqual(a.drawn, ['toon']);
  assert.deepEqual(b.drawn, ['real']);
  sprites.release(new Set(['shared-style']));
  sprites.drawSprite(a, toon);
  sprites.drawSprite(b, real);
  assert.equal(Sheet.loaded.length - before, 2, 'both active appearances remain cached');
  sprites.release(new Set());
});

test('closing an unused shelf prevents delayed previews from reloading released sheets', async () => {
  const sprites = await import('../src/core/sprites.js');
  const target = surface();
  const pet = { id: 'closed-shelf', spriteUrl: 'closed' };
  Sheet.pending = true;
  sprites.drawStill(target, pet);
  Sheet.pending = false;
  const delayed = Sheet.loaded.at(-1);
  const before = Sheet.loaded.length;
  sprites.release(new Set());
  delayed.complete = true;
  delayed.dispatchEvent(new Event('load'));
  assert.equal(Sheet.loaded.length, before, 'released sheets stay released');
  assert.deepEqual(target.drawn, []);
  delayed.fail();
  assert.equal(Sheet.loaded.length, before, 'released errors cannot restart loading either');
  sprites.release(new Set());
});

test('reused still previews ignore late loads and retries from the previous friend', async () => {
  class PendingSheet extends Sheet {
    complete = false;
  }
  globalThis.Image = PendingSheet;
  const sprites = await import('../src/core/sprites.js');
  sprites.release(new Set());
  const c = surface();
  const old = { id: 'old-preview', spriteUrl: 'old-preview' };
  const next = { id: 'next-preview', spriteUrl: 'next-preview' };
  sprites.drawStill(c, old);
  const previous = Sheet.loaded.at(-1);
  sprites.drawStill(c, next);
  const current = Sheet.loaded.at(-1);
  current.complete = true;
  current.dispatchEvent(new Event('load'));
  previous.complete = true;
  previous.dispatchEvent(new Event('load'));
  assert.deepEqual(c.drawn, ['next-preview']);
  previous.fail();
  const retry = Sheet.loaded.at(-1);
  retry.complete = true;
  retry.dispatchEvent(new Event('load'));
  assert.deepEqual(c.drawn, ['next-preview'], 'stale failure retries cannot reclaim the canvas');
  sprites.release(new Set());
  globalThis.Image = Sheet;
});

test('a friend keeps its current sheet on screen until the new season has decoded', async () => {
  globalThis.Image = Sheet;
  const sprites = await import('../src/core/sprites.js');
  const pet = { id: 'changing', spriteUrl: 'base', seasonalSpriteUrls: { spring: 'spring', winter: 'winter' } };
  const canvas = surface();
  sprites.setSpriteSeason('spring');
  sprites.drawSprite(canvas, pet);
  Sheet.pending = true;
  sprites.setSpriteSeason('winter');
  sprites.drawSprite(canvas, pet, 'idle', 1000);
  assert.equal(canvas.drawn.at(-1), 'spring');
  assert.ok(canvas._pk, 'the canvas was not cleared');
  const winter = Sheet.loaded.at(-1);
  winter.complete = true;
  sprites.drawSprite(canvas, pet, 'idle', 2000);
  assert.equal(canvas.drawn.at(-1), 'winter');
  Sheet.pending = false;
  sprites.release(new Set());
});
