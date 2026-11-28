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

// Trees stand as tall as their kind grows (catalog.json "stature" on a tree): a metasequoia over
// a cherry, a lilac bush under it. A seedling is a seedling whatever it becomes; a young tree is
// halfway there. The desktop reads the same sizes (content.rs tree_size).
test('a grown tree stands as tall as its kind, a seedling as any other', async () => {
  const { treeKind, treeSize } = await import('../src/yard/catalog.js');
  const [cw, ch] = treeSize('cherry', 2),
    [mw, mh] = treeSize('metasequoia', 2),
    [lw, lh] = treeSize('lilac', 2);
  assert.ok(mh > ch * 1.25 && lh < ch * 0.85, `${mh} ${ch} ${lh}`);
  assert.ok(Math.abs(mw / mh - cw / ch) < 1e-9, 'the box keeps its shape, so the drawing is not stretched');
  assert.ok(Math.abs(lw / lh - cw / ch) < 1e-9);
  assert.deepEqual(treeSize('metasequoia', 0), treeSize('lilac', 0));
  const young = treeSize('metasequoia', 1)[1] / treeSize('cherry', 1)[1];
  assert.ok(Math.abs(young - (1 + treeKind('metasequoia').stature) / 2) < 1e-9);
  assert.deepEqual(treeSize('cherry', 2), [cw, ch], 'a new box each time, not one to change');
});
