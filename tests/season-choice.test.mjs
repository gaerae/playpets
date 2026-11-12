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
  assert.equal(events.sceneEvent(new Date(2026, 11, 15), false, 'summer')?.id, 'lights');
  assert.equal(events.sceneEvent(new Date(2026, 11, 15), true, 'spring')?.id, 'lights');
});

// docs/decisions/2026-11-12-scenes-before-dates.md: a season picked by hand calls an event up on
// any day when the scene is the one it asks for; on Auto only the calendar does.
test('a season picked by hand calls up the event its scene asks for, on any day', () => {
  const june = new Date(2026, 5, 10, 12),
    picked = (season, period, weather, date = june) =>
      events.sceneEvent(date, false, season, { chosen: true, period, weather })?.id ?? null;
  assert.equal(picked('spring', 'morning', 'clear'), 'blossom');
  assert.equal(picked('spring', 'day', 'clear'), 'blossom');
  assert.equal(picked('spring', 'night', 'clear'), null, 'the blossom is a daytime festival');
  assert.equal(picked('spring', 'day', 'rain'), null);
  assert.equal(picked('summer', 'evening', 'clear'), 'fireflies');
  assert.equal(picked('summer', 'night', 'clear'), 'fireflies');
  assert.equal(picked('summer', 'day', 'clear'), null);
  assert.equal(picked('autumn', 'night', 'clear'), 'harvest');
  assert.equal(picked('autumn', 'evening', 'clear'), null);
  assert.equal(picked('winter', 'evening', 'snow'), 'lights');
  assert.equal(picked('winter', 'night', 'clear'), 'lights');
  assert.equal(picked('winter', 'morning', 'snow'), 'newyear');
  assert.equal(picked('winter', 'day', 'clear'), null);
  // Picked by hand, the scene asks; the calendar's own event still comes first.
  assert.equal(picked('summer', 'night', 'clear', new Date(2026, 11, 15)), 'lights', 'December keeps its lights');
  assert.equal(picked('spring', 'day', 'clear', april), 'blossom');
  assert.equal(picked('summer', 'night', 'clear', april), 'fireflies', 'a summer night in April');
  // On Auto the scene calls nothing up: the season is the calendar's, and so are its festivals.
  const auto = (date, season, period, weather) =>
    events.sceneEvent(date, false, season, { chosen: false, period, weather })?.id ?? null;
  assert.equal(auto(june, 'summer', 'night', 'clear'), null);
  assert.equal(auto(new Date(2026, 6, 25, 22), 'summer', 'night', 'clear'), 'fireflies');
  assert.equal(events.sceneEvent(june, false, 'summer'), null, 'without a scene it is the calendar alone');
});

test('each event names the scene that calls it up, in the choices the scene picker offers', async () => {
  const { events: list } = JSON.parse(await readFile('src/content/events.json', 'utf8'));
  const html = await readFile('src/index.html', 'utf8'),
    offered = id =>
      new Set(
        [...html.match(new RegExp(`<select id="${id}"[^]*?</select>`))[0].matchAll(/value="(\w+)"/g)].map(m => m[1]),
      );
  const choices = { seasons: offered('scene-season'), periods: offered('period'), weathers: offered('weather') };
  for (const event of list) {
    assert.ok(event.scene?.seasons?.length, `${event.id} names its seasons`);
    for (const [key, values] of Object.entries(event.scene))
      for (const value of values)
        assert.ok(choices[key]?.has(value) && value !== 'auto', `${event.id} ${key} ${value}`);
  }
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
