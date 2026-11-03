import assert from 'node:assert/strict';
import test from 'node:test';
import { brightColor, fireworks, sparkAt } from '../src/yard/fireworks.js';

const w = 1000,
  h = 600;
const friends = [
  { x: 200, y: 420, color: '#ff9db0' },
  { x: 500, y: 450, color: '#9fd8ff' },
  { x: 780, y: 430, color: '#c5f2a2' },
];
const seeded =
  (seed = 1) =>
  () =>
    ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test('every friend sends up a shell of its own colour from where it stands', () => {
  const { sparks, bursts } = fireworks(w, h, 0, friends, seeded());
  friends.forEach((friend, i) => {
    const own = bursts.filter(b => b.by === i);
    assert.ok(own.length >= 2, 'once on its own and again in the finale');
    const first = own[0],
      shell = sparks.find(s => s.rise && s.since + s.life === first.at && s.tx === first.x);
    assert.deepEqual([shell.cx, shell.cy], [friend.x, friend.y], 'from the friend');
    assert.ok(
      sparks.some(s => s.since === first.at && s.cx === first.x && s.color === friend.color),
      'in its colour',
    );
  });
  // One after another to begin with, in the order the friends stand.
  const opening = friends.map((_, i) => bursts.find(b => b.by === i).at);
  assert.deepEqual(
    [...opening].sort((a, b) => a - b),
    opening,
  );
});

test('the show builds to a finale and ends with one heart for everyone', () => {
  const { sparks, bursts } = fireworks(w, h, 1000, friends, seeded(7));
  const heart = bursts.at(-1);
  assert.equal(heart.kind, 'heart');
  assert.equal(heart.by, -1, 'from everyone');
  assert.ok(bursts.slice(0, -1).every(b => b.at < heart.at));
  const finale = bursts.filter(b => b.finale);
  assert.ok(finale.length >= 8);
  assert.ok(Math.max(...finale.map(b => b.at)) - Math.min(...finale.map(b => b.at)) <= 2500, 'close together');
  assert.ok(finale.some(b => b.kind === 'willow'));
  assert.ok(new Set(bursts.map(b => b.kind)).size >= 5, 'shells of many kinds');
  for (const s of sparks) {
    assert.ok(s.tx > 0 && s.tx < w && s.ty > 0 && s.ty < h * 0.5, JSON.stringify(s));
    assert.ok(s.since >= 1000 && s.since + s.life <= 1000 + 16000);
  }
});

test('the heart is the largest burst and hangs in the sky the longest', () => {
  const { sparks, bursts } = fireworks(w, h, 0, friends, seeded(9));
  const heart = bursts.at(-1);
  assert.ok(bursts.slice(0, -1).every(b => b.r < heart.r));
  assert.ok(heart.r >= Math.min(w, h) * 0.12);
  const lasts = b => Math.max(...sparks.filter(s => s.since === b.at && s.cx === b.x && !s.flash).map(s => s.life));
  assert.ok(bursts.slice(0, -1).every(b => lasts(b) < lasts(heart)));
});

test('with no friends in the yard the shells rise from behind the hills', () => {
  const { sparks, bursts } = fireworks(w, h, 0, [], seeded(3));
  assert.ok(bursts.length >= 10);
  for (const s of sparks.filter(s => s.rise)) assert.ok(s.cy > h * 0.4 && s.cy < h * 0.5);
});

test("a crossette's stars split in four where they burn out", () => {
  const { sparks, bursts } = fireworks(w, h, 0, friends, seeded(11));
  const burst = bursts.find(b => b.kind === 'crossette');
  assert.ok(burst);
  const stars = sparks.filter(s => s.since === burst.at && s.cx === burst.x && s.cy === burst.y && !s.flash);
  for (const star of stars) {
    const end = sparkAt(star, star.since + star.life - 1),
      pieces = sparks.filter(s => s.since === star.since + star.life && Math.hypot(s.cx - end.x, s.cy - end.y) < 2);
    assert.equal(pieces.length, 4);
  }
});

test('a friend colour is lifted to a bright firework colour, whatever the friend looks like', () => {
  const lightness = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  };
  for (const [r, g, b] of [
    [90, 50, 20],
    [10, 10, 10],
    [250, 250, 250],
    [40, 120, 200],
  ]) {
    const c = brightColor(r, g, b);
    assert.match(c, /^#[0-9a-f]{6}$/);
    assert.ok(lightness(c) >= 0.6 && lightness(c) <= 0.85, `${[r, g, b]} → ${c}`);
  }
});

test('a spark flies out fast, slows, then droops and fades', () => {
  const s = { cx: 100, cy: 100, tx: 200, ty: 100, fall: 30, since: 1000, life: 2000, color: '#fff' };
  assert.equal(sparkAt(s, 999), null, 'not yet');
  const at = now => sparkAt(s, now);
  assert.deepEqual([at(1000).x, at(1000).y], [100, 100]);
  assert.ok(at(1500).x - at(1000).x > 2 * (at(2000).x - at(1500).x), 'it slows down');
  assert.equal(at(1500).alpha, 1);
  const end = at(2999);
  assert.ok(Math.abs(end.x - 200) < 2 && end.y > 120, 'it ends at its place, sunk by its fall');
  assert.ok(end.alpha < 0.05);
  assert.equal(at(3000), null, 'gone');
});
