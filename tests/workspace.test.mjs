// Agent workspaces (docs/design/2026-11-11-agent-workspaces.md): stations a friend goes to for its
// agent's state, furniture that strolls keep off and that is drawn in front of a seated friend,
// a place's own depth, and pots wherever the floor has no soil.
import assert from 'node:assert/strict';
import test from 'node:test';
import { worlds as shipped } from './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

globalThis.playPets = { updatePet: async () => ({ ok: true, data: null }) };
const { reduced } = await import('../src/core/sprites.js');
const { setData, views } = await import('../src/core/state.js');
const { DEPTH_FAR, depthScale, EDGE, footTarget, geometry, measureYard } = await import('../src/yard/field.js');
const { moveFriends } = await import('../src/yard/motion.js');
const { scene } = await import('../src/yard/world.js');
const { useWorlds, worldHasSoil, worlds } = await import('../src/yard/worlds.js');
const { blocked, frontsIn, stationAt } = await import('../src/yard/workspace.js');

// A picture of 1536 by 1024 in a yard of the same size: its fractions are the yard's.
const office = {
  id: 'test-office',
  fit: 'cover-bottom',
  geometry: {
    fieldTop: 0.4,
    depthFar: 0.6,
    stations: {
      desks: [
        { x: 0.3, y: 0.55 },
        { x: 0.6, y: 0.55 },
      ],
      approval: { x: 0.5, y: 0.85 },
      rest: { x: 0.15, y: 0.6 },
    },
    blocks: [{ x: 0.3, y: 0.58, rx: 0.06, ry: 0.03 }],
    fronts: [
      {
        x: 0.24,
        y: 0.5,
        width: 0.12,
        height: 0.1,
        foot: 0.6,
        shape: [
          [0, 0.2],
          [1, 0.2],
          [1, 1],
          [0, 1],
        ],
      },
    ],
  },
  capabilities: {
    sky: true,
    weather: true,
    soil: false,
    wildlife: false,
    fishing: false,
    seasonalEffects: false,
    ambient: false,
  },
};

function inOffice(t) {
  installDom(t, { anyId: true, props: { rect: { width: 1536, height: 1024 } } });
  globalThis.document.querySelector = () => null;
  const before = { list: [...worlds], world: scene.world, reduced: reduced.matches };
  useWorlds([...shipped, office]);
  scene.world = office.id;
  reduced.matches = false;
  measureYard();
  views.clear();
  t.after(() => {
    useWorlds(before.list);
    scene.world = before.world;
    reduced.matches = before.reduced;
    views.clear();
  });
}
const friend = (id, more = {}) => {
  const v = { pet: { id, size: 96, x: 0.5, y: 0.3 }, x: 0.5, y: 0.3, nextWander: Infinity, ...more };
  Object.assign(v, { button: element(), label: element() });
  const { w, h, top } = geometry(v.pet);
  v.px = EDGE + v.x * w;
  v.py = top + v.y * h;
  views.set(id, v);
  return v;
};
const agent = states =>
  setData({
    statuses: Object.fromEntries(
      Object.entries(states).map(([id, state]) => [id, { state, source: 'agent', at: Date.now() }]),
    ),
  });
const at = (v, x, y) => footTarget(v, 1536 * x, 1024 * y, 0);

test('a floor without soil is told apart from a place without a sky', () => {
  useWorlds([...shipped, office]);
  try {
    assert.equal(worldHasSoil('woodland'), true);
    assert.equal(worldHasSoil('studio'), false, 'no sky and no soil said: none');
    assert.equal(worldHasSoil(office.id), false, 'a sky through the glass, a paved floor');
  } finally {
    useWorlds(shipped);
  }
});

test('a place may say how small friends at the back look', t => {
  inOffice(t);
  assert.equal(depthScale(0), 0.6);
  assert.equal(depthScale(1), 1);
  scene.world = 'woodland';
  assert.equal(depthScale(0), DEPTH_FAR);
});

test("a station is where the picture puts it, and a station cropped away comes to the floor's edge", t => {
  inOffice(t);
  assert.deepEqual(stationAt({ x: 0.5, y: 0.85 }), { x: 768, y: 1024 * 0.85 });
  // A wider window shows the picture larger from its foot: the front stays, the back is cut off.
  globalThis.document.getElementById = () => ({
    dataset: {},
    getBoundingClientRect: () => ({ width: 3072, height: 1024 }),
  });
  measureYard();
  assert.deepEqual(stationAt({ x: 0.5, y: 0.85 }), { x: 1536, y: 1024 - 2048 * 0.15 });
  const back = stationAt({ x: 0.5, y: 0.3 });
  assert.ok(back.y < 0, 'a desk at the back is out of the window');
  assert.equal(footTarget(friend('a'), back.x, back.y, 0).y, 0, "its friend stands at the floor's top instead");
});

test('working friends sit at desks in turn, keep theirs, and the extra one stands beside one', t => {
  inOffice(t);
  const a = friend('a'),
    b = friend('b'),
    c = friend('c');
  agent({ a: 'working', b: 'working', c: 'working' });
  moveFriends(1000, 50);
  assert.deepEqual(a.target, at(a, 0.3, 0.55));
  assert.deepEqual(b.target, at(b, 0.6, 0.55));
  assert.equal(c.target.y, at(c, 0.3, 0.55).y, 'beside a desk');
  assert.ok(Math.abs(c.target.x - a.target.x) > 0.01);
  assert.equal(a.trip.save, false);
  // Back at work after a break, each has its own desk again.
  agent({ a: 'idle', b: 'idle', c: 'idle' });
  moveFriends(1050, 50);
  agent({ b: 'working', a: 'working' });
  moveFriends(1100, 50);
  assert.deepEqual(a.target, at(a, 0.3, 0.55));
  assert.deepEqual(b.target, at(b, 0.6, 0.55));
});

test('an error stays at the desk; waiting goes to the approval spot; done rests in the corner and stays', t => {
  inOffice(t);
  const a = friend('a');
  agent({ a: 'error' });
  moveFriends(1000, 50);
  assert.deepEqual(a.target, at(a, 0.3, 0.55));
  agent({ a: 'waiting' });
  moveFriends(1050, 50);
  assert.deepEqual(a.target, at(a, 0.5, 0.85));
  agent({ a: 'done' });
  moveFriends(1100, 50);
  assert.deepEqual(a.target, at(a, 0.15, 0.6));
  a.target = null;
  a.trip = null;
  a.nextWander = 0;
  moveFriends(60000, 50);
  assert.equal(a.target, null, 'it does not wander off the rest corner');
  agent({ a: 'idle' });
  moveFriends(60050, 50);
  assert.deepEqual(a.target, { x: 0.5, y: 0.3 }, 'idle again, it walks back to its own place');
});

test('two waiting friends stand side by side at the approval spot', t => {
  inOffice(t);
  const a = friend('a'),
    b = friend('b');
  agent({ a: 'waiting', b: 'waiting' });
  moveFriends(1000, 50);
  assert.equal(a.target.y, b.target.y);
  assert.notEqual(a.target.x, b.target.x);
});

test('furniture blocks the end of a stroll, as a tree does', t => {
  inOffice(t);
  assert.equal(blocked(1536 * 0.3, 1024 * 0.58), true);
  assert.equal(blocked(1536 * 0.3 + 1536 * 0.059, 1024 * 0.58), true);
  assert.equal(blocked(1536 * 0.5, 1024 * 0.58), false);
  assert.equal(blocked(1536 * 0.3, 1024 * 0.62), false);
});

test("a desk's front is drawn over a friend whose feet are behind its foot line", t => {
  inOffice(t);
  const [front] = frontsIn(1536, 1024);
  assert.deepEqual(
    { shape: front.shape, x: front.x, y: front.y, width: front.width, height: front.height },
    {
      shape: [
        [0, 0.2],
        [1, 0.2],
        [1, 1],
        [0, 1],
      ],
      x: 1536 * 0.24,
      y: 1024 * 0.5,
      width: 1536 * 0.12,
      height: 1024 * 0.1,
    },
  );
  // Friends are layered by where their feet are (views.js place); a friend at the desk is behind.
  const a = friend('a');
  const seated = at(a, 0.3, 0.55),
    before = at(a, 0.3, 0.65);
  assert.ok(1 + Math.round(seated.y * 100) < front.z, 'seated, behind the desk');
  assert.ok(1 + Math.round(before.y * 100) > front.z, 'in front of it, in front');
});
