import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage } from './support/dom.mjs';

const { rareKind, setupCard, showCard } = await import('../src/yard/card.js');

function card(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  installStorage(t);
  const parts = new Map();
  const node = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: selector => parts.get(selector) ?? parts.set(selector, element()).get(selector),
  });
  setupCard();
  const next = () => {
    node.hidden = true;
    parts.clear();
  };
  return { node, parts, next };
}

test('the album marks Rare what is rare or comes with an event, and a treasure seldom dug up', () => {
  assert.equal(rareKind('fish', { rarity: 'rare' }), true);
  assert.equal(rareKind('bug', { rarity: 'common', event: 'fireflies' }), true);
  assert.equal(rareKind('fish', { rarity: 'common' }), false);
  assert.equal(rareKind('fish', {}), false);
  assert.equal(rareKind('treasure', { rarity: 'uncommon' }), true);
  assert.equal(rareKind('treasure', { rarity: 'common' }), false);
  assert.equal(rareKind('fish', undefined), false);
});

test('a first find pops and wears the short New as a paper tag; the sentence is still read', t => {
  const { node, parts } = card(t);
  showCard('<svg></svg>', 'Pond snail', '12 cm', true, 'fish');
  assert.ok(node.classList.contains('first'));
  assert.match(node.innerHTML, /class="catch-new-short" aria-hidden="true"/);
  assert.match(node.innerHTML, /class="catch-new sr-only"/);
  assert.equal(parts.get('.catch-new').textContent, 'New in the album!');
  assert.equal(parts.get('.catch-new-short').textContent, 'New');
  assert.equal(node.classList.contains('rare'), false);
  assert.equal(node.classList.contains('record'), false);
});

test('a rare find wears the Rare tag and the gold edge; a record its own tag; the next card neither', t => {
  const { node, parts, next } = card(t);
  showCard('<svg></svg>', 'Golden carp', '40 cm', true, 'fish', null, { rare: true });
  assert.ok(node.classList.contains('rare') && node.classList.contains('first'));
  assert.equal(parts.get('.catch-rare').textContent, 'Rare');
  next();
  showCard('<svg></svg>', 'Carp', '52 cm', false, 'fish', null, { record: true });
  assert.ok(node.classList.contains('record'));
  assert.equal(node.classList.contains('first'), false);
  assert.equal(node.classList.contains('rare'), false);
  assert.equal(parts.get('.catch-record').textContent, 'Best ever');
  next();
  showCard('<svg></svg>', 'Carp', '30 cm', false, 'fish');
  for (const mark of ['first', 'rare', 'record']) assert.equal(node.classList.contains(mark), false, mark);
  assert.doesNotMatch(node.innerHTML, /catch-rare|catch-record|catch-new/);
});

test('news in its own words keeps its sentence on screen, and no tag', t => {
  const { node, parts } = card(t);
  showCard('<svg></svg>', 'Round and round', 'You spun a friend', 'You found a hidden secret!', 'secret');
  assert.equal(node.classList.contains('first'), false);
  assert.match(node.innerHTML, /class="catch-new"/);
  assert.equal(parts.get('.catch-new').textContent, 'You found a hidden secret!');
});

// A fish's size and a bug's count are short and are what the catch is about (a record is one), so
// they stay on the card; a gift's or a flower's sentence and an event's news show on hover only.
test('a card whose caller keeps its words keeps them in view; other cards do not', t => {
  const { node, next } = card(t);
  showCard('<svg></svg>', 'Carp', '52 cm', false, 'fish', null, { record: true, keep: true });
  assert.ok(node.classList.contains('keep-detail'));
  next();
  showCard('<svg></svg>', 'Shell', 'Daisy brought this from the beach.', true, 'gift');
  assert.equal(node.classList.contains('keep-detail'), false);
  next();
  showCard('', 'Fireflies', 'They glow at night.', false);
  assert.equal(node.classList.contains('keep-detail'), false);
});

// A fish's size, a bug's count and a letter's quote are what their card is about: each caller says
// so, so a large window does not tuck them away until hovered (shell.css).
test('the fish, bug and letter-back cards keep their words', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = f => readFile(new URL(`../src/yard/${f}`, import.meta.url), 'utf8');
  const catchJs = await source('catch.js');
  assert.match(catchJs, /showCard\(fishSvg[^;]*'fish',\s*null,\s*\{[^}]*keep:\s*true/);
  assert.match(catchJs, /showCard\(bugSvg[^;]*'bug',\s*null,\s*\{[^}]*keep:\s*true/);
  const letter = await source('letter.js');
  assert.match(letter, /t\('letter\.back_quote'[\s\S]*?\{\s*keep:\s*true\s*\}/);
});

// The album marks a gift that comes only with an event Rare (album.js `rare`); its card says so too.
test('a gift a friend brings wears Rare when the album would call it rare', async () => {
  const { readFile } = await import('node:fs/promises');
  const decor = await readFile(new URL('../src/yard/decor.js', import.meta.url), 'utf8');
  assert.match(decor, /showCard\([^;]*'gift',\s*null,\s*\{\s*rare:\s*rareKind\('gift',\s*gift\),?\s*\}/);
});
