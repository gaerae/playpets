import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { cellLeft } from '../src/core/animation.js';

// Runs the end of app.js (its last top-level try) with `booted` saying whether the state came at
// the start, and returns the commands and toasts in order.
async function start({ booted }) {
  const source = await readFile('src/app.js', 'utf8');
  const startup = source.slice(source.lastIndexOf('\ntry {'));
  const calls = [];
  const context = {
    booted,
    call: async method => {
      calls.push(method);
      if (method === 'growTrees') throw new Error('The garden could not be saved.');
      return { language: 'en' };
    },
    setData(value) {
      context.data = value;
    },
    data: {},
    follow() {},
    recallRun() {},
    PANELS: [],
    openPanel() {},
    render() {},
    setupBond() {},
    refreshChat() {},
    announceInstalledUpdate() {},
    performance: { now: () => 0 },
    last: 0,
    every() {
      calls.push('animate');
    },
    BUSY_MS: 1,
    animate() {},
    toast(message) {
      calls.push(message);
    },
    spoken: error => error.message,
    t: key => key,
  };
  await vm.runInNewContext(`(async () => {${startup}\n})()`, context);
  return calls;
}

test('a growth save error remains visible without stopping yard startup', async () => {
  assert.deepEqual(await start({ booted: true }), ['growTrees', 'The garden could not be saved.', 'animate']);
});

test('the state is asked for once: again at the full start only when the first ask failed', async () => {
  // Trees that grew come to the page as a change, like every other save.
  assert.ok(!(await start({ booted: true })).includes('bootstrap'));
  assert.deepEqual(await start({ booted: false }), [
    'growTrees',
    'The garden could not be saved.',
    'bootstrap',
    'animate',
  ]);
});

test("the companions' actions load alongside the yard's content, not after it", async () => {
  const source = await readFile('src/app.js', 'utf8');
  assert.match(source, /await Promise\.all\(\[loadContent\(\), setupCompanionActions\(\)\]\)/);
});

// The frame loop's part of app.js (its constants, interval and animate), with the page around it.
async function frameLoop({
  hidden = false,
  shown = true,
  views = new Map(),
  scenery = { busy: () => false, lively: () => false, frame: () => {} },
  moveFriends = () => {},
} = {}) {
  const source = await readFile('src/app.js', 'utf8');
  const loop = source.slice(source.indexOf('\nconst BUSY_MS'), source.lastIndexOf('\ntry {'));
  const noop = () => {};
  const yardLife = [
    'idleChatter',
    'giftTick',
    'thanksTick',
    'soloFishing',
    'snowmanTick',
    'viewingTick',
    'viewing',
    'petalTick',
    'judge',
    'moveFriends',
    'bondTick',
  ];
  const context = {
    document: { hidden },
    shown,
    game: null,
    aiming: false,
    views,
    scenery,
    scene: {},
    ...Object.fromEntries([...yardLife, 'playGame'].map(name => [name, noop])),
    moveFriends,
    $: () => ({ hidden: true }),
  };
  return vm.runInNewContext(`${loop}\n({ animate, BUSY_MS, CALM_MS })`, context);
}

// A sprite cell lasts 110-320 ms; at the loop's 50 or 100 ms a 120 ms cell would show for 100 or
// 150 ms, a limp in a walk. The loop wakes when a friend's cell ends (motion.js cellEnds).
test("the frame loop wakes when a friend's sprite cell ends, so each cell shows its own time", async () => {
  const friend = { cellEnds: 1030 },
    loop = await frameLoop({ views: new Map([['a', friend]]) });
  assert.equal(loop.animate(1000), 30);
  friend.cellEnds = 1500;
  assert.equal(loop.animate(1000), loop.CALM_MS, 'a cell that outlasts the frame waits for it');
  friend.cellEnds = Infinity;
  assert.equal(loop.animate(1000), loop.CALM_MS, 'a gesture held on its last cell has no next');
  friend.cellEnds = 1000.5;
  assert.ok(loop.animate(1000) >= 8, 'never a busy wait');
  friend.target = { x: 0, y: 0 };
  friend.cellEnds = 1080;
  assert.equal(loop.animate(1000), loop.BUSY_MS, 'a walk keeps its own pace when that comes first');
});

// How often the loop wakes in a second, run as core/ticker.js every runs it: each frame says when
// the next comes.
function wakesIn(loop, from = 1000, ms = 1000) {
  let count = 0;
  for (let now = from; now < from + ms; now += loop.animate(now)) count++;
  return count;
}
// Friends as motion.js leaves them each frame: a walker's step ends on the walk's clock (`phase`
// shifts a friend's own clock off the shared one), and one standing has no wake of its own.
const stepping = views => now => {
  for (const v of views.values()) v.cellEnds = v.target ? now + cellLeft('right', now + (v.phase || 0)) : Infinity;
};

// The performance standard's paces are the most the loop wakes: 20 a second while friends walk,
// with one more for each walking step (120 ms) on top, and 10 while they only stand.
test('the loop wakes once for all walkers at the end of a step, and never early for friends standing', async () => {
  const walkers = new Map(['a', 'b', 'c'].map(id => [id, { target: { x: 0, y: 0 } }]));
  const walking = await frameLoop({ views: walkers, moveFriends: stepping(walkers) });
  const busy = wakesIn(walking);
  assert.ok(busy >= 20 && busy <= 20 + Math.ceil(1000 / 120), `three walking: ${busy} wakes`);
  const standing = new Map(['a', 'b', 'c'].map(id => [id, {}]));
  const calm = await frameLoop({ views: standing, moveFriends: stepping(standing) });
  assert.equal(wakesIn(calm), 10, 'friends standing: the calm pace alone');
  // Steps out of step (should they ever be) still wake early at most once between two paced frames.
  const apart = new Map(['a', 'b', 'c'].map((id, i) => [id, { target: { x: 0, y: 0 }, phase: i * 37 }]));
  const loose = wakesIn(await frameLoop({ views: apart, moveFriends: stepping(apart) }));
  assert.ok(loose <= 40, `three walking out of step: ${loose} wakes`);
});

test('creatures and falling petals out keep the yard at its busy pace', async () => {
  const loop = await frameLoop({ scenery: { busy: () => false, lively: () => true, frame() {} } });
  assert.equal(loop.animate(1000), loop.BUSY_MS);
});

// Every repaint of the weather canvas costs a screen update: a wake only for a friend's cell leaves
// it for the yard's own pace, which counts on from its last repaint.
test('a wake for a sprite cell leaves the weather canvas to the yard pace', async () => {
  const moved = [],
    friend = { cellEnds: 1030 };
  const loop = await frameLoop({
    views: new Map([['a', friend]]),
    scenery: { busy: () => false, lively: () => false, frame: (now, dt) => moved.push([now, dt]) },
  });
  assert.equal(loop.animate(1000), 30);
  assert.equal(moved.length, 1);
  friend.cellEnds = 1300;
  assert.equal(loop.animate(1030), loop.CALM_MS - 30, 'the yard pace still comes when it was due');
  assert.equal(moved.length, 1, 'the weather canvas waits for it');
  loop.animate(1100);
  assert.deepEqual(moved[1], [1100, 100], 'and then moves for the whole time since it last did');
});

test('the frame loop wakes about once a second while the yard cannot be seen', async () => {
  const seen = await frameLoop();
  assert.equal(seen.animate(1000), seen.CALM_MS, 'a still yard in view keeps its calm pace');
  for (const unseen of [{ hidden: true }, { shown: false }]) {
    const { animate, CALM_MS } = await frameLoop(unseen);
    assert.ok(animate(1000) >= 1000, `${JSON.stringify(unseen)} waits a second, not ${CALM_MS}ms`);
  }
});

// The Let them chat now and then interval of app.js, with the page around it: what it started.
async function autoChatter({ gathered }) {
  const source = await readFile('src/app.js', 'utf8');
  const block = source.slice(source.indexOf('\nconst AUTO_CHATTER_MS'), source.indexOf('\nconst AUTO_PLAY_MS'));
  const started = [];
  let tick = null;
  const context = {
    data: { autoChatter: true, busy: [], pets: [{ providerId: 'p' }, { providerId: 'q' }] },
    shown: true,
    viewing: () => gathered,
    startChatter: async () => {
      started.push('chatter');
    },
    setInterval: fn => (tick = fn),
  };
  vm.runInNewContext(block, context);
  tick();
  return started;
}

test('the friends chat now and then, but not over a gathering under the blossom', async () => {
  assert.deepEqual(await autoChatter({ gathered: false }), ['chatter']);
  assert.deepEqual(await autoChatter({ gathered: true }), []);
});
