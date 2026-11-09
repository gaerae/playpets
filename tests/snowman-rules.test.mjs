import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BALLS,
  DRAG_FASTER,
  SNOWMAN,
  START,
  dragStep,
  grow,
  liftPoint,
  push,
  rollRange,
  rollSpeed,
  snowmanOffer,
  stackBottoms,
  stackSpot,
} from '../src/yard/snowman-rules.js';

test('a ball grows as it rolls and rolls more slowly as it grows', () => {
  assert.ok(rollSpeed(0.5) < rollSpeed(START) && rollSpeed(1) < rollSpeed(0.5));
  assert.ok(rollSpeed(1) <= rollSpeed(START) / 2);
  assert.ok(Math.abs(grow(0.18, 0.2, 1) - 0.28) < 1e-9);
  assert.equal(grow(0.68, 0.2, 0.7), 0.7, 'never past its size');
  assert.equal(push(0.44, 0.46), 0.46);
  assert.ok(Math.abs(push(0.2, 1) - 0.25) < 1e-9);
});

test('a dragged ball follows the pointer no faster than its weight allows', () => {
  const step = dragStep({ x: 0.2, y: 0.7 }, { x: 0.9, y: 0.7 }, 1, 1000);
  assert.ok(Math.abs(step.x - (0.2 + rollSpeed(1) * DRAG_FASTER)) < 1e-9);
  assert.deepEqual(dragStep({ x: 0.2, y: 0.7 }, { x: 0.21, y: 0.7 }, 0.2, 1000), { x: 0.21, y: 0.7 }, 'never past it');
});

test('three balls stack 1 : 0.7 : 0.46, each resting a little into the one below', () => {
  assert.deepEqual(BALLS, [1, 0.7, 0.46]);
  const b = stackBottoms(BALLS);
  assert.equal(b[0], 0);
  assert.ok(Math.abs(b[1] - 0.82) < 1e-9 && Math.abs(b[2] - 1.394) < 1e-9);
});

test('a lifted ball arcs from where it was to the stack', () => {
  const from = { x: 100, y: 300 };
  const to = { x: 400, y: 200 };
  assert.deepEqual(liftPoint(from, to, 0, 60), from);
  assert.deepEqual(liftPoint(from, to, 1, 60), to);
  assert.deepEqual(liftPoint(from, to, 0.5, 60), { x: 250, y: 190 });
  assert.deepEqual(liftPoint(from, to, 2, 60), to);
});

test('the stack goes where the yard has room, and friends roll on the other side', () => {
  assert.deepEqual(stackSpot([]), { x: 0.72, y: 0.72 });
  assert.deepEqual(stackSpot([{ x: 0.7, y: 0.7 }]), { x: 0.28, y: 0.72 });
  assert.deepEqual(
    stackSpot([
      { x: 0.3, y: 0.7 },
      { x: 0.7, y: 0.7 },
    ]),
    { x: 0.5, y: 0.72 },
  );
  assert.deepEqual(rollRange(0.72), [0.08, 0.56]);
  assert.deepEqual(rollRange(0.28), [0.44, 0.92]);
});

test('building is offered in the winter yard, once a day, with room or a snowman to replace', () => {
  const garden = (decor = [], snowmanDay = '') => ({ decor, snowmanDay });
  const at = (d, h, m) => new Date(2026, 11, d, h, m);
  const offer = (date, g, season = 'winter') => snowmanOffer({ date, season, garden: g, decorMax: 12 });
  assert.equal(offer(at(15, 10, 0), garden()), null);
  assert.equal(offer(at(15, 10, 0), garden(), 'autumn'), 'not_winter');
  assert.equal(offer(at(15, 10, 0), garden(), null), 'not_winter', 'not in the living room');
  assert.equal(offer(at(15, 23, 59), garden([], '2026-12-15')), 'built_today');
  assert.equal(offer(at(16, 0, 1), garden([], '2026-12-15')), null, 'a new local day');
  assert.equal(offer(at(14, 10, 0), garden([], '2026-12-15')), 'built_today', 'a clock set back');
  const twelve = n => Array.from({ length: 12 }, (_, i) => ({ id: `${i}`, kind: i < n ? SNOWMAN : 'xmas_tree' }));
  assert.equal(offer(at(15, 10, 0), garden(twelve(0))), 'full', 'hidden decorations count too');
  assert.equal(offer(at(15, 10, 0), garden(twelve(1))), null, 'the old one makes room');
});
