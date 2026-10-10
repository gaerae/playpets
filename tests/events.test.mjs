// Seasonal events: when each is on, north and south of the equator (src/yard/events.js).

import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { bite, flyingBug } from '../src/yard/catalog.js';
import { boostOf, eventOn, inEvent } from '../src/yard/events.js';

const on = (iso, south = false) => eventOn(new Date(`${iso}T12:00:00`), south)?.id ?? null;

test('each event is on from its first day to its last, and not around it', () => {
  assert.equal(on('2026-04-01'), 'blossom');
  assert.equal(on('2026-04-20'), 'blossom');
  assert.equal(on('2026-04-21'), null);
  assert.equal(on('2026-08-01'), 'fireflies');
  assert.equal(on('2026-10-01'), 'harvest');
  assert.equal(on('2026-12-31'), 'lights');
  assert.equal(on('2027-01-03'), 'newyear');
  assert.equal(on('2026-06-15'), null);
});

test('south of the equator the seasons come six months later, the new year does not', () => {
  assert.equal(on('2026-10-05', true), 'blossom', 'spring in October');
  assert.equal(on('2026-04-05', true), 'harvest', 'the harvest moon in April');
  assert.equal(on('2027-01-03', true), 'newyear');
  assert.equal(on('2026-06-20', true), 'lights');
  // Dates that cross the end of the year.
  assert.ok(inEvent({ from: '12-20', to: '01-05' }, '1-2'));
  assert.ok(!inEvent({ from: '12-20', to: '01-05' }, '6-2'));
});

test('an event brings more small life and kinds of its own, only while it is on', () => {
  assert.equal(boostOf('fireflies', 'fireflies'), 2.5);
  assert.equal(boostOf('fireflies', 'petals'), 1);
  assert.equal(boostOf(null, 'petals'), 1);
  const golden = () => 0.999;
  assert.notEqual(flyingBug('firefly', 'summer', 'night', golden)?.id, 'golden_firefly', 'not without the event');
  assert.equal(flyingBug('firefly', 'summer', 'night', golden, 'fireflies')?.id, 'golden_firefly');
  for (let i = 0; i < 200; i++)
    assert.notEqual(
      bite('autumn', 'night', 'clear', Math.random).fish.id,
      'moon_carp',
      'the moonlight carp waits for its moon',
    );
});
