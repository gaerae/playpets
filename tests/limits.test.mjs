// What the page and the backend each keep: the limits, the relationships and how often time
// together counts. The backend's are read from its source, so a change on one side alone fails here.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LIMITS } from '../src/core/limits.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const constant = (source, name) => source.match(new RegExp(`pub const ${name}: [^=]+= ([^;]+);`))?.[1];

test("the page's limits before the state arrives are the backend's", () => {
  const model = read('src-tauri/src/pets/model.rs'),
    garden = read('src-tauri/src/pets/garden.rs'),
    bond = read('src-tauri/src/pets/bond.rs');
  assert.equal(String(LIMITS.pets), constant(model, 'LIMIT'));
  assert.equal(String(LIMITS.persona), constant(model, 'PERSONA_MAX'));
  assert.equal(String(LIMITS.seeds), constant(garden, 'SEED_MAX'));
  assert.equal(String(LIMITS.decor), constant(garden, 'DECOR_MAX'));
  assert.equal(`[${LIMITS.bondLevels.join(', ')}]`, constant(bond, 'LEVELS'));
  assert.match(read('src/index.html'), new RegExp(`id="pet-persona" maxlength="${LIMITS.persona}"`));
});

test('the relationships the friend settings offer are the ones the backend knows and has a voice for', () => {
  const cards = [...read('src/index.html').matchAll(/name="relation" value="(\w*)"/g)].map(m => m[1]);
  const known = JSON.parse(constant(read('src-tauri/src/pets/model.rs'), 'RELATIONS'));
  const voices = [...read('src-tauri/src/chat/prompt.rs').matchAll(/^\s+"(\w+)",\n\s+"Your relationship/gm)].map(
    m => m[1],
  );
  assert.deepEqual(cards, ['', ...known], 'a friend (no relationship) and each one the backend keeps');
  assert.deepEqual(voices, known, 'each has its voice in the prompt');
});

test('time together is offered more often than the backend counts it, so no tick is lost', () => {
  const page = read('src/yard/bond.js').match(/const TIME_EVERY = (\d+) \* 60 \* 1000;/)[1],
    backend = constant(read('src-tauri/src/pets/bond.rs'), 'TIME_EVERY_MS').match(/^(\d+) \* 60 \* 1000$/)[1];
  assert.ok(Number(page) > Number(backend), 'the backend counts one per page tick, with room for timers that run late');
});

test('discovery limits and the public probability guide use the same backend rules', () => {
  const source = read('src-tauri/src/pets/discovery.rs');
  for (const [key, name] of Object.entries({
    trees: 'TREE_MAX',
    treesPerWorld: 'TREE_WORLD_MAX',
    digCooldownMs: 'DIG_COOLDOWN_MS',
    digHistory: 'DIG_HISTORY',
  }))
    assert.equal(String(LIMITS[key]), constant(source, name), key);
  const hours = name => Number(constant(source, name).split('*')[0].trim()) * 3600000;
  assert.equal(LIMITS.treeYoungMs, hours('TREE_YOUNG_MS'));
  assert.equal(LIMITS.treeMatureMs, hours('TREE_MATURE_MS'));
  assert.equal(LIMITS.digTtlMs, hours('DIG_TTL_MS'));
  assert.deepEqual(Object.values(LIMITS.digOdds), JSON.parse(constant(source, 'DIG_ODDS')));
  const guide = read('website/.vitepress/theme/DiscoveryGuide.vue');
  assert.match(guide, /LIMITS\.digOdds/);
  assert.match(guide, /LIMITS\.treeMatureMs/);
});
