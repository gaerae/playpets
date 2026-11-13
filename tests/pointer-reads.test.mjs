// The pointer moves far more often than the yard draws (a mouse sends a move each screen refresh).
// A move over the yard reads no layout: a friend under it works out where to look once a frame,
// and what can be caught under it is found from the yard's box as last measured.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { installDom, installStorage } from './support/dom.mjs';

globalThis.playPets = {};
const { setData, views } = await import('../src/core/state.js');
const { inYard, measureYard } = await import('../src/yard/field.js');
const { followPointer, setupViews, syncViews } = await import('../src/yard/views.js');

function yard(t) {
  const reads = { count: 0 };
  installDom(t, {
    anyId: true,
    props: {
      getBoundingClientRect() {
        reads.count++;
        return { x: 40, y: 30, left: 40, top: 30, right: 1040, bottom: 630, width: 1000, height: 600 };
      },
    },
  });
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  installStorage(t, { getItem: () => '1', setItem() {} });
  views.clear();
  setData({ pets: [{ id: 'p', name: 'Pip', size: 100, x: 0.3, y: 0.5 }], assets: [], statuses: {}, busy: [] });
  measureYard();
  setupViews({ select() {}, patted() {}, openChat() {}, gameTap() {}, resized() {} });
  syncViews();
  t.after(() => views.clear());
  return reads;
}

test('a friend under a moving pointer looks its way, measured once a frame, not once a move', async t => {
  const reads = yard(t);
  const v = views.get('p');
  reads.count = 0;
  for (let i = 0; i < 5; i++) await v.button.dispatch('pointermove', { clientX: 900 + i, clientY: 100 });
  assert.equal(reads.count, 0, 'a move reads no layout');
  followPointer(v);
  assert.equal(reads.count, 1, 'the frame reads its box once');
  assert.ok(v.look.x > 0, 'and it looks toward the last move');
  followPointer(v);
  assert.equal(reads.count, 1, 'no move since: nothing to read');
  await v.button.dispatch('pointerleave');
  followPointer(v);
  assert.equal(v.look, null, 'the pointer gone, it looks ahead again');
});

test("a pointer's place in the yard comes from the yard's box as last measured", async t => {
  const reads = yard(t);
  reads.count = 0;
  assert.deepEqual(inYard({ clientX: 140, clientY: 130 }), [100, 100]);
  assert.equal(reads.count, 0);
  const catching = await readFile('src/yard/catch.js', 'utf8');
  assert.doesNotMatch(catching, /getBoundingClientRect/, 'catching reads the yard as measured, not on each move');
});
