// Yard games: the rules are pure so they can be checked without the app.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chaseTarget,
  fleeTarget,
  GAMES,
  hidingSpots,
  paradeDone,
  paradePoint,
  paradePositions,
  touching,
} from '../src/yard/games.js';

const inside = p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

test('three games are offered', () => {
  assert.deepEqual(Object.keys(GAMES), ['hide', 'parade', 'tag']);
});

test('friends hide along the ridge, apart from each other', () => {
  for (const count of [1, 3, 12]) {
    const spots = hidingSpots(count, Math.random);
    assert.equal(spots.length, count);
    for (const s of spots) {
      assert.ok(inside(s));
      assert.ok(s.y <= 0.2, 'hiding spots sit at the far edge of the field');
    }
    const xs = spots.map(s => s.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 0.5 / count, 'no two friends share a spot');
  }
});

test('the parade is one closed lap around the yard', () => {
  const start = paradePoint(0),
    end = paradePoint(1);
  assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 1e-9);
  for (let t = 0; t <= 1; t += 0.05) assert.ok(inside(paradePoint(t)));
  const xs = [],
    ys = [];
  for (let t = 0; t < 1; t += 0.01) {
    const p = paradePoint(t);
    xs.push(p.x);
    ys.push(p.y);
  }
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.7, 'the lap spans the yard');
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.4);
});

test('followers trail the leader in an even line and everyone walks one full lap', () => {
  const at = paradePositions(3, 0.5);
  assert.deepEqual(at[0], paradePoint(0.5));
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(gap(at[0], at[1]) > 0.1, 'there is room between friends');
  assert.ok(Math.abs(gap(at[0], at[1]) - gap(at[1], at[2])) < 0.03, 'gaps are even');
  const start = paradePositions(3, 0),
    end = paradePositions(3, 1);
  for (let i = 0; i < 3; i++) assert.ok(gap(start[i], end[i]) < 1e-9, 'each friend ends where it started');
  assert.equal(paradeDone(0.99), false);
  assert.equal(paradeDone(1), true);
});

test('the tagger chases the nearest friend that is not immune', () => {
  const it = { x: 0.5, y: 0.5 },
    others = [
      { id: 'a', x: 0.55, y: 0.5 },
      { id: 'b', x: 0.9, y: 0.9 },
    ];
  assert.equal(chaseTarget(it, others, null).id, 'a');
  assert.equal(chaseTarget(it, others, 'a').id, 'b');
  assert.equal(chaseTarget(it, [], null), null);
});

test('runners flee away from the tagger and never get stuck in a corner', () => {
  const it = { x: 0.3, y: 0.5 },
    me = { x: 0.5, y: 0.5 };
  const target = fleeTarget(me, it, () => 0.5);
  assert.ok(inside(target));
  assert.ok(target.x > me.x, 'runs away, not toward');
  const cornered = fleeTarget({ x: 0.98, y: 0.98 }, { x: 0.9, y: 0.9 }, () => 0.5);
  assert.ok(inside(cornered));
  assert.ok(Math.hypot(cornered.x - 0.98, cornered.y - 0.98) > 0.15, 'a cornered friend breaks out along the wall');
});

test('a tag happens when two friends visibly overlap on screen, whatever their sizes', () => {
  const at = (cx, cy, size) => ({ cx, cy, size });
  assert.equal(touching(at(100, 300, 128), at(160, 300, 128)), true, 'half overlapped side by side');
  assert.equal(touching(at(100, 300, 128), at(110, 350, 128)), true, 'overlap counts vertically too');
  assert.equal(touching(at(100, 300, 128), at(240, 300, 128)), false, 'merely near is not a tag');
  assert.equal(touching(at(100, 300, 192), at(200, 300, 64)), true, 'a big friend reaches further');
  assert.equal(touching(at(100, 300, 64), at(200, 300, 64)), false);
});

// Hide and seek by name: the game names a hidden friend, and only that friend counts.
import { pickTarget, seek } from '../src/yard/games.js';

test('the game asks for one of the friends still hidden', () => {
  const hidden = new Set(['a', 'b', 'c']);
  assert.equal(
    pickTarget(hidden, () => 0),
    'a',
  );
  assert.equal(
    pickTarget(hidden, () => 0.99),
    'c',
  );
  for (let i = 0; i < 20; i++) assert.ok(hidden.has(pickTarget(hidden, Math.random)));
  assert.equal(pickTarget(new Set(), Math.random), null, 'nobody left to ask for');
});
test('only the friend asked for is found; anyone else is a miss and stays hidden', () => {
  const hidden = new Set(['a', 'b']);
  assert.equal(seek(hidden, 'a', 'a'), 'found');
  assert.equal(seek(hidden, 'a', 'b'), 'wrong');
  assert.equal(seek(hidden, 'a', 'z'), 'ignored', 'a friend already found is not a guess');
  assert.deepEqual([...hidden], ['a', 'b'], 'judging a press changes nothing by itself');
});
