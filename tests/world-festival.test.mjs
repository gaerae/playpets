import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { eventChanged } from '../src/yard/festival.js';
import { scene } from '../src/yard/world.js';
import { element, installStorage, keepGlobals } from './support/dom.mjs';

function page(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = { ...scene };
  t.after(() => {
    eventChanged(null);
    Object.assign(scene, previous);
  });
  keepGlobals(t, 'document');
  const chip = {},
    card = element('div', { hidden: true, querySelector: () => element() }),
    stored = new Map(),
    listeners = [];
  installStorage(t, { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) });
  // The festival listens for nothing but the window being shown again.
  globalThis.document = {
    hidden: false,
    getElementById: id => (id === 'event-chip' ? chip : card),
    addEventListener(type, listener) {
      assert.equal(type, 'visibilitychange');
      listeners.push(listener);
    },
  };
  Object.assign(scene, { world: 'woodland', event: 'harvest' });
  return { card, stored, listeners };
}

test('a pending outdoor festival reveal is cancelled when entering the studio', t => {
  const { card, stored } = page(t);
  eventChanged({ id: 'harvest' });
  Object.assign(scene, { world: 'studio', event: null });
  eventChanged(null);
  t.mock.timers.tick(1800);
  assert.equal(card.hidden, true);
  assert.equal(stored.size, 0, 'an unseen cancelled reveal remains available on returning outside');
});

test('a festival hidden during its reveal delay waits until the window is visible', t => {
  const { card, stored, listeners } = page(t);
  eventChanged({ id: 'harvest' });
  t.mock.timers.tick(1000);
  document.hidden = true;
  t.mock.timers.tick(800);
  assert.equal(card.hidden, true, 'the announcement is not drawn in a hidden window');
  assert.equal(stored.size, 0, 'the yearly announcement is not consumed offscreen');
  assert.equal(listeners.length, 1);
  document.hidden = false;
  listeners.shift()();
  t.mock.timers.tick(1800);
  assert.equal(card.hidden, false, 'the announcement appears after the window returns');
  assert.equal(stored.size, 1);
});
