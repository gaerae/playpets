// Tree moments in the yard: a grown fringe tree's gusts and the petals they leave on heads, a red
// plum's visits (src/yard/tree-moments.js), and the burrs a chestnut drops and friends pick up
// (src/yard/burrs.js). The rules are tested in tree-moments.test.mjs; here the page runs them with
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
const { scene, setScenery } = await import('../src/yard/world.js');
const { forPerson, release, sendTo } = await import('../src/yard/trips.js');
const { bubble, place, syncViews } = await import('../src/yard/views.js');
const { petalTick, setupPetals } = await import('../src/yard/petals.js');
const { setupTreeMoments, syncTreeMoments, treeMomentTick } = await import('../src/yard/tree-moments.js');
const { BURR_FIRST, GUST_FIRST, momentOf } = await import('../src/yard/tree-moment-rules.js');
const { drawYard } = await import('./support/yard.mjs');
const { burrPicking, burrsMinute, pickBurr, renderBurrs, setupBurrs } = await import('../src/yard/burrs.js');

const spring = { world: 'woodland', season: 'spring', period: 'day', weather: 'clear', event: null };
const grown = (id, kind, x, y) => ({ id, kind, world: 'woodland', x, y, planted: 0, stage: 2 });

// A yard of 1000 x 700 on April 20, 2027 at 10:00 local time, with friends drawn the way the page
// draws them (views.js), a scenery that records the gusts it is sent, and a clock the test holds.
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
  const gusts = [];
  setScenery({
    drift: gust => {
      gusts.push(gust);
      return true;
    },
  });
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
    setScenery(null);
    Object.assign(scene, was);
    reduced.matches = motion;
  });
  return {
    gusts,
    views: () => [...state.views.values()],
    clock: () => clock,
    // Lets `ms` go by with no tick, as while the window is hidden.
    skip(ms) {
      clock += ms;
      t.mock.timers.tick(ms);
    },
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

test('a grown fringe tree in spring now and then sends a gust of its own white petals off its crown', t => {
  const fringe = grown('f', 'fringe_tree', 0.5, 0.3),
    y = yard(t, { garden: { trees: [fringe] } });
  y.run(GUST_FIRST[0] - 1000);
  assert.equal(y.gusts.length, 0, 'it waits a little first');
  y.run(2000);
  assert.equal(y.gusts.length, 1);
  const [gust] = y.gusts,
    foot = fieldToYard(fringe),
    moment = momentOf('fringe_tree');
  assert.deepEqual(gust.colors, moment.colors);
  assert.equal(gust.petals, moment.petals);
  assert.equal(gust.x, foot.x);
  assert.equal(gust.foot, foot.y);
  assert.ok(gust.top < gust.bottom && gust.bottom < gust.foot, 'the crown is above the foot');
  assert.ok(gust.ms >= 8000 && gust.ms <= 12000);
  y.run(30_000);
  assert.equal(y.gusts.length, 1, 'and then the canvas rests a good while');
});

test('a gust waits its first wait again each time the moment comes back, or the yard is seen again', async t => {
  for (const [name, away] of [
    ['night', () => (scene.period = 'night')],
    ['rain', () => (scene.weather = 'rain')],
    ['a hidden spell', null],
  ])
    await t.test(name, s => {
      const y = yard(s, { garden: { trees: [grown('f', 'fringe_tree', 0.5, 0.3)] } });
      y.run(GUST_FIRST[0] + 1000);
      assert.equal(y.gusts.length, 1);
      // The next would be due about 54 s in; the moment is away until 60 s.
      if (away) {
        y.run(8000);
        away();
        syncTreeMoments();
        y.run(45_000);
        Object.assign(scene, spring);
        syncTreeMoments();
      } else y.skip(53_000);
      y.run(GUST_FIRST[0] - 1000);
      assert.equal(y.gusts.length, 1, 'not at once on its return');
      y.run(2000);
      assert.equal(y.gusts.length, 2, 'but after its first wait');
    });
});

test('no gust at night, in rain, in another season, or under a tree still growing', async t => {
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
        const y = yard(s, { garden: { trees }, values });
        y.run(120_000);
        assert.deepEqual(y.gusts, []);
      },
    );
});

test('a friend under the crown may get a white petal, kept while the moment lasts', t => {
  const fringe = grown('f', 'fringe_tree', 0.5, 0.3),
    y = yard(t, { garden: { trees: [fringe] } }),
    [v, far] = y.views(),
    foot = fieldToYard(fringe);
  standAt(v, foot.x + 20, foot.y + 10);
  y.run(GUST_FIRST[0] + 6000);
  assert.ok(v.petal, 'a petal of the gust landed on it');
  assert.ok(v.petal.classList.contains('tinted'), 'in the tree’s colours');
  assert.equal(v.petal.style['--petal'], momentOf('fringe_tree').colors[0]);
  assert.equal(far.petal ?? null, null, 'not on a friend away from the tree');
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
  y.run(GUST_FIRST[0] + 4000);
  assert.ok(v.petal);
  y.run(3000);
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
async function burrYard(ctx, { stored = null, values = {}, rng = [] } = {}) {
  ctx.mock.method(Math, 'random', () => (rng.length ? rng.shift() : 0.5));
  const y = await drawYard(ctx, {
    now: AUTUMN,
    scene: { season: 'autumn', world: 'woodland', weather: 'clear', period: 'day', ...values },
    garden: { trees: [chestnut] },
    art: [momentOf('chestnut').art],
    before: ({ storage }) => {
      if (stored) storage.setItem('burrs', stored);
    },
  });
  setupBurrs();
  const live = () => y.shown().filter(b => b.classList.contains('burr'));
  const saved = () => JSON.parse(state.recall('burrs'));
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
  burrsMinute();
  assert.equal(y.live().length, 0, 'the first look only sets the wait');
  // 0.5 of the way through the first wait.
  ctx.mock.timers.tick((BURR_FIRST[0] + BURR_FIRST[1]) / 2 - 1);
  burrsMinute();
  assert.equal(y.live().length, 0, 'not before it is due');
  ctx.mock.timers.tick(1);
  burrsMinute();
  const [button, ...more] = y.live();
  assert.equal(more.length, 0);
  const [burr] = y.saved().out;
  assert.equal(burr.tree, 'c');
  assert.equal(burr.world, 'woodland');
  assert.ok(burr.y > chestnut.y && Math.abs(burr.x - chestnut.x) < 0.1, 'at the foot, in front of the trunk');
  assert.equal(button.dataset.kind, 'chestnut');
  assert.equal(button.title, translate('moment.burr_title'));
  assert.equal(button.getAttribute('aria-label'), translate('moment.burr_title'));
  const [svg] = button.children;
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.children[0].getAttribute('href'), artHref(momentOf('chestnut').art));
  assert.ok(button.classList.contains('dropped'), 'it drops as it comes');
  // Drawn again (a state change), it stays where it lies and does not drop a second time.
  renderBurrs();
  setupBurrs();
  renderBurrs();
  const [again] = y.live();
  assert.ok(!again.classList.contains('dropped'));
});

test('the first wait comes again each time the harvest comes back, and at each start', async ctx => {
  const y = await burrYard(ctx, { stored: record([], { next: AUTUMN - 1 }) });
  burrsMinute();
  assert.equal(y.live().length, 0, 'a start waits first, whatever was stored');
  ctx.mock.timers.tick(BURR_FIRST[0] - 1000);
  scene.period = 'night';
  burrsMinute();
  ctx.mock.timers.tick(10 * 60_000);
  burrsMinute();
  scene.period = 'day';
  burrsMinute();
  assert.equal(y.live().length, 0, 'a new morning waits first too');
  ctx.mock.timers.tick(BURR_FIRST[1]);
  burrsMinute();
  assert.equal(y.live().length, 1, 'and then one drops');
});

test('at most two burrs lie under a tree, and none drop at night, but those there stay', async ctx => {
  const y = await burrYard(ctx, { stored: record([lyingBurr('1'), lyingBurr('2', 0.46, 0.34)], { next: AUTUMN - 1 }) });
  burrsMinute();
  assert.equal(y.live().length, 2, 'a third waits for room');
  assert.equal(y.saved().out.length, 2);
  scene.period = 'night';
  setupBurrs();
  burrsMinute();
  assert.equal(y.live().length, 2, 'at night they lie on');
  scene.season = 'winter';
  burrsMinute();
  assert.equal(y.live().length, 0, 'another season takes them');
  assert.deepEqual(y.saved().out, []);
});

// A friend picking a burr up (burrs.js pickBurr): the walk and stroke of a shoot's gathering.
async function pickYard(ctx, options = {}) {
  const y = await burrYard(ctx, { stored: record([lyingBurr('1')]), ...options });
  burrsMinute();
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
  assert.equal(burrPicking(), true);
  y.click();
  assert.equal(pickBurr('1'), false, 'one friend for one burr');
  y.arrive();
  ctx.mock.timers.tick(1950);
  assert.equal(y.live().length, 0, 'the burr leaves the yard');
  assert.deepEqual(y.saved().out, []);
  assert.equal(y.saved().picked, '2027-10-05');
  assert.ok(list('moment.chestnut_first').includes(y.v.bubble.textContent), y.v.bubble.textContent);
  assert.equal(y.v.doing, null);
  assert.equal(burrPicking(), false);
});

test('a later pick the same day says an ordinary line, and a friend taken away leaves the burr', async ctx => {
  const y = await pickYard(ctx, { stored: record([lyingBurr('1')], { picked: '2027-10-05' }) });
  y.click();
  release(y.v);
  assert.equal(burrPicking(), false);
  assert.ok(!y.button.classList.contains('picking'));
  assert.equal(y.saved().out.length, 1, 'still there');
  y.click();
  y.arrive();
  ctx.mock.timers.tick(1950);
  assert.ok(list('moment.chestnut_pick').includes(y.v.bubble.textContent), y.v.bubble.textContent);
});

test('with no friend in the yard a click says who could pick it up', async ctx => {
  const y = await burrYard(ctx, { stored: record([lyingBurr('1')]) });
  burrsMinute();
  y.live()[0].dispatch('click', {});
  assert.deepEqual(
    y.document.getElementById('toast').children.map(line => line.textContent),
    [translate('moment.burr_no_friend')],
  );
});

test('the yard wires the moments in with the sky, the garden and the frame loop', async () => {
  const app = await readFile('src/app.js', 'utf8'),
    render = await readFile('src/render.js', 'utf8');
  const sky = app.search(/^setupSky\(/m);
  for (const setup of ['setupBurrs();', 'setupTreeMoments();']) {
    const at = app.search(new RegExp(`^${setup.replace(/[()]/g, '\\$&')}`, 'm'));
    assert.ok(at >= 0 && at < sky, `${setup} runs before the sky first paints`);
  }
  const minute = app.indexOf('burrsMinute();');
  assert.ok(minute > app.indexOf('shootsMinute();') && minute < app.indexOf('seasonPicked'), 'each repaint looks');
  assert.ok(app.indexOf('syncTreeMoments();') < app.indexOf('seasonPicked'));
  for (const hook of ['worldChanged', 'landChanged', 'resized']) {
    const from = app.indexOf(`${hook}:`),
      body = app.slice(from, app.indexOf('},', app.indexOf('renderTrees();', from)) + 2);
    assert.ok(body.indexOf('renderBurrs();') > body.indexOf('renderTrees();'), hook);
    assert.ok(body.includes('syncTreeMoments();'), hook);
    if (hook !== 'worldChanged') assert.ok(body.includes('cancelBurrPicks();'), hook);
  }
  assert.match(app, /const YARD_LIFE = \[[^\]]*treeMomentTick,/);
  assert.ok(render.indexOf('renderBurrs();') > render.indexOf('renderTrees();'), 'a state change redraws them');
  assert.ok(render.indexOf('syncTreeMoments();') > render.indexOf('renderTrees();'));
});

test('a burr drops and bounces once, stays still for reduced motion, and lets a tool or a game through', async () => {
  const css = (await readFile('src/styles/garden.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  assert.match(css, /\.burr\.dropped svg \{ animation: burr-drop /);
  const frames = css.match(/@keyframes burr-drop \{(.*?\}) \}/)?.[1] || '';
  for (const [, property] of frames.matchAll(/([a-z-]+):/g))
    assert.ok(['transform', 'opacity', 'animation-timing-function'].includes(property), property);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.burr\.dropped svg \{ animation: none; \}/);
  assert.match(css, /\.yard\.aiming \.burr, \.yard\.playing \.burr \{ pointer-events: none; \}/);
});
