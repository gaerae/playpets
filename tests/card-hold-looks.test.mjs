import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

// Its own file: the card's module keeps the last card's timers, which a test before it would leave behind.
const { setupCard, showCard } = await import('../src/yard/card.js');

// Showing the hidden card to measure it lays out the whole yard (15 ms a look in the app, once a
// second for as long as a chat stays open): it looks again only once a panel opens or closes, or
// the window changes size.
test('a card held under a panel measures again only when a panel or the window changes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  let looks = 0;
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: () => element(),
    getBoundingClientRect: () => {
      looks++;
      return { left: 400, top: 20, right: 600, bottom: 90, width: 200, height: 70 };
    },
  });
  for (const id of ['scene-menu', 'play-panel', 'yard-controls-panel', 'welcome'])
    document.getElementById(id).hidden = true;
  const panel = Object.assign(document.getElementById('side-panel'), {
    hidden: false,
    getBoundingClientRect: () => ({ left: 350, top: 0, right: 1180, bottom: 850, width: 830, height: 850 }),
  });
  const width = globalThis.innerWidth;
  t.after(() => (globalThis.innerWidth = width));
  globalThis.innerWidth = 1180;
  setupCard();
  showCard('<svg></svg>', 'Pond snail', 'Found while you chatted', false, 'fish');
  assert.equal(card.hidden, true);
  const first = looks;
  t.mock.timers.tick(5000);
  assert.equal(looks, first, 'nothing changed, nothing measured');
  globalThis.innerWidth = 900;
  t.mock.timers.tick(1000);
  assert.equal(looks, first + 1, 'a new window size is measured');
  assert.equal(card.hidden, true);
  panel.hidden = true;
  t.mock.timers.tick(1000);
  assert.equal(card.hidden, false, 'the panel closed: it shows');
});
