import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

// Its own file: the card keeps its timers at module level, and mocked timers do not carry over.
const { setupCard, showCard } = await import('../src/yard/card.js');
test('Close shows the next waiting card instead of closing it too, and a held card keeps its turn ahead of a newer one under the panel', async t => {
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

test('a card in view shows while another waits under a panel, and the held one comes next', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  const strong = element('strong');
  let left = 400;
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: selector => (selector === 'strong' ? strong : element()),
    getBoundingClientRect: () => ({ left, top: 20, right: left + 200, bottom: 90, width: 200, height: 70 }),
  });
  for (const id of ['scene-menu', 'play-panel', 'yard-controls-panel']) document.getElementById(id).hidden = true;
  // The Friends panel over the right of the yard.
  Object.assign(document.getElementById('side-panel'), {
    hidden: false,
    getBoundingClientRect: () => ({ left: 800, top: 0, right: 1180, bottom: 850, width: 380, height: 850 }),
  });
  setupCard();
  left = 900;
  showCard('<svg></svg>', 'Ladybug', 'under the panel', false, 'bug');
  assert.equal(card.hidden, true, 'held');
  left = 100;
  showCard('<svg></svg>', 'Pond snail', 'far left', false, 'fish');
  assert.equal(card.hidden, false, 'a card in view is not blocked by the held one');
  assert.equal(strong.textContent, 'Pond snail');
  await card.dispatch('click');
  assert.equal(strong.textContent, 'Ladybug', 'the held card comes next');
});
