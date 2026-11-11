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
const { DEPTH_FAR, depthScale, EDGE, field, footTarget, geometry, measureYard, yardZoom } =
  await import('../src/yard/field.js');
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

// A wider window shows the picture larger from its foot: the front stays, the back is cut off.
const wide = (width, height) => {
  globalThis.document.getElementById = () => ({ dataset: {}, getBoundingClientRect: () => ({ width, height }) });
  measureYard();
};

test('in a room, friends grow with the picture past the size it was drawn for, and keep their size in a small window', t => {
  inOffice(t);
  const close = (a, b) => Math.abs(a - b) < 0.001;
  // The picture fills a window 850px tall at 850/1024: the size its furniture was drawn for.
  wide(1180, 850);
  assert.equal(yardZoom(), 1);
  // Larger, the picture and the friends grow alike, so a desk stays as tall next to a friend.
  wide(1920, 1080);
  assert.ok(close(yardZoom(), 1920 / 1536 / (850 / 1024)), `${yardZoom()}`);
  wide(2560, 1440);
  assert.equal(yardZoom(), 2, 'up to twice the friend size');
  scene.world = 'studio';
  wide(1920, 1080);
  assert.ok(close(yardZoom(), 1920 / 1536 / (850 / 1024)), 'the living room is a room too');
  // Small, friends keep the size that reads, larger than the picture shrinks them to.
  scene.world = office.id;
  wide(300, 210);
  assert.equal(yardZoom(), 0.375);
  wide(900, 260);
  assert.ok(close(yardZoom(), 900 / 1536 / (850 / 1024)), 'a strip: the larger of the two');
  // Outdoors, friends keep the size they always had.
  scene.world = 'woodland';
  wide(2560, 1440);
  assert.equal(yardZoom(), 1);
});

test("in a window wider than the picture, the floor begins where the picture's floor shows, and the back desks are seats", t => {
  inOffice(t);
  // 1920 by 1080: the picture is 1920 by 1280 from its foot, so its top 200px are cut off.
  wide(1920, 1080);
  assert.ok(Math.abs(field().top - stationAt({ x: 0.5, y: office.geometry.fieldTop }).y) < 1e-6);
  const a = friend('a'),
    b = friend('b');
  agent({ a: 'working', b: 'working' });
  moveFriends(1000, 50);
  const seat = footTarget(a, 1920 * 0.3, 1080 - 1280 * 0.45, 0);
  assert.ok(Math.abs(a.target.x - seat.x) < 1e-6 && Math.abs(a.target.y - seat.y) < 1e-6, 'a desk at the back');
  assert.ok(b.target, 'the second desk too');
  // A friend at a desk is as deep, and so as large next to it, as in a window of the picture's shape.
  const deep = depthScale(a.target.y);
  wide(1536, 1024);
  assert.ok(Math.abs(depthScale(footTarget(a, 1536 * 0.3, 1024 * 0.55, 0).y) - deep) < 0.01);
});

test('a station is where the picture puts it, and cropped away it lies outside the window', t => {
  inOffice(t);
  assert.deepEqual(stationAt({ x: 0.5, y: 0.85 }), { x: 768, y: 1024 * 0.85 });
  wide(3072, 1024);
  assert.deepEqual(stationAt({ x: 0.5, y: 0.85 }), { x: 1536, y: 1024 - 2048 * 0.15 });
  assert.ok(stationAt({ x: 0.5, y: 0.3 }).y < 0, 'a desk at the back is out of the window');
});

test('with its station cropped away, a friend is not sent behind the furniture in front of it', t => {
  inOffice(t);
  // 3072 by 300: the picture is 3072 by 2048 from its foot, so only its lowest 15% shows.
  wide(3072, 300);
  const a = friend('a'),
    b = friend('b'),
    c = friend('c');
  agent({ a: 'waiting', b: 'working', c: 'done' });
  moveFriends(1000, 50);
  assert.equal(a.target?.y, 1, 'waiting, it comes to the front of the yard instead');
  assert.equal(b.target, null, 'working, it stays where it stands');
  assert.equal(c.target, null, 'done, it rests where it stands');
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

test("a friend seated at a desk wears its tag at its feet, on the desk's front, not over its face", async t => {
  inOffice(t);
  const { place } = await import('../src/yard/views.js');
  const { petHeight } = await import('../src/yard/field.js');
  const a = friend('a', { y: 0.2 });
  a.body = element();
  place(a);
  const full = petHeight(a.pet);
  assert.ok(parseFloat(a.body.style.height) < full, 'at the back, standing, its tag rises with its smaller body');
  a.spot = { kind: 'desk', x: 0.5, y: 0.2 };
  place(a);
  assert.equal(parseFloat(a.body.style.height), full, 'seated, the tag goes down to its feet');
  a.spot = null;
  place(a);
  assert.ok(parseFloat(a.body.style.height) < full, 'up again, it rises again');
});

test('a workspace takes the outdoor light, and its glass is not washed over as a painted window is', async () => {
  const { environmentLook, paintEnvironment } = await import('../src/yard/environment.js');
  // The room and the view through its glass share one light: a darker view alone would need its
  // own mask, and a pane's rectangle also covers frames, walls and plants.
  for (const period of ['morning', 'day', 'evening', 'night'])
    for (const weather of ['clear', 'rain']) {
      const at = { season: 'summer', period, weather };
      const { art, ...light } = environmentLook({ ...at, world: 'office' });
      const { art: _, ...outdoors } = environmentLook({ ...at, world: 'woodland' });
      assert.equal(art, 'office');
      assert.deepEqual(light, outdoors);
    }
  // Rain over the yard's own sky already greys what the glass shows.
  let fills = 0;
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() {},
    fillRect() {
      fills++;
    },
  };
  paintEnvironment(ctx, { width: 1536, height: 1024 }, 1180, 850, {
    world: 'office',
    season: 'summer',
    period: 'day',
    weather: 'rain',
  });
  assert.equal(fills, 1, 'the outdoor rain tint only');
});
