// Tree moments (src/yard/tree-moment-rules.js): a grown tree whose kind names a moment has it in its
// own season, in fair hours, outdoors. A drift moment sends gusts of petals off the crown that land
// on a ring at the foot and fade; a harvest moment drops burrs at the foot, kept in the webview's
// storage. The clock, the random draws and the ground are the test's.
import './support/content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMITS } from '../src/core/limits.js';
import {
  BURR_APART,
  BURR_EVERY,
  BURR_FIRST,
  BURR_STAYS_MS,
  BURRS_OUT,
  BURRS_PER_TREE,
  burrDue,
  burrSpot,
  burrsStay,
  driftMoving,
  driftPetal,
  freshBurrs,
  GUST_EVERY,
  GUST_FIRST,
  GUST_MS,
  GUSTS_AT_ONCE,
  gustPetals,
  keptBurrs,
  LIE_MS,
  lyingAlpha,
  momentOf,
  momentTime,
  momentTrees,
  pickLine,
  stepDrift,
  stepGusts,
  visitX,
} from '../src/yard/tree-moment-rules.js';

const T = Date.UTC(2027, 9, 5, 9);
const seq =
  (...values) =>
  () =>
    values.length > 1 ? values.shift() : values[0];
const grown = (id, kind, x = 0.5, y = 0.3, extra = {}) => ({ id, kind, world: 'woodland', x, y, planted: 0, ...extra });
const fair = season => ({ world: 'woodland', season, period: 'day', weather: 'clear', event: null });

test('the fringe tree, the red plum and the chestnut each name their moment', () => {
  assert.equal(momentOf('fringe_tree').kind, 'drift');
  assert.equal(momentOf('fringe_tree').season, 'spring');
  assert.equal(momentOf('red_plum').kind, 'drift');
  assert.equal(momentOf('red_plum').season, 'winter');
  assert.equal(momentOf('chestnut').kind, 'harvest');
  assert.equal(momentOf('chestnut').season, 'autumn');
  assert.equal(momentOf('cherry'), null, 'a tree with no moment has none');
  assert.equal(momentOf('nothing'), null);
  // The plum's petals are fewer and slower than the fringe tree's.
  assert.ok(gustPetals(momentOf('red_plum')) < gustPetals(momentOf('fringe_tree')));
  assert.ok(momentOf('red_plum').pace < (momentOf('fringe_tree').pace ?? 1));
});

test('a moment is on in its season, morning to evening, in its weather, outdoors', () => {
  const fringe = momentOf('fringe_tree'),
    plum = momentOf('red_plum');
  assert.equal(momentTime(fair('spring'), fringe), true);
  for (const period of ['morning', 'evening']) assert.equal(momentTime({ ...fair('spring'), period }, fringe), true);
  assert.equal(momentTime({ ...fair('spring'), period: 'night' }, fringe), false, 'not at night');
  assert.equal(momentTime({ ...fair('spring'), weather: 'rain' }, fringe), false, 'not in rain');
  assert.equal(momentTime({ ...fair('spring'), weather: 'snow' }, fringe), false, 'the fringe tree wants a clear sky');
  assert.equal(momentTime(fair('summer'), fringe), false, 'not in another season');
  assert.equal(momentTime({ ...fair('spring'), world: 'workshop' }, fringe), false, 'not where no season shows');
  assert.equal(momentTime(fair('winter'), plum), true);
  assert.equal(momentTime({ ...fair('winter'), weather: 'snow' }, plum), true, 'the plum blooms in snow too');
  assert.equal(momentTime({ ...fair('winter'), weather: 'rain' }, plum), false);
  assert.equal(momentTime(fair('spring'), null), false);
});

test('only grown trees in this place with their moment on count', () => {
  const now = T,
    trees = [
      grown('a', 'fringe_tree'),
      grown('b', 'fringe_tree', 0.2, 0.3, { planted: now - 1000 }),
      grown('c', 'fringe_tree', 0.8, 0.3, { world: 'lakeside' }),
      grown('d', 'cherry'),
      grown('e', 'chestnut'),
      grown('f', 'fringe_tree', 0.1, 0.5, { planted: now, stage: 2 }),
    ];
  assert.deepEqual(
    momentTrees(trees, fair('spring'), now, LIMITS).map(t => t.id),
    ['a', 'f'],
    'a seedling, another place, a tree with no moment and another season are left out',
  );
  const [a] = momentTrees(trees, fair('spring'), now, LIMITS);
  assert.deepEqual(a, { id: 'a', kind: 'fringe_tree', x: 0.5, y: 0.3, moment: momentOf('fringe_tree') });
  assert.deepEqual(
    momentTrees(trees, fair('autumn'), now, LIMITS).map(t => t.id),
    ['e'],
  );
  assert.deepEqual(momentTrees(undefined, fair('spring'), now, LIMITS), []);
});

test('each tree gusts now and then, for a while, at most two at once', () => {
  let { plan, started } = stepGusts({}, ['a', 'b', 'c'], 0, seq(0));
  assert.deepEqual(started, [], 'a new tree waits for its first gust');
  assert.equal(plan.a.next, GUST_FIRST[0]);
  ({ plan, started } = stepGusts(plan, ['a', 'b', 'c'], GUST_FIRST[0], seq(0)));
  assert.deepEqual(started, ['a', 'b'], `no more than ${GUSTS_AT_ONCE} at once`);
  assert.equal(plan.a.until, GUST_FIRST[0] + GUST_MS[0]);
  assert.equal(plan.c.until, 0, 'the third waits for room');
  const end = GUST_FIRST[0] + GUST_MS[0];
  ({ plan, started } = stepGusts(plan, ['a', 'b', 'c'], end, seq(1)));
  assert.deepEqual(started, ['c'], 'once a gust ends the waiting tree starts');
  assert.equal(plan.a.next, end + GUST_EVERY[1], 'a tree whose gust ended waits its turn');
  assert.equal(plan.a.until, 0);
  assert.deepEqual(stepGusts(plan, ['a'], end + GUST_EVERY[1] - 1, seq(0)).started, [], 'not before');
  ({ plan, started } = stepGusts(plan, ['a'], end + GUST_EVERY[1], seq(0)));
  assert.deepEqual(started, ['a']);
  assert.deepEqual(Object.keys(plan), ['a'], 'a tree whose moment is over leaves the plan');
  assert.ok(GUST_MS[0] >= 8000 && GUST_MS[1] <= 12000, 'a gust lasts eight to twelve seconds');
  assert.ok(GUST_EVERY[0] >= 40000 && GUST_EVERY[1] <= 90000, 'and comes every forty to ninety');
});

const crown = { x: 400, top: 200, bottom: 300, width: 200, foot: 400, colors: ['#fff', '#eee'], wind: 0.005 };

test('a petal starts in the crown, upwind of its spot, and its spot is on a ring in front of the trunk', () => {
  for (const values of [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99],
    [0.3, 0.9, 0.1, 0.7, 0.2, 0.6, 0.4, 0.8],
  ]) {
    const p = driftPetal(crown, seq(...values));
    assert.ok(p.y >= crown.top && p.y <= crown.bottom, `starts in the crown (${p.y})`);
    assert.ok(p.ty >= crown.foot, `lies at or in front of the foot (${p.ty})`);
    assert.ok(p.ty <= crown.foot + crown.width * 0.46 * 0.2 + 1.001, 'on a flat ring');
    const tx = p.x + p.wind * ((p.ty - p.y) / p.vy);
    assert.ok(Math.abs(tx - crown.x) <= crown.width * 0.46 + 1e-9, `near the trunk (${tx})`);
    assert.ok(crown.colors.includes(p.color));
    assert.equal(p.lay, null);
  }
  const slow = driftPetal({ ...crown, pace: 0.7 }, seq(0.5)),
    plain = driftPetal(crown, seq(0.5));
  assert.ok(slow.vy < plain.vy, 'a slower moment falls slower');
});

test('a petal falls, lies on its spot, fades and is gone', () => {
  const p = driftPetal({ ...crown, wind: 0 }, seq(0.5));
  let petals = [p],
    now = 0;
  while (p.lay === null && now < 60_000) {
    now += 50;
    petals = stepDrift(petals, 50, now);
  }
  assert.equal(p.lay, now, 'it came to rest');
  assert.equal(p.y, p.ty);
  const x = p.x;
  petals = stepDrift(petals, 50, now + 50);
  assert.equal(p.x, x, 'lying, it no longer moves');
  assert.equal(lyingAlpha(0), 1);
  assert.equal(lyingAlpha(LIE_MS / 2), 1);
  assert.ok(lyingAlpha(LIE_MS * 0.75) > 0 && lyingAlpha(LIE_MS * 0.75) < 1, 'it fades over the second half');
  assert.equal(lyingAlpha(LIE_MS), 0);
  assert.equal(driftMoving([driftPetal(crown, seq(0.5))], now), true, 'one falling changes the picture');
  assert.equal(driftMoving(petals, now + LIE_MS / 2), false, 'lying whole, it does not');
  assert.equal(driftMoving(petals, now + LIE_MS / 2 + 1), true, 'fading, it does again');
  assert.equal(stepDrift(petals, 50, now + LIE_MS - 1).length, 1);
  assert.equal(stepDrift(petals, 50, now + LIE_MS).length, 0, 'gone');
});

// ---- burrs ----

const kept0 = { next: 0, picked: '', out: [] };
const burr = (id, tree, x, y, extra = {}) => ({ id, tree, world: 'woodland', x, y, at: T - 1000, ...extra });

test('the first look only sets when a burr drops; then one drops now and then under a tree with room', () => {
  const trees = [grown('a', 'chestnut'), grown('b', 'chestnut', 0.2, 0.4)];
  assert.deepEqual(burrDue(kept0, [], T, seq(0)), { kept: kept0, tree: null }, 'no harvest tree, nothing');
  const first = burrDue(kept0, trees, T, seq(0));
  assert.equal(first.tree, null);
  assert.equal(first.kept.next, T + BURR_FIRST[0]);
  assert.equal(burrDue(first.kept, trees, T + BURR_FIRST[0] - 1, seq(0)).tree, null);
  const due = burrDue(first.kept, trees, T + BURR_FIRST[0], seq(0.99));
  assert.equal(due.tree.id, 'b');
  assert.equal(due.kept.next, T + BURR_FIRST[0] + BURR_EVERY[0] + 0.99 * (BURR_EVERY[1] - BURR_EVERY[0]));
  // A tree with two under it gets no third; a yard with three gets no fourth, but the wait goes on.
  const full = { ...first.kept, out: [burr('1', 'a', 0.5, 0.35), burr('2', 'a', 0.55, 0.35)] };
  assert.equal(burrDue(full, trees, T + BURR_FIRST[0], seq(0)).tree.id, 'b');
  assert.equal(burrDue(full, [trees[0]], T + BURR_FIRST[0], seq(0)).tree, null);
  const yard = { ...full, out: [...full.out, burr('3', 'b', 0.2, 0.45)] };
  const none = burrDue(yard, trees, T + BURR_FIRST[0], seq(0));
  assert.equal(none.tree, null);
  assert.equal(none.kept.next, T + BURR_FIRST[0] + BURR_EVERY[0]);
  // Night, rain or another season forgets the wait, so the first wait comes again.
  assert.deepEqual(burrDue(none.kept, [], T + BURR_FIRST[0] + 1, seq(0)).kept, { ...none.kept, next: 0 });
  assert.equal(BURRS_PER_TREE, 2);
  assert.equal(BURRS_OUT, 3);
});

const open = {
  soil: true,
  bounds: { left: 0, top: 0, right: 1, bottom: 1 },
  water: [],
  obstacles: [],
  bodies: [],
  unit: { x: 0.001, y: 0.002 },
};

test('a burr lands at the foot, in front of the trunk, apart from the others', () => {
  const tree = { x: 0.5, y: 0.3 };
  for (const v of [0, 0.5, 0.99]) {
    const spot = burrSpot(seq(v), open, tree, []);
    assert.ok(Math.abs(spot.x - 0.5) <= 64 * 0.001 + 1e-9, `beside the trunk (${spot.x})`);
    assert.ok(spot.y > tree.y && spot.y <= tree.y + 26 * 0.002 + 1e-9, `in front of it (${spot.y})`);
  }
  const taken = burrSpot(seq(0.5), open, tree, []);
  const other = burrSpot(seq(0.5, 0.5, 0, 0), open, tree, [taken]);
  assert.ok(Math.hypot(other.x - taken.x, other.y - taken.y) >= BURR_APART, 'not on another burr');
  // The tree's own roots (its footprint on the ground) take the middle.
  const roots = { ...open, obstacles: [{ x: 0.5, y: 0.3, rx: 0.2, ry: 0.2 }] };
  assert.equal(burrSpot(seq(0.5), roots, tree, []), null);
  assert.equal(burrSpot(seq(0.5), { ...open, soil: false }, tree, []), null);
});

test('a burr lies six hours, under its own grown tree, while the yard shows its season here', () => {
  const trees = [grown('a', 'chestnut', 0.5, 0.3)],
    b = burr('1', 'a', 0.52, 0.33),
    look = (extra = {}) => ({ trees, scene: fair('autumn'), now: T, limits: LIMITS, ...extra });
  assert.deepEqual(burrsStay([b], look()), [b]);
  assert.deepEqual(burrsStay([b], look({ scene: { ...fair('autumn'), period: 'night' } })), [b], 'it lies on at night');
  assert.deepEqual(burrsStay([b], look({ scene: { ...fair('autumn'), weather: 'rain' } })), [b], 'and in rain');
  assert.deepEqual(burrsStay([b], look({ scene: fair('winter') })), [], 'another season takes it');
  assert.deepEqual(burrsStay([b], look({ scene: { ...fair('autumn'), world: 'lakeside' } })), [], 'another place too');
  assert.deepEqual(burrsStay([b], look({ trees: [] })), [], 'a tree pulled up takes its burrs');
  assert.deepEqual(burrsStay([b], look({ trees: [{ ...trees[0], x: 0.9 }] })), [], 'a tree moved away too');
  assert.deepEqual(burrsStay([b], look({ now: b.at + BURR_STAYS_MS })), [], 'six hours on it is gone');
  assert.deepEqual(freshBurrs([b], b.at + BURR_STAYS_MS - 1), [b]);
  assert.deepEqual(freshBurrs([b], b.at - 1), [], 'one from a clock set back is not trusted');
});

test('the stored burrs are read back, keeping only what makes sense', () => {
  const good = burr('1', 'a', 0.5, 0.35);
  assert.deepEqual(keptBurrs(null, T), kept0);
  assert.deepEqual(keptBurrs('not json', T), kept0);
  assert.deepEqual(keptBurrs('[1]', T), kept0);
  const read = keptBurrs(
    JSON.stringify({
      next: T + 5,
      picked: '2027-10-05',
      out: [
        good,
        { ...good },
        { ...good, id: '2', x: 2 },
        { ...good, id: '3', tree: '' },
        { ...good, id: '4', at: T - BURR_STAYS_MS },
        null,
        { ...good, id: '5', extra: 'kept out' },
        burr('6', 'a', 0.4, 0.35),
        burr('7', 'a', 0.6, 0.35),
      ],
    }),
    T,
  );
  assert.equal(read.next, 0, 'the wait is not kept: a start waits the first wait again');
  assert.equal(read.picked, '2027-10-05');
  assert.deepEqual(
    read.out.map(b => b.id),
    ['1', '5', '6'],
    'bad, doubled and stale burrs go, and no more than three are kept',
  );
  assert.equal('extra' in read.out[1], false);
  assert.deepEqual(keptBurrs(JSON.stringify({ next: -1, picked: 'yesterday', out: 'x' }), T), kept0);
});

test("the first pick of the day has its own line, and the day's later picks the usual one", () => {
  const moment = momentOf('chestnut');
  const first = pickLine(kept0, moment, '2027-10-05');
  assert.equal(first.key, moment.lines.first);
  assert.equal(first.kept.picked, '2027-10-05');
  assert.equal(kept0.picked, '', 'the old record is left alone');
  assert.equal(pickLine(first.kept, moment, '2027-10-05').key, moment.lines.pick);
  assert.equal(pickLine(first.kept, moment, '2027-10-06').key, moment.lines.first, 'and a new day starts again');
});

test('a friend visiting a tree stands beside its trunk, not in front of it', () => {
  // Pixels: the crown 120 wide at x 400; a friend 100 wide.
  for (const side of [-1, 1]) {
    const x = visitX(400, 120, 100, side),
      near = side < 0 ? x + 50 : x - 50;
    // The friend's near edge stays clear of the trunk, which stands about 20 px either side of the middle.
    assert.ok(side < 0 ? near <= 380 : near >= 420, `side ${side}: ${x}`);
    // Close enough to smell the blossom: within the crown's reach.
    assert.ok(Math.abs(x - 400) <= 120, `side ${side}: ${x}`);
  }
  // A wide crown: the friend stands under its edge, not farther out.
  assert.equal(visitX(400, 300, 100, 1), 400 + 300 * 0.4);
});
