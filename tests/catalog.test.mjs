// What bites at the lake and what flies over the yard (src/yard/catalog.js).

import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { BUGS, bite, bugChances, FISH, fishHere, weighted } from '../src/yard/catalog.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'],
  PERIODS = ['morning', 'day', 'evening', 'night'];

test('something always bites, whatever the season and the hour, and its size is in its range', () => {
  let r = 0;
  const rng = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  for (const season of SEASONS)
    for (const period of PERIODS) {
      assert.ok(fishHere(season, period).length > 0, `${season} ${period}`);
      for (let i = 0; i < 20; i++) {
        const { fish, size } = bite(season, period, 'clear', rng);
        assert.ok(fish.seasons.includes(season) && fish.periods.includes(period));
        assert.ok(size >= fish.size[0] && size <= fish.size[1], `${fish.id} ${size}`);
      }
    }
});

test('rarer kinds come up less often, and rain brings up the fish of the deep', () => {
  const tally = (weather, n = 4000) => {
    const seen = {};
    for (let i = 0; i < n; i++) {
      const { fish } = bite('summer', 'night', weather, Math.random);
      seen[fish.id] = (seen[fish.id] || 0) + 1;
    }
    return seen;
  };
  const clear = tally('clear'),
    rain = tally('rain');
  assert.ok((clear.crucian || 0) > (clear.golden_carp || 0) * 5, 'a golden carp is rare');
  assert.ok((rain.catfish || 0) > (clear.catfish || 0), 'catfish bite more in the rain');
  assert.equal(
    weighted(
      ['a', 'b'],
      x => (x === 'a' ? 1 : 0),
      () => 0.99,
    ),
    'a',
    'a kind with no weight never comes',
  );
});

test('bugs fly by their season and hour: none in winter, fireflies only after dark', () => {
  const flying = (season, period, kind) =>
    bugChances(season, period, 'clear')
      .filter(b => b.kind === kind)
      .map(b => b.id);
  assert.deepEqual(flying('winter', 'day', 'butterfly'), []);
  assert.deepEqual(flying('summer', 'day', 'firefly'), []);
  assert.ok(bugChances('summer', 'night', 'clear').every(b => b.kind === 'firefly'));
  assert.deepEqual(flying('spring', 'night', 'firefly'), ['firefly'], 'in spring only the one kind');
  // The common skimmer flies from spring to autumn; the red dragonfly joins it in late summer.
  assert.deepEqual(new Set(flying('autumn', 'day', 'dragonfly')), new Set(['dragonfly', 'red_dragonfly']));
});

// Their names in every language are content.test.mjs's.
test('every kind has a name the album keeps', () => {
  for (const k of [...FISH, ...BUGS])
    assert.match(k.id, /^[a-z_]{1,24}$/, 'the backend takes lowercase names with underscores');
});
