import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { cellLeft } from '../src/core/animation.js';

// Runs the end of app.js (its last top-level try) with `booted` saying whether the state came at
// the start, and returns the commands and toasts in order.
// `ready` is the answer to windowReady; `heardMeanwhile`, a window event heard while it was on its way.
async function start({ booted, unreachable = false, ready = null, heardMeanwhile = false }) {
  const source = await readFile('src/app.js', 'utf8');
  const startup = source.slice(source.lastIndexOf('\ntry {'));
  const calls = [];
  const context = {
    booted,
    shown: true,
    windowEvents: 0,
    seenAs(visible) {
      calls.push(`seenAs ${visible}`);
    },
    call: async method => {
      calls.push(method);
      if (method === 'growTrees') throw new Error('The garden could not be saved.');
      if (method === 'bootstrap' && unreachable) throw new Error('The app could not start.');
      if (method === 'windowReady') {
        if (heardMeanwhile) context.windowEvents++;
        return ready;
      }
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
  // The answer to windowReady is not waited for: whatever it does is done once it has come.
  await new Promise(resolve => setImmediate(resolve));
  return calls;
}

// Growth during closed time is recorded after the yard is first drawn: trees that grew come back as
// a change, like every other save, and the first friend is not kept waiting for a save.
test('a growth save error remains visible without stopping yard startup', async () => {
  assert.deepEqual(await start({ booted: true }), [
    'windowReady',
    'animate',
    'growTrees',
    'The garden could not be saved.',
  ]);
});

// The window is made hidden so that it never shows white while the page loads (window.rs): it
// shows once the yard is first drawn, and with the error when the start fails.
test('the window is shown once the yard is first drawn, or with the error when the start fails', async () => {
  assert.deepEqual(await start({ booted: false, unreachable: true }), [
    'bootstrap',
    'The app could not start.',
    'windowReady',
  ]);
});

test('the state is asked for once: again at the full start only when the first ask failed', async () => {
  // Trees that grew come to the page as a change, like every other save.
  assert.ok(!(await start({ booted: true })).includes('bootstrap'));
  assert.deepEqual(await start({ booted: false }), [
    'bootstrap',
    'windowReady',
    'animate',
    'growTrees',
    'The garden could not be saved.',
  ]);
});

// The first ask of app.js (from the window listener to the content), answered with `reply`, with
// the window events in `meanwhile` heard while the ask was on its way and those in `later` heard as
// the page goes on setting up: whether the page then takes its yard as seen.
async function firstAsk(reply, { meanwhile = [], later = [] } = {}) {
  const source = await readFile('src/app.js', 'utf8');
  const ask = source.slice(
    source.indexOf("\n// The backend's word on the window"),
    source.indexOf('\n// What the yard is made of'),
  );
  const listeners = [];
  const hear = shown => listeners.forEach(listener => listener({ type: 'window', shown }));
  const context = {
    shown: true,
    windowEvents: 0,
    setUp: false,
    data: {},
    setData() {},
    api: { onEvent: listener => listeners.push(listener) },
    call: async () => {
      meanwhile.forEach(hear);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  await vm.runInNewContext(`(async () => {${ask}\n})()`, context);
  later.forEach(hear);
  return context.shown;
}

// Started at login with friends on the desktop, the window is hidden before the page loads, and the
// window event that said so had nobody to hear it: the yard kept drawing for nobody.
test('a yard whose window was hidden before the page loaded is unseen from the start', async () => {
  assert.equal(await firstAsk({ windowShown: false }), false);
  assert.equal(await firstAsk({ windowShown: true }), true);
  assert.equal(await firstAsk(new Error('no state')), true, 'without an answer, the window is taken as seen');
  const source = await readFile('src/app.js', 'utf8');
  assert.match(
    source,
    /\nsetUp = true;\nif \(!shown\) seenAs\(false\);\n/,
    'what an unseen window stops, it stops at the start',
  );
});

// The window shows (the tray, the Dock, a second launch, a link, the wait in window.rs) or is closed
// while the page loads: the event that says so came before the page's listener, and the yard stayed
// frozen in a window people could see, or kept drawing in one they could not.
test('a window shown or closed while the page loads is heard, and an older answer does not undo it', async () => {
  assert.equal(await firstAsk({ windowShown: false }, { meanwhile: [true] }), true, 'shown while asking');
  assert.equal(await firstAsk({ windowShown: true }, { meanwhile: [false] }), false, 'closed while asking');
  assert.equal(await firstAsk({ windowShown: false }, { later: [true] }), true, 'shown while setting up');
  assert.equal(await firstAsk({ windowShown: true }, { later: [false] }), false, 'closed while setting up');
  assert.equal(await firstAsk(new Error('no state'), { meanwhile: [false] }), false);
  // One listener hears the window: the table of events does not call seenAs a second time.
  const source = await readFile('src/app.js', 'utf8');
  assert.doesNotMatch(source, /\n {2}window: /);
});

// The window's showing at the start answers whether the yard can be seen now: the backend's word may
// have come before the page could hear it, and a failed first ask told it nothing.
test('the answer to windowReady says whether the yard is seen, unless a newer event said so', async () => {
  assert.ok((await start({ booted: true, ready: false })).includes('seenAs false'));
  assert.ok(!(await start({ booted: true, ready: true })).some(c => c.startsWith('seenAs')), 'already seen');
  assert.ok(!(await start({ booted: true, ready: false, heardMeanwhile: true })).includes('seenAs false'));
  assert.ok((await start({ booted: false, unreachable: true, ready: false })).includes('seenAs false'));
});

// A friend's own game poses are not needed to draw the yard: the first render waits for the
// content only. A friend with poses asks for them as its view is made or synced (views.js), so
// they are on their way before it first plays, whenever it came in.
test("friends' poses are asked for by the friends in the yard, not waited for at the start", async () => {
  const source = await readFile('src/app.js', 'utf8');
  assert.match(source, /^await loadContent\(\);$/m);
  assert.doesNotMatch(source, /CompanionActions/);
  const views = await readFile('src/yard/views.js', 'utf8');
  assert.match(views, /v\.asset = asset\(p\);\n(?:\s*\/\/.*\n)*\s*loadCompanionActionsFor\(\[v\.asset\]\);/);
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
    'treeMomentTick',
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
