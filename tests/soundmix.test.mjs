// What the yard sounds like in each scene (src/yard/soundmix.js): now and then a call, never a
// sound that goes on and on.

import assert from 'node:assert/strict';
import test from 'node:test';
import { CUES, mixFor, stepHz } from '../src/yard/soundmix.js';
import { useWorlds } from '../src/yard/worlds.js';
import { worlds } from './support/content.mjs';

useWorlds(worlds);

const SEASONS = ['spring', 'summer', 'autumn', 'winter'],
  PERIODS = ['morning', 'day', 'evening', 'night'],
  WEATHERS = ['clear', 'rain', 'snow'];
const CALLS = ['birds', 'cicadas', 'geese', 'frogs', 'crickets', 'drops'];
const every = fn => {
  for (const season of SEASONS)
    for (const period of PERIODS) for (const weather of WEATHERS) fn({ season, period, weather });
};

// A breeze, rustling leaves, the lake and rain were noise that never stopped; people heard a hiss.
test('a scene is only how often each call comes, with no bed of noise under them', () => {
  every(scene => {
    const mix = mixFor(scene);
    assert.deepEqual(Object.keys(mix).sort(), [...CALLS, 'indoors'].sort(), JSON.stringify(scene));
    for (const name of CALLS)
      assert.ok(mix[name] >= 0 && Number.isFinite(mix[name]), `${name} ${JSON.stringify(scene)}`);
    assert.equal(mix.indoors, false);
  });
});

test('birds sing by day, most in the morning, never at night or in rain or snow', () => {
  const at = (period, weather = 'clear', season = 'spring') => mixFor({ period, weather, season }).birds;
  assert.ok(at('morning') > at('day') && at('day') > at('evening') && at('evening') > 0);
  assert.equal(at('night'), 0);
  assert.equal(at('day', 'rain'), 0);
  assert.equal(at('day', 'snow', 'winter'), 0);
  assert.ok(at('morning', 'clear', 'winter') < at('morning'), 'fewer in winter');
});

// Spring, summer and autumn days sounded the same; each season now has a voice of its own.
test('each season has its own voices', () => {
  const at = (season, period, weather = 'clear') => mixFor({ season, period, weather });
  assert.ok(at('summer', 'day').cicadas > 0, 'cicadas on summer days');
  for (const season of ['spring', 'autumn', 'winter']) assert.equal(at(season, 'day').cicadas, 0, season);
  assert.equal(at('summer', 'night').cicadas, 0);
  assert.ok(at('autumn', 'day').geese > 0, 'geese over in autumn');
  for (const season of ['spring', 'summer', 'winter']) assert.equal(at(season, 'day').geese, 0, season);
  for (const season of ['spring', 'summer']) assert.ok(at(season, 'night').frogs > 0, `frogs on ${season} nights`);
  for (const season of ['autumn', 'winter']) assert.equal(at(season, 'night').frogs, 0, season);
  assert.equal(at('spring', 'day').frogs, 0);
  assert.equal(at('spring', 'night', 'snow').frogs, 0);
});

// The album has crickets on autumn evenings and nights only, so the yard heard them only then.
test('crickets chirp on autumn evenings and nights, as the album finds them', () => {
  const at = (season, period, weather = 'clear') => mixFor({ season, period, weather }).crickets;
  assert.ok(at('autumn', 'night') > at('autumn', 'evening') && at('autumn', 'evening') > 0);
  for (const season of ['spring', 'summer', 'winter']) assert.equal(at(season, 'night'), 0, season);
  assert.equal(at('autumn', 'day'), 0);
  assert.equal(at('autumn', 'night', 'rain'), 0);
});

test('rain is a drop now and then, and snow is quiet', () => {
  every(scene => {
    const mix = mixFor(scene);
    if (scene.weather === 'rain') assert.ok(mix.drops > 0 && mix.drops <= 15, 'a few a minute, not a patter');
    else assert.equal(mix.drops, 0);
    if (scene.weather === 'snow') for (const name of CALLS) assert.equal(mix[name], 0, `${name} in snow`);
  });
});

// The workshop was silent even with rain on its glass; it hears the outside through its window.
test('indoors, the outside comes in through the window, softer and with no lake', () => {
  for (const season of SEASONS)
    for (const period of PERIODS)
      for (const weather of WEATHERS) {
        const scene = { season, period, weather },
          inside = mixFor({ ...scene, world: 'workshop' }),
          outside = mixFor(scene);
        assert.equal(inside.indoors, true);
        assert.equal(inside.frogs, 0, 'no lake by the workshop');
        assert.equal(inside.drops, outside.drops, 'rain on the glass');
        for (const name of ['birds', 'cicadas', 'geese', 'crickets']) assert.ok(inside[name] <= outside[name], name);
      }
  assert.ok(mixFor({ season: 'spring', period: 'morning', weather: 'clear', world: 'workshop' }).birds > 0);
  assert.ok(mixFor({ season: 'spring', period: 'day', weather: 'rain', world: 'workshop' }).drops > 0);
});

test('cues are notes of the pentatonic scale above C6', () => {
  assert.equal(Math.round(stepHz(0)), 1047);
  assert.equal(Math.round(stepHz(5)), 2093, 'five steps up is an octave');
  assert.equal(Math.round(stepHz(3)), 1568, 'the fourth step is G6');
  for (const steps of Object.values(CUES)) for (const s of steps) assert.ok(stepHz(s) >= 1046 && stepHz(s) < 5000);
});
