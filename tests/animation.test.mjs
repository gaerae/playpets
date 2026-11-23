// Sprite sheet timing: frames must stay inside the cells a Codex pet sheet defines.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  animationSpec,
  calmRhythm,
  cellLeft,
  directionFrame,
  frameAt,
  headroom,
  IDLE_BEAT,
  idleCell,
  idleLeft,
  lookAt,
  lookDirection,
  liven,
  lookFrame,
  renewsClock,
  turnStep,
} from '../src/core/animation.js';

test('site preview descriptors follow the runtime rows, frame counts and loop lengths', () => {
  const states = ['idle', 'right', 'left', 'wave', 'jump', 'error', 'waiting', 'working', 'done'];
  const counts = [6, 8, 8, 4, 5, 8, 6, 6, 6];
  for (const [row, state] of states.entries()) {
    const spec = animationSpec(state);
    assert.equal(spec.row, row);
    assert.equal(spec.frames, counts[row]);
    assert.deepEqual(frameAt(state, Math.round(spec.seconds * 1000) - 1), { row, column: spec.frames - 1 });
    assert.deepEqual(frameAt(state, Math.round(spec.seconds * 1000)), { row, column: 0 });
  }
  assert.deepEqual(animationSpec('unknown'), animationSpec('idle'));
});

test('changing a preview descriptor cannot change runtime animation', () => {
  const spec = animationSpec('wave');
  spec.frames = 88;
  assert.equal(animationSpec('wave').frames, 4);
  assert.deepEqual(frameAt('wave', 699), { row: 3, column: 3 });
});

test('a friend looks toward the pointer, and nowhere while it is on its middle', () => {
  const rect = { x: 100, y: 100, width: 200, height: 200 };
  assert.deepEqual(lookAt(rect, 290, 110), { x: 90, y: -90 });
  assert.equal(lookAt(rect, 205, 195), null);
});

test('the empty rows above a sprite are measured from its first opaque pixel', () => {
  const w = 4,
    h = 10,
    rgba = new Uint8ClampedArray(w * h * 4);
  assert.equal(headroom(rgba, w, h), 0, 'an empty cell claims no headroom, so the bubble stays put');
  rgba[(6 * w + 2) * 4 + 3] = 255;
  assert.equal(headroom(rgba, w, h), 0.6);
  rgba[(3 * w + 0) * 4 + 3] = 10;
  assert.equal(headroom(rgba, w, h), 0.6, 'a faint shadow pixel is not the head');
  rgba[(3 * w + 0) * 4 + 3] = 200;
  assert.equal(headroom(rgba, w, h), 0.3);
});

test('animation never reads unused standard cells and v2 looks use 16 directions', () => {
  for (let t = 0; t < 20000; t += 13) assert.ok(frameAt('idle', t).column < 6);
  assert.deepEqual(frameAt('idle', 0), { row: 0, column: 0 });
  assert.deepEqual(lookFrame(1, 0), { row: 9, column: 4 });
  assert.deepEqual(lookFrame(0, 1), { row: 10, column: 0 });
});

test('a walk keeps stepping: renewing the same pose does not restart its frames', () => {
  assert.equal(renewsClock('right', 'right', 1000, 900), false, 'same pose, still running');
  assert.equal(renewsClock('right', 'left', 1000, 900), true, 'turning around starts the other walk');
  assert.equal(renewsClock('right', 'right', 1000, 1200), true, 'a pose that ran out starts over');
  assert.notDeepEqual(frameAt('right', 0), frameAt('right', 400), 'the walk row has more than one cell to show');
});

test('a brief reaction finishes once instead of restarting a partial second gesture', async () => {
  const { poseClock } = await import('../src/core/animation.js');
  for (const state of ['jump', 'wave', 'done']) {
    const end = Math.round(animationSpec(state).seconds * 1000) - 1;
    assert.equal(poseClock(state, 1200), Math.min(1200, end));
    assert.equal(poseClock(state, 0), 0);
    assert.deepEqual(frameAt(state, poseClock(state, 5000)), frameAt(state, end));
  }
  for (const state of ['idle', 'right', 'left', 'working', 'waiting', 'error'])
    assert.equal(poseClock(state, 5000), 5000, 'continuous poses retain their normal loop');
});

test("the time left in a cell runs to that cell's own end, and round the loop", () => {
  assert.equal(cellLeft('right', 0), 120);
  assert.equal(cellLeft('right', 100), 20);
  assert.equal(cellLeft('right', 120), 120, 'a cell that just began has all of its time');
  assert.equal(cellLeft('right', 7 * 120 + 10), 210, 'the last step is held longer');
  assert.equal(cellLeft('right', 1060 + 5), 115, 'the walk goes round');
  assert.equal(cellLeft('idle', 280), 110);
  assert.equal(cellLeft('unknown', 0), cellLeft('idle', 0));
  // Wherever it is, the cell changes when the time left has passed, and not before.
  for (const state of ['idle', 'right', 'jump', 'done'])
    for (let at = 0; at < 3000; at += 37) {
      const left = cellLeft(state, at);
      assert.deepEqual(frameAt(state, at + left - 0.5), frameAt(state, at), `${state} at ${at}`);
      assert.notDeepEqual(frameAt(state, at + left), frameAt(state, at), `${state} at ${at}`);
    }
});

test('a standing friend mostly stands, and plays its idle row now and then, whole and in order', () => {
  const cycle = Math.round(animationSpec('idle').seconds * 1000);
  for (const seed of [0, 1, 7, 12345, 0xdeadbeef]) {
    let resting = 0,
      steps = 0,
      previous = 0;
    const gestures = [];
    for (let t = 0; t < 600_000; t += 10) {
      const cell = idleCell(t, seed);
      steps++;
      assert.equal(cell.row, 0, 'only the idle row');
      if (cell.column === 0) resting++;
      // A gesture shows its second cell after its first, which is the resting one.
      if (cell.column === 1 && previous === 0) gestures.push(t - 280);
      previous = cell.column;
    }
    assert.ok(resting / steps > 0.8, `seed ${seed}: it stands still most of the time (${resting / steps})`);
    const gaps = gestures.slice(1).map((t, i) => t - gestures[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    assert.ok(mean > 4500 && mean < 8000, `seed ${seed}: a gesture about every 6 s (${mean})`);
    assert.ok(Math.min(...gaps) >= 2000, `seed ${seed}: at least 2 s apart (${Math.min(...gaps)})`);
    assert.ok(Math.min(...gaps) >= cycle + 1000, 'a second of rest between two gestures at least');
    // Each gesture plays the row once through: its cells in order.
    for (const start of gestures.slice(0, 20))
      for (let at = 0; at < cycle; at += 10) assert.deepEqual(idleCell(start + at, seed), frameAt('idle', at));
  }
});

test('friends do not gesture together', () => {
  let together = 0,
    apart = 0;
  for (let t = 0; t < 120_000; t += 50) {
    const a = idleCell(t, 1).column,
      b = idleCell(t, 2).column;
    if (a || b) a && b ? together++ : apart++;
  }
  assert.ok(apart > together * 3, `${apart} apart, ${together} together`);
});

// The desktop rests more while nobody is with its friends (overlay/pace.js), and is as lively as
// the yard for a while after someone was: the same gestures at the same moments, fewer of them.
test('a calm rhythm plays some of the gestures a lively one does, at the same moments', () => {
  const starts = (seed, rhythm) => {
    const found = [];
    let previous = 0;
    for (let t = 0; t < 1_800_000; t += 10) {
      const column = idleCell(t, seed, rhythm).column;
      if (column === 1 && previous === 0) found.push(t);
      previous = column;
    }
    return found;
  };
  for (const seed of [0, 7, 12345]) {
    const lively = new Set(starts(seed)),
      calm = starts(seed, calmRhythm(0.3));
    assert.ok(
      calm.every(t => lively.has(t)),
      `seed ${seed}: each calm gesture is one the lively rhythm plays`,
    );
    const mean = 1_800_000 / calm.length;
    assert.ok(mean > 9000 && mean < 16000, `seed ${seed}: a gesture about every 12 s (${mean})`);
    assert.ok(calm.length < lively.size * 0.6, `seed ${seed}: ${calm.length} calm against ${lively.size} lively`);
  }
});

test('livening makes the beats from the next one on lively for a while, and never cuts into a gesture', () => {
  for (const seed of [0, 3, 99]) {
    const rhythm = calmRhythm(0.3);
    let previous = idleCell(0, seed, rhythm).column;
    for (let t = 0; t < 300_000; t += 10) {
      // Someone comes by now and then, sometimes again while the friend is still lively.
      if (t % 23_330 === 0 || t % 61_110 === 0) liven(rhythm, t, 60_000);
      const column = idleCell(t, seed, rhythm).column;
      assert.ok(column === previous || column === (previous + 1) % 6, `seed ${seed} at ${t}: ${previous} to ${column}`);
      previous = column;
    }
  }
  const rhythm = calmRhythm(0.3);
  liven(rhythm, 5000, 60_000);
  assert.equal(rhythm.from, 2 * IDLE_BEAT, 'from the beat after the one under way');
  assert.equal(rhythm.until, 65_000);
  for (let t = rhythm.from; t < rhythm.until; t += 10) assert.deepEqual(idleCell(t, 4, rhythm), idleCell(t, 4));
  liven(rhythm, 40_000, 60_000);
  assert.equal(rhythm.from, 2 * IDLE_BEAT, 'still lively: the window only grows');
  assert.equal(rhythm.until, 100_000);
  liven(rhythm, 200_000, 60_000);
  assert.equal(rhythm.from, Math.ceil(200_001 / IDLE_BEAT) * IDLE_BEAT, 'calm again: from the next beat');
});

test('the idle rhythm says when its cell changes, and it changes then', () => {
  const livened = calmRhythm(0.3);
  liven(livened, 20_000, 30_000);
  for (const rhythm of [undefined, calmRhythm(0.3), livened])
    for (const seed of [0, 3, 99])
      for (let at = 0; at < 60_000; at += 41) {
        const left = idleLeft(at, seed, rhythm);
        assert.ok(left > 0 && left <= 60_000, `seed ${seed} at ${at}: ${left}`);
        assert.deepEqual(idleCell(at + left - 0.5, seed, rhythm), idleCell(at, seed, rhythm), `seed ${seed} at ${at}`);
        assert.notDeepEqual(idleCell(at + left, seed, rhythm), idleCell(at, seed, rhythm), `seed ${seed} at ${at}`);
      }
});

test('a look turns one direction at a time, the shorter way round', () => {
  assert.equal(lookDirection(0, -1), 0, 'up');
  assert.equal(lookDirection(1, 0), 4, 'right');
  assert.equal(lookDirection(0, 1), 8, 'down');
  assert.equal(lookDirection(-1, 0), 12, 'left');
  assert.deepEqual(directionFrame(4), lookFrame(1, 0));
  assert.deepEqual(directionFrame(8), lookFrame(0, 1));
  assert.equal(turnStep(null, 5), 5, 'a look starts where the pointer is');
  assert.equal(turnStep(4, 4), 4);
  assert.equal(turnStep(4, 6), 5);
  assert.equal(turnStep(4, 2), 3);
  assert.equal(turnStep(1, 14), 0, 'round through up');
  assert.equal(turnStep(0, 15), 15);
  assert.equal(turnStep(14, 1), 15);
  assert.equal(turnStep(15, 0), 0);
  assert.equal(turnStep(2, 10), 1, 'right behind: one way, always the same');
  for (let from = 0; from < 16; from++)
    for (let to = 0; to < 16; to++) {
      let at = from,
        steps = 0;
      while (at !== to) {
        at = turnStep(at, to);
        steps++;
      }
      assert.ok(steps <= 8, `${from} to ${to} in ${steps}`);
    }
});
