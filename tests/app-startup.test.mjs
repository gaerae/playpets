import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('a growth save error remains visible without stopping yard startup', async () => {
  const source = await readFile('src/app.js', 'utf8');
  const startup = source.slice(source.lastIndexOf('\ntry {'));
  const calls = [];
  const context = {
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
  assert.deepEqual(calls, ['growTrees', 'The garden could not be saved.', 'bootstrap', 'animate']);
});
