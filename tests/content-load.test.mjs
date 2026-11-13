// What the yard is made of loads at the start, before anything is drawn (yard/content.js). The
// drawings (about a hundred files) and the imported backgrounds (the backend, then the webview's
// storage) do not wait for each other: on Windows every request goes through the window's own
// thread, and in series they add up.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Each step is awaited as it happens, not after a count of turns: reading the JSON from disk takes
// longer on a slow runner, and a fixed count let the first test give up and leak into the next.
let backgroundsAnswered = null;
let backgroundsAsked;
const backgroundsAskedNow = new Promise(resolve => (backgroundsAsked = resolve));
globalThis.playPets = {
  listBackgrounds: () =>
    new Promise(resolve => {
      backgroundsAnswered = () => resolve({ ok: true, data: [] });
      backgroundsAsked();
    }),
};
const { loadContent } = await import('../src/yard/content.js');

test('the drawings are asked for while the backgrounds are still being read', { timeout: 20_000 }, async t => {
  let drawingAsked;
  const drawingAskedNow = new Promise(resolve => (drawingAsked = resolve));
  globalThis.fetch = async path => {
    if (path.endsWith('.svg')) drawingAsked();
    if (path.endsWith('.json')) return { json: async () => JSON.parse(await readFile(`src/${path}`, 'utf8')) };
    return { ok: true, text: async () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>' };
  };
  globalThis.document = {
    querySelector: () => ({ append() {} }),
    createElementNS: () => ({ setAttribute() {}, append() {} }),
  };
  globalThis.DOMParser = class {
    parseFromString() {
      return {
        documentElement: {
          nodeName: 'svg',
          getAttribute: () => '0 0 10 10',
          querySelectorAll: () => [],
          attributes: [],
          childNodes: [],
        },
      };
    }
  };
  t.after(() => {
    delete globalThis.fetch;
    delete globalThis.document;
    delete globalThis.DOMParser;
  });
  const loading = loadContent();
  await backgroundsAskedNow;
  // Were the drawings to wait for the backgrounds, this would never come and the test would time out.
  await drawingAskedNow;
  backgroundsAnswered();
  await loading;
});

test('every drawing is asked for at once, not one after another', async t => {
  const { loadArt } = await import('../src/yard/art.js');
  const waiting = [];
  globalThis.fetch = () => new Promise(resolve => waiting.push(resolve));
  globalThis.document = { querySelector: () => ({ append() {} }) };
  globalThis.DOMParser = class {
    parseFromString() {
      return { documentElement: null };
    }
  };
  t.after(() => {
    delete globalThis.fetch;
    delete globalThis.document;
    delete globalThis.DOMParser;
  });
  const loading = loadArt(['a.svg', 'b.svg', 'c.svg']);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(waiting.length, 3, 'all three on their way before any answers');
  for (const answer of waiting) answer({ ok: false });
  await loading;
});
