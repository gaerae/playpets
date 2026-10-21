import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

const { albumSeen, setupCard, showCard } = await import('../src/yard/card.js');

test('a find in the album offers one press to its book and marks Play until the album is opened', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes } = installDom(t, { anyId: true });
  installStorage(t);
  Object.assign(document.getElementById('catch-card'), { hidden: true, querySelector: () => element() });
  const opened = [];
  setupCard({ openAlbum: book => opened.push(book) });
  showCard('<svg></svg>', 'Pond snail', 'A new one', true, 'fish');
  const link = nodes.get('catch-card').children.find(child => child.className === 'catch-album');
  assert.ok(link, 'the card offers its album book');
  assert.equal(link.textContent, 'See in album');
  await link.onclick({ stopPropagation() {} });
  assert.deepEqual(opened, ['fish']);
  assert.equal(nodes.get('catch-card').hidden, true, 'the card makes way for the album');
  assert.equal(nodes.get('album-button').classList.contains('has-new'), true, 'Album carries a dot');
  assert.equal(nodes.get('play-button').classList.contains('has-new'), true, 'and so does Play in the dock');
  albumSeen();
  assert.equal(nodes.get('album-button').classList.contains('has-new'), false);
  assert.equal(nodes.get('play-button').classList.contains('has-new'), false);
  const links = () => nodes.get('catch-card').children.filter(child => child.className === 'catch-album').length;
  const before = links();
  showCard('<svg></svg>', 'Event', 'Started', false);
  assert.equal(links(), before, 'cards about something outside the album add no link');
});

test('a find shows above the friend who made it, or in the top lane when there is no room', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  installStorage(t);
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: () => element(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 70, right: 200, bottom: 70 }),
  });
  globalThis.innerWidth = 1180;
  globalThis.innerHeight = 850;
  setupCard();
  const friend = {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 500, top: 550, width: 112, height: 120, right: 612, bottom: 670 }),
  };
  showCard('<svg></svg>', 'Pond snail', 'A new one', false, 'fish', friend);
  assert.equal(card.classList.contains('near'), true);
  assert.equal(card.style.left, '456px', 'centred on the friend');
  assert.ok(Number.parseFloat(card.style.top) < 550 - 70, 'above the friend, with room for its speech bubble');
  card.dispatch('click');
  const high = {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 10, top: 30, width: 40, height: 40, right: 50, bottom: 70 }),
  };
  showCard('<svg></svg>', 'Ladybug', 'Again', false, 'bug', high);
  assert.equal(card.classList.contains('near'), false, 'no room above: the card keeps to the top lane');
  assert.equal(card.style.top, '');
});

test('a card waits while a panel is open over the yard, then shows when it closes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { anyId: true });
  installStorage(t);
  const card = Object.assign(document.getElementById('catch-card'), { hidden: true, querySelector: () => element() });
  let panelOpen = true;
  const query = document.querySelector;
  document.querySelector = selector => (selector.includes('#side-panel') ? (panelOpen ? {} : null) : query(selector));
  setupCard();
  showCard('<svg></svg>', 'Pond snail', 'Found while you were in Settings', false, 'fish');
  assert.equal(card.hidden, true, 'not behind the panel');
  panelOpen = false;
  t.mock.timers.tick(1000);
  assert.equal(card.hidden, false, 'it shows once the panel is closed');
});
