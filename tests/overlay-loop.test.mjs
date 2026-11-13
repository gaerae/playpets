// A desktop window kept open with nothing on it (overlay.rs LINGER) does no frame work: its loop
// rests until something comes out, then draws at once (core/ticker.js every).

import assert from 'node:assert/strict';
import test from 'node:test';
import { every } from '../src/core/ticker.js';

test('a loop whose frame says rest runs no more until woken, then runs at once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let shown = 0;
  const frames = [];
  const wake = every(100, now => {
    frames.push(now);
    return shown ? 0 : Infinity;
  });
  t.mock.timers.tick(100);
  assert.equal(frames.length, 1);
  t.mock.timers.tick(10_000);
  assert.equal(frames.length, 1, 'nothing to draw: no frames');
  shown = 1;
  wake();
  t.mock.timers.tick(0);
  assert.equal(frames.length, 2, 'something to draw: a frame now, not at the next interval');
  t.mock.timers.tick(100);
  assert.equal(frames.length, 3, 'then at its interval');
  // Woken while running, it draws now and keeps one loop going.
  wake();
  t.mock.timers.tick(0);
  assert.equal(frames.length, 4);
  t.mock.timers.tick(100);
  assert.equal(frames.length, 5, 'one loop, not two');
});

// A wake can come from inside a frame (something the frame does shows a friend): the loop then
// draws its next frame at once, and is still one loop.
test('a wake during a frame asks for the next frame at once and keeps one loop', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const frames = [];
  const wake = every(100, now => {
    frames.push(now);
    if (frames.length === 1) wake();
    return 100;
  });
  t.mock.timers.tick(100);
  assert.equal(frames.length, 2, 'woken inside the frame: the next one comes at once');
  for (let i = 0; i < 10; i++) t.mock.timers.tick(100);
  assert.equal(frames.length, 12, 'then one frame each interval, not two loops');
});
