import './support/content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOOTS } from '../src/yard/catalog.js';
import { behind, groundAllows } from '../src/yard/discovery-rules.js';
import {
  freshShoots,
  keptShoots,
  pickShoots,
  RAIN_GAP_MS,
  SHOOT_APART,
  SHOOT_STAYS_MS,
  SHOOTS_OUT,
  shootScale,
  shootSpot,
  shootTime,
  sprouting,
  underBody,
} from '../src/yard/shoot-rules.js';

const T = Date.UTC(2027, 3, 5, 9);
const seq =
  (...values) =>
  () =>
    values.length > 1 ? values.shift() : values[0];
const kept0 = { morning: '', rainAt: 0, out: [] };
const open = { soil: true, bounds: { left: 0, top: 0, right: 1, bottom: 1 }, water: [], obstacles: [] };

test('shoots sprout only in spring, outdoors, on soil', () => {
  assert.equal(shootTime({ season: 'spring', world: 'woodland' }, true), true);
  assert.equal(shootTime({ season: 'summer', world: 'woodland' }, true), false);
  assert.equal(shootTime({ season: 'spring', world: 'workshop' }, true), false);
  assert.equal(shootTime({ season: 'spring', world: 'woodland' }, false), false);
});

test('after rain a few sprout, at most once in three hours', () => {
  const rain = { before: 'rain', weather: 'clear', period: 'day', day: '2027-04-05', now: T };
  assert.equal(sprouting(kept0, rain, seq(0.2)).count, 2);
  const three = sprouting(kept0, rain, seq(0.8));
  assert.equal(three.count, 3);
  assert.equal(three.kept.rainAt, T);
  assert.equal(sprouting({ ...kept0, rainAt: T - RAIN_GAP_MS + 1 }, rain, seq(0.2)).count, 0);
  assert.equal(sprouting({ ...kept0, rainAt: T - RAIN_GAP_MS }, rain, seq(0.2)).count, 2);
  assert.equal(sprouting(kept0, { ...rain, before: 'clear' }, seq(0.2)).count, 0);
  assert.equal(sprouting(kept0, { ...rain, before: null }, seq(0.2)).count, 0);
  assert.equal(sprouting(kept0, { ...rain, weather: 'rain' }, seq(0.2)).count, 0);
  assert.equal(kept0.rainAt, 0, 'the old record is left alone');
});

test('one sprouts on a fair morning, once a day', () => {
  const fair = { before: 'clear', weather: 'clear', period: 'morning', day: '2027-04-05', now: T };
  const first = sprouting(kept0, fair, seq(0.2));
  assert.equal(first.count, 1);
  assert.equal(first.kept.morning, '2027-04-05');
  assert.equal(sprouting(first.kept, fair, seq(0.2)).count, 0);
  assert.equal(sprouting(first.kept, { ...fair, day: '2027-04-06' }, seq(0.2)).count, 1);
  assert.equal(sprouting(kept0, { ...fair, period: 'day' }, seq(0.2)).count, 0);
  assert.equal(sprouting(kept0, { ...fair, weather: 'rain' }, seq(0.2)).count, 0);
  const burst = sprouting(kept0, { ...fair, before: 'rain' }, seq(0.2));
  assert.equal(burst.count, 2);
  assert.equal(burst.kept.morning, '2027-04-05', 'a rain burst in the morning spends the morning too');
  assert.equal(sprouting(burst.kept, { ...fair, now: T + 1 }, seq(0.2)).count, 0);
});

test('kinds out are not picked again', () => {
  const picked = pickShoots(3, [{ kind: 'morel' }, { kind: 'mugwort' }], () => 0);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3);
  assert.ok(!picked.includes('morel') && !picked.includes('mugwort'));
  assert.deepEqual(
    pickShoots(
      2,
      SHOOTS.map(s => ({ kind: s.id })),
      Math.random,
    ),
    [],
  );
  const seen = new Map();
  for (let i = 0; i < 800; i++) {
    const [id] = pickShoots(1, [], seq((i + 0.5) / 800));
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  assert.equal(seen.size, SHOOTS.length);
  for (const n of seen.values()) assert.equal(n, 800 / SHOOTS.length);
});

test('a spot is on free ground, clear of what hides it, and apart from the others', () => {
  const ground = { ...open, obstacles: [{ x: 0.5, y: 0.6, rx: 0.1, ry: 0.1 }] };
  const near = [
    { x: 0.3, y: 0.5 },
    { x: 0.7, y: 0.8, kind: 'morel' },
  ];
  let found = 0;
  for (let seed = 1; seed <= 200; seed++) {
    let s = seed;
    const rng = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const spot = shootSpot(rng, ground, near);
    if (!spot) continue;
    found++;
    assert.ok(spot.x >= 0.12 && spot.x <= 0.88 && spot.y >= 0.3 && spot.y <= 0.9);
    assert.ok(groundAllows(spot, ground) && !behind(spot, ground));
    for (const n of near) assert.ok(Math.hypot(spot.x - n.x, spot.y - n.y) >= SHOOT_APART);
  }
  assert.ok(found > 150);
  assert.equal(
    shootSpot(() => 0.5, { ...ground, soil: false }, []),
    null,
  );
  assert.equal(
    shootSpot(() => 0.5, { ...open, obstacles: [{ x: 0.5, y: 0.5, rx: 2, ry: 2 }] }, []),
    null,
  );
});

test('a spot is never where a body hides it', () => {
  const ground = { ...open, obstacles: [{ x: 0.5, y: 0.8, rx: 0.1, ry: 0.1 }] };
  // The draw lands at x 0.5, y 0.6: clear of the foot, but within the body standing above it.
  const y = (0.6 - 0.3) / 0.6;
  const hidden = { x: 0.5, y: 0.6 };
  assert.ok(groundAllows(hidden, ground), 'the ground alone would take it');
  assert.ok(behind(hidden, ground), 'but a body would hide it');
  const spot = shootSpot(seq(0.5, y, 0, 0), ground, []);
  assert.ok(spot && Math.hypot(spot.x - 0.12, spot.y - 0.3) < 1e-9, 'the next draw is taken instead');
});

test("a spot is never inside a tree's or a tall gift's drawn box in front of it", () => {
  // A mature tree's foot at (0.5, 0.8), drawn up to 0.3: its feet and the body behind() guesses
  // take only the ground just around the foot.
  const ground = {
    ...open,
    unit: { x: 0.001, y: 0.003 },
    obstacles: [{ x: 0.5, y: 0.8, rx: 0.03, ry: 0.03 }],
    bodies: [{ left: 0.4, right: 0.6, top: 0.3, bottom: 0.8 }],
  };
  const inside = { x: 0.5, y: 0.6 };
  assert.ok(groundAllows(inside, ground) && !behind(inside, ground), 'clear of its feet');
  assert.equal(underBody(inside, 40, ground), true, 'but drawn over by the tree');
  assert.equal(underBody({ x: 0.5, y: 0.85 }, 40, ground), false, 'in front of the tree it is drawn over it');
  assert.equal(underBody({ x: 0.7, y: 0.6 }, 40, ground), false, 'beside the tree');
  // The shoot's own width counts, not only its foot.
  assert.equal(underBody({ x: 0.615, y: 0.6 }, 40, ground), true);
  assert.equal(underBody({ x: 0.615, y: 0.6 }, 0, ground), false);
  const spot = shootSpot(seq((0.5 - 0.12) / 0.76, 0.5, 0, 0), ground, [], 40);
  assert.ok(spot && Math.hypot(spot.x - 0.12, spot.y - 0.3) < 1e-9, 'the next draw is taken instead');
});

test('stale shoots are not fresh', () => {
  const out = [
    { id: 'a', at: T - SHOOT_STAYS_MS + 1 },
    { id: 'b', at: T - SHOOT_STAYS_MS },
    { id: 'c', at: T + 1 },
    { id: 'd', at: T },
  ];
  assert.deepEqual(
    freshShoots(out, T).map(s => s.id),
    ['a', 'd'],
  );
});

test('kept shoots read back only what makes sense', () => {
  const good = (id, extra = {}) => ({ id, kind: 'morel', world: 'woodland', x: 0.4, y: 0.5, at: T - 1000, ...extra });
  const text = (out, extra = {}) => JSON.stringify({ morning: '2027-04-05', rainAt: T - 5, out, ...extra });
  for (const bad of [null, '{', '7', '[]', '"x"']) assert.deepEqual(keptShoots(bad, T), kept0);
  const one = keptShoots(text([good('a')]), T);
  assert.deepEqual(one, { morning: '2027-04-05', rainAt: T - 5, out: [good('a')] });
  const dropped = [
    good('b', { kind: 'carp' }),
    good('c', { x: 2 }),
    good('d', { at: T + 1 }),
    good('e', { at: T - SHOOT_STAYS_MS }),
    good('a'),
    good('a'),
    good('', {}),
    good('h', { at: String(T - 1000) }),
    null,
    7,
    'x',
    good('f', { world: '' }),
    good('g', { y: NaN }),
  ];
  assert.deepEqual(
    keptShoots(text(dropped), T).out.map(s => s.id),
    ['a'],
  );
  const five = ['v', 'w', 'x', 'y', 'z'].map(id => good(id));
  assert.deepEqual(
    keptShoots(text(five), T).out.map(s => s.id),
    ['v', 'w', 'x'],
  );
  assert.equal(SHOOTS_OUT, 3);
  assert.equal(keptShoots(text([], { morning: 'today' }), T).morning, '');
  assert.equal(keptShoots(text([], { rainAt: T + 5 }), T).rainAt, 0);
});

test('a shoot shrinks with the yard down to three quarters, not into the grass of a small window', () => {
  assert.equal(shootScale(1), 1);
  assert.equal(shootScale(1.4), 1.4);
  assert.equal(shootScale(0.8), 0.8);
  assert.equal(shootScale(0.57), 0.75);
  assert.equal(shootScale(0.3), 0.75);
});
