// How a desktop friend's legs keep time with the positions the backend streams (overlay/legs.js):
// by the distance, easing to a passing cell as it nears its stop or when the pointer cuts it short,
// turning with a standing cell, and walking sideways only.
import assert from 'node:assert/strict';
import test from 'node:test';
import { walkCell } from '../src/core/gait.js';
import { legsOf, legsWait, stepDesktop } from '../src/overlay/legs.js';

// No sheet: the walk keeps the drawn order (gait.js DRAWN_GAIT), passing cells 2 and 6.
const ORDER = { contact: 0, passing: 2 };
const PASSING = new Set([2, 6]);
const friend = () => ({ pet: { size: 128 }, asset: null, pose: 'idle', until: 0 });
// The backend's step for a Medium friend in 40 ms (roam.rs ROAM_BODIES), well before its stop.
const STEP = 0.0007 * 128 * 40;

function walk(v, from, steps, { dx = STEP, dy = 0, toGo = () => undefined, at = 0 } = {}) {
  let x = from;
  let y = 600;
  for (let i = 0; i <= steps; i++) {
    stepDesktop(v, { x, y, toGo: toGo(i) }, at + i * 40);
    x += dx;
    y += dy;
  }
  return at + steps * 40;
}

test('the legs follow the ground covered between positions', () => {
  const v = friend();
  const now = walk(v, 100, 10, { toGo: () => 1000 });
  assert.equal(v.pose, 'right');
  assert.ok(Math.abs(v.phase - (10 * STEP) / 128 / 0.8) < 1e-9, `${v.phase}`);
  assert.equal(legsOf(v, 'right', now).legs.cell, walkCell(ORDER, v.phase));
});

test('a walk nearing its stop eases to a passing cell and arrives on it', () => {
  const v = friend();
  // 30 steps of STEP, the last few within half a stride of the stop.
  const total = 30 * STEP;
  const now = walk(v, 100, 30, { toGo: i => (i < 30 ? total - i * STEP : undefined) });
  assert.ok(PASSING.has(legsOf(v, 'right', now).legs.cell), `${legsOf(v, 'right', now).legs.cell}`);
  assert.equal(legsWait(v, now + 10), Infinity, 'standing on it, nothing more to draw');
});

test('a walk cut short settles to a passing cell in at most two cells', () => {
  const v = friend();
  const now = walk(v, 100, 7, { toGo: () => 1000 });
  const from = legsOf(v, 'right', now).legs.cell;
  assert.ok(!PASSING.has(from), `mid-step (${from})`);
  // The loop draws once more after the last position, then wakes when legsWait asks.
  const cells = [];
  for (let at = now + 40, i = 0; i < 10; i++) {
    cells.push(legsOf(v, 'right', at).legs.cell);
    const wait = legsWait(v, at);
    if (wait === Infinity) break;
    at += wait;
  }
  assert.ok(cells.length <= 3, `${cells}`);
  assert.ok(PASSING.has(cells.at(-1)), `it ends on ${cells.at(-1)}`);
  // Ahead when the next passing cell is two cells away or less, else one back: never further.
  for (const c of cells) assert.ok([0, 1, 2, 7].includes((c - from + 8) % 8), `${from} → ${c}`);
});

test('turning round shows a standing cell, then the other side', () => {
  const v = friend();
  const now = walk(v, 100, 5, { toGo: () => 1000 });
  stepDesktop(v, { x: 100 + 5 * STEP - STEP, y: 600, toGo: 1000 }, now + 40);
  assert.equal(v.pose, 'left');
  assert.deepEqual(legsOf(v, 'left', now + 40), { state: 'idle', legs: { cell: 0, lift: 0 } });
  assert.equal(legsOf(v, 'left', now + 200).state, 'left');
});

test('walking up or down the screen keeps the side it was walking', () => {
  const v = friend();
  const now = walk(v, 100, 3, { dx: -STEP, toGo: () => 1000 });
  assert.equal(v.pose, 'left');
  walk(v, 100 - 3 * STEP, 3, { dx: 0, dy: STEP, toGo: () => 1000, at: now + 40 });
  assert.equal(v.pose, 'left');
});

test('a held friend is not walked by its positions', () => {
  const v = friend();
  v.drag = {};
  walk(v, 100, 5, { toGo: () => 1000 });
  assert.equal(v.phase ?? 0, 0);
});

test('a walking friend wakes the loop for its turn or settle, not for every cell by the clock', async t => {
  class Sheet {
    complete = true;
    naturalWidth = 1536;
    set src(value) {
      this.url = value;
    }
  }
  const image = globalThis.Image;
  globalThis.Image = Sheet;
  t.after(() => {
    globalThis.Image = image;
  });
  const { nextDraw } = await import('../src/overlay/pace.js');
  const v = { ...friend(), asset: { id: 'pace-walker', spriteUrl: 'pace-walker' }, status: 'idle' };
  const now = walk(v, 100, 7, { toGo: () => 1000 });
  // Mid-step 10 ms after its last position: it looks again once positions have stopped coming.
  assert.equal(nextDraw([v], now + 10), 51);
  stepDesktop(v, { x: 100 + 8 * STEP, y: 600, toGo: 1000 }, now + 40);
  const standing = walkCell(ORDER, v.phase) === 2 || walkCell(ORDER, v.phase) === 6;
  assert.ok(standing || nextDraw([v], now + 50) > 40, 'no wake for the cell by the clock');
});

// Near its stop a Small friend moves under half a pixel a tick (roam.rs slows over the last body
// length): those steps add up, so it keeps walking and lands on the stop's passing cell.
test('a small friend creeping to its stop keeps stepping and arrives on a passing cell', () => {
  const v = { ...friend(), pet: { size: 64 } };
  const slow = 0.0007 * 64 * 0.25 * 40;
  let now = walk(v, 100, 20, { dx: 0.0007 * 64 * 40, toGo: () => 200 });
  const start = 100 + 20 * 0.0007 * 64 * 40;
  const before = v.phase;
  now = walk(v, start, 30, { dx: slow, toGo: i => (i < 30 ? 30 * slow - i * slow : undefined), at: now + 40 });
  assert.ok(v.phase > before, 'the creeping steps count');
  assert.equal(v.pose, 'right', 'still in its walk, not standing');
  assert.ok(PASSING.has(legsOf(v, 'right', now).legs.cell), `${legsOf(v, 'right', now).legs.cell}`);
});

// The backend sends every friend on a screen whenever one of them moves: one that stopped gets its
// own position again and again, and that is no step.
test('a walk cut short settles even while another friend keeps the positions coming', () => {
  const v = friend();
  let now = walk(v, 100, 7, { toGo: () => 1000 });
  const from = legsOf(v, 'right', now).legs.cell;
  assert.ok(!PASSING.has(from), `mid-step (${from})`);
  const x = 100 + 7 * STEP;
  for (let i = 1; i <= 8; i++) stepDesktop(v, { x, y: 600 }, (now += 40));
  assert.ok(PASSING.has(legsOf(v, 'right', now).legs.cell), `${legsOf(v, 'right', now).legs.cell}`);
});
