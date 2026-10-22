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

test('Close shows the next waiting card instead of closing it too, and a held card keeps its turn', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  const strong = element('strong'),
    close = element('button');
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: selector => (selector === 'strong' ? strong : selector === '.catch-dismiss' ? close : element()),
    getBoundingClientRect: () => ({ left: 400, top: 20, right: 600, bottom: 90, width: 200, height: 70 }),
  });
  for (const id of ['scene-menu', 'play-panel', 'yard-controls-panel']) document.getElementById(id).hidden = true;
  const panel = Object.assign(document.getElementById('side-panel'), { hidden: true });
  setupCard();
  showCard('<svg></svg>', 'Pond snail', '', false, 'fish');
  showCard('<svg></svg>', 'Level 2', '', false);
  // A press on Close reaches the card too (the click bubbles): one press, one card.
  close.onclick?.();
  await card.dispatch('click');
  assert.equal(card.hidden, false);
  assert.equal(strong.textContent, 'Level 2', 'the waiting card is on show');
  await card.dispatch('click');
  // Held under a panel, a card keeps its place ahead of a newer one.
  panel.hidden = false;
  panel.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1180, bottom: 850, width: 1180, height: 850 });
  showCard('<svg></svg>', 'Firefly', '', false, 'bug');
  assert.equal(card.hidden, true);
  showCard('<svg></svg>', 'Mayfly', '', false, 'bug');
  panel.hidden = true;
  t.mock.timers.tick(1000);
  assert.equal(strong.textContent, 'Firefly');
});
