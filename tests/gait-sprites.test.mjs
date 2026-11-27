// How a walk row's own art sets the gait (core/sprites.js gaitOf): measured once a sheet and row,
// and drawn in the sheet's order when its pixels cannot be read; and how drawSprite draws the cell
// and the lift a walk asks for.
import assert from 'node:assert/strict';
import test from 'node:test';

class Sheet {
  complete = true;
  naturalWidth = 1536;
  set src(value) {
    this.url = value;
  }
}
// Feet spread a share of the 192 px cell, widest in cells 2 and 6.
const SPREADS = [0.2, 0.4, 0.6, 0.4, 0.2, 0.4, 0.6, 0.4];
let reads = 0,
  unreadable = false;
function strip() {
  const drawn = [];
  return {
    drawn,
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect() {},
      drawImage(_image, sx, sy, _sw, _sh, dx, dy) {
        drawn.push({ row: sy / 208, column: sx / 192, dx, dy });
      },
      getImageData: (x, y, w, h) => {
        reads++;
        if (unreadable) throw new Error('tainted');
        const data = new Uint8ClampedArray(w * h * 4);
        for (let cell = 0; cell < w / 192; cell++) {
          const middle = cell * 192 + 96,
            half = (SPREADS[cell] * 192) / 2;
          for (let row = 40; row < 200; row++) {
            const reach = row >= 180 ? half : 20;
            for (let col = Math.round(middle - reach); col < Math.round(middle + reach); col++)
              data[(row * w + col) * 4 + 3] = 255;
          }
        }
        return { data };
      },
    }),
  };
}
globalThis.Image = Sheet;
globalThis.document = { createElement: () => strip() };
const { drawSprite, gaitOf } = await import('../src/core/sprites.js');

test("a walk row's gait comes from its art and is measured once", () => {
  const pet = { id: 'gait-pet', spriteUrl: 'gait' };
  reads = 0;
  const gait = gaitOf(pet, 1);
  assert.equal(gait.contact, 2);
  assert.equal(gait.passing, 0);
  assert.equal(gait.stride, 1.2);
  assert.equal(gait.ownBob, false, 'the figure keeps one height');
  assert.equal(gaitOf(pet, 1), gait);
  assert.equal(reads, 1);
});

test('a sheet still loading has no gait yet', () => {
  class Loading extends Sheet {
    complete = false;
  }
  globalThis.Image = Loading;
  try {
    assert.equal(gaitOf({ id: 'gait-loading', spriteUrl: 'loading' }, 1), null);
  } finally {
    globalThis.Image = Sheet;
  }
});

test('a row whose pixels cannot be read walks in the order it is drawn', () => {
  unreadable = true;
  try {
    const gait = gaitOf({ id: 'gait-tainted', spriteUrl: 'tainted' }, 1);
    assert.equal(gait.contact, 0);
    assert.equal(gait.passing, 2);
    assert.equal(gait.ownBob, true, 'no lift is added to art nobody could measure');
  } finally {
    unreadable = false;
  }
});

test('a walk draws the cell it is given, whatever the clock says', () => {
  const canvas = strip(),
    pet = { id: 'gait-walk', spriteUrl: 'walk' };
  for (const elapsed of [0, 130, 999]) {
    drawSprite(canvas, pet, 'right', elapsed, null, null, elapsed, { cell: 5, lift: 0 });
    assert.deepEqual(canvas.drawn.at(-1), { row: 1, column: 5, dx: 0, dy: 0 });
  }
  assert.equal(canvas.drawn.length, 1, 'the same cell is not drawn again');
});

test('a lift raises the cell and counts as a new drawing', () => {
  const canvas = strip(),
    pet = { id: 'gait-lift', spriteUrl: 'lift' };
  drawSprite(canvas, pet, 'left', 0, null, null, 0, { cell: 3, lift: 0 });
  drawSprite(canvas, pet, 'left', 0, null, null, 0, { cell: 3, lift: 2 });
  assert.equal(canvas.drawn.length, 2);
  assert.deepEqual(canvas.drawn.at(-1), { row: 2, column: 3, dx: 0, dy: -2 });
});
