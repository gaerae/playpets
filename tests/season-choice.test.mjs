import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import * as events from '../src/yard/events.js';
import * as rules from '../src/yard/scene.js';

const april = new Date(2026, 3, 10, 12);

test('a chosen season overrides the calendar while Auto and invalid values retain hemisphere rules', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    assert.equal(rules.selectedSeason(april, false, season), season);
    assert.equal(rules.selectedSeason(april, true, season), season);
  }
  for (const choice of ['auto', undefined, null, 'bogus', '__proto__']) {
    assert.equal(rules.selectedSeason(april, false, choice), 'spring');
    assert.equal(rules.selectedSeason(april, true, choice), 'autumn');
  }
});

test('season selection preserves real festival dates without mismatched seasonal effects', () => {
  assert.equal(events.sceneEvent(april, false, 'spring')?.id, 'blossom');
  assert.equal(events.sceneEvent(april, false, 'winter'), null);
  assert.equal(events.sceneEvent(april, true, 'autumn')?.id, 'harvest');
  assert.equal(events.sceneEvent(april, true, 'spring'), null);
  assert.equal(events.sceneEvent(new Date(2026, 5, 10), false, 'winter'), null);
  assert.equal(events.sceneEvent(new Date(2026, 0, 3), false, 'summer')?.id, 'newyear');
  assert.equal(events.sceneEvent(new Date(2026, 6, 3), false, 'winter'), null);
});

test('automatic weather uses the chosen season without moving the clock', () => {
  const base = april.getTime();
  const weather = season =>
    Array.from({ length: 80 }, (_, index) =>
      rules.autoWeather(base + index * 1200000, rules.selectedSeason(april, false, season)),
    );
  assert.ok(weather('winter').includes('snow'));
  assert.ok(!weather('summer').includes('snow'));
});
