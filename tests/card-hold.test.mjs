import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

const { setupCard, showCard } = await import('../src/yard/card.js');

test('a card that would land under an open panel waits for it to close; one beside it shows', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: () => element(),
    getBoundingClientRect: () => ({ left: 400, top: 20, right: 600, bottom: 90, width: 200, height: 70 }),
  });
  for (const id of ['scene-menu', 'play-panel', 'yard-controls-panel']) document.getElementById(id).hidden = true;
  const panel = Object.assign(document.getElementById('side-panel'), {
    hidden: false,
    getBoundingClientRect: () => ({ left: 350, top: 0, right: 1180, bottom: 850, width: 830, height: 850 }),
  });
  setupCard();
  showCard('<svg></svg>', 'Pond snail', 'Found while you were in Settings', false, 'fish');
  assert.equal(card.hidden, true, 'not under the panel');
  panel.hidden = true;
  t.mock.timers.tick(1000);
  assert.equal(card.hidden, false, 'it shows once the panel is closed');
  card.dispatch('click');
  panel.hidden = false;
  panel.getBoundingClientRect = () => ({ left: 800, top: 0, right: 1180, bottom: 850, width: 380, height: 850 });
  showCard('<svg></svg>', 'Ladybug', 'Beside the panel', false, 'bug');
  assert.equal(card.hidden, false, 'a card beside a panel shows at once');
});
