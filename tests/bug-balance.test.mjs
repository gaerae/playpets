import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import * as catalog from '../src/yard/catalog.js';
import { boostOf } from '../src/yard/events.js';
import { fireflyCount } from '../src/yard/scene.js';

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
  assert.ok(Math.abs(ordinary.find(b => b.id === 'firefly').chance - 70 / 110) < 1e-12);
  const festival = catalog.bugChances('summer', 'night', 'clear', 'fireflies');
  assert.ok(Math.abs(festival.find(b => b.id === 'golden_firefly').chance - 1 / 111) < 1e-12);
  assert.deepEqual(
    catalog.bugChances('spring', 'night', 'clear').map(b => [b.id, b.chance]),
    [['firefly', 1]],
  );
  const rare = catalog.BUGS.filter(b => b.rarity === 'rare')
    .map(b => b.id)
    .sort();
  assert.deepEqual(rare, [
    'black_swallowtail',
    'butterfly_dragonfly',
    'golden_firefly',
    'purple_emperor',
    'rhinoceros_beetle',
  ]);
  // Fireflies and the crickets of autumn nights come after dark; everything else by day.
  for (const bug of catalog.BUGS.filter(b => b.kind !== 'firefly'))
    assert.ok(
      bug.periods.every(p => p === 'morning' || p === 'day') ||
        (bug.kind === 'cricket' && bug.seasons.join() === 'autumn'),
      bug.id,
    );
});

test('crickets sing on clear autumn evenings and nights, alone and only then', () => {
  for (const period of ['evening', 'night']) {
    const pool = catalog.bugChances('autumn', period, 'clear');
    assert.ok(pool.length, period);
    assert.ok(pool.every(b => b.kind === 'cricket'));
    assert.ok(pool.some(b => b.id === 'emma_cricket'));
    assert.deepEqual(catalog.bugChances('autumn', period, 'rain'), []);
    assert.ok(!catalog.bugChances('summer', period, 'clear').some(b => b.kind === 'cricket'));
  }
  assert.ok(!catalog.bugChances('autumn', 'day', 'clear').some(b => b.id === 'emma_cricket'));
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

// A few fireflies for the yard's size: the light of each one counts, so a full yard has a handful,
// a small window one or two, and no screen is ever crowded.
test('fireflies come in a handful for the yard area, a few more in their event, never a crowd', () => {
  assert.equal(fireflyCount('night', 1180, 850), 5);
  assert.equal(fireflyCount('evening', 1180, 850), 3);
  assert.equal(fireflyCount('night', 300, 210), 2, 'a small window still has a couple');
  assert.equal(fireflyCount('evening', 300, 210), 1);
  assert.equal(fireflyCount('night', 0, 0), 2, 'a yard not laid out yet still has its floor');
  assert.equal(fireflyCount('evening', -10, 100), 1);
  assert.ok(fireflyCount('night', 600, 420) <= fireflyCount('night', 1180, 850));
  assert.ok(fireflyCount('night', 1180, 850) <= fireflyCount('night', 1600, 1000));
  for (const period of ['evening', 'night']) {
    assert.ok(fireflyCount(period, 5120, 2880) <= 6, `${period}: a firm cap`);
    assert.ok(fireflyCount(period, 5120, 2880, boostOf('fireflies', 'fireflies')) <= 8, 'and in the event');
  }
  const festival = fireflyCount('night', 1180, 850, boostOf('fireflies', 'fireflies'));
  assert.ok(festival > fireflyCount('night', 1180, 850), 'the event is richer');
  const small = fireflyCount('night', 300, 210, boostOf('fireflies', 'fireflies'));
  assert.ok(small >= fireflyCount('night', 300, 210) && small <= 3, 'a small window still has only a few');
  // The golden one still turns up now and then: a spell of the event on a full yard has one about
  // one time in fifteen, a few spells an hour.
  const golden = catalog
    .bugChances('summer', 'night', 'clear', 'fireflies')
    .find(b => b.id === 'golden_firefly').chance;
  assert.ok(1 - (1 - golden) ** festival > 0.06);
});
