import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import * as catalog from '../src/yard/catalog.js';

test('individual wildlife chances share the actual group split and preserve every species', () => {
  assert.equal(typeof catalog.bugChances, 'function');
  const seen = new Set();
  for (const season of ['spring', 'summer', 'autumn', 'winter'])
    for (const period of ['morning', 'day', 'evening', 'night'])
      for (const weather of ['clear', 'rain', 'snow'])
        for (const event of [null, 'blossom', 'fireflies', 'harvest', 'lights']) {
          const pool = catalog.bugChances(season, period, weather, event);
          const total = pool.reduce((sum, b) => sum + b.chance, 0);
          assert.ok(Math.abs(total - (pool.length ? 1 : 0)) < 1e-12);
          if (weather !== 'clear' || season === 'winter') assert.equal(pool.length, 0);
          for (const bug of pool) {
            seen.add(bug.id);
            assert.ok(bug.chance > 0);
            assert.ok(bug.periods.includes(period) && bug.seasons.includes(season));
          }
        }
  assert.deepEqual([...seen].sort(), catalog.BUGS.map(b => b.id).sort());
  const summer = catalog.bugChances('summer', 'day', 'clear');
  assert.ok(Math.abs(summer.filter(b => b.kind === 'dragonfly').reduce((sum, b) => sum + b.chance, 0) - 0.25) < 1e-12);
  for (const kind of ['beetle', 'cricket'])
    assert.ok(Math.abs(summer.filter(b => b.kind === kind).reduce((sum, b) => sum + b.chance, 0) - 0.1) < 1e-12);
  assert.ok(catalog.bugChances('spring', 'day', 'clear').some(b => b.kind === 'dragonfly'));
});

test('ordinary fireflies remain common while the festival species is a small part of its pool', () => {
  assert.equal(typeof catalog.bugChances, 'function');
  const ordinary = catalog.bugChances('summer', 'night', 'clear');
  assert.ok(Math.abs(ordinary.find(b => b.id === 'firefly').chance - 70 / 95) < 1e-12);
  const festival = catalog.bugChances('summer', 'night', 'clear', 'fireflies');
  assert.ok(Math.abs(festival.find(b => b.id === 'golden_firefly').chance - 1 / 96) < 1e-12);
  assert.deepEqual(
    catalog.bugChances('spring', 'night', 'clear').map(b => [b.id, b.chance]),
    [['firefly', 1]],
  );
  const rare = catalog.BUGS.filter(b => b.rarity === 'rare')
    .map(b => b.id)
    .sort();
  assert.deepEqual(rare, ['black_swallowtail', 'emperor_dragonfly', 'golden_firefly', 'peacock', 'purple_emperor']);
  for (const bug of catalog.BUGS.filter(b => b.kind !== 'firefly')) assert.deepEqual(bug.periods, ['morning', 'day']);
});

test('daytime families renormalize when a season has no members of a family', () => {
  const kinds = ['butterfly', 'dragonfly', 'beetle', 'cricket'].map(kind => ({
    id: kind,
    kind,
    weight: 10,
    seasons: ['summer'],
    periods: ['day'],
  }));
  const all = catalog.bugChances('summer', 'day', 'clear', null, kinds);
  assert.deepEqual(
    all.map(b => b.chance),
    [0.55, 0.25, 0.1, 0.1],
  );
  const partial = catalog.bugChances(
    'summer',
    'day',
    'clear',
    null,
    kinds.filter(b => b.kind !== 'cricket'),
  );
  assert.ok(Math.abs(partial[0].chance - 0.55 / 0.9) < 1e-12);
  assert.deepEqual(
    catalog.bugChances('summer', 'day', 'clear', null, kinds.slice(2, 3)).map(b => b.chance),
    [1],
  );
});
