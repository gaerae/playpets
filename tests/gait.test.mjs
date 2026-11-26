import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advance,
  BOB,
  bobShare,
  CELL_FLOOR_MS,
  cellLeftMs,
  cellTops,
  DRAWN_GAIT,
  facingOf,
  feetSpread,
  liftOf,
  nextRest,
  ownBob,
  restPhase,
  restToward,
  rowGait,
  SIDE_ROWS,
  walkCell,
} from '../src/core/gait.js';

// A row of `cells` cells, each `cell` px square, with a body block and two feet whose outer
// edges are `feet[i]` px apart, standing on the cell's bottom edge.
function row(cell, feet) {
  const width = cell * feet.length,
    rgba = new Uint8ClampedArray(width * cell * 4);
  const paint = (x, y) => {
    rgba[(y * width + x) * 4 + 3] = 255;
  };
  feet.forEach((apart, i) => {
    const middle = i * cell + cell / 2;
    for (let y = cell * 0.2; y < cell * 0.8; y++) for (let x = middle - 4; x < middle + 4; x++) paint(x, y);
    for (let y = cell * 0.8; y < cell; y++) {
      for (let x = 0; x < 3; x++) {
        paint(Math.round(middle - apart / 2 + x), y);
        paint(Math.round(middle + apart / 2 - 1 - x), y);
      }
    }
  });
  return rgba;
}

test('feet spread is the width the feet cover near the ground, as a share of the cell', () => {
  const spreads = feetSpread(row(100, [60, 40, 20, 40, 60, 40, 20, 40]), 8, 100, 100);
  assert.equal(spreads.length, 8);
  assert.deepEqual(
    spreads.map(s => Math.round(s * 100)),
    [60, 40, 20, 40, 60, 40, 20, 40],
  );
});

test('a blank cell spreads nothing', () => {
  const rgba = new Uint8ClampedArray(800 * 100 * 4);
  assert.deepEqual(feetSpread(rgba, 8, 100, 100), [0, 0, 0, 0, 0, 0, 0, 0]);
});

test('the widest pair of cells four apart is the contact, the narrowest the passing', () => {
  const gait = rowGait([0.2, 0.4, 0.6, 0.4, 0.2, 0.4, 0.6, 0.4]);
  assert.equal(gait.contact, 2);
  assert.equal(gait.passing, 0);
  assert.equal(gait.stride, 1.2);
});

test('a row whose feet hardly change keeps the drawn order', () => {
  const gait = rowGait([0.3, 0.31, 0.32, 0.3, 0.31, 0.3, 0.32, 0.31]);
  assert.equal(gait.contact, 0);
  assert.equal(gait.passing, 2);
  assert.equal(rowGait([0, 0, 0, 0, 0, 0, 0, 0]).contact, 0);
});

test('the stride stays between half a body and a body and a fifth', () => {
  assert.equal(rowGait([0.1, 0.05, 0.02, 0.05, 0.1, 0.05, 0.02, 0.05]).stride, 0.5);
  assert.equal(rowGait([0.4, 0.3, 0.2, 0.3, 0.4, 0.3, 0.2, 0.3]).stride, 0.8);
});

test('the legs move with the distance walked, not the time it took', () => {
  const stride = 0.8;
  assert.equal(advance(0, 0.2, 1000, stride), 0.25);
  assert.equal(advance(0, 0.2, 2000, stride), 0.25);
  assert.equal(advance(0, 0, 1000, stride), 0);
});

test('a cell lasts at least the floor however fast the friend goes', () => {
  assert.equal(advance(0, 10, CELL_FLOOR_MS, 0.8), 1 / 8);
});

test('the phase wraps after a full cycle', () => {
  assert.ok(Math.abs(advance(0.9, 0.16, 1e6, 0.8) - 0.1) < 1e-9);
});

test('phase zero shows the passing cell and the cells go round', () => {
  const gait = { contact: 3, passing: 1 };
  assert.equal(walkCell(gait, 0), 1);
  assert.equal(walkCell(gait, 1 / 8), 2);
  assert.equal(walkCell(gait, 7 / 8), 0);
  assert.equal(walkCell(gait, 0.5), 5);
});

test('the next rest is the nearest passing cell ahead', () => {
  assert.equal(nextRest(0), 0);
  assert.equal(nextRest(0.05), 0.05);
  assert.equal(nextRest(0.2), 0.5);
  assert.equal(nextRest(0.55), 0.55);
  assert.equal(nextRest(0.7), 1);
});

test('the time left in a cell follows the speed', () => {
  // A cell is an eighth of the stride: 0.1 bodies at 0.001 bodies/ms is 100 ms.
  assert.equal(Math.round(cellLeftMs(0, 0.001, 0.8)), 100);
  assert.equal(Math.round(cellLeftMs(1 / 16, 0.001, 0.8)), 50);
  assert.equal(Math.round(cellLeftMs(0, 1, 0.8)), CELL_FLOOR_MS);
  assert.equal(cellLeftMs(0, 0, 0.8), Infinity);
});

test("each cell's top is the first row with any of the figure", () => {
  const width = 200,
    rgba = new Uint8ClampedArray(width * 50 * 4);
  rgba[(12 * width + 30) * 4 + 3] = 255;
  rgba[(20 * width + 130) * 4 + 3] = 255;
  assert.deepEqual(cellTops(rgba, 2, 100, 50), [12, 20]);
  assert.deepEqual(cellTops(new Uint8ClampedArray(width * 50 * 4), 2, 100, 50), [50, 50]);
});

test('art that already rises and falls keeps its own bob', () => {
  assert.equal(BOB, 0.015);
  assert.equal(ownBob([10, 10, 11, 10, 10, 10, 11, 10], 200), false);
  assert.equal(ownBob([10, 12, 14, 12, 10, 12, 14, 12], 200), true);
});

test('the body is lowest just after contact and highest just before', () => {
  const gait = { contact: 2, passing: 0 };
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map(cell => bobShare(gait, cell)),
    [0.5, 1, 0.5, 0, 0.5, 1, 0.5, 0],
  );
});

test('a friend faces the side until it walks steeply up or down', () => {
  assert.equal(facingOf(100, 0), 'side');
  assert.equal(facingOf(100, 80), 'side');
  assert.equal(facingOf(100, 100), 'front');
  assert.equal(facingOf(0, -50), 'back');
  assert.equal(facingOf(0, 0, 'back'), 'back');
  assert.equal(facingOf(0, 0), 'side');
});

test('facing changes only past a margin, so a path near the line does not flicker', () => {
  const tan = degrees => Math.tan((degrees * Math.PI) / 180) * 100;
  assert.equal(facingOf(100, tan(45), 'side'), 'side');
  assert.equal(facingOf(100, tan(52), 'side'), 'front');
  assert.equal(facingOf(100, tan(35), 'front'), 'front');
  assert.equal(facingOf(100, -tan(35), 'back'), 'back');
  assert.equal(facingOf(100, tan(28), 'front'), 'side');
});

test('a stop eases the legs from where they were to the passing cell reached on arrival', () => {
  const rest = restToward(0.3, 0.2, 0.8);
  assert.equal(rest.from, 0.3);
  assert.equal(rest.to, nextRest(0.3 + 0.2 / 0.8));
  assert.equal(restPhase(rest, 0.2), 0.3, 'nothing walked yet');
  assert.ok(Math.abs(restPhase(rest, 0.1) - (0.3 + rest.to) / 2) < 1e-9, 'half way');
  assert.equal(restPhase(rest, 0), rest.to, 'there');
  assert.equal(restPhase(restToward(0.5, 0, 0.8), 0), 0.5, 'a stop with no way to go');
});

test('the lift follows the bob, none where the art bobs by itself', () => {
  const gait = { contact: 0, passing: 2, stride: 0.8, ownBob: false };
  assert.equal(liftOf(gait, 3), Math.round(BOB * 208));
  assert.equal(liftOf(gait, 1), 0);
  assert.equal(liftOf({ ...gait, ownBob: true }, 3), 0);
  assert.equal(liftOf(DRAWN_GAIT, 3), 0, 'unmeasured art gets no lift');
});

test('a side walk is drawn on rows 1 (right) and 2 (left)', () => {
  assert.deepEqual(SIDE_ROWS, { right: 1, left: 2 });
});
