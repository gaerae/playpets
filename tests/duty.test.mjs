// A friend linked to a coding agent shows the agent's state in what it does (src/yard/duty.js).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

const saved = [];
globalThis.playPets = {
  updatePet: async (id, at) => {
    saved.push([id, at]);
    return { ok: true, data: null };
  },
};
const { reduced } = await import('../src/core/sprites.js');
const { setData, views } = await import('../src/core/state.js');
const { frontSpot } = await import('../src/yard/duty.js');
const { EDGE, geometry, petHeight, sizeOf } = await import('../src/yard/field.js');
const { moveFriends } = await import('../src/yard/motion.js');
const { forPerson, isFree } = await import('../src/yard/trips.js');

// A yard of 800 by 560 with the dock over the foot at the right, as shell.css floats it.
function yard(t, dock = { left: 520, top: 500, width: 270, height: 42 }) {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  globalThis.document.querySelector = selector =>
    selector === '.yard-dock' ? { getBoundingClientRect: () => dock } : null;
  const before = reduced.matches;
  reduced.matches = false;
  t.after(() => {
    views.clear();
    reduced.matches = before;
  });
  views.clear();
}
const friend = (id, more = {}) => {
  const v = { pet: { id, size: 96 }, x: 0.3, y: 0.4, nextWander: 0, button: element(), label: element(), ...more };
  const { w, h, top } = geometry(v.pet);
  v.px = EDGE + v.x * w;
  v.py = top + v.y * h;
  views.set(id, v);
  return v;
};
const agent = (states, source = 'agent') =>
  setData({
    statuses: Object.fromEntries(Object.entries(states).map(([id, state]) => [id, { state, source, at: Date.now() }])),
  });

test("an agent at work stops a friend's own stroll and keeps it where it stands", t => {
  yard(t);
  const v = friend('a', { target: { x: 0.9, y: 0.4 }, trip: { slow: true }, own: true });
  agent({ a: 'working' });
  moveFriends(1000, 50);
  assert.equal(v.target, null, 'the stroll ends');
  moveFriends(60000, 50);
  assert.equal(v.target, null, 'it does not wander off again');
  agent({ a: 'error' });
  moveFriends(120000, 50);
  assert.equal(v.target, null, 'an error keeps it where it is too');
});

test('waiting brings a friend to the front of the yard, and the trip is not saved', t => {
  yard(t);
  const v = friend('a');
  agent({ a: 'waiting' });
  moveFriends(1000, 50);
  assert.deepEqual(v.target, { x: 0.5, y: 1 });
  assert.equal(v.trip.save, false);
});

test('a friend done waiting walks back to its own place, which the wait never changed', t => {
  yard(t);
  const v = friend('a', { pet: { id: 'a', size: 96, x: 0.3, y: 0.4 } });
  agent({ a: 'waiting' });
  moveFriends(1000, 50);
  v.x = 0.5;
  v.y = 1;
  v.target = null;
  agent({ a: 'working' });
  moveFriends(1050, 50);
  assert.deepEqual(v.target, { x: 0.3, y: 0.4 });
  assert.equal(v.trip.save, false);
  assert.deepEqual([v.pet.x, v.pet.y], [0.3, 0.4]);
});

test('a stroll cut short leaves the friend where it stopped, kept as its place', t => {
  yard(t);
  const v = friend('a', { pet: { id: 'a', size: 96, x: 0.1, y: 0.4 }, target: { x: 0.9, y: 0.4 }, own: true });
  v.trip = { slow: true };
  saved.length = 0;
  agent({ a: 'working' });
  moveFriends(1000, 50);
  assert.deepEqual([v.pet.x, v.pet.y], [v.x, v.y]);
  assert.deepEqual(saved, [['a', { x: v.x, y: v.y }]]);
});

test('done lets a friend stroll again after a while; idle strolls as before', t => {
  yard(t);
  const v = friend('a');
  agent({ a: 'working' });
  moveFriends(1000, 50);
  agent({ a: 'done' });
  moveFriends(1050, 50);
  assert.equal(v.duty, null);
  assert.ok(v.nextWander > 1050, 'it rests a moment first');
});

test("a chat's state is not an agent's: the friend strolls on", t => {
  yard(t);
  const v = friend('a', { target: { x: 0.9, y: 0.4 }, trip: { slow: true }, own: true });
  agent({ a: 'waiting' }, 'chat');
  moveFriends(1000, 50);
  assert.deepEqual(v.target, { x: 0.9, y: 0.4 });
  assert.equal(v.duty, null);
});

test('what the person started keeps the friend; it goes to its spot once that lets go', t => {
  yard(t);
  const errand = { save: false, arrive: () => {} };
  const v = friend('a', { target: { x: 0.9, y: 0.4 }, trip: errand, own: false });
  agent({ a: 'waiting' });
  moveFriends(1000, 50);
  assert.equal(v.trip, errand, "the person's errand goes on");
  v.target = null;
  v.trip = null;
  moveFriends(1050, 50);
  assert.deepEqual(v.target, { x: 0.5, y: 1 });

  const held = friend('b', { drag: true });
  agent({ a: 'waiting', b: 'waiting' });
  moveFriends(1100, 50);
  assert.equal(held.target, undefined, 'a friend in hand is not taken');
  held.drag = false;
  moveFriends(1150, 50);
  assert.equal(held.target?.y, 1);
});

test('waiting friends stand side by side nearest the middle, never behind the dock', t => {
  yard(t);
  const a = friend('a'),
    b = friend('b'),
    c = friend('c');
  agent({ a: 'waiting', b: 'waiting', c: 'waiting' });
  moveFriends(1000, 50);
  const { w, top, h } = geometry(a.pet),
    body = sizeOf(a.pet) / w,
    xs = [a, b, c].map(v => v.target.x);
  assert.equal(xs[0], 0.5);
  assert.equal(new Set(xs).size, 3, 'each has its own place');
  for (const x of xs) assert.ok(Math.abs(x - 0.5) <= 2 * body + 1e-9, 'all near the middle');
  for (const x of xs) {
    const px = EDGE + x * w + sizeOf(a.pet) / 2,
      py = top + h + petHeight(a.pet);
    assert.ok(px + sizeOf(a.pet) / 2 <= 520 || py <= 500, 'not behind the dock');
  }
  // A dock across the middle sends the first one beside it.
  yard(t, { left: 300, top: 500, width: 200, height: 42 });
  const d = friend('d');
  views.set('d', d);
  d.duty = 'waiting';
  const spot = frontSpot(d),
    px = EDGE + spot.x * w + sizeOf(d.pet) / 2;
  assert.ok(px + sizeOf(d.pet) / 2 <= 300 || px - sizeOf(d.pet) / 2 >= 500);
});

test('a friend busy with its agent is passed over by what friends start, not by the person', t => {
  yard(t);
  const v = friend('a');
  agent({ a: 'working' });
  moveFriends(1000, 50);
  assert.equal(isFree(v), false);
  assert.equal(forPerson(0, 0), v, "the person's rod or seed still finds it");
  // It would stroll off on its own before the person looks.
  const w = friend('b', { x: 0.9, nextWander: Infinity });
  agent({ a: 'working', b: 'idle' });
  moveFriends(1050, 50);
  assert.equal(forPerson(0, 0), w, 'a friend with nothing on goes first');
});
