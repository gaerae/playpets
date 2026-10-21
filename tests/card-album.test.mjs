import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

const { albumSeen, setupCard, showCard } = await import('../src/yard/card.js');

test('a find in the album offers one press to its book and marks Play until the album is opened', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes } = installDom(t, { anyId: true });
  installStorage(t);
  document.getElementById('catch-card').querySelector = () => element();
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
