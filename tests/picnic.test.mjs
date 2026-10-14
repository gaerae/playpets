import assert from 'node:assert/strict';
import test from 'node:test';
import { picnicLayout } from '../src/yard/care.js';

test('a shared picnic fits the field at its edges in full and mini yards', () => {
  for (const [width, height, zoom] of [
    [1180, 780, 1],
    [460, 320, 0.57],
  ]) {
    for (const [x, y] of [
      [0, 0],
      [width, height],
    ]) {
      const p = picnicLayout({ x, y, width, height, top: height * 0.62, zoom, count: 3 });
      assert.ok(p.x - p.width / 2 >= 0);
      assert.ok(p.x + p.width / 2 <= width);
      assert.ok(p.y - p.height / 2 >= height * 0.62);
      assert.ok(p.y + p.height / 2 <= height - 20);
      assert.equal(p.seats.length, 3);
      assert.equal(new Set(p.seats.map(s => `${s.x},${s.y}`)).size, 3);
      assert.ok(
        p.seats.every(s => s.y <= p.y + p.height * 0.1),
        'friends gather behind and beside the food',
      );
    }
  }
});

test('one friend sits beside the shared food, and an empty yard has no seats', () => {
  const base = { x: 300, y: 300, width: 600, height: 400, top: 240, zoom: 0.7 };
  const one = picnicLayout({ ...base, count: 1 });
  assert.ok(Math.abs(one.seats[0].x - one.x) >= one.width / 2);
  assert.deepEqual(picnicLayout({ ...base, count: 0 }).seats, []);
});
