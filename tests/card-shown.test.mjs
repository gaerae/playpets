import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

// Its own file, as card-queue's: the card keeps its queue and timers at module level, and mocked
// timers do not carry over between tests.
const { setupCard, showCard } = await import('../src/yard/card.js');
test('a card says when it goes on show: at once, in its turn or out from under a panel, never when it gave way', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  const strong = element('strong');
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: selector => (selector === 'strong' ? strong : element()),
    getBoundingClientRect: () => ({ left: 400, top: 20, right: 600, bottom: 90, width: 200, height: 70 }),
  });
  for (const id of ['scene-menu', 'play-panel', 'yard-controls-panel']) document.getElementById(id).hidden = true;
  const panel = Object.assign(document.getElementById('side-panel'), { hidden: true });
  setupCard();
  const shown = [];
  const say = name => () => shown.push(name);
  showCard('<svg></svg>', 'Koi', '', false, 'fish', say('Koi'));
  assert.deepEqual(shown, ['Koi'], 'at once');
  for (const name of ['A', 'B', 'C', 'D']) showCard('<svg></svg>', name, '', false, null, say(name));
  assert.deepEqual(shown, ['Koi'], 'waiting');
  for (let i = 0; i < 4; i++) await card.dispatch('click');
  assert.deepEqual(shown, ['Koi', 'B', 'C', 'D'], 'A, the oldest of four waiting, gave way');
  assert.equal(card.hidden, true);
  panel.hidden = false;
  panel.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1180, bottom: 850, width: 1180, height: 850 });
  showCard('<svg></svg>', 'Firefly', '', false, 'bug', say('Firefly'));
  t.mock.timers.tick(1000);
  assert.equal(shown.length, 4, 'held under the panel');
  panel.hidden = true;
  t.mock.timers.tick(1000);
  assert.equal(card.hidden, false);
  assert.equal(shown.at(-1), 'Firefly', 'out from under the panel');
  t.mock.timers.tick(60000);
  assert.equal(shown.filter(name => name === 'Firefly').length, 1, 'once');
  assert.equal(card.hidden, true);
});
