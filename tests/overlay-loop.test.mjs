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
