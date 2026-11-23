// The desktop's frame loop wakes when a friend's cell ends, not ten times a second: a friend standing
// on the desktop mostly stands and plays its idle row now and then, and a still one (reduced
// motion) never changes (src/overlay/pace.js, overlay.js animate).

import assert from 'node:assert/strict';
import test from 'node:test';
import { calmRhythm, cellLeft, idleCell, idleLeft, liven, TURN_MS } from '../src/core/animation.js';
import { CALM_SHARE, FOLLOW_MS, LIVELY_MS, nextDraw } from '../src/overlay/pace.js';

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

test('a standing friend is drawn again when its idle cell changes', () => {
  for (const seed of [0, 5]) {
    const standing = friend({ sprite: { _seed: seed } });
    for (let now = 0; now < 20_000; now += 97)
      assert.equal(nextDraw([standing], now), Math.max(8, Math.ceil(idleLeft(now, seed))), `seed ${seed} at ${now}`);
  }
  // Friends doing different things: the first cell to end.
  assert.equal(nextDraw([friend(), friend({ status: 'working' })], 0), Math.min(120, idleLeft(0, 0)));
});

test('an idle desktop wakes for each cell its friend shows, far less often than the row cycling did', () => {
  const standing = friend({ sprite: { _seed: 11 } });
  let wakes = 0,
    changes = 0,
    shown = idleCell(0, 11);
  for (let now = 0; now < 60_000; now += nextDraw([standing], now)) {
    wakes++;
    const cell = idleCell(now, 11);
    if (cell.column !== shown.column) changes++;
    shown = cell;
  }
  assert.ok(wakes <= changes + 2, `${wakes} wakes for ${changes} changes`);
  assert.ok(wakes < 120, `${wakes} wakes in a minute, where cycling the row woke 327 times`);
});

test('a desktop friend nobody is with rests longer, and wakes the loop as its own rhythm says', () => {
  const count = rhythm => {
    const standing = friend({ sprite: { _seed: 11, _rhythm: rhythm } });
    let wakes = 0;
    for (let now = 0; now < 600_000; now += nextDraw([standing], now)) {
      assert.equal(nextDraw([standing], now), Math.max(8, Math.ceil(idleLeft(now, 11, rhythm))), `at ${now}`);
      wakes++;
    }
    return wakes;
  };
  const lively = count(undefined),
    calm = count(calmRhythm(CALM_SHARE));
  assert.ok(calm < lively * 0.65, `${calm} wakes calm against ${lively} lively in ten minutes`);
  // Someone was with it: for LIVELY_MS it wakes as often as in the yard.
  const livened = calmRhythm(CALM_SHARE);
  liven(livened, 0, LIVELY_MS);
  assert.ok(LIVELY_MS >= 30_000, 'lively long enough to be seen');
  for (let now = livened.from; now < livened.until; now += 97)
    assert.equal(
      nextDraw([friend({ sprite: { _seed: 11, _rhythm: livened } })], now),
      nextDraw([friend({ sprite: { _seed: 11 } })], now),
    );
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
  assert.equal(nextDraw([jump], 2400), Math.ceil(idleLeft(2400, 0)), 'standing again');
});

test('a walking friend is drawn when its step ends or the walk does', () => {
  const walking = friend({ pose: 'right', since: 0, until: 1050 });
  assert.equal(nextDraw([walking], 1000), 50, 'the walk ends first');
  assert.equal(nextDraw([walking], 500), cellLeft('right', 500), 'mid-walk: when the step ends');
});

test('a friend held or looking at the pointer is drawn every 100 ms, and one turning at each turn', () => {
  assert.equal(nextDraw([friend({ drag: { x: 0, y: 0 } })], 0), FOLLOW_MS);
  assert.equal(FOLLOW_MS, 100);
  const looking = friend({ look: { x: 1, y: 0 }, lookedAt: 1000 });
  assert.equal(nextDraw([looking], 1000), FOLLOW_MS);
  assert.equal(nextDraw([looking], 1350), 50, 'until the look runs out');
  assert.equal(nextDraw([looking], 1400), Math.ceil(idleLeft(1400, 0)), 'then it stands as before');
  // Still turning toward the pointer, or holding its last look before it stands again.
  const turning = friend({ look: { x: 1, y: 0 }, lookedAt: 1000, sprite: { _turning: true } });
  assert.equal(nextDraw([turning], 1000), TURN_MS);
  const holding = friend({ sprite: { _turning: true } });
  assert.equal(nextDraw([holding], 5000), TURN_MS);
});
