// Idle life in the yard: where a friend strolls on its own, and how long it waits first.

import assert from 'node:assert/strict';
import test from 'node:test';
import { between } from '../src/core/math.js';
import * as wander from '../src/yard/wander.js';

const rngOf = values => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('wander targets always stay inside the yard and actually move the pet', () => {
  for (const position of [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0.5, y: 0.5 },
  ])
    for (let i = 0; i < 200; i++) {
      const target = wander.wanderTarget(position, Math.random);
      assert.ok(
        target.x >= 0 && target.x <= 1 && target.y >= 0 && target.y <= 1,
        `inside yard from ${JSON.stringify(position)}`,
      );
      assert.ok(
        Math.hypot(target.x - position.x, target.y - position.y) > 0.05,
        'a wander is a visible stroll, not a shuffle',
      );
    }
});

// A stroll is a few of the friend's own steps whatever the window, as its pace is (motion.js): a
// share of the yard made a full screen's strolls three times as long, and the yard drew all the while.
test('a stroll is a few body lengths in any window', () => {
  for (const [width, height, size] of [
    [1728, 1080, 112],
    [1180, 850, 112],
    [560, 400, 56],
  ]) {
    const body = { x: size / width, y: size / height };
    for (let i = 0; i < 300; i++) {
      const from = { x: 0.5, y: 0.6 },
        to = wander.wanderTarget(from, Math.random, () => true, body);
      const bodies = Math.hypot((to.x - from.x) * width, (to.y - from.y) * height) / size;
      assert.ok(bodies >= 1 && bodies <= 3, `${width}x${height}: ${bodies.toFixed(2)} body lengths`);
    }
  }
});

test('idle delays fall inside the configured window and scatter is quicker than wander', () => {
  const [wanderMin, wanderMax] = wander.WANDER_DELAY,
    [scatterMin, scatterMax] = wander.SCATTER_DELAY;
  assert.ok(scatterMax <= wanderMin, 'pets leave the treat sooner than a fresh idle wander');
  assert.equal(
    between(() => 0, wander.WANDER_DELAY),
    wanderMin,
  );
  assert.equal(
    between(() => 1, wander.WANDER_DELAY),
    wanderMax,
  );
  for (let i = 0; i < 100; i++) {
    const d = between(Math.random, wander.SCATTER_DELAY);
    assert.ok(d >= scatterMin && d <= scatterMax);
  }
});

test('idle actions are mostly strolls with occasional small poses', () => {
  assert.deepEqual(wander.idleAction(rngOf([0.9])), { type: 'move' });
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.2])), { type: 'pose', pose: 'wave' });
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.8])), { type: 'pose', pose: 'jump' });
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.6])), { type: 'pose', pose: 'wave' }, 'a jump is the rarer pose');
  assert.deepEqual(wander.idleAction(rngOf([0.2])), { type: 'move' });
  let moves = 0,
    jumps = 0;
  for (let i = 0; i < 4000; i++) {
    const action = wander.idleAction(Math.random);
    if (action.type === 'move') moves++;
    if (action.pose === 'jump') jumps++;
  }
  assert.ok(moves > 3400, 'strolling dominates so pets feel alive, not twitchy');
  assert.ok(jumps < 220, 'a jump on its own is rare');
});

test('quiet companions greet without spontaneous jumping', () => {
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.8]), true), { type: 'pose', pose: 'wave' });
  assert.deepEqual(wander.idleAction(rngOf([0.9]), true), { type: 'move' });
});

// The four friends move like characters (docs/design/2026-11-24-the-yard-plays-like-a-game.md, G4).
test('each of the four friends has its own pace and rhythm, and any other pet the middle one', () => {
  const of = id => wander.characterOf({ sourceId: id });
  assert.ok(of('playpets-pip').pace > of('playpets-clover').pace, 'Pip is brisk');
  assert.ok(of('playpets-miso').pace < of('playpets-clover').pace, 'Miso is unhurried');
  assert.ok(of('playpets-pip').rest < 1 && of('playpets-miso').rest > 1, 'Pip rests short, Miso long');
  assert.ok(of('playpets-daisy').look > of('playpets-clover').look, 'Daisy stops to look more often');
  assert.equal(of('someone-imported'), wander.characterOf(null));
  assert.equal(of('someone-imported').pace, 1);
});

test('outdoors a friend sometimes looks, meets a friend, sits or stretches, and mostly strolls', () => {
  const all = { look: true, meet: true, sit: true, stretch: true };
  const counts = {};
  for (let i = 0; i < 6000; i++) {
    const { type } = wander.idleAction(Math.random, false, wander.characterOf(null), all);
    counts[type] = (counts[type] || 0) + 1;
  }
  for (const type of ['look', 'meet', 'sit', 'stretch', 'pose'])
    assert.ok(counts[type] > 120, `${type}: ${counts[type]}`);
  assert.ok(counts.move > 6000 * 0.55, 'strolling still leads');
  // What a friend cannot do (no clip, nobody near, a sheet without look rows) is a stroll instead.
  for (let i = 0; i < 500; i++)
    assert.match(wander.idleAction(Math.random, false, wander.characterOf(null), {}).type, /^(move|pose)$/);
  // Miso sits more than Pip; Pip meets more than Miso.
  const share = (id, type) => {
    let n = 0;
    for (let i = 0; i < 6000; i++)
      if (wander.idleAction(Math.random, false, wander.characterOf({ sourceId: id }), all).type === type) n++;
    return n;
  };
  assert.ok(share('playpets-miso', 'sit') > share('playpets-pip', 'sit'));
  assert.ok(share('playpets-pip', 'meet') > share('playpets-miso', 'meet'));
});

test('two friends meet face to face, a little apart, on the ground between them', () => {
  const body = { x: 0.1, y: 0.13 };
  const spots = wander.meetSpots({ x: 0.3, y: 0.6 }, { x: 0.5, y: 0.7 }, body);
  assert.ok(spots, 'near enough to meet');
  const [a, b] = spots;
  assert.ok(a.x < b.x, 'each keeps its side');
  assert.equal(a.y, b.y, 'level with each other');
  const apart = (b.x - a.x) / body.x;
  assert.ok(apart >= 1 && apart <= 1.6, `about a body and a bit apart: ${apart}`);
  assert.ok(a.x > 0.3 && b.x < 0.5, 'both step toward the other');
  assert.equal(wander.meetSpots({ x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 }, body), null, 'too far to call over');
  const flipped = wander.meetSpots({ x: 0.5, y: 0.7 }, { x: 0.3, y: 0.6 }, body);
  assert.ok(flipped[0].x > flipped[1].x, 'the first keeps its own side whichever it is');
});

// The lake and what stands on the field, in field units, as ground.js measures them.
const pond = { water: [{ x: 0.5, y: 0.5, rx: 0.2, ry: 0.2 }], obstacles: [{ x: 0.9, y: 0.9, rx: 0.06, ry: 0.06 }] };

test('a stroll stays out of the water and ends clear of what stands on the field', () => {
  assert.ok(wander.strollClear({ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, pond), 'dry ground is fine');
  assert.ok(!wander.strollClear({ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, pond), 'never into the lake');
  assert.ok(!wander.strollClear({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, pond), 'never across it');
  assert.ok(!wander.strollClear({ x: 0.8, y: 0.8 }, { x: 0.9, y: 0.9 }, pond), 'never onto a tree or a flower');
  assert.ok(
    wander.strollClear({ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.1 }, pond),
    'a friend set down in the water walks out',
  );
  assert.ok(
    wander.strollClear({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, null),
    'a place without ground notes has no water',
  );
});

test('a friend picks a stroll the ground allows, and stays put when there is none', () => {
  const dry = (from, to) => wander.strollClear(from, to, pond);
  for (let i = 0; i < 300; i++) {
    const from = { x: 0.1, y: 0.15 },
      target = wander.wanderTarget(from, Math.random, dry);
    if (target) assert.ok(dry(from, target), `the stroll to ${JSON.stringify(target)} is dry`);
  }
  assert.equal(
    wander.wanderTarget({ x: 0.5, y: 0.5 }, Math.random, () => false),
    null,
  );
});

// A friend with no walk toward or away from you strolls across, where its side walk looks right.
test('a stroll across keeps within its angle of the horizontal, both ways', () => {
  const across = (35 * Math.PI) / 180,
    body = { x: 0.1, y: 0.1 },
    from = { x: 0.5, y: 0.5 };
  let left = 0,
    right = 0;
  for (let i = 0; i < 400; i++) {
    const to = wander.wanderTarget(from, Math.random, () => true, body, { across });
    const dx = (to.x - from.x) / body.x,
      dy = (to.y - from.y) / body.y;
    assert.ok(Math.atan2(Math.abs(dy), Math.abs(dx)) <= across + 1e-9, `${dx}, ${dy}`);
    if (dx < 0) left++;
    else right++;
  }
  assert.ok(left > 100 && right > 100, `both ways (${left}, ${right})`);
});
