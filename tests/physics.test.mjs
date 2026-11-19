// The small physics of a friend's body (core/physics.js): a walk that speeds up and slows into its
// stop, a lean that follows a spring, and a fall under gravity, all in body lengths and ms.

import assert from 'node:assert/strict';
import test from 'node:test';
import { fallMs, GRAVITY, LEAN, leanStep, RAMP_MS, rampPace, settled } from '../src/core/physics.js';

// Walks a friend `distance` body lengths at `pace`, frame by frame, as motion.js does.
function walk(distance, pace, dt = 50) {
  let left = distance,
    speed = 0,
    t = 0;
  const speeds = [];
  while (left > 0.005 && t < 60_000) {
    speed = rampPace(speed, pace, left, dt);
    left -= Math.min(left, speed * dt);
    speeds.push(speed);
    t += dt;
  }
  return { t, speeds };
}

test('a walk reaches its pace in RAMP_MS and goes at it', () => {
  const pace = 0.002;
  assert.equal(RAMP_MS, 240);
  let speed = 0;
  for (let t = 0; t < RAMP_MS; t += 10) speed = rampPace(speed, pace, 10, 10);
  assert.ok(Math.abs(speed - pace) < 1e-12, 'at pace after the ramp');
  assert.equal(rampPace(pace, pace, 10, 50), pace, 'and stays there');
  assert.ok(rampPace(0, pace, 10, 50) < pace / 3, 'it does not set off at full pace');
});

test('a walk slows into its stop and still arrives', () => {
  for (const pace of [0.0008, 0.002, 0.003]) {
    const { speeds, t } = walk(3, pace);
    const top = Math.max(...speeds);
    assert.ok(Math.abs(top - pace) < 1e-12, `${pace}: it reaches its pace on a long walk`);
    assert.ok(speeds.at(-1) < pace * 0.5, `${pace}: it is slow as it arrives`);
    assert.ok(speeds.at(-1) >= pace * 0.15 - 1e-12, `${pace}: never too slow to arrive`);
    // Little slower than at pace all the way: the ramps cost about RAMP_MS.
    assert.ok(t < 3 / pace + RAMP_MS * 1.6, `${pace}: ${t} ms for 3 body lengths`);
  }
  // A short step still arrives, without reaching full pace.
  const short = walk(0.1, 0.002);
  assert.ok(short.t < 600, `a tenth of a body in ${short.t} ms`);
});

test('a lean follows its target on a spring and settles without swinging past it', () => {
  let state = { angle: 0, spin: 0 },
    t = 0,
    most = 0;
  for (; t < 1000; t += 50) {
    state = leanStep(state, LEAN.accel, 50);
    most = Math.max(most, state.angle);
  }
  assert.ok(Math.abs(state.angle - LEAN.accel) < 0.05, 'it reaches the target');
  assert.ok(most <= LEAN.accel + 0.05, 'critically damped: no overshoot');
  // Settled back upright within about 0.4 s.
  let back = state,
    settledAt = null;
  for (let at = 0; at < 1500; at += 50) {
    back = leanStep(back, 0, 50);
    if (settledAt === null && settled(back)) settledAt = at + 50;
  }
  assert.ok(settledAt !== null && settledAt <= 500, `upright again after ${settledAt} ms`);
  // The same lean whether the loop runs at 50 or 100 ms frames.
  let a = { angle: 0, spin: 0 },
    b = { angle: 0, spin: 0 };
  for (let at = 0; at < 200; at += 50) a = leanStep(a, 3, 50);
  for (let at = 0; at < 200; at += 100) b = leanStep(b, 3, 100);
  assert.ok(Math.abs(a.angle - b.angle) < 0.15, `${a.angle} against ${b.angle}`);
  assert.ok(settled({ angle: 0.01, spin: 0.1 }) && !settled({ angle: 0.5, spin: 0 }));
});

test('a friend put down falls its lift under gravity, faster as it goes', () => {
  assert.equal(GRAVITY, 9);
  const lift = 0.1 * (208 / 192);
  const ms = fallMs(lift);
  assert.ok(ms > 140 && ms < 170, `${ms} ms`);
  assert.ok(fallMs(lift * 4) < ms * 2.1 && fallMs(lift * 4) > ms * 1.9, 'four times the height takes twice as long');
  assert.equal(fallMs(0), 0);
});

test('the leans stay small', () => {
  assert.deepEqual(LEAN, { accel: 3, look: 1.5, carry: 8, perBody: 1.5 });
});
