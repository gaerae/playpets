import assert from 'node:assert/strict';
import test from 'node:test';
import { meteorAt, shower, wish } from '../src/yard/meteors.js';

const w = 1000,
  h = 600;
const seeded =
  (seed = 1) =>
  () =>
    ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const travel = m => Math.hypot(m.dx, m.dy);

test('a shower sends shooting stars one, two or three at a time, all from one point in the sky', () => {
  const rng = seeded(),
    sizes = [];
  let radiant = null;
  for (let i = 0; i < 80; i++) {
    const group = shower(w, h, i * 5000, rng);
    sizes.push(group.length);
    for (const m of group) {
      assert.ok(m.x > 0 && m.x < w && m.y > 0 && m.y < h * 0.3, 'they begin high in the sky');
      assert.ok(travel(m) >= w * 0.12, 'and cross a good part of it');
      assert.ok(m.since >= i * 5000 && m.since < i * 5000 + 800, 'close together');
      // Traced back, every one comes from the same point above the sky.
      const back = { x: m.x - m.dx * 3, y: m.y - m.dy * 3 };
      radiant ??= m.radiant;
      assert.deepEqual(m.radiant, radiant);
      const off = Math.abs(Math.atan2(m.dy, m.dx) - Math.atan2(m.y - radiant.y, m.x - radiant.x));
      assert.ok(off < 0.12, JSON.stringify({ m, back }));
    }
  }
  assert.ok(radiant.y < 0, 'the point they come from is beyond the top of the sky');
  assert.ok(sizes.every(n => n >= 1 && n <= 3));
  assert.ok(sizes.some(n => n === 3) && sizes.some(n => n === 2));
  assert.ok(sizes.filter(n => n === 1).length > sizes.length / 2, 'mostly one at a time');
});

test('a wish starts at the moon and falls long, slow and bright toward the middle, leaving dust', () => {
  const longest = Math.max(
    ...Array.from({ length: 40 }, (_, i) => shower(w, h, 0, seeded(i + 1)))
      .flat()
      .map(travel),
  );
  for (const moon of [
    { x: 200, y: 70 },
    { x: 820, y: 90 },
  ]) {
    const { meteor, dust } = wish(moon, w, h, 1000, seeded(5));
    assert.ok(Math.hypot(meteor.x - moon.x, meteor.y - moon.y) < 40, 'from the moon');
    assert.equal(Math.sign(meteor.dx), Math.sign(w / 2 - moon.x), 'toward the middle');
    assert.ok(meteor.dy > 0, 'and down');
    assert.ok(travel(meteor) > longest, 'farther than any in a shower');
    assert.ok(meteor.life >= 1500 && meteor.since === 1000);
    assert.ok(meteor.width > 2.5);
    assert.ok(dust.length >= 20);
    for (const d of dust) {
      assert.ok(d.since >= meteor.since && d.since <= meteor.since + meteor.life);
      // where the star was when it let the dust go
      const k = (d.since - meteor.since) / meteor.life;
      assert.ok(Math.hypot(d.cx - (meteor.x + meteor.dx * k), d.cy - (meteor.y + meteor.dy * k)) < 1);
    }
    assert.ok(Math.max(...dust.map(d => d.since + d.life)) > meteor.since + meteor.life + 500, 'the dust stays after');
  }
});

test('a shooting star runs its path once, its tail growing behind it, and fades at the end', () => {
  const m = { x: 100, y: 50, dx: 300, dy: 100, tail: 120, since: 0, life: 1000, width: 2 };
  assert.equal(meteorAt(m, -1), null);
  assert.equal(meteorAt(m, 1000), null);
  const early = meteorAt(m, 100),
    mid = meteorAt(m, 500),
    late = meteorAt(m, 950);
  assert.ok(early.length < mid.length && mid.length <= 120);
  assert.ok(Math.abs(mid.x - 250) < 1 && Math.abs(mid.y - 100) < 1);
  assert.ok(Math.abs(mid.angle - Math.atan2(100, 300)) < 1e-9);
  assert.equal(mid.alpha, 1);
  assert.ok(early.alpha < 1 && late.alpha < 0.3);
});
