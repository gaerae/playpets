// Tree moments (src/yard/tree-moment-rules.js): a grown tree whose kind names a moment has it in its
// own season, in fair hours, outdoors. A visit moment draws a friend to the tree; a harvest moment
// drops the tree's fruit at the foot, kept in the webview's storage. The clock, the random draws and
// the ground are the test's.
import './support/content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMITS } from '../src/core/limits.js';
import {
  FRUIT_APART,
  FRUIT_EVERY,
  FRUIT_FIRST,
  FRUIT_STAYS_MS,
  FRUIT_OUT,
  FRUIT_PER_TREE,
  fruitDue,
  fruitHere,
  fruitFall,
  fruitSpot,
  fruitStays,
  freshFruit,
  keptFruit,
  harvestOf,
  MOMENT_KINDS,
  momentsOf,
  momentTime,
  momentTrees,
  pickLine,
  treeStands,
  visitX,
} from '../src/yard/tree-moment-rules.js';

const T = Date.UTC(2027, 9, 5, 9);
const seq =
  (...values) =>
  () =>
    values.length > 1 ? values.shift() : values[0];
const grown = (id, kind, x = 0.5, y = 0.3, extra = {}) => ({ id, kind, world: 'woodland', x, y, planted: 0, ...extra });
const fair = season => ({ world: 'woodland', season, period: 'day', weather: 'clear', event: null });

// A kind's moment of one kind, for these tests.
const momentOf = (kind, what) => momentsOf(kind).find(moment => moment.kind === what);

test('the red plum and the fruit trees each name their moments', () => {
  assert.deepEqual(MOMENT_KINDS, ['visit', 'harvest']);
  assert.deepEqual(
    momentsOf('red_plum').map(m => [m.kind, m.season]),
    [
      ['visit', 'winter'],
      ['harvest', 'summer'],
    ],
    'the red plum draws friends to its blossom in winter and drops its plums in summer',
  );
  for (const [kind, season] of [
    ['persimmon', 'autumn'],
    ['fig', 'summer'],
    ['yuzu', 'winter'],
    ['oak', 'autumn'],
    ['chestnut', 'autumn'],
  ])
    assert.equal(harvestOf(kind).season, season, kind);
  assert.deepEqual(momentsOf('fringe_tree'), [], 'the fringe tree has no moment');
  assert.equal(harvestOf('fringe_tree'), null, 'a tree with no harvest has none');
  assert.deepEqual(momentsOf('cherry'), [], 'a tree with no moment has none');
  assert.deepEqual(momentsOf('nothing'), []);
});

test('a moment is on in its season, morning to evening, in its weather, outdoors', () => {
  const plum = momentOf('red_plum', 'visit'),
    chestnut = harvestOf('chestnut');
  assert.equal(momentTime(fair('autumn'), chestnut), true);
  for (const period of ['morning', 'evening']) assert.equal(momentTime({ ...fair('autumn'), period }, chestnut), true);
  assert.equal(momentTime({ ...fair('autumn'), period: 'night' }, chestnut), false, 'not at night');
  assert.equal(momentTime({ ...fair('autumn'), weather: 'rain' }, chestnut), false, 'not in rain');
  assert.equal(momentTime({ ...fair('autumn'), weather: 'snow' }, chestnut), false, 'a clear sky unless it names more');
  assert.equal(momentTime(fair('summer'), chestnut), false, 'not in another season');
  assert.equal(momentTime({ ...fair('autumn'), world: 'workshop' }, chestnut), false, 'not where no season shows');
  assert.equal(momentTime(fair('winter'), plum), true);
  assert.equal(momentTime({ ...fair('winter'), weather: 'snow' }, plum), true, 'the plum blooms in snow too');
  assert.equal(momentTime({ ...fair('winter'), weather: 'rain' }, plum), false);
  assert.equal(momentTime(fair('spring'), null), false);
});

test('only grown trees with their moment on count, wherever they were planted, where the land has soil', () => {
  const now = T,
    trees = [
      grown('a', 'chestnut'),
      grown('b', 'chestnut', 0.2, 0.3, { planted: now - 1000 }),
      grown('c', 'chestnut', 0.8, 0.3, { world: 'lakeside' }),
      grown('d', 'cherry'),
      grown('e', 'fig'),
      grown('f', 'chestnut', 0.1, 0.5, { planted: now, stage: 2 }),
    ];
  assert.deepEqual(
    momentTrees(trees, fair('autumn'), now, LIMITS).map(t => t.id),
    ['a', 'c', 'f'],
    'a seedling, a tree with no moment and another season are left out; one planted elsewhere stands here too',
  );
  assert.deepEqual(momentTrees(trees, { ...fair('autumn'), world: 'workshop' }, now, LIMITS), [], 'no trees indoors');
  const [a] = momentTrees(trees, fair('autumn'), now, LIMITS);
  assert.deepEqual(a, { id: 'a', kind: 'chestnut', x: 0.5, y: 0.3, moment: harvestOf('chestnut') });
  assert.deepEqual(
    momentTrees(trees, fair('summer'), now, LIMITS).map(t => t.id),
    ['e'],
  );
  // A tree with two moments has the one of the season.
  const plum = [grown('p', 'red_plum')];
  assert.equal(momentTrees(plum, fair('winter'), now, LIMITS)[0].moment.kind, 'visit');
  assert.equal(momentTrees(plum, fair('summer'), now, LIMITS)[0].moment.kind, 'harvest');
  assert.deepEqual(momentTrees(plum, fair('autumn'), now, LIMITS), []);
  assert.deepEqual(momentTrees(undefined, fair('spring'), now, LIMITS), []);
});

// ---- fallen fruit ----

const kept0 = { next: 0, picked: {}, out: [] };
// Fruit lying at (x, y), dropped by `tree` standing at (treeX, treeY): the tree's own spot by default.
const fallen = (id, tree, x, y, extra = {}) => ({
  id,
  tree,
  world: 'woodland',
  x,
  y,
  treeX: 0.5,
  treeY: 0.3,
  at: T - 1000,
  ...extra,
});

test('the first look only sets when fruit drops; then one drops now and then under a tree with room', () => {
  const trees = [grown('a', 'chestnut'), grown('b', 'chestnut', 0.2, 0.4)];
  assert.deepEqual(fruitDue(kept0, [], T, seq(0), 'woodland'), { kept: kept0, tree: null }, 'no harvest tree, nothing');
  const first = fruitDue(kept0, trees, T, seq(0), 'woodland');
  assert.equal(first.tree, null);
  assert.equal(first.kept.next, T + FRUIT_FIRST[0]);
  assert.equal(fruitDue(first.kept, trees, T + FRUIT_FIRST[0] - 1, seq(0), 'woodland').tree, null);
  const due = fruitDue(first.kept, trees, T + FRUIT_FIRST[0], seq(0.99), 'woodland');
  assert.equal(due.tree.id, 'b');
  assert.equal(due.kept.next, T + FRUIT_FIRST[0] + FRUIT_EVERY[0] + 0.99 * (FRUIT_EVERY[1] - FRUIT_EVERY[0]));
  // A tree with two under it gets no third; a yard with three gets no fourth, but the wait goes on.
  const full = { ...first.kept, out: [fallen('1', 'a', 0.5, 0.35), fallen('2', 'a', 0.55, 0.35)] };
  assert.equal(fruitDue(full, trees, T + FRUIT_FIRST[0], seq(0), 'woodland').tree.id, 'b');
  assert.equal(fruitDue(full, [trees[0]], T + FRUIT_FIRST[0], seq(0), 'woodland').tree, null);
  const yard = { ...full, out: [...full.out, fallen('3', 'b', 0.2, 0.45)] };
  const none = fruitDue(yard, trees, T + FRUIT_FIRST[0], seq(0), 'woodland');
  assert.equal(none.tree, null);
  assert.equal(none.kept.next, T + FRUIT_FIRST[0] + FRUIT_EVERY[0]);
  // Fruit lying in another place takes no room here.
  const elsewhere = {
    ...first.kept,
    out: ['1', '2', '3'].map(id => fallen(id, 'c', 0.5, 0.35, { world: 'lakeside' })),
  };
  assert.equal(fruitDue(elsewhere, trees, T + FRUIT_FIRST[0], seq(0), 'woodland').tree.id, 'a');
  // Night, rain or another season forgets the wait, so the first wait comes again.
  assert.deepEqual(fruitDue(none.kept, [], T + FRUIT_FIRST[0] + 1, seq(0), 'woodland').kept, { ...none.kept, next: 0 });
  assert.equal(FRUIT_PER_TREE, 2);
  assert.equal(FRUIT_OUT, 3);
});

const open = {
  soil: true,
  bounds: { left: 0, top: 0, right: 1, bottom: 1 },
  water: [],
  obstacles: [],
  bodies: [],
  unit: { x: 0.001, y: 0.002 },
};

test("fruit falls from the crown's lower edge to where it lies", () => {
  // A tree 200 px tall standing at y 500: its leaves end a quarter of the way up, at y 450.
  assert.equal(fruitFall(510, 500, 200), 60);
  assert.equal(fruitFall(500, 500, 100), 25);
  assert.equal(fruitFall(510.6, 500, 200), 61, 'whole pixels');
  assert.equal(fruitFall(400, 500, 200), 0, 'never upward');
});

test('fruit lands at the foot, in front of the trunk, apart from the others', () => {
  const tree = { x: 0.5, y: 0.3 };
  for (const v of [0, 0.5, 0.99]) {
    const spot = fruitSpot(seq(v), open, tree, []);
    assert.ok(Math.abs(spot.x - 0.5) <= 64 * 0.001 + 1e-9, `beside the trunk (${spot.x})`);
    assert.ok(spot.y > tree.y && spot.y <= tree.y + 26 * 0.002 + 1e-9, `in front of it (${spot.y})`);
  }
  const taken = fruitSpot(seq(0.5), open, tree, []);
  const other = fruitSpot(seq(0.5, 0.5, 0, 0), open, tree, [taken]);
  assert.ok(Math.hypot(other.x - taken.x, other.y - taken.y) >= FRUIT_APART, 'not on other fruit');
  // The tree's own roots (its footprint on the ground) take the middle.
  const roots = { ...open, obstacles: [{ x: 0.5, y: 0.3, rx: 0.2, ry: 0.2 }] };
  assert.equal(fruitSpot(seq(0.5), roots, tree, []), null);
  assert.equal(fruitSpot(seq(0.5), { ...open, soil: false }, tree, []), null);
});

test('fruit lies six hours under its own grown tree, in its own place, while its season lasts', () => {
  const trees = [grown('a', 'chestnut', 0.5, 0.3), grown('l', 'chestnut', 0.5, 0.3, { world: 'lakeside' })],
    b = fallen('1', 'a', 0.52, 0.33),
    there = fallen('2', 'l', 0.52, 0.33, { world: 'lakeside' }),
    look = (extra = {}) => ({ trees, season: 'autumn', now: T, limits: LIMITS, ...extra });
  assert.deepEqual(fruitStays([b], look()), [b]);
  assert.deepEqual(fruitStays([b], look({ season: 'winter' })), [], 'another season takes it');
  // Only the season counts, not the hour, the weather or the place shown: it lies on at night, in
  // rain, and while the person is somewhere else, even a place that shows no season.
  assert.deepEqual(fruitStays([b, there], look()), [b, there], 'each place keeps its own');
  assert.deepEqual(fruitHere([b, there], 'woodland'), [b], 'and shows only its own');
  assert.deepEqual(fruitHere([b, there], 'lakeside'), [there]);
  assert.deepEqual(fruitHere([b, there], 'workshop'), []);
  // Every tree stands in every place, so fruit that dropped by the lake lies under that same tree.
  assert.deepEqual(fruitStays([{ ...b, world: 'lakeside' }], look()), [{ ...b, world: 'lakeside' }]);
  assert.deepEqual(fruitStays([b], look({ trees: [] })), [], 'a tree pulled up takes its fruit');
  assert.deepEqual(fruitStays([b], look({ trees: [{ ...trees[0], x: 0.9 }] })), [], 'a tree moved away too');
  // Fruit lies only a few hundredths from its trunk, so a short move takes it too: it stays only
  // under the tree where it stood when the fruit dropped.
  assert.deepEqual(fruitStays([b], look({ trees: [{ ...trees[0], x: 0.6 }] })), [], 'moved a little to the side');
  assert.deepEqual(fruitStays([b], look({ trees: [{ ...trees[0], y: 0.25 }] })), [], 'or a little back');
  assert.deepEqual(fruitStays([b], look({ trees: [{ ...trees[0], x: 0.5 + 1e-9 }] })), [b], 'float noise is no move');
  assert.deepEqual(fruitStays([b], look({ now: b.at + FRUIT_STAYS_MS })), [], 'six hours on it is gone');
  assert.deepEqual(freshFruit([b], b.at + FRUIT_STAYS_MS - 1), [b]);
  assert.deepEqual(freshFruit([b], b.at - 1), [], 'one from a clock set back is not trusted');
});

test('a tree stands where it stood unless it moved by more than float noise', () => {
  const tree = grown('a', 'chestnut', 0.5, 0.3);
  assert.equal(treeStands(tree, { x: 0.5, y: 0.3 }), true);
  assert.equal(treeStands(tree, { x: 0.5 + 1e-9, y: 0.3 - 1e-9 }), true, 'float noise is no move');
  assert.equal(treeStands(tree, { x: 0.51, y: 0.3 }), false, 'moved a little to the side');
  assert.equal(treeStands(tree, { x: 0.5, y: 0.29 }), false, 'or a little back');
});

test('the stored fruit is read back, keeping only what makes sense', () => {
  const good = fallen('1', 'a', 0.5, 0.35);
  assert.deepEqual(keptFruit(null, T), kept0);
  assert.deepEqual(keptFruit('not json', T), kept0);
  assert.deepEqual(keptFruit('[1]', T), kept0);
  const read = keptFruit(
    JSON.stringify({
      next: T + 5,
      picked: { chestnut: '2027-10-05', cherry: '2027-10-05', persimmon: 'today' },
      out: [
        good,
        { ...good },
        { ...good, id: '2', x: 2 },
        { ...good, id: '3', tree: '' },
        { ...good, id: '4', at: T - FRUIT_STAYS_MS },
        null,
        { ...good, id: '5', extra: 'kept out' },
        { ...good, id: '6', treeX: undefined },
        { ...good, id: '7', treeY: -1 },
      ],
    }),
    T,
  );
  assert.equal(read.next, 0, 'the wait is not kept: a start waits the first wait again');
  assert.deepEqual(read.picked, { chestnut: '2027-10-05' }, 'a day for each fruit tree, no other');
  assert.deepEqual(
    read.out.map(f => f.id),
    ['1', '5'],
    'bad, doubled and stale fruit goes, and so does fruit that does not say where its tree stood',
  );
  assert.deepEqual(read.out[1], { ...good, id: '5' }, 'with nothing else kept');
  assert.deepEqual(keptFruit(JSON.stringify({ next: -1, picked: 'yesterday', out: 'x' }), T), kept0);
});

test('each place keeps its own three fallen fruit across a start', () => {
  const at = (world, n) =>
    Array.from({ length: n }, (_, i) => fallen(`${world}${i}`, `${world}-tree`, 0.4 + i * 0.05, 0.35, { world }));
  const read = keptFruit(
    JSON.stringify({ out: [...at('woodland', 4), ...at('lakeside', 3), ...at('courtyard', 2)] }),
    T,
  );
  assert.deepEqual(
    read.out.map(f => f.id),
    ['woodland0', 'woodland1', 'woodland2', 'lakeside0', 'lakeside1', 'lakeside2', 'courtyard0', 'courtyard1'],
    'up to three in each place, the first stored kept',
  );
});

test("each fruit's first pick of the day has its own line, and the day's later picks the usual one", () => {
  const { lines } = harvestOf('chestnut');
  const first = pickLine(kept0, 'chestnut', '2027-10-05');
  assert.equal(first.key, lines.first);
  assert.deepEqual(first.kept.picked, { chestnut: '2027-10-05' });
  assert.deepEqual(kept0.picked, {}, 'the old record is left alone');
  assert.equal(pickLine(first.kept, 'chestnut', '2027-10-05').key, lines.pick);
  assert.equal(pickLine(first.kept, 'chestnut', '2027-10-06').key, lines.first, 'and a new day starts again');
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
