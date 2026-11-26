import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

// Its own file: the card's module keeps the last card's timers, which a test before it would leave behind.
const { setupCard, showCard } = await import('../src/yard/card.js');

test('news in an empty yard waits while it would cover the first card that picks a friend', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: () => element(),
    getBoundingClientRect: () => ({ left: 170, top: 328, right: 590, bottom: 456, width: 420, height: 128 }),
  });
  for (const id of ['side-panel', 'scene-menu', 'play-panel', 'yard-controls-panel'])
    document.getElementById(id).hidden = true;
  const welcome = Object.assign(document.getElementById('welcome'), {
    getBoundingClientRect: () => ({ left: 108, top: 147, right: 652, bottom: 373, width: 544, height: 226 }),
  });
  setupCard();
  showCard('<svg></svg>', 'Winter lights began!', 'The big tree is lit from evening', 'An event began');
  assert.equal(card.hidden, true, 'not over the friends to pick and Other pets');
  // As render.js puts the first card away once a friend is in.
  welcome.hidden = true;
  welcome.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  t.mock.timers.tick(1000);
  assert.equal(card.hidden, false, 'it shows once a friend has come and the first card is gone');
});
