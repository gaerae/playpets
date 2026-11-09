import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

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
async function frameLoop({ hidden = false, shown = true } = {}) {
  const source = await readFile('src/app.js', 'utf8');
  const loop = source.slice(source.indexOf('\nconst BUSY_MS'), source.lastIndexOf('\ntry {'));
  const noop = () => {};
  const yardLife = ['idleChatter', 'giftTick', 'thanksTick', 'soloFishing', 'judge', 'moveFriends', 'bondTick'];
  const context = {
    document: { hidden },
    shown,
    game: null,
    aiming: false,
    views: new Map(),
    scenery: { busy: () => false, frame: noop },
    scene: {},
    ...Object.fromEntries([...yardLife, 'playGame'].map(name => [name, noop])),
    $: () => ({ hidden: true }),
  };
  return vm.runInNewContext(`${loop}\n({ animate, CALM_MS })`, context);
}

test('the frame loop wakes about once a second while the yard cannot be seen', async () => {
  const seen = await frameLoop();
  assert.equal(seen.animate(1000), seen.CALM_MS, 'a still yard in view keeps its calm pace');
  for (const unseen of [{ hidden: true }, { shown: false }]) {
    const { animate, CALM_MS } = await frameLoop(unseen);
    assert.ok(animate(1000) >= 1000, `${JSON.stringify(unseen)} waits a second, not ${CALM_MS}ms`);
  }
});
