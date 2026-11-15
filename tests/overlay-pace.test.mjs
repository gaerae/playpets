// The desktop's frame loop wakes when a friend's cell ends, not ten times a second: a friend standing
// on the desktop changes cells about five times a second, and a still one (reduced motion) never
// (src/overlay/pace.js, overlay.js animate).

import assert from 'node:assert/strict';
import test from 'node:test';
import { cellLeft } from '../src/core/animation.js';
import { FOLLOW_MS, nextDraw } from '../src/overlay/pace.js';

const friend = (over = {}) => ({
  asset: { id: 'cat' },
  status: 'idle',
  pose: 'idle',
  until: 0,
  since: 0,
  drag: null,
  look: null,
  lookedAt: 0,
  ...over,
});

test('a standing friend is drawn again when its cell ends', () => {
  // The idle row's cells last 280, 110, 110, 140, 140 and 320 ms.
  assert.equal(nextDraw([friend()], 0), 280);
  assert.equal(nextDraw([friend()], 300), 90);
  assert.equal(nextDraw([friend()], 1099), 8, 'never sooner than a few ms after a frame');
  // Friends doing different things: the first cell to end.
  assert.equal(nextDraw([friend(), friend({ status: 'working' })], 0), 120);
});

test('an idle desktop wakes once for each cell, about half as often as every 100 ms', () => {
  let wakes = 0;
  for (let now = 0; now < 11_000; now += nextDraw([friend()], now)) wakes++;
  assert.equal(wakes, 60, 'six cells a cycle, ten cycles');
});

test('with reduced motion a friend shows one cell, and the loop rests until woken', () => {
  assert.equal(nextDraw([friend()], 0, { reduced: true }), Infinity);
  assert.equal(nextDraw([friend({ pose: 'jump', until: 1400, since: 0 })], 0, { reduced: true }), Infinity);
});

test('nobody drawn yet, or nobody at all: nothing to wake for', () => {
  assert.equal(nextDraw([], 0), Infinity);
  assert.equal(nextDraw([friend({ asset: null })], 0), Infinity);
});

test('a gesture plays its cells, holds its last one, and the friend stands again when it ends', () => {
  const jump = friend({ pose: 'jump', since: 1000, until: 2400 });
  assert.equal(nextDraw([jump], 1000), 140, 'its first cell');
  // The jump's cells end at 840 ms; it then holds its last cell until the pose ends.
  assert.equal(nextDraw([jump], 1900), 500, 'played through: wakes when the pose ends, not every few ms');
  assert.equal(nextDraw([jump], 2400), cellLeft('idle', 2400), 'standing again');
});

test('a walking friend is drawn when its step ends or the walk does', () => {
  const walking = friend({ pose: 'right', since: 0, until: 1050 });
  assert.equal(nextDraw([walking], 1000), 50, 'the walk ends first');
  assert.equal(nextDraw([walking], 500), cellLeft('right', 500), 'mid-walk: when the step ends');
});

test('a friend held or looking at the pointer is drawn every 100 ms, as before', () => {
  assert.equal(nextDraw([friend({ drag: { x: 0, y: 0 } })], 0), FOLLOW_MS);
  assert.equal(FOLLOW_MS, 100);
  const looking = friend({ look: { x: 1, y: 0 }, lookedAt: 1000 });
  assert.equal(nextDraw([looking], 1000), FOLLOW_MS);
  assert.equal(nextDraw([looking], 1350), 50, 'until the look runs out');
  assert.equal(nextDraw([looking], 1400), cellLeft('idle', 1400), 'then it stands as before');
});
