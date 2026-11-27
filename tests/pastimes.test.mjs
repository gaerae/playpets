// What an idle friend does between strolls outdoors (docs/design/2026-11-24-the-yard-plays-like-a-game.md,
// G4): it looks at a friend on the move, calls a friend over to meet face to face, and sits or
// stretches only with a clip of its own. Indoors it keeps to the workspace's lounging.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { setData, views } from '../src/core/state.js';
import { pastime } from '../src/yard/pastimes.js';
import { scene } from '../src/yard/world.js';
import { element, installDom } from './support/dom.mjs';

// The middle character's shares (wander.js): a pose under 0.12, then a look, a meeting, a sit and a
// stretch, then a stroll.
const LOOK = 0.15,
  MEET = 0.25,
  SIT = 0.31,
  STROLL = 0.9;
const rngOf = values => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const friend = (id, x, px, extra = {}) => ({
  pet: { id, size: 112 },
  asset: { id, version: 2 },
  x,
  y: 0.6,
  px,
  py: 300,
  button: element(),
  label: element(),
  ...extra,
});
function yard(t, world = 'woodland') {
  installDom(t, { anyId: true, props: { rect: { width: 1000, height: 700 } } });
  setData({ statuses: {}, pets: [] });
  const before = scene.world;
  scene.world = world;
  views.clear();
  t.after(() => {
    scene.world = before;
    views.clear();
  });
}

test('a friend stops and looks at the friend on the move nearest it', t => {
  yard(t);
  const v = friend('a', 0.3, 300),
    walker = friend('b', 0.7, 700, { target: { x: 0.8, y: 0.6 } }),
    stander = friend('c', 0.35, 340);
  for (const f of [v, walker, stander]) views.set(f.pet.id, f);
  assert.equal(pastime(v, 0, { rng: rngOf([LOOK, 0.5]) }), true);
  assert.deepEqual(v.look, { x: 400, y: 0 }, 'the one walking, not the one standing nearer');
  assert.equal(v.target ?? null, null, 'it stays where it is');
  // With nobody around it looks up and away; a sheet without look rows strolls instead.
  views.delete('b');
  views.delete('c');
  pastime(v, 0, { rng: rngOf([LOOK, 0.5, 0.9]) });
  assert.ok(v.look.y < 0, 'up at the sky');
  const old = friend('d', 0.5, 500, { asset: { id: 'd', version: 1 } });
  assert.equal(pastime(old, 0, { rng: rngOf([LOOK]) }), false);
});

test('two idle friends meet face to face, and the one who called waves', t => {
  yard(t);
  const v = friend('a', 0.3, 300),
    o = friend('b', 0.5, 500);
  views.set('a', v);
  views.set('b', o);
  assert.equal(pastime(v, 1000, { rng: rngOf([MEET]) }), true);
  assert.ok(v.target && o.target, 'both walk');
  assert.ok(v.target.x < o.target.x && v.target.y === o.target.y, 'to stand level, each on its side');
  assert.ok(v.target.x > 0.3 && o.target.x < 0.5, 'each steps toward the other');
  v.trip.arrive(v, 2000);
  assert.equal(v.pose, undefined, 'no wave until both are there');
  o.trip.arrive(o, 2100);
  assert.equal(v.pose, 'wave');
  assert.ok(v.look.x > 0 && o.look.x < 0, 'they look at each other');
  // A friend busy with its agent is not called over.
  setData({ statuses: { b: { state: 'working', at: Date.now() } }, pets: [] });
  v.target = o.target = v.trip = o.trip = null;
  assert.equal(pastime(v, 3000, { rng: rngOf([MEET]) }), false);
});

test('a sit or a stretch needs a clip of its own; without one the friend strolls', t => {
  yard(t);
  const v = friend('a', 0.3, 300);
  views.set('a', v);
  assert.equal(pastime(v, 0, { rng: rngOf([SIT]) }), false);
  assert.equal(v.doing ?? null, null);
  assert.equal(pastime(v, 0, { rng: rngOf([STROLL]) }), false);
});

test('in a workspace a friend keeps to its lounging', t => {
  yard(t, 'workshop');
  const v = friend('a', 0.3, 300),
    o = friend('b', 0.5, 500);
  views.set('a', v);
  views.set('b', o);
  for (const roll of [LOOK, MEET, SIT]) assert.equal(pastime(v, 0, { rng: rngOf([roll]) }), false);
  assert.equal(o.target ?? null, null);
  // A wave is still anywhere.
  assert.equal(pastime(v, 0, { rng: rngOf([0.05, 0.1]) }), true);
  assert.equal(v.pose, 'wave');
});
