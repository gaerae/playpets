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
const { FADE_MS } = await import('../src/core/status.js');
const { DEPTH_FAR, depthScale, EDGE, field, footTarget, geometry, measureYard, sizeOf, yardZoom } =
  await import('../src/yard/field.js');
const { moveFriends } = await import('../src/yard/motion.js');
const { scene } = await import('../src/yard/world.js');
const { useWorlds, worldHasSoil, worlds } = await import('../src/yard/worlds.js');
const { den } = await import('./support/den.mjs');
const { blocked, frontsIn, stationAt } = await import('../src/yard/workspace.js');
const { loungeTarget, sitOut } = await import('../src/yard/lounge.js');
const { forPerson, release, rest } = await import('../src/yard/trips.js');
const { dutyAfresh, station } = await import('../src/yard/duty.js');

// A picture of 1536 by 1024 in a yard of the same size: its fractions are the yard's.
const room = {
  id: 'test-room',
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

function inRoom(t) {
  installDom(t, { anyId: true, props: { rect: { width: 1536, height: 1024 } } });
  globalThis.document.querySelector = () => null;
  const before = { list: [...worlds], world: scene.world, reduced: reduced.matches };
  useWorlds([...shipped, room]);
  scene.world = room.id;
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
  useWorlds([...shipped, room, den]);
  try {
    assert.equal(worldHasSoil('woodland'), true);
    assert.equal(worldHasSoil(den.id), false, 'no sky and no soil said: none');
    assert.equal(worldHasSoil(room.id), false, 'a sky through the glass, a paved floor');
  } finally {
    useWorlds(shipped);
  }
});

test('a place may say how small friends at the back look', t => {
  inRoom(t);
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
  inRoom(t);
  const close = (a, b) => Math.abs(a - b) < 0.001;
  // The picture fills a window 850px tall at 850/1024: the size its furniture was drawn for.
  wide(1180, 850);
  assert.equal(yardZoom(), 1);
  // Larger, the picture and the friends grow alike, so a desk stays as tall next to a friend.
  wide(1920, 1080);
  assert.ok(close(yardZoom(), 1920 / 1536 / (850 / 1024)), `${yardZoom()}`);
  wide(2560, 1440);
  assert.equal(yardZoom(), 2, 'up to twice the friend size');
  scene.world = 'workshop';
  wide(1920, 1080);
  assert.ok(close(yardZoom(), 1920 / 1536 / (850 / 1024)), 'the garden workshop is a room too');
  // Small, friends keep the size that reads, larger than the picture shrinks them to.
  scene.world = room.id;
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
  inRoom(t);
  // 1920 by 1080: the picture is 1920 by 1280 from its foot, so its top 200px are cut off.
  wide(1920, 1080);
  assert.ok(Math.abs(field().top - stationAt({ x: 0.5, y: room.geometry.fieldTop }).y) < 1e-6);
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
  inRoom(t);
  assert.deepEqual(stationAt({ x: 0.5, y: 0.85 }), { x: 768, y: 1024 * 0.85 });
  wide(3072, 1024);
  assert.deepEqual(stationAt({ x: 0.5, y: 0.85 }), { x: 1536, y: 1024 - 2048 * 0.15 });
  assert.ok(stationAt({ x: 0.5, y: 0.3 }).y < 0, 'a desk at the back is out of the window');
});

test('with its station cropped away, a friend is not sent behind the furniture in front of it', t => {
  inRoom(t);
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

// The shipped workshop, not the test room: its stations stand on its floor, clear of its furniture,
// and a small window keeps the approval spot and two desks in view (the design's "Small windows").
test("the garden workshop's stations stand on its floor, off its furniture, and in view down to 300 by 210", t => {
  inRoom(t);
  scene.world = 'workshop';
  const { geometry: shape } = shipped.find(w => w.id === 'workshop'),
    { desks, approval, rest } = shape.stations;
  for (const s of [...desks, approval, rest]) {
    assert.ok(s.y > shape.fieldTop && s.y <= 1 && s.x >= 0 && s.x <= 1, `${s.x},${s.y} is on the floor`);
  }
  const seen = (width, height) => {
    wide(width, height);
    const v = friend('seen');
    return { approval: station(v, approval), desks: desks.filter(d => station(v, d)).length };
  };
  for (const [width, height] of [
    [1180, 850],
    [800, 560],
    [300, 210],
  ]) {
    wide(width, height);
    for (const s of [approval, rest]) {
      const at = stationAt(s);
      assert.equal(blocked(at.x, at.y), false, `at ${width} by ${height}, ${s.x},${s.y} is clear of furniture`);
    }
    const { approval: spot, desks: shown } = seen(width, height);
    assert.ok(spot, `at ${width} by ${height}, the approval spot shows`);
    assert.ok(shown >= 2, `at ${width} by ${height}, ${shown} desks show`);
  }
  assert.ok(seen(900, 260).approval, 'in a strip, the approval spot still shows');
});

test('working friends sit at desks in turn, keep theirs, and the extra one stands beside one', t => {
  inRoom(t);
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

test('past two beside each desk, a working friend works where it stands', t => {
  inRoom(t);
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    all = ids.map(id => friend(id));
  agent(Object.fromEntries(ids.map(id => [id, 'working'])));
  moveFriends(1000, 50);
  const [a, b, ...rest] = all,
    body = sizeOf(a.pet);
  assert.deepEqual(a.target, at(a, 0.3, 0.55));
  assert.deepEqual(b.target, at(b, 0.6, 0.55));
  // Beside a desk: a body to the right of each desk in turn, then a body to the left.
  const beside = [1, -1].flatMap(side => [0.3, 0.6].map(x => footTarget(a, 1536 * x + side * body, 1024 * 0.55, 0)));
  rest.slice(0, 4).forEach((v, i) => assert.deepEqual(v.target, beside[i], `${v.pet.id} stands beside a desk`));
  assert.equal(rest[4].target, null, 'the seventh works where it stands');
});

// A finished or failed agent fades (status.js FADE_MS): the friend leaves its station with no word.
test('a done or failed friend leaves its station when the state fades, without a new word', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  inRoom(t);
  const a = friend('a'),
    b = friend('b');
  agent({ a: 'done', b: 'error' });
  moveFriends(1000, 50);
  assert.deepEqual(a.target, at(a, 0.15, 0.6), 'done, it rests in the corner');
  assert.deepEqual(b.target, at(b, 0.3, 0.55), 'failed, it stays at a desk');
  for (const v of [a, b]) {
    v.target = null;
    v.trip = null;
  }
  t.mock.timers.tick(FADE_MS + 1000);
  moveFriends(1050, 50);
  for (const v of [a, b]) {
    assert.deepEqual(v.target, { x: 0.5, y: 0.3 }, `${v.pet.id} walks back to its own place`);
    assert.equal(v.spot, null);
  }
});

test('an error stays at the desk; waiting goes to the approval spot; done rests in the corner and stays', t => {
  inRoom(t);
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

// A new place is a new look at the friends: one whose agent already works sits down in the room,
// and leaving the room lets go of the desk, so the friend stands at its own place again.
test('entering a workspace seats each friend for the state its agent already reported, and leaving lets go of the station', t => {
  inRoom(t);
  scene.world = 'woodland';
  measureYard();
  const a = friend('a');
  agent({ a: 'working' });
  moveFriends(1000, 50);
  assert.equal(a.target, null, 'outdoors, it works where it stands');
  // The place changes as app.js worldChanged does it: trips end, the scene moves, each friend afresh.
  const go = world => {
    release(a);
    scene.world = world;
    measureYard();
    dutyAfresh(a);
  };
  go(room.id);
  moveFriends(1050, 50);
  assert.deepEqual(a.target, at(a, 0.3, 0.55), 'in the room, it sits at a desk');
  assert.equal(a.spot?.kind, 'desk');
  go('woodland');
  assert.equal(a.spot, null, 'the desk stays in the room');
  moveFriends(1100, 50);
  assert.equal(a.target, null, 'outdoors again, it works where it stands');
});

test('two waiting friends stand side by side at the approval spot', t => {
  inRoom(t);
  const a = friend('a'),
    b = friend('b');
  agent({ a: 'waiting', b: 'waiting' });
  moveFriends(1000, 50);
  assert.equal(a.target.y, b.target.y);
  assert.notEqual(a.target.x, b.target.x);
});

test('furniture blocks the end of a stroll, as a tree does', t => {
  inRoom(t);
  assert.equal(blocked(1536 * 0.3, 1024 * 0.58), true);
  assert.equal(blocked(1536 * 0.3 + 1536 * 0.059, 1024 * 0.58), true);
  assert.equal(blocked(1536 * 0.5, 1024 * 0.58), false);
  assert.equal(blocked(1536 * 0.3, 1024 * 0.62), false);
});

test("a desk's front is drawn over a friend whose feet are behind its foot line", async t => {
  inRoom(t);
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
  // Friends are layered by where their feet are (views.js place, depthAt): a friend seated at the
  // desk, its feet 10px behind the front's foot line, is under it; 10px in front, over it.
  const { place } = await import('../src/yard/views.js');
  const foot = 1024 * 0.6;
  for (const [gap, over] of [
    [-10, false],
    [10, true],
  ]) {
    const a = friend('a');
    Object.assign(a, at(a, 0.3, (foot + gap) / 1024));
    place(a);
    assert.equal(a.z > front.z, over, `${gap}px from the foot line`);
  }
});

test("a friend wears its tag at its feet, standing or seated at a desk, so a desk's front never puts it over the face", async t => {
  inRoom(t);
  const { place } = await import('../src/yard/views.js');
  const { petHeight } = await import('../src/yard/field.js');
  const a = friend('a', { y: 0.2 });
  a.body = element();
  // Where the tag starts: the label's top plus the body's room in it.
  const tagTop = () => Number(/,([-\d.]+)px\)/.exec(a.label.style.transform)[1]) + parseFloat(a.body.style.height);
  for (const spot of [null, { kind: 'desk', x: 0.5, y: 0.2 }]) {
    a.spot = spot;
    place(a);
    assert.ok(Math.abs(tagTop() - (a.py + petHeight(a.pet))) < 1e-6, spot ? 'seated' : 'standing');
  }
});

test('a workspace takes the outdoor light, and its glass is not washed over as a painted window is', async () => {
  const { environmentLook, paintEnvironment } = await import('../src/yard/environment.js');
  // The room and the view through its glass share one light: a darker view alone would need its
  // own mask, and a pane's rectangle also covers frames, walls and plants.
  for (const period of ['morning', 'day', 'evening', 'night'])
    for (const weather of ['clear', 'rain']) {
      const at = { season: 'summer', period, weather };
      const { art, ...light } = environmentLook({ ...at, world: 'workshop' });
      const { art: _, ...outdoors } = environmentLook({ ...at, world: 'woodland' });
      assert.equal(art, 'workshop');
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
    world: 'workshop',
    season: 'summer',
    period: 'day',
    weather: 'rain',
  });
  assert.equal(fills, 1, 'the outdoor rain tint only');
});

// An rng giving these numbers in turn, then 0.99.
const draws =
  (...values) =>
  () =>
    values.length ? values.shift() : 0.99;
const SEAT = 0.1,
  TEA = 0.6,
  BENCH = 0.9;
// Walks a friend the rest of its way, as a frame at the end of a trip does.
function arrive(v, now) {
  v.x = v.target.x;
  v.y = v.target.y;
  moveFriends(now, 50);
}

test('with no agent, an idle friend now and then sits at a free seat, has tea or sits by the bench, then strolls on', t => {
  inRoom(t);
  agent({});
  const a = friend('a', { bubble: element() }),
    b = friend('b', { bubble: element() }),
    c = friend('c', { bubble: element() });
  // A first frame reads each friend's agent state.
  moveFriends(900, 50);
  assert.equal(loungeTarget(a, 1000, draws(0.9)), null, 'most of the time it strolls instead');
  assert.deepEqual(loungeTarget(a, 1000, draws(0, SEAT)), at(a, 0.3, 0.55));
  assert.equal(a.trip.save, false, 'its own place stays where it lives');
  assert.equal(a.own, true, 'its own trip');
  assert.deepEqual(loungeTarget(b, 1000, draws(0, SEAT)), at(b, 0.6, 0.55), 'the next free seat');
  assert.deepEqual(loungeTarget(c, 1000, draws(0, TEA)), at(c, 0.15, 0.6));
  arrive(a, 1100);
  assert.equal(a.target, null);
  assert.ok(a.doing, 'seated a while');
  moveFriends(1100 + 20000, 50);
  assert.ok(a.doing, 'still seated after 20 seconds');
  // Sitting costs one comparison a frame; when the time is up it gets up and strolls on.
  sitOut(a, 1100 + 120000);
  assert.equal(a.doing, null);
  assert.equal(a.spot, null);
  assert.equal(loungeTarget(a, 1100 + 121000, draws(0, SEAT)), null, 'not straight back to a seat');
  const d = friend('d', { bubble: element() });
  moveFriends(122200, 50);
  assert.deepEqual(loungeTarget(d, 1000, draws(0, BENCH)), at(d, 0.5, 0.85));
  // Another place: a friend sitting there gets up at once.
  arrive(d, 122300);
  assert.ok(d.doing);
  scene.world = shipped.find(w => !w.geometry?.stations).id;
  sitOut(d, 122400);
  assert.equal(d.doing, null);
});

test('no two friends share a seat, and one that is only sitting gives way to an agent and to the person', t => {
  inRoom(t);
  agent({});
  const a = friend('a', { bubble: element() }),
    b = friend('b', { bubble: element() }),
    c = friend('c', { bubble: element() });
  moveFriends(900, 50);
  loungeTarget(a, 1000, draws(0, SEAT));
  loungeTarget(b, 1000, draws(0, SEAT));
  assert.equal(loungeTarget(c, 1000, draws(0, SEAT)), null, 'both seats taken: it strolls');
  arrive(a, 1100);
  // Its friend's agent starts work: the seat goes to it, and the one sitting there walks home.
  agent({ c: 'working' });
  moveFriends(1200, 50);
  assert.deepEqual(c.target, at(c, 0.3, 0.55));
  assert.equal(a.doing, null);
  assert.equal(a.spot, null);
  assert.deepEqual(a.target, { x: 0.5, y: 0.3 });
  // A seat a working friend holds is not offered.
  a.target = null;
  a.trip = null;
  a.sitAgain = 0;
  assert.equal(loungeTarget(a, 5000, draws(0, SEAT)), null);
  // Its own agent's state takes a sitting friend at once.
  agent({ c: 'working', b: 'waiting' });
  moveFriends(1300, 50);
  assert.deepEqual(b.target, at(b, 0.5, 0.85));
  // The person asks for a friend: a free one first, else one only sitting.
  const e = friend('e', { bubble: element() });
  moveFriends(1350, 50);
  loungeTarget(e, 1000, draws(0, TEA));
  arrive(e, 1400);
  assert.equal(
    forPerson(0, 0, null, v => v === e),
    e,
  );
});

test('a friend picked up from its seat does not walk straight back to one', t => {
  inRoom(t);
  agent({});
  const a = friend('a', { bubble: element() });
  moveFriends(900, 50);
  loungeTarget(a, 1000, draws(0, TEA));
  arrive(a, 1100);
  assert.ok(a.doing);
  // What a press on the friend does (views.js): the trip and the sitting end.
  release(a);
  rest(a);
  assert.equal(a.spot, null);
  assert.equal(loungeTarget(a, 9000, draws(0, SEAT)), null, 'a while of strolling first');
  assert.ok(loungeTarget(a, 1000 + 61000, draws(0, SEAT)));
});

test('a friend whose agent waits takes the bench from a friend only sitting by it', t => {
  inRoom(t);
  agent({});
  const a = friend('a', { bubble: element() }),
    b = friend('b', { bubble: element() });
  moveFriends(900, 50);
  loungeTarget(a, 1000, draws(0, BENCH));
  arrive(a, 1100);
  agent({ b: 'waiting' });
  moveFriends(1200, 50);
  assert.deepEqual(b.target, at(b, 0.5, 0.85));
  assert.equal(a.spot, null);
});

test('outdoors and in rooms without stations, an idle friend strolls as before', t => {
  inRoom(t);
  agent({});
  scene.world = shipped.find(w => !w.geometry?.stations).id;
  const a = friend('a', { bubble: element() });
  assert.equal(
    loungeTarget(a, 1000, () => {
      throw new Error('no draw outdoors');
    }),
    null,
  );
});
