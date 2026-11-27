// A desktop window opens while friends are being sent out to it: the backend's layout event can come
// before the window's own first state (bootstrap) has answered, and that answer was read when the
// friends were not out yet. The newer layout stays; an older answer does not take the friends away.

import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const ORIGIN = { x: 0, y: 0, width: 1920, height: 1080 };
const PET = { id: 'a', assetId: 'cat', name: 'Momo', visualStyle: 'default', size: 112, x: 0.5, y: 0.5 };
const OUT = [{ id: 'a', x: 100, y: 500, width: 140, height: 150, displayId: '0', origin: ORIGIN }];
const state = desktopLayout => ({
  pets: [PET],
  assets: [{ id: 'cat', displayName: 'Cat', spriteUrl: 'pet-asset://sprite/cat' }],
  statuses: {},
  garden: { plants: [], trees: [], decor: [] },
  desktopLayout,
  desktopGround: null,
  language: 'en',
  sound: { on: false, volume: 50 },
  scene: { season: 'auto' },
});

test('a friend sent out while the desktop window is still opening is drawn there', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { document } = installDom(t, {
    anyId: true,
    props: {
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? element('span');
      },
    },
  });
  document.documentElement = element('html');
  installStorage(t);
  keepGlobals(t, 'fetch', 'Image');
  globalThis.fetch = async () => {
    throw new Error('no catalogue here');
  };
  globalThis.Image = class {};
  let answer, event;
  window.__DISPLAY = '0';
  window.playPets = {
    bootstrap: () => new Promise(resolve => (answer = resolve)),
    onChange() {},
    onEvent: cb => (event = cb),
  };
  const page = import('../src/overlay/overlay.js');
  await new Promise(resolve => setImmediate(resolve));
  // The friend goes out before the window has its state, then the state read before it went out.
  event({ type: 'layout', layout: OUT, ground: null });
  answer({ ok: true, data: state([]) });
  await page;
  const friends = document.getElementById('friends');
  const shown = friends.children.filter(node => node.className === 'friend-wrap' && !node.removed);
  assert.deepEqual(
    shown.map(node => node.dataset.id),
    ['a'],
    'the friend that went out is on the desktop',
  );
});
