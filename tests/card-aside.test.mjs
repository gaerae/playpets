import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

// Its own file: the card's module keeps the last card's timers, which a test before it would leave behind.
const { setupCard, showCard } = await import('../src/yard/card.js');

test('a card on show that a panel then opens over steps aside, and comes back when the panel closes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  // The panels' hidden attribute is watched; this stands in for the browser's observer.
  const watchers = [];
  globalThis.MutationObserver = class {
    constructor(callback) {
      watchers.push(callback);
    }
    observe() {}
  };
  t.after(() => delete globalThis.MutationObserver);
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: () => element(),
    getBoundingClientRect: () => ({ left: 400, top: 700, right: 800, bottom: 780, width: 400, height: 80 }),
  });
  for (const id of ['scene-menu', 'play-panel', 'yard-controls-panel']) document.getElementById(id).hidden = true;
  const panel = Object.assign(document.getElementById('side-panel'), {
    hidden: true,
    getBoundingClientRect: () => ({ left: 730, top: 52, right: 1168, bottom: 786, width: 438, height: 734 }),
  });
  setupCard();
  showCard('<svg></svg>', 'Winter lights', 'The big tree is lit from evening', 'An event began');
  assert.equal(card.hidden, false, 'shown while nothing covers it');
  panel.hidden = false;
  for (const seen of watchers) seen([]);
  assert.equal(card.hidden, true, 'it steps aside instead of covering the chat box');
  panel.hidden = true;
  t.mock.timers.tick(1000);
  assert.equal(card.hidden, false, 'back once the panel is closed');
});
