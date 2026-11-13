// What the yard is made of loads at the start, before anything is drawn (yard/content.js). The
// drawings (about a hundred files) and the imported backgrounds (the backend, then the webview's
// storage) do not wait for each other: on Windows every request goes through the window's own
// thread, and in series they add up.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

let backgroundsAnswered = null;
globalThis.playPets = {
  listBackgrounds: () => new Promise(resolve => (backgroundsAnswered = () => resolve({ ok: true, data: [] }))),
};
const { loadContent } = await import('../src/yard/content.js');

test('the drawings are asked for while the backgrounds are still being read', async t => {
  const asked = [];
  globalThis.fetch = async path => {
    asked.push(path);
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
  for (let i = 0; i < 20 && !backgroundsAnswered; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(backgroundsAnswered, 'the backgrounds are asked for');
  assert.ok(
    asked.some(path => path.endsWith('.svg')),
    'the drawings are already on their way before the backgrounds answer',
  );
  backgroundsAnswered();
  await loading;
});
