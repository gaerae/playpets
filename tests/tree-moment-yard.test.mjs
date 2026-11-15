// Tree moments in the yard: the petals a grown fringe tree leaves on heads, a red plum's visits
// (src/yard/tree-moments.js), and the fruit a fruit tree drops and friends pick up
// (src/yard/fallen-fruit.js). The rules are tested in tree-moments.test.mjs; here the page runs them with
// the clock, the random draws and the scene the test holds.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';

// The backend, as the tests answer it (state.js reads the bridge when it first loads).
globalThis.playPets = {
  markViewed: async () => ({ ok: true, data: null }),
  updatePet: async () => ({ ok: true, data: null }),
};
const state = await import('../src/core/state.js');
const { list, t: translate } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { element, installDom, keepGlobals } = await import('./support/dom.mjs');
const { artHref } = await import('../src/yard/art.js');
const { fieldToYard, footOf, measureYard } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');
const { forPerson, release, sendTo } = await import('../src/yard/trips.js');
const { bubble, place, syncViews } = await import('../src/yard/views.js');
const { petalTick, setupPetals } = await import('../src/yard/petals.js');
const { setupTreeMoments, syncTreeMoments, treeMomentTick } = await import('../src/yard/tree-moments.js');
const { FRUIT_FIRST, HEAD_PETAL_EVERY, fruitFall, harvestOf, momentsOf } =
  await import('../src/yard/tree-moment-rules.js');
const { treeSize } = await import('../src/yard/catalog.js');
const { propScale } = await import('../src/yard/props.js');
const { drawYard } = await import('./support/yard.mjs');
const { fruitPicking, fruitMinute, pickFruit, renderFruit, setupFruit } = await import('../src/yard/fallen-fruit.js');

const spring = { world: 'woodland', season: 'spring', period: 'day', weather: 'clear', event: null };
const grown = (id, kind, x, y) => ({ id, kind, world: 'woodland', x, y, planted: 0, stage: 2 });

// A yard of 1000 x 700 on April 20, 2027 at 10:00 local time, with friends drawn the way the page
// draws them (views.js), and a clock the test holds.
function yard(t, { garden = {}, pets = 2, values = spring } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(2027, 3, 20, 10).getTime() });
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  t.mock.method(Math, 'random', () => 0);
  installDom(t, { anyId: true });
  keepGlobals(t, 'MutationObserver');
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  document.getElementById('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700 });
  measureYard();
  const was = Object.fromEntries(Object.keys(spring).map(key => [key, scene[key]]));
  Object.assign(scene, values);
  const motion = reduced.matches;
  reduced.matches = false;
  const previous = state.data;
  state.setData({
    pets: Array.from({ length: pets }, (_, i) => ({ id: `p${i}`, name: `p${i}`, size: 100, x: 0.2 + i * 0.5, y: 0.6 })),
    assets: [],
    statuses: {},
    busy: [],
    garden: { viewed: '', wished: '', decor: [], plants: [], trees: [], ...garden },
  });
  state.views.clear();
  state.setGame(null);
  syncViews();
  setupPetals();
  setupTreeMoments();
  syncTreeMoments();
  t.after(() => {
    for (const v of state.views.values()) release(v);
    state.views.clear();
    state.setData(previous);
    Object.assign(scene, was);
    reduced.matches = motion;
  });
  return {
    views: () => [...state.views.values()],
    clock: () => clock,
    // Runs the yard's ticks a second at a time for `ms`.
    run(ms) {
      for (let at = 0; at < ms; at += 1000) {
        clock += 1000;
        t.mock.timers.tick(1000);
        treeMomentTick(clock);
        petalTick(clock);
      }
    },
  };
}
// Stands a friend with its feet at a yard point.
function standAt(v, x, y) {
  const foot = footOf(v);
  v.px += x - foot.x;
  v.py += y - foot.y;
}

test('a friend standing under a grown fringe tree in spring now and then gets one of its white petals', t => {
  const fringe = grown('f', 'fringe_tree', 0.5, 0.3),
    y = yard(t, { garden: { trees: [fringe] } }),
    [v, far] = y.views(),
    foot = fieldToYard(fringe);
  standAt(v, foot.x + 20, foot.y + 10);
  y.run(HEAD_PETAL_EVERY[0] - 2000);
  assert.equal(v.petal ?? null, null, 'it waits a while first');
  y.run(3000);
  assert.ok(v.petal, 'then one lands on the friend under the crown');
  assert.ok(v.petal.classList.contains('tinted'), 'in the tree’s colours');
  assert.equal(v.petal.style['--petal'], momentsOf('fringe_tree')[0].colors[0]);
  assert.equal(far.petal ?? null, null, 'not on a friend away from the tree');
  // Brushed off, the next one waits as long again: never a shower of them.
  release(v);
  assert.equal(v.petal, null);
  y.run(HEAD_PETAL_EVERY[0] - 3000);
  assert.equal(v.petal, null, 'not again so soon');
  y.run(3000);
  assert.ok(v.petal, 'but in a while');
});

test('a head petal waits its first wait again each time the moment comes back', async t => {
  for (const [name, away] of [
    ['night', () => (scene.period = 'night')],
    ['rain', () => (scene.weather = 'rain')],
  ])
    await t.test(name, s => {
      const fringe = grown('f', 'fringe_tree', 0.5, 0.3),
        y = yard(s, { garden: { trees: [fringe] }, pets: 1 }),
        [v] = y.views(),
        foot = fieldToYard(fringe);
      standAt(v, foot.x, foot.y + 10);
      y.run(HEAD_PETAL_EVERY[0] + 1000);
      assert.ok(v.petal);
      release(v);
      // The next would be due about 25 s on; the moment is away until 45 s.
      y.run(5000);
      away();
      syncTreeMoments();
      y.run(40_000);
      Object.assign(scene, spring);
      syncTreeMoments();
      y.run(HEAD_PETAL_EVERY[0] - 2000);
      assert.equal(v.petal, null, 'not at once on its return');
      y.run(3000);
      assert.ok(v.petal, 'but after its first wait');
    });
});

test('no head petal at night, in rain, in another season, or under a tree still growing', async t => {
  for (const [values, trees] of [
    [{ ...spring, period: 'night' }, [grown('f', 'fringe_tree', 0.5, 0.3)]],
    [{ ...spring, weather: 'rain' }, [grown('f', 'fringe_tree', 0.5, 0.3)]],
    [{ ...spring, season: 'summer' }, [grown('f', 'fringe_tree', 0.5, 0.3)]],
    [spring, [{ ...grown('f', 'fringe_tree', 0.5, 0.3), stage: 1, planted: new Date(2027, 3, 20, 9).getTime() }]],
    [spring, [grown('c', 'cherry', 0.5, 0.3)]],
  ])
    await t.test(
      `${values.period}, ${values.weather}, ${values.season}, ${trees[0].kind} at stage ${trees[0].stage}`,
      s => {
        const y = yard(s, { garden: { trees }, values, pets: 1 }),
          [v] = y.views(),
          foot = fieldToYard(trees[0]);
        standAt(v, foot.x, foot.y + 10);
        y.run(120_000);
        assert.equal(v.petal ?? null, null);
      },
    );
});

test('a fringe petal stays on while the moment lasts, and comes off when it ends', t => {
  const fringe = grown('f', 'fringe_tree', 0.5, 0.3),
    y = yard(t, { garden: { trees: [fringe] }, pets: 1 }),
    [v] = y.views(),
    foot = fieldToYard(fringe);
  standAt(v, foot.x + 20, foot.y + 10);
  y.run(HEAD_PETAL_EVERY[0] + 1000);
  assert.ok(v.petal);
  // Not blossom time (no festival), and still it stays while the fringe tree's moment lasts.
  y.run(20_000);
  assert.ok(v.petal && !v.petal.removed, 'it stays on');
  // The moment ends with the rain, and the petal comes off though the friend never moved.
  scene.weather = 'rain';
  syncTreeMoments();
  y.run(1000);
  assert.equal(v.petal, null, 'rain takes it off');
});

test('a friend wearing a fringe petal notices it in the tree’s own words', t => {
  const fringe = grown('f', 'fringe_tree', 0.5, 0.3),
    y = yard(t, { garden: { trees: [fringe] }, pets: 1 }),
    [v] = y.views(),
    foot = fieldToYard(fringe);
  standAt(v, foot.x, foot.y + 10);
  y.run(HEAD_PETAL_EVERY[0] + 1000);
  assert.ok(v.petal);
  y.run(4000);
  assert.equal(v.bubble.hidden, false);
  assert.ok(list('moment.fringe_head').includes(v.bubble.textContent), v.bubble.textContent);
});

test('now and then a free friend walks to a red plum in winter, looks up at it and says a line', t => {
  const plum = grown('r', 'red_plum', 0.5, 0.3),
    y = yard(t, { garden: { trees: [plum] }, pets: 1, values: { ...spring, season: 'winter', weather: 'snow' } }),
    [v] = y.views();
  y.run(3 * 60_000 + 2000);
  assert.ok(v.target, 'it sets off');
  assert.ok(v.trip.slow, 'at a stroll');
  // It gets there, as moveFriends brings it.
  const { trip, target } = v;
  v.x = target.x;
  v.y = target.y;
  v.target = null;
  v.trip = null;
  place(v);
  trip.arrive(v, performance.now());
  assert.ok(v.doing, 'it stands there');
  assert.ok(v.button.classList.contains('looking-up'));
  assert.ok(['left', 'right'].includes(v.button.dataset.tilt));
  assert.ok(v.look, 'looking at the blossom');
  y.run(1000);
  assert.ok(list('moment.plum_smell').includes(v.bubble.textContent), v.bubble.textContent);
  y.run(5000);
  assert.equal(v.doing, null, 'then it goes on with its day');
  assert.equal(v.button.classList.contains('looking-up'), false);
  assert.equal(v.button.dataset.tilt, undefined);
});

test('a friend still speaking when it reaches the plum says its line once that one is done', t => {
  const plum = grown('r', 'red_plum', 0.5, 0.3),
    y = yard(t, { garden: { trees: [plum] }, pets: 1, values: { ...spring, season: 'winter' } }),
    [v] = y.views();
  y.run(3 * 60_000 + 2000);
  const { trip } = v;
  v.target = null;
  v.trip = null;
  trip.arrive(v, performance.now());
  // A line shows at least three seconds (readingTime).
  bubble(v, 'Something else', 3000);
  y.run(1000);
  assert.equal(v.bubble.textContent, 'Something else', 'never over its own words');
  y.run(2500);
  assert.ok(list('moment.plum_smell').includes(v.bubble.textContent), v.bubble.textContent);
});

test('a friend out for a stroll turns aside to the plum, but not one on an errand', t => {
  const plum = grown('r', 'red_plum', 0.5, 0.3),
    y = yard(t, { garden: { trees: [plum] }, pets: 1, values: { ...spring, season: 'winter' } }),
    [v] = y.views();
  const away = { x: 0.9, y: 0.9 };
  sendTo(v, away, { arrive: () => {} });
  y.run(8 * 60_000);
  assert.equal(v.target, away, 'an errand goes on');
  release(v);
  sendTo(v, away, { slow: true });
  y.run(8 * 60_000);
  assert.notEqual(v.target, away, 'a stroll gives way');
  assert.ok(v.trip?.arrive, 'to the tree');
});

test('a visit ends whenever the friend is taken, and none starts in a game', t => {
  const plum = grown('r', 'red_plum', 0.5, 0.3),
    y = yard(t, { garden: { trees: [plum] }, pets: 1, values: { ...spring, season: 'winter' } }),
    [v] = y.views();
  state.setGame({ kind: 'tag' });
  y.run(8 * 60_000);
  assert.equal(v.target, null, 'no visit in a game');
  state.setGame(null);
  y.run(8 * 60_000);
  const { trip } = v;
  v.target = null;
  v.trip = null;
  trip.arrive(v, performance.now());
  assert.ok(v.button.classList.contains('looking-up'));
  release(v);
  assert.equal(v.button.classList.contains('looking-up'), false, 'a press or a call takes the look away');
  y.run(10_000);
  assert.equal(v.bubble.hidden, true, 'and nothing is said afterwards');
});

// Brings a friend on its way to the tree there, as moveFriends does.
function arrive(v) {
  const { trip } = v;
  v.target = null;
  v.trip = null;
  trip.arrive(v, performance.now());
}

test('while one friend walks to the plum no other is sent, and none is left looking up', t => {
  const plum = grown('r', 'red_plum', 0.5, 0.3),
    y = yard(t, { garden: { trees: [plum] }, values: { ...spring, season: 'winter' } }),
    [a, b] = y.views();
  y.run(3 * 60_000 + 2000);
  assert.ok(a.trip?.arrive, 'one sets off');
  // It is still walking when the next visit comes due (the window hidden on the way, say).
  y.run(8 * 60_000);
  assert.equal(b.target, null, 'the walk is the visit: no second friend is sent');
  arrive(a);
  assert.ok(a.button.classList.contains('looking-up'));
  y.run(6000);
  for (const v of [a, b]) {
    assert.equal(v.doing, null);
    assert.equal(v.button.classList.contains('looking-up'), false);
    assert.equal(v.button.dataset.tilt, undefined);
  }
});

test('a friend taken on its way to the plum frees the visit for another time', t => {
  const plum = grown('r', 'red_plum', 0.5, 0.3),
    y = yard(t, { garden: { trees: [plum] }, pets: 1, values: { ...spring, season: 'winter' } }),
    [v] = y.views();
  y.run(3 * 60_000 + 2000);
  assert.ok(v.trip?.arrive);
  release(v);
  assert.equal(v.visiting, false, 'no longer on a visit');
  y.run(8 * 60_000);
  assert.ok(v.trip?.arrive, 'a later visit goes ahead');
  arrive(v);
  assert.ok(v.button.classList.contains('looking-up'));
});

test('a friend at the plum, or on its way, gives way to what the person asks', t => {
  const plum = grown('r', 'red_plum', 0.5, 0.3),
    y = yard(t, { garden: { trees: [plum] }, pets: 1, values: { ...spring, season: 'winter' } }),
    [v] = y.views();
  y.run(3 * 60_000 + 2000);
  assert.equal(forPerson(0, 0), v, 'on its way');
  arrive(v);
  assert.equal(forPerson(0, 0), v, 'and standing there');
  sendTo(v, { x: 0.9, y: 0.9 }, { arrive: () => {} });
  assert.equal(v.button.classList.contains('looking-up'), false, 'the errand takes it from the tree');
  assert.equal(v.visiting, false);
});

// ---- burrs ----

const AUTUMN = new Date(2027, 9, 5, 11).getTime();
const chestnut = grown('c', 'chestnut', 0.5, 0.3);
async function burrYard(ctx, { stored = null, values = {}, rng = [], tree = chestnut, now = AUTUMN } = {}) {
  ctx.mock.method(Math, 'random', () => (rng.length ? rng.shift() : 0.5));
  const y = await drawYard(ctx, {
    now,
    scene: { season: 'autumn', world: 'woodland', weather: 'clear', period: 'day', ...values },
    garden: { trees: [tree] },
    art: [harvestOf(tree.kind).art],
    before: ({ storage }) => {
      if (stored) storage.setItem('fallen-fruit', stored);
    },
  });
  setupFruit();
  const live = () => y.shown().filter(b => b.classList.contains('fallen-fruit'));
  const saved = () => JSON.parse(state.recall('fallen-fruit'));
  return { ...y, live, saved };
}
const lyingBurr = (id, x = 0.52, y = 0.33, extra = {}) => ({
  id,
  tree: 'c',
  world: 'woodland',
  x,
  y,
  at: AUTUMN - 1000,
  ...extra,
});
const record = (out, extra = {}) => JSON.stringify({ next: AUTUMN + 3_600_000, picked: '', out, ...extra });

test('a grown chestnut in autumn drops a burr at its foot now and then, drawn as it falls', async ctx => {
  const y = await burrYard(ctx);
  fruitMinute();
  assert.equal(y.live().length, 0, 'the first look only sets the wait');
  // 0.5 of the way through the first wait.
  ctx.mock.timers.tick((FRUIT_FIRST[0] + FRUIT_FIRST[1]) / 2 - 1);
  fruitMinute();
  assert.equal(y.live().length, 0, 'not before it is due');
  ctx.mock.timers.tick(1);
  fruitMinute();
  const [button, ...more] = y.live();
  assert.equal(more.length, 0);
  const [burr] = y.saved().out;
  assert.equal(burr.tree, 'c');
  assert.equal(burr.world, 'woodland');
  assert.ok(burr.y > chestnut.y && Math.abs(burr.x - chestnut.x) < 0.1, 'at the foot, in front of the trunk');
  assert.equal(button.dataset.kind, 'chestnut');
  assert.equal(button.title, translate('moment.chestnut_title'));
  assert.equal(button.getAttribute('aria-label'), translate('moment.chestnut_title'));
  const [svg] = button.children;
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.children[0].getAttribute('href'), artHref(harvestOf('chestnut').art));
  assert.ok(button.classList.contains('dropped'), 'it drops as it comes');
  // From the crown's lower edge: the tree's foot and height as planted-trees.js draws it.
  const foot = fieldToYard(chestnut),
    spot = fieldToYard(burr),
    tall = treeSize('chestnut', 2)[1] * propScale(foot);
  assert.equal(button.style['--fall'], `${fruitFall(spot.y, foot.y, tall)}px`);
  assert.ok(fruitFall(spot.y, foot.y, tall) > 40, 'a fall the eye can follow');
  // Drawn again (a state change), it stays where it lies and does not drop a second time.
  renderFruit();
  setupFruit();
  renderFruit();
  const [again] = y.live();
  assert.ok(!again.classList.contains('dropped'));
});

test('the first wait comes again each time the harvest comes back, and at each start', async ctx => {
  const y = await burrYard(ctx, { stored: record([], { next: AUTUMN - 1 }) });
  fruitMinute();
  assert.equal(y.live().length, 0, 'a start waits first, whatever was stored');
  ctx.mock.timers.tick(FRUIT_FIRST[0] - 1000);
  scene.period = 'night';
  fruitMinute();
  ctx.mock.timers.tick(10 * 60_000);
  fruitMinute();
  scene.period = 'day';
  fruitMinute();
  assert.equal(y.live().length, 0, 'a new morning waits first too');
  ctx.mock.timers.tick(FRUIT_FIRST[1]);
  fruitMinute();
  assert.equal(y.live().length, 1, 'and then one drops');
});

// The red plum flowers in winter and drops green plums in summer: the same code, its own fruit.
const SUMMER = new Date(2027, 6, 5, 11).getTime();
const plumTree = grown('c', 'red_plum', 0.5, 0.3);

test('a grown red plum in summer drops green plums, with their own drawing and title', async ctx => {
  const y = await burrYard(ctx, { tree: plumTree, now: SUMMER, values: { season: 'summer' } });
  fruitMinute();
  ctx.mock.timers.tick(FRUIT_FIRST[1]);
  fruitMinute();
  const [button, ...more] = y.live();
  assert.equal(more.length, 0);
  assert.equal(button.dataset.kind, 'red_plum');
  assert.equal(button.title, translate('moment.plum_title'));
  assert.equal(button.children[0].children[0].getAttribute('href'), artHref(harvestOf('red_plum').art));
  assert.notEqual(harvestOf('red_plum').art, harvestOf('chestnut').art);
  scene.season = 'autumn';
  fruitMinute();
  assert.equal(y.live().length, 0, 'the summer takes its plums along');
});

test('a friend picking up green plums says the plum’s own lines', async ctx => {
  const y = await pickYard(ctx, {
    tree: plumTree,
    now: SUMMER,
    values: { season: 'summer' },
    stored: record([lyingBurr('1', 0.52, 0.33, { at: SUMMER - 1000 })], {
      picked: { chestnut: '2027-07-05' },
    }),
  });
  y.click();
  y.arrive();
  ctx.mock.timers.tick(1950);
  assert.ok(list('moment.plum_first').includes(y.v.bubble.textContent), 'a chestnut picked today does not count');
  assert.deepEqual(y.saved().picked, { chestnut: '2027-07-05', red_plum: '2027-07-05' });
});

test('at most two burrs lie under a tree, and none drop at night, but those there stay', async ctx => {
  const y = await burrYard(ctx, { stored: record([lyingBurr('1'), lyingBurr('2', 0.46, 0.34)], { next: AUTUMN - 1 }) });
  fruitMinute();
  assert.equal(y.live().length, 2, 'a third waits for room');
  assert.equal(y.saved().out.length, 2);
  scene.period = 'night';
  setupFruit();
  fruitMinute();
  assert.equal(y.live().length, 2, 'at night they lie on');
  scene.season = 'winter';
  fruitMinute();
  assert.equal(y.live().length, 0, 'another season takes them');
  assert.deepEqual(y.saved().out, []);
});

// A friend picking a burr up (fallen-fruit.js pickFruit): the walk and stroke of a shoot's gathering.
async function pickYard(ctx, options = {}) {
  const y = await burrYard(ctx, { stored: record([lyingBurr('1')]), ...options });
  fruitMinute();
  const pet = { id: 'clover', size: 112, name: 'Clover' },
    v = { pet, px: 120, py: 300, x: 0.1, y: 0.5, pose: 'idle', bubble: element('span') };
  state.views.set(pet.id, v);
  state.setSelected(pet.id);
  ctx.after(() => {
    release(v);
    state.views.clear();
    state.setSelected(null);
  });
  const [button] = y.live();
  return {
    ...y,
    v,
    button,
    click: () => button.dispatch('click', {}),
    arrive() {
      const { trip } = v;
      v.target = null;
      v.trip = null;
      trip.arrive(v, 0);
    },
  };
}

test('clicking a burr sends a friend to pick it up; the day’s first pick has its own line', async ctx => {
  const y = await pickYard(ctx);
  y.click();
  assert.ok(y.v.target, 'the friend sets off');
  assert.ok(y.button.classList.contains('picking'));
  assert.equal(fruitPicking(), true);
  y.click();
  assert.equal(pickFruit('1'), false, 'one friend for one burr');
  y.arrive();
  ctx.mock.timers.tick(1950);
  assert.equal(y.live().length, 0, 'the burr leaves the yard');
  assert.deepEqual(y.saved().out, []);
  assert.deepEqual(y.saved().picked, { chestnut: '2027-10-05' });
  assert.ok(list('moment.chestnut_first').includes(y.v.bubble.textContent), y.v.bubble.textContent);
  assert.equal(y.v.doing, null);
  assert.equal(fruitPicking(), false);
});

test('a later pick the same day says an ordinary line, and a friend taken away leaves the burr', async ctx => {
  const y = await pickYard(ctx, { stored: record([lyingBurr('1')], { picked: { chestnut: '2027-10-05' } }) });
  y.click();
  release(y.v);
  assert.equal(fruitPicking(), false);
  assert.ok(!y.button.classList.contains('picking'));
  assert.equal(y.saved().out.length, 1, 'still there');
  y.click();
  y.arrive();
  ctx.mock.timers.tick(1950);
  assert.ok(list('moment.chestnut_pick').includes(y.v.bubble.textContent), y.v.bubble.textContent);
});

test('with no friend in the yard a click says who could pick it up', async ctx => {
  const y = await burrYard(ctx, { stored: record([lyingBurr('1')]) });
  fruitMinute();
  y.live()[0].dispatch('click', {});
  assert.deepEqual(
    y.document.getElementById('toast').children.map(line => line.textContent),
    [translate('moment.fruit_no_friend')],
  );
});

test('the yard wires the moments in with the sky, the garden and the frame loop', async () => {
  const app = await readFile('src/app.js', 'utf8'),
    render = await readFile('src/render.js', 'utf8');
  const sky = app.search(/^setupSky\(/m);
  for (const setup of ['setupFruit();', 'setupTreeMoments();']) {
    const at = app.search(new RegExp(`^${setup.replace(/[()]/g, '\\$&')}`, 'm'));
    assert.ok(at >= 0 && at < sky, `${setup} runs before the sky first paints`);
  }
  const minute = app.indexOf('fruitMinute();');
  assert.ok(minute > app.indexOf('shootsMinute();') && minute < app.indexOf('seasonPicked'), 'each repaint looks');
  assert.ok(app.indexOf('syncTreeMoments();') < app.indexOf('seasonPicked'));
  for (const hook of ['worldChanged', 'landChanged', 'resized']) {
    const from = app.indexOf(`${hook}:`),
      body = app.slice(from, app.indexOf('},', app.indexOf('renderTrees();', from)) + 2);
    assert.ok(body.indexOf('renderFruit();') > body.indexOf('renderTrees();'), hook);
    assert.ok(body.includes('syncTreeMoments();'), hook);
    if (hook !== 'worldChanged') assert.ok(body.includes('cancelFruitPicks();'), hook);
  }
  assert.match(app, /const YARD_LIFE = \[[^\]]*treeMomentTick,/);
  assert.ok(render.indexOf('renderFruit();') > render.indexOf('renderTrees();'), 'a state change redraws them');
  assert.ok(render.indexOf('syncTreeMoments();') > render.indexOf('renderTrees();'));
});

test('fruit falls from the crown, bounces once and settles, stays still for reduced motion, and lets a tool or a game through', async () => {
  const css = (await readFile('src/styles/garden.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  assert.match(css, /\.fallen-fruit\.dropped svg \{ animation: fruit-drop [\d.]+m?s both; \}/);
  const frames = css.match(/@keyframes fruit-drop \{(.*?\}) \}/)?.[1] || '';
  for (const [, property] of frames.matchAll(/([a-z-]+):/g))
    assert.ok(['transform', 'opacity', 'animation-timing-function'].includes(property), property);
  const steps = [...frames.matchAll(/(from|to|[\d.]+%) \{([^}]*)\}/g)].map(([, at, body]) => ({
    at: at === 'from' ? 0 : at === 'to' ? 100 : Number.parseFloat(at),
    body,
  }));
  // It starts at the crown's lower edge (--fall above where it lies) and falls faster as it goes.
  assert.match(steps[0].body, /translateY\(calc\(-1 \* var\(--fall\)\)\)/);
  const [x1, y1, x2, y2] = steps[0].body
    .match(/animation-timing-function: cubic-bezier\(([^)]*)\)/)[1]
    .split(',')
    .map(Number);
  assert.ok(x1 >= 0.4 && y1 === 0 && x2 > y2, 'speeding up');
  // It reaches the ground, lifts once a little (a share of its own height, never back up to the
  // crown) and settles; it never sinks below the ground or stretches.
  const lifts = steps.filter(s => /translateY\(-[\d.]+%\)/.test(s.body));
  assert.equal(lifts.length, 1, 'one bounce');
  assert.ok(Number.parseFloat(lifts[0].body.match(/translateY\(-([\d.]+)%\)/)[1]) <= 15, 'a small one');
  assert.doesNotMatch(frames, /translateY\((?!-|calc)/, 'never below where it lies');
  assert.doesNotMatch(frames, /scale/, 'no squash or stretch');
  assert.match(steps.at(-1).body, /transform: none/);
  // Its shade under it grows as it nears the ground.
  assert.match(css, /\.fallen-fruit\.dropped::before \{ animation: fruit-shade [\d.]+m?s both; \}/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.fallen-fruit\.dropped svg, \.fallen-fruit\.dropped::before \{ animation: none; \}/,
  );
  assert.match(css, /\.yard\.aiming \.fallen-fruit, \.yard\.playing \.fallen-fruit \{ pointer-events: none; \}/);
});
