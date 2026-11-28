// A thing that comes out on the desktop while the app runs arrives once (src/overlay/arrive.js;
// overlay.rs marks it `arriving`): a friend drops in, lands in a puff of dust and waves; a gift, a
// flower or a tree pops up from its foot. With reduced motion it is just there.

import assert from 'node:assert/strict';
import test from 'node:test';
import { element } from './support/dom.mjs';

const { arrivalOf, dropIn, popUp } = await import('../src/overlay/arrive.js');

test('a friend drops in and a thing pops up, once for each coming out', () => {
  const seen = new Set();
  assert.equal(arrivalOf({ id: 'pip' }, seen), null, 'already out when the app started');
  assert.equal(arrivalOf({ id: 'pip', arriving: true }, seen), 'drop');
  assert.equal(arrivalOf({ id: 'pip', arriving: true }, seen), null, 'the next layout while it still counts');
  assert.equal(arrivalOf({ id: 'bench', decor: 'bench', arriving: true }, seen), 'pop');
  // Taken in and sent out again later: it arrives again.
  assert.equal(arrivalOf({ id: 'pip' }, seen), null);
  assert.equal(arrivalOf({ id: 'pip', arriving: true }, seen), 'drop');
});

test('a friend falls from above its box and lands; with reduced motion it lands at once', () => {
  const button = element('button');
  let landed = 0;
  dropIn(button, 640, { reduced: false, land: () => landed++ });
  assert.ok(button.classList.contains('arrive-drop'));
  assert.equal(button.style['--fall'], '640px');
  // An animation of something inside (its bubble) is not the landing.
  button.dispatch('animationend', { target: element('div') });
  assert.equal(landed, 0);
  button.dispatch('animationend');
  assert.equal(landed, 1);
  assert.ok(!button.classList.contains('arrive-drop'));

  const still = element('button');
  dropIn(still, 640, { reduced: true, land: () => landed++ });
  assert.equal(landed, 2);
  assert.ok(!still.classList.contains('arrive-drop'));
});

test('a thing pops up from its foot, and not with reduced motion', () => {
  const button = element('button');
  popUp(button, { reduced: false });
  assert.ok(button.classList.contains('arrive-pop'));
  button.dispatch('animationend');
  assert.ok(!button.classList.contains('arrive-pop'));
  const still = element('button');
  popUp(still, { reduced: true });
  assert.ok(!still.classList.contains('arrive-pop'));
});
