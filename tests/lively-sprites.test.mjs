// How a friend's canvas shows standing and looking (core/sprites.js drawSprite): the idle rhythm by
// the canvas's own seed, and a look that turns one direction at a time and holds before it ends.

import assert from 'node:assert/strict';
import test from 'node:test';

class Sheet {
  complete = true;
  naturalWidth = 1536;
  set src(value) {
    this.url = value;
  }
}
globalThis.Image = Sheet;
const { idleCell, LOOK_HOLD, lookFrame, TURN_MS } = await import('../src/core/animation.js');
const sprites = await import('../src/core/sprites.js');
const { drawSprite } = sprites;

const surface = () => {
  const drawn = [];
  return {
    drawn,
    getContext: () => ({
      clearRect() {},
      drawImage(_image, sx, sy) {
        drawn.push({ row: sy / 208, column: sx / 192 });
      },
    }),
  };
};
const pet = { id: 'lively', spriteUrl: 'lively', version: 2 };
const last = canvas => canvas.drawn.at(-1);

test('a standing friend shows the idle rhythm of its own canvas', () => {
  const a = surface(),
    b = surface();
  drawSprite(a, pet, 'idle', 0, null, null, 0);
  drawSprite(b, pet, 'idle', 0, null, null, 0);
  assert.notEqual(a._seed, b._seed, 'each canvas has its own seed');
  for (let t = 0; t < 30_000; t += 50) {
    drawSprite(a, pet, 'idle', t, null, null, t);
    assert.deepEqual(last(a), idleCell(t, a._seed), `at ${t}`);
  }
});

test('a look starts at the pointer, then turns one direction each turn step', () => {
  const c = surface();
  const right = { x: 100, y: 0 },
    left = { x: -100, y: 0 };
  drawSprite(c, pet, 'idle', 0, right, null, 0);
  assert.deepEqual(last(c), lookFrame(right.x, right.y), 'straight to where the pointer is');
  // The pointer goes round to the other side: one direction a step, not a jump.
  let at = 0;
  const seen = [];
  for (; at <= 20 * TURN_MS; at += 10) {
    drawSprite(c, pet, 'idle', at, left, null, at);
    const cell = last(c);
    if (JSON.stringify(cell) !== JSON.stringify(seen.at(-1))) seen.push(cell);
  }
  assert.equal(seen.length, 9, 'from right to left through eight directions');
  assert.deepEqual(seen.at(-1), lookFrame(left.x, left.y));
  assert.equal(c._turning, false, 'arrived');
});

test('a look that ends holds its direction a moment, then the friend stands again', () => {
  const c = surface();
  drawSprite(c, pet, 'idle', 0, { x: 100, y: 0 }, null, 0);
  drawSprite(c, pet, 'idle', 100, null, null, 100);
  assert.deepEqual(last(c), lookFrame(100, 0), 'still looking');
  assert.equal(c._turning, true, 'the loop keeps drawing until it stands');
  drawSprite(c, pet, 'idle', 100 + LOOK_HOLD - 1, null, null, 100 + LOOK_HOLD - 1);
  assert.deepEqual(last(c), lookFrame(100, 0));
  drawSprite(c, pet, 'idle', 100 + LOOK_HOLD, null, null, 100 + LOOK_HOLD);
  assert.deepEqual(last(c), idleCell(100 + LOOK_HOLD, c._seed), 'standing');
  assert.equal(c._turning, false);
});

test('a friend that walks off stops looking at once', () => {
  const c = surface();
  drawSprite(c, pet, 'idle', 0, { x: 100, y: 0 }, null, 0);
  drawSprite(c, pet, 'right', 10, null, null, 10);
  assert.equal(last(c).row, 1, 'the walk row');
  assert.equal(c._turning, false);
});

// The yard's loop runs busy while a canvas turns (app.js pace): a turn that can no longer be drawn
// must not leave it turning.
test('a turn cut off by reduced motion or a sheet without look rows ends at once', () => {
  const { reduced } = sprites;
  const previous = reduced.matches;
  try {
    const c = surface();
    drawSprite(c, pet, 'idle', 0, { x: 100, y: 0 }, null, 0);
    drawSprite(c, pet, 'idle', 10, { x: -100, y: 0 }, null, 10);
    assert.equal(c._turning, true, 'turning');
    reduced.matches = true;
    drawSprite(c, pet, 'idle', 20, { x: -100, y: 0 }, null, 20);
    assert.equal(c._turning, false, 'reduced motion shows one still cell');
    reduced.matches = previous;
    drawSprite(c, pet, 'idle', 30, { x: 100, y: 0 }, null, 30);
    drawSprite(c, pet, 'idle', 40, { x: -100, y: 0 }, null, 40);
    assert.equal(c._turning, true, 'turning again');
    drawSprite(c, { ...pet, id: 'plain', version: 1 }, 'idle', 50, { x: -100, y: 0 }, null, 50);
    assert.equal(c._turning, false, 'its look changed to a sheet with no look rows');
  } finally {
    reduced.matches = previous;
  }
});

test('a sheet without look rows never turns', () => {
  const c = surface();
  drawSprite(c, { ...pet, id: 'old', version: 1 }, 'idle', 0, { x: 100, y: 0 }, null, 0);
  assert.equal(last(c).row, 0);
  assert.ok(!c._turning);
});
