import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMITS } from '../src/core/limits.js';
import { eligibleKinds, fishWeight, relativeChances } from '../src/yard/catalog.js';
import { discoveryFindChances } from '../src/yard/discovery-rewards.js';
import { flowerFor } from '../src/yard/growth.js';
import { catalog } from './support/content.mjs';

const books = ['flowers', 'fish', 'bugs', 'gifts', 'trees', 'treasures'];
const seasons = ['spring', 'summer', 'autumn', 'winter'];

test('the collection has 100 distinct entries with four equally reachable flowers per season', () => {
  assert.equal(
    books.reduce((sum, book) => sum + catalog[book].length, 0),
    100,
  );
  for (const season of seasons) {
    const kinds = catalog.flowers.filter(item => item.season === season);
    assert.equal(kinds.length, 4, season);
    const found = new Set(Array.from({ length: 400 }, (_, i) => flowerFor(season, () => (i + 0.5) / 400)));
    assert.deepEqual(found, new Set(kinds.map(item => item.id)));
  }
});

test('new finds are ordinary discoveries with themed affinities and no additional calendar lock', () => {
  const ids = ['glass_marble', 'wooden_whale', 'felt_mushroom', 'acorn_teacup', 'sleeping_fox'];
  for (const id of ids) {
    const item = catalog.treasures.find(item => item.id === id);
    assert.ok(item, id);
    assert.equal(item.rarity, 'common');
    assert.ok(item.affinity.seasons.length && item.affinity.places.length);
    assert.equal(item.event, undefined);
  }
  for (const season of seasons)
    for (const weather of ['clear', 'rain', 'snow'])
      for (const place of ['woodland', 'courtyard', 'lakeside']) {
        const finds = discoveryFindChances(catalog, LIMITS.digOdds, { season, weather, place, rareReady: false });
        for (const id of ids) assert.ok(finds.find(item => item.id === id)?.chance > 0, id);
      }
});

test('added freshwater creatures have a reachable seasonal pool without becoming vanishingly rare', () => {
  for (const id of ['freshwater_prawn', 'crayfish', 'pond_snail', 'stickleback']) {
    const fish = catalog.fish.find(item => item.id === id);
    assert.ok(fish, id);
    let best = 0;
    for (const season of seasons)
      for (const period of ['morning', 'day', 'evening', 'night'])
        for (const weather of ['clear', 'rain', 'snow']) {
          const rows = relativeChances(eligibleKinds(catalog.fish, season, period), item => fishWeight(item, weather));
          best = Math.max(best, rows.find(item => item.id === id)?.chance || 0);
        }
    assert.ok(best >= 0.05 && best < 0.4, `${id}: ${best}`);
  }
});

test('green field cricket keeps its grounded discovery route and the 100-entry collection', () => {
  const cricket = catalog.bugs.find(bug => bug.id === 'field_cricket');
  assert.ok(cricket);
  assert.equal(cricket.kind, 'cricket');
  assert.equal(cricket.look.body, '#7b9e57');
  assert.equal(cricket.art, 'bugs/field_cricket.svg');
  assert.ok(cricket.seasons.includes('summer'));
  assert.equal(
    catalog.bugs.some(bug => bug.id === 'stag_beetle'),
    false,
  );
  assert.equal(catalog.bugs.length, 18);
});
