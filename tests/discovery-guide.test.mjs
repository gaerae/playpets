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
  assert.equal(relativeChances(pool, b => b.weight).find(b => b.id === 'golden_firefly').chance, 1 / 96);
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

test('digging guide follows five outcome buckets and catalog weights within each rarity', async () => {
  const { discoveryFindChances } = await import('../website/.vitepress/theme/discovery-odds.js');
  const { LIMITS } = await import('../src/core/limits.js');
  assert.deepEqual(LIMITS.digOdds, { empty: 30, seed: 25, sapling: 20, common: 22, uncommon: 3 });
  const fixture = {
    trees: [{ id: 'one' }, { id: 'two' }],
    treasures: [
      { id: 'light', rarity: 'common', weight: 1 },
      { id: 'heavy', rarity: 'common', weight: 3 },
      { id: 'rare', rarity: 'uncommon' },
    ],
  };
  const rows = discoveryFindChances(fixture, LIMITS.digOdds);
  assert.deepEqual(
    rows.map(item => item.chance),
    [0.1, 0.1, 0.055, 0.165, 0.03],
  );
  const live = discoveryFindChances(catalog, LIMITS.digOdds);
  assert.equal(live.length, catalog.trees.length + catalog.treasures.length);
  assert.ok(Math.abs(live.reduce((sum, item) => sum + item.chance, 0) - 0.45) < 1e-12);
});

test('guide bug percentages use one actual spawned-individual pool, not two full groups', async () => {
  const { discoveryBugChances } = await import('../website/.vitepress/theme/discovery-odds.js');
  const rows = discoveryBugChances(catalog, 'summer', 'day', 'clear');
  const total = items => items.reduce((sum, item) => sum + item.chance, 0);
  assert.ok(Math.abs(total(rows) - 1) < 1e-12);
  assert.ok(Math.abs(total(rows.filter(item => item.kind === 'butterfly')) - 0.55) < 1e-12);
  assert.ok(Math.abs(total(rows.filter(item => item.kind === 'dragonfly')) - 0.25) < 1e-12);
  assert.deepEqual(discoveryBugChances(catalog, 'summer', 'day', 'rain'), []);
  assert.deepEqual(discoveryBugChances(catalog, 'summer', 'night', 'snow', 'fireflies'), []);
  const festival = discoveryBugChances(catalog, 'summer', 'night', 'clear', 'fireflies');
  assert.ok(Math.abs(festival.find(item => item.id === 'golden_firefly').chance - 1 / 96) < 1e-12);
});

test('all 100 album entries remain reachable and event gifts retain calendar gates', async () => {
  const { discoveryBugChances, discoveryFindChances } = await import('../website/.vitepress/theme/discovery-odds.js');
  const { LIMITS } = await import('../src/core/limits.js');
  const events = JSON.parse(await readFile(new URL('../src/content/events.json', import.meta.url))).events;
  const seen = {
    fish: new Set(),
    bugs: new Set(),
    flowers: new Set(),
    gifts: new Set(),
    trees: new Set(),
    treasures: new Set(),
  };
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const period of ['morning', 'day', 'evening', 'night']) {
      for (const event of [null, ...events.map(item => item.id)]) {
        for (const item of eligibleKinds(catalog.fish, season, period, event))
          if (fishWeight(item, 'clear') > 0) seen.fish.add(item.id);
        for (const item of discoveryBugChances(catalog, season, period, 'clear', event))
          if (item.chance > 0) seen.bugs.add(item.id);
      }
    }
    for (const item of catalog.flowers.filter(item => item.season === season)) seen.flowers.add(item.id);
  }
  for (const item of discoveryFindChances(catalog, LIMITS.digOdds)) {
    assert.ok(item.chance > 0);
    seen[catalog.trees.some(tree => tree.id === item.id) ? 'trees' : 'treasures'].add(item.id);
  }
  for (const gift of catalog.gifts) {
    if (gift.event)
      assert.ok(events.some(event => event.id === gift.event && event.gift === gift.id && event.from && event.to));
    seen.gifts.add(gift.id);
  }
  for (const [book, found] of Object.entries(seen)) assert.equal(found.size, catalog[book].length, book);
  assert.equal(
    Object.values(seen).reduce((sum, found) => sum + found.size, 0),
    100,
  );
});

test('guide dig odds use the shared context weights and cooldown transfer', async () => {
  const { discoveryFindChances } = await import('../website/.vitepress/theme/discovery-odds.js');
  const { discoveryFindChances: runtime } = await import('../src/yard/discovery-rewards.js');
  const odds = { empty: 30, seed: 25, sapling: 20, common: 22, uncommon: 3 };
  const fixture = {
    trees: [{ id: 'a', affinity: { seasons: ['spring'] } }, { id: 'b' }],
    treasures: [
      { id: 'c', rarity: 'common', affinity: { weather: ['rain'], places: ['lakeside'] } },
      { id: 'd', rarity: 'common' },
      { id: 'r', rarity: 'uncommon' },
    ],
  };
  const context = { season: 'spring', weather: 'rain', place: 'lakeside', rareReady: true };
  const rows = discoveryFindChances(fixture, odds, context);
  assert.deepEqual(rows, runtime(fixture, odds, context));
  assert.ok(rows.find(i => i.id === 'a').chance > rows.find(i => i.id === 'b').chance);
  assert.ok(rows.find(i => i.id === 'c').chance > rows.find(i => i.id === 'd').chance);
  const cooldown = discoveryFindChances(fixture, odds, { ...context, rareReady: false });
  assert.equal(cooldown.find(i => i.id === 'r')?.chance ?? 0, 0);
  assert.ok(Math.abs(cooldown.filter(i => i.rarity === 'common').reduce((sum, i) => sum + i.chance, 0) - 0.25) < 1e-12);
});

test('collection guide does not render exact probability controls or values', async () => {
  const guide = await readFile(new URL('../website/.vitepress/theme/DiscoveryGuide.vue', import.meta.url), 'utf8');
  const template = guide.split('<template>')[1].split('</template>')[0];
  assert.doesNotMatch(template, /percent\(|text\.details/);
});
