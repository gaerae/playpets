import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { LIMITS } from '../src/core/limits.js';
import { discoveryFindChances, rareReadyAt, rewardWeight } from '../src/yard/discovery-rewards.js';

const catalog = JSON.parse(await readFile(new URL('../src/content/catalog.json', import.meta.url)));
const context = { season: 'winter', weather: 'snow', place: 'woodland' };

test('each preferred environmental axis doubles weight without excluding other contexts', () => {
  const kind = { weight: 3, affinity: { seasons: ['winter'], weather: ['snow'], places: ['woodland'] } };
  assert.equal(rewardWeight(kind, {}), 3);
  assert.equal(rewardWeight(kind, { season: 'winter' }), 6);
  assert.equal(rewardWeight(kind, context), 24);
  assert.equal(rewardWeight(kind, { ...context, place: 'my-import' }), 12);
  assert.equal(rewardWeight({ affinity: kind.affinity }, context), 8);
});

test('context probabilities preserve category totals, positivity and rarity totals in every combination', () => {
  assert.deepEqual(LIMITS.digOdds, { empty: 30, seed: 25, sapling: 20, common: 22, uncommon: 3 });
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const weather of ['clear', 'rain', 'snow']) {
      for (const place of ['woodland', 'courtyard', 'lakeside', 'custom-scene']) {
        for (const rareReady of [true, false]) {
          const rows = discoveryFindChances(catalog, LIMITS.digOdds, { season, weather, place, rareReady });
          const total = predicate => rows.filter(predicate).reduce((sum, item) => sum + item.chance, 0);
          assert.ok(Math.abs(total(item => !item.rarity) - 0.2) < 1e-12);
          assert.ok(Math.abs(total(item => item.rarity === 'common') - (rareReady ? 0.22 : 0.25)) < 1e-12);
          assert.ok(Math.abs(total(item => item.rarity === 'uncommon') - (rareReady ? 0.03 : 0)) < 1e-12);
          assert.ok(rows.every(item => item.chance > 0 || (!rareReady && item.rarity === 'uncommon')));
          assert.ok(Math.abs(total(() => true) - 0.45) < 1e-12);
        }
      }
    }
  }
});

test('every affinity increases its own item probability compared with no matches', () => {
  for (const item of [...catalog.trees, ...catalog.treasures]) {
    assert.ok(item.affinity?.seasons.length && item.affinity.weather.length && item.affinity.places.length, item.id);
    const context = {
      season: item.affinity.seasons[0],
      weather: item.affinity.weather[0],
      place: item.affinity.places[0],
    };
    const best = discoveryFindChances(catalog, LIMITS.digOdds, context).find(row => row.id === item.id);
    const base = discoveryFindChances(catalog, LIMITS.digOdds).find(row => row.id === item.id);
    assert.ok(best.chance > base.chance, item.id);
  }
});

test('rare readiness comes from saved uncommon rewards across pets and scenes', () => {
  const now = 100000000;
  const rare = catalog.treasures.find(item => item.rarity === 'uncommon').id;
  const digs = [{ outcome: 'keepsake', kind: rare, at: now - 1000, world: 'removed-world', petId: 'gone' }];
  assert.equal(rareReadyAt(digs, catalog.treasures, now), now - 1000 + LIMITS.digTtlMs);
  assert.equal(rareReadyAt(digs, catalog.treasures, now - 2000), now - 2000 + LIMITS.digTtlMs);
  assert.equal(rareReadyAt(digs, catalog.treasures, now - 1000 + LIMITS.digTtlMs), 0);
  assert.equal(rareReadyAt([{ ...digs[0], outcome: 'full' }], catalog.treasures, now), 0);
  assert.equal(rareReadyAt([{ ...digs[0], kind: 'unknown' }], catalog.treasures, now), 0);
});
