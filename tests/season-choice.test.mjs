import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import * as seasons from '../src/core/season.js';
import * as events from '../src/yard/events.js';
import * as rules from '../src/yard/scene.js';

const april = new Date(2026, 3, 10, 12);

test('a chosen season overrides the calendar while Auto and invalid values retain hemisphere rules', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    assert.equal(seasons.selectedSeason(april, false, season), season);
    assert.equal(seasons.selectedSeason(april, true, season), season);
  }
  for (const choice of ['auto', undefined, null, 'bogus', '__proto__']) {
    assert.equal(seasons.selectedSeason(april, false, choice), 'spring');
    assert.equal(seasons.selectedSeason(april, true, choice), 'autumn');
  }
});

test('season selection preserves real festival dates without mismatched seasonal effects', () => {
  assert.equal(events.sceneEvent(april, false, 'spring')?.id, 'blossom');
  assert.equal(events.sceneEvent(april, false, 'winter'), null);
  assert.equal(events.sceneEvent(april, true, 'autumn')?.id, 'harvest');
  assert.equal(events.sceneEvent(april, true, 'spring'), null);
  assert.equal(events.sceneEvent(new Date(2026, 5, 10), false, 'winter'), null);
  assert.equal(events.sceneEvent(new Date(2026, 0, 3), false, 'summer')?.id, 'newyear');
  assert.equal(events.sceneEvent(new Date(2026, 6, 3), false, 'winter'), null);
});

test('automatic weather uses the chosen season without moving the clock', () => {
  const base = april.getTime();
  const weather = season =>
    Array.from({ length: 80 }, (_, index) =>
      rules.autoWeather(base + index * 1200000, seasons.selectedSeason(april, false, season)),
    );
  assert.ok(weather('winter').includes('snow'));
  assert.ok(!weather('summer').includes('snow'));
});

// The four seasons are listed once, in core where the yard, the sprites and the overlay can all
// reach them; a second copy could drift (a season the sky accepts but the wardrobe ignores).
test('the season list is written once, in core, and core depends on nothing in the yard', async () => {
  assert.deepEqual(seasons.SEASONS, ['spring', 'summer', 'autumn', 'winter']);
  assert.ok(Object.isFrozen(seasons.SEASONS));
  const files = [];
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.js')) files.push(path);
    }
  };
  await walk('src');
  const listed = /\[\s*'spring',\s*'summer',\s*'autumn',\s*'winter',?\s*\]/;
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    if (file !== 'src/core/season.js') assert.ok(!listed.test(text), `${file} writes out the season list`);
    if (file.startsWith('src/core/'))
      assert.ok(!/from '\.\.\/(yard|panel)\//.test(text), `${file} imports a higher layer`);
  }
});
