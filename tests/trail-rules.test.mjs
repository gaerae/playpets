import assert from 'node:assert/strict';
import test from 'node:test';
import { groundAllows } from '../src/yard/discovery-rules.js';
import {
  BLOCK_MS,
  coveredAt,
  laidAt,
  seedOf,
  stamps,
  trailAnimal,
  trailOpacity,
  trailPath,
  trailsOn,
} from '../src/yard/trail-rules.js';

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const blockOf = t => Math.floor(t / BLOCK_MS) * BLOCK_MS;
const snowFrom = (from, blocks) => ms => (ms >= from && ms < from + blocks * BLOCK_MS ? 'snow' : 'clear');

test('an hour of snow that begins after a trail is laid covers it', () => {
  const L = blockOf(at(2026, 12, 14, 9));
  const w = snowFrom(L + BLOCK_MS, 3);
  assert.equal(coveredAt(L, L + 3 * BLOCK_MS, w), L + 3 * BLOCK_MS);
  assert.equal(coveredAt(L, L + 2.5 * BLOCK_MS, w), null);
  assert.equal(coveredAt(L, L + 10 * BLOCK_MS, snowFrom(L + BLOCK_MS, 2)), null);
  assert.equal(coveredAt(L, L + 10 * BLOCK_MS, snowFrom(L - BLOCK_MS, 6)), null);
});

test('a trail laid mid-block is covered by snow from the next block, not by snow already falling', () => {
  const L = blockOf(at(2026, 12, 14, 9));
  const laid = L + 0.5 * BLOCK_MS;
  assert.equal(coveredAt(laid, L + 10 * BLOCK_MS, snowFrom(L + BLOCK_MS, 3)), L + 3 * BLOCK_MS);
  assert.equal(coveredAt(laid, L + 10 * BLOCK_MS, snowFrom(L, 6)), null);
});

test('weather chosen by hand never covers a trail or makes a snowy morning', () => {
  const L = blockOf(at(2026, 12, 14, 9));
  assert.equal(
    coveredAt(L, L + 50 * BLOCK_MS, () => 'snow'),
    null,
  );
  assert.equal(
    coveredAt(L, L + 50 * BLOCK_MS, () => 'clear'),
    null,
  );
  assert.deepEqual(
    trailsOn(new Date(2026, 11, 14, 12), () => 'snow'),
    [0],
  );
});

test('a snowy night brings a second trail, except from December 26 to January 7', () => {
  const w = snowFrom(blockOf(at(2026, 12, 14, 2)), 3);
  assert.deepEqual(trailsOn(new Date(2026, 11, 14, 12), w), [0, 1]);
  assert.deepEqual(trailsOn(new Date(2026, 11, 14, 12), snowFrom(at(2026, 12, 14, 5, 20), 3)), [0]);
  for (const [y, m, d, want] of [
    [2026, 12, 25, [0, 1]],
    [2026, 12, 26, [0]],
    [2027, 1, 7, [0]],
    [2027, 1, 8, [0, 1]],
  ])
    assert.deepEqual(trailsOn(new Date(y, m - 1, d, 12), snowFrom(blockOf(at(y, m, d, 2)), 3)), want);
  assert.equal(laidAt(1, new Date(2026, 11, 14, 12), 0), at(2026, 12, 14, 5));
  assert.equal(laidAt(0, new Date(2026, 11, 14, 12), 123), 123);
});

test('each day has its animal, and a second trail is another one', () => {
  const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const firsts = new Set();
  for (
    let t = new Date(2026, 11, 1);
    t < new Date(2027, 2, 1);
    t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)
  ) {
    const day = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
    assert.notEqual(trailAnimal(day, 0, IDS), trailAnimal(day, 1, IDS));
    assert.equal(trailAnimal(day, 0, IDS), trailAnimal(day, 0, IDS));
    firsts.add(trailAnimal(day, 0, IDS));
  }
  assert.equal(firsts.size, 8);
  assert.ok(Number.isInteger(seedOf('2026-12-01', 0)) && seedOf('2026-12-01', 0) >= 0);
});

const profile = {
  soil: true,
  bounds: { left: 0, right: 1, top: 0, bottom: 1 },
  water: [{ x: 0.5, y: 0.5, rx: 0.15, ry: 0.1 }],
  obstacles: [],
};
test("a trail ends on ground a friend can dig, away from today's digs and the other trail", () => {
  const taken = [{ x: 0.3, y: 0.7 }],
    other = { x: 0.5, y: 0.85 };
  let nearSide = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const p = trailPath(seed, profile, { taken, other });
    assert.ok(p, `seed ${seed}`);
    assert.ok(p.points[0].x === 0 || p.points[0].x === 1);
    assert.ok(p.points.length >= 5 && p.points.length <= 8);
    assert.ok(p.end.x >= 0.06 && p.end.x <= 0.94);
    assert.ok(p.points[0].y >= 0.15 && p.points[0].y <= 0.85);
    let total = 0;
    for (let i = 1; i < p.points.length; i++)
      total += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y);
    assert.ok(total >= 0.6 && total <= 1.6, `length ${total}`);
    const lastDx = p.end.x - p.points[p.points.length - 2].x;
    assert.equal(p.exit, lastDx < 0 ? 'left' : 'right');
    assert.equal(p.bush, seed % 3 === 0 ? 'twigs' : 'bush');
    if (p.end.x <= 0.1 || p.end.x >= 0.9) nearSide++;
    assert.notDeepEqual([Math.floor(p.end.x * 8), Math.floor(p.end.y * 8)], [2, 5]);
    assert.ok(Math.hypot(p.end.x - other.x, p.end.y - other.y) >= 0.15);
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1],
        b = p.points[i];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.01);
      for (let k = 0; k <= n; k++)
        assert.ok(groundAllows({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, profile));
    }
  }
  assert.ok(nearSide / 200 >= 0.2 && nearSide / 200 <= 0.5, `near side ${nearSide}`);
  assert.deepEqual(trailPath(7, profile), trailPath(7, profile));
  assert.equal(trailPath(7, { ...profile, soil: false }), null);
});

test('prints alternate for walkers and keep in line for bounders', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ];
  const walk = stamps(line, { group: false, step: 10, side: 3, size: 9 }, 1);
  assert.equal(walk.length, 21);
  assert.equal(walk[0].angle, 90);
  assert.deepEqual(
    walk.slice(0, 3).map(s => s.y),
    [3, -3, 3],
  );
  const hop = stamps(line, { group: true, step: 10, side: 3, size: 9 }, 1);
  assert.ok(hop.every(s => s.y === 0));
  const dup = stamps([line[0], ...line], { group: false, step: 10, side: 3, size: 9 }, 1);
  assert.equal(dup[0].angle, 90);
  assert.equal(dup.length, 21);
  const small = stamps(line, { group: false, step: 10, side: 3, size: 9 }, 0.5);
  assert.equal(small.length, 41);
  assert.equal(small[0].size, 4.5);
});

test('prints fade over the day', () => {
  const h = 3600000;
  assert.equal(trailOpacity(0, 0), 0.6);
  assert.equal(trailOpacity(0, 2 * h), 0.55);
  assert.equal(trailOpacity(0, 8 * h), 0.35);
  assert.equal(trailOpacity(0, 24 * h), 0.35);
});
