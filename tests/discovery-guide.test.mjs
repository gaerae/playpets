import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { eligibleKinds, fishWeight, relativeChances, wildlifeGroup } from '../src/yard/catalog.js';

const catalog = JSON.parse(await readFile(new URL('../src/content/catalog.json', import.meta.url)));
test('guide odds normalize only currently eligible fish and rain weights', () => {
  const pool = eligibleKinds(catalog.fish, 'summer', 'night');
  const dry = relativeChances(pool, f => fishWeight(f, 'clear'));
  const rain = relativeChances(pool, f => fishWeight(f, 'rain'));
  assert.ok(Math.abs(dry.reduce((sum, f) => sum + f.chance, 0) - 1) < 1e-12);
  assert.ok(rain.find(f => f.id === 'catfish').chance > dry.find(f => f.id === 'catfish').chance);
  assert.ok(!pool.some(f => f.event));
  assert.deepEqual(
    relativeChances([], () => 1),
    [],
  );
});
test('wildlife availability follows actual clear-day and warm-evening gates', () => {
  assert.equal(wildlifeGroup('summer', 'evening', 'clear'), 'firefly');
  assert.equal(wildlifeGroup('autumn', 'evening', 'clear'), null);
  assert.equal(wildlifeGroup('winter', 'day', 'clear'), null);
  assert.equal(wildlifeGroup('spring', 'day', 'rain'), null);
  assert.equal(wildlifeGroup('spring', 'morning', 'clear'), 'day');
});
test('event species only enter their active event pool', () => {
  assert.ok(!eligibleKinds(catalog.bugs, 'summer', 'night').some(b => b.id === 'golden_firefly'));
  const pool = eligibleKinds(catalog.bugs, 'summer', 'night', 'fireflies').filter(b => b.kind === 'firefly');
  assert.equal(relativeChances(pool, b => b.weight).find(b => b.id === 'golden_firefly').chance, 1 / 3);
});

test('shared wildlife predicate preserves every valid scenery condition', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const period of ['morning', 'day', 'evening', 'night']) {
      for (const weather of ['clear', 'rain', 'snow']) {
        const warm = season === 'spring' || season === 'summer';
        const glow = warm && weather === 'clear' && (period === 'night' || period === 'evening');
        const flutter = season !== 'winter' && weather === 'clear' && (period === 'day' || period === 'morning');
        assert.equal(wildlifeGroup(season, period, weather), glow ? 'firefly' : flutter ? 'day' : null);
      }
    }
  }
});
