import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { eventChanged } from '../src/yard/festival.js';
import { scene } from '../src/yard/world.js';
import { element, installStorage, keepGlobals } from './support/dom.mjs';

function page(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(2026, 5, 15, 22) });
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

test('a pending outdoor festival reveal is cancelled when entering the garden workshop', t => {
  const { card, stored } = page(t);
  eventChanged({ id: 'harvest' });
  Object.assign(scene, { world: 'workshop', event: null });
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

// A scene picked by hand calls an event's look up on any day; its gifts keep to its dates, so the
// chip and the card speak of them only then.
test('an event names its gift only on its own dates', async t => {
  const { t: say } = await import('../src/core/i18n.js');
  page(t);
  const chip = document.getElementById('event-chip'),
    gift = say('event.harvest.gift');
  eventChanged({ id: 'harvest' });
  assert.equal(chip.title, say('event.harvest.about'), 'a summer day calls up the moon, not the pumpkin');
  t.mock.timers.setTime(new Date(2026, 8, 20, 22).getTime());
  eventChanged({ id: 'harvest' });
  assert.ok(
    chip.title.startsWith(say('event.harvest.about')) && chip.title.endsWith(gift),
    'its dates bring the pumpkin',
  );
  assert.notEqual(gift, 'event.harvest.gift', 'the gift line is in the tables');
});
