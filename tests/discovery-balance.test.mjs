import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { LIMITS } from '../src/core/limits.js';
import { discoveryFindChances } from '../src/yard/discovery-rewards.js';
import { groundAllows } from '../src/yard/discovery-rules.js';
import { environmentLake } from '../src/yard/environment.js';
import { buildGroundProfile } from '../src/yard/ground.js';
import { worlds } from '../src/yard/worlds.js';

const catalog = JSON.parse(await readFile(new URL('../src/content/catalog.json', import.meta.url)));
const places = ['woodland', 'courtyard', 'lakeside'];
const contexts = ['spring', 'summer', 'autumn', 'winter'].flatMap(season =>
  ['clear', 'rain', 'snow'].flatMap(weather => places.map(place => ({ season, weather, place }))),
);
const tables = contexts.map(context => ({ context, rows: discoveryFindChances(catalog, LIMITS.digOdds, context) }));

test('every specimen remains reachable and a preferred route improves every digging find', () => {
  for (const item of [...catalog.trees, ...catalog.treasures]) {
    const chances = tables.map(table => table.rows.find(row => row.id === item.id).chance);
    assert.ok(Math.min(...chances) > 0, item.id);
    assert.ok(Math.max(...chances) >= Math.min(...chances) * 2, item.id);
  }
  const bestChance = item => Math.max(...tables.map(table => table.rows.find(row => row.id === item.id).chance));
  const hardestCommon = Math.min(...catalog.treasures.filter(item => item.rarity === 'common').map(bestChance));
  const easiestRare = Math.max(...catalog.treasures.filter(item => item.rarity === 'uncommon').map(bestChance));
  assert.ok(
    hardestCommon > easiestRare,
    'with its own preferred habitat, every common find is easier than any rare find',
  );
});

function patchCounts() {
  return Object.fromEntries(
    places.map(place => {
      const world = worlds.find(world => world.id === place);
      const width = 960,
        height = 640;
      const bounds = { width, height, top: height * world.geometry.fieldTop, bottom: height - 76 };
      const profile = buildGroundProfile({
        world,
        bounds,
        garden: {},
        lake: environmentLake(width, height, { world: place }),
      });
      // Sample ordinary tile centres only; boundary slivers and imported scenes add no opportunities here.
      let count = 0;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          if (groundAllows({ x: (x + 0.5) / 8, y: (y + 0.5) / 8 }, profile)) count++;
        }
      return [place, count];
    }),
  );
}

function simulate({ attempts, profiles = 2000, targeted = true }) {
  let seed = 0x7b32a19;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const counts = patchCounts();
  const completion = [],
    firstSession = [];
  const rare = catalog.treasures.filter(item => item.rarity === 'uncommon');
  for (let p = 0; p < profiles; p++) {
    const found = new Set();
    let lastRare = -Infinity,
      complete = false;
    for (let day = 0; day < 60 && !complete; day++) {
      const remaining = { ...counts };
      for (let attempt = 0; attempt < attempts; attempt++) {
        const at = day * 26 * 3600000 + attempt * 8000;
        const rareReady = at - lastRare >= LIMITS.digTtlMs;
        const missing = (rareReady ? rare : catalog.treasures.filter(item => item.rarity === 'common')).filter(
          item => !found.has(item.id),
        );
        const target = missing[(p + day) % Math.max(1, missing.length)];
        const available = tables.filter(table => remaining[table.context.place] > 0);
        if (!available.length) break;
        const best =
          targeted && target
            ? available.reduce((best, table) =>
                table.rows.find(row => row.id === target.id).chance > best.rows.find(row => row.id === target.id).chance
                  ? table
                  : best,
              )
            : available[(p + day + attempt) % available.length];
        remaining[best.context.place]--;
        // Category roll and within-category roll are independent, as in the real command.
        const roll = Math.floor(random() * 100);
        if (roll < 75) continue;
        const rarity = roll >= 97 && rareReady ? 'uncommon' : 'common';
        const pool = best.rows.filter(item => item.rarity === rarity);
        const total = pool.reduce((sum, item) => sum + item.chance, 0);
        let choice = random() * total;
        let selected = pool.at(-1);
        for (const item of pool) {
          choice -= item.chance;
          if (choice < 0) {
            selected = item;
            break;
          }
        }
        found.add(selected.id);
        if (rarity === 'uncommon') lastRare = at;
        if (found.size === catalog.treasures.length) {
          completion.push(at / 3600000);
          complete = true;
          break;
        }
      }
      if (day === 0) firstSession.push(found.size);
    }
    if (!complete) completion.push(Infinity);
  }
  completion.sort((a, b) => a - b);
  firstSession.sort((a, b) => a - b);
  const quantile = (values, fraction) => values[Math.floor((values.length - 1) * fraction)];
  return {
    attemptsPerSession: attempts,
    profiles,
    patchCounts: counts,
    medianFirstSession: quantile(firstSession, 0.5),
    completedFirstSession: firstSession.filter(count => count === catalog.treasures.length).length,
    completionHours: {
      p10: quantile(completion, 0.1),
      median: quantile(completion, 0.5),
      p95: quantile(completion, 0.95),
    },
    minimumHours: completion[0],
  };
}

test('finite-ground seeded collection remains multi-day while choosing habitats improves completion', t => {
  const targeted = simulate({ attempts: 48 });
  const casual = simulate({ attempts: 16 });
  const sweep = simulate({ attempts: 192 });
  const unguided = simulate({ attempts: 48, targeted: false });
  for (const result of [targeted, casual, sweep, unguided]) {
    assert.equal(result.completedFirstSession, 0);
    assert.ok(result.minimumHours >= 72);
    assert.ok(Number.isFinite(result.completionHours.p95), 'no long-tail stall beyond sixty sessions');
    assert.ok(result.medianFirstSession >= 2, 'a quiet short session still gives early discoveries');
  }
  assert.ok(targeted.completionHours.median < unguided.completionHours.median);
  t.diagnostic(
    JSON.stringify({
      assumptions:
        'Empty 960x640 built-in worlds, ordinary tile centres, 26h between sessions, no imported worlds or extra edge tiles; attempts not playtime; treasure book only, not whole album',
      targeted,
      casual,
      sweep,
      unguided,
    }),
  );
});
