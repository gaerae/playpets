import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

const { albumSeen, bookSeen, newBooks, setupCard, showCard } = await import('../src/yard/card.js');

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

test('each find marks its own book, the latest last, until that book is opened', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  installStorage(t);
  Object.assign(document.getElementById('catch-card'), { hidden: true, querySelector: () => element() });
  setupCard();
  showCard('<svg></svg>', 'A wish on the moon', 'Seven taps', 'You found a secret!', 'secret');
  // the next two wait behind the first card, and are kept all the same
  showCard('<svg></svg>', 'Pond snail', 'A new one', true, 'fish');
  showCard('<svg></svg>', 'Round and round', 'Three spins', 'You found another secret!', 'secret');
  assert.deepEqual(newBooks(), ['fish', 'secret']);
  showCard('<svg></svg>', 'Carp', 'Caught again', false, 'fish');
  assert.deepEqual(newBooks(), ['fish', 'secret'], 'one met before is no news');
  albumSeen();
  assert.deepEqual(newBooks(), ['fish', 'secret'], 'opening the album leaves each book its mark');
  bookSeen('secret');
  assert.deepEqual(newBooks(), ['fish']);
});

test('a find shows in the lane of messages, not apart above whoever found it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  installStorage(t);
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: () => element(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 70, right: 200, bottom: 70 }),
  });
  setupCard();
  showCard('<svg></svg>', 'Pond snail', 'A new one', false, 'fish');
  assert.equal(card.hidden, false);
  assert.equal(card.classList.contains('near'), false);
  assert.equal(card.style.left ?? '', '');
  assert.equal(card.style.top ?? '', '');
});

test('a new find also carries a short word for small windows, and news in its own words does not', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  installStorage(t);
  const parts = new Map();
  const card = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: selector => parts.get(selector) ?? parts.set(selector, element()).get(selector),
  });
  setupCard();
  showCard('<svg></svg>', 'Pond snail', 'A new one', true, 'fish');
  assert.match(card.innerHTML, /class="catch-new-short"/);
  assert.equal(parts.get('.catch-new').textContent, 'New in the album!');
  assert.equal(parts.get('.catch-new-short').textContent, 'New');
  card.hidden = true;
  showCard('<svg></svg>', 'Round and round', 'You spun a friend', 'You found a hidden secret!', 'secret');
  assert.doesNotMatch(card.innerHTML, /catch-new-short/, 'news in its own words keeps them whole');
});

test('a first may say in its own words why it is news, on the line a narrow yard still shows', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  installStorage(t);
  const parts = new Map();
  Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: selector => parts.get(selector) ?? parts.set(selector, element()).get(selector),
  });
  setupCard();
  showCard('<svg></svg>', 'Round and round', 'You spun a friend', 'You found a hidden secret!', 'secret');
  assert.equal(parts.get('.catch-new').textContent, 'You found a hidden secret!');
  assert.equal(parts.get('small').textContent, 'You spun a friend');
});
