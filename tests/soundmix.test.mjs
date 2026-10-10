// What the yard sounds like in each scene (src/yard/soundmix.js).

import assert from 'node:assert/strict';
import test from 'node:test';
import { CUES, mixFor, stepHz } from '../src/yard/soundmix.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'],
  PERIODS = ['morning', 'day', 'evening', 'night'],
  WEATHERS = ['clear', 'rain', 'snow'];

test('every scene has a breeze and every level is between 0 and 1', () => {
  for (const season of SEASONS)
    for (const period of PERIODS)
      for (const weather of WEATHERS) {
        const mix = mixFor({ season, period, weather });
        assert.ok(mix.breeze > 0, `${season} ${period} ${weather}`);
        for (const name of ['breeze', 'leaves', 'water', 'rain', 'crickets'])
          assert.ok(mix[name] >= 0 && mix[name] <= 1);
        assert.ok(mix.birds >= 0);
      }
});

test('birds sing by day, most in the morning, never at night or in rain or snow', () => {
  const at = (period, weather = 'clear', season = 'spring') => mixFor({ period, weather, season }).birds;
  assert.ok(at('morning') > at('day') && at('day') > at('evening') && at('evening') > 0);
  assert.equal(at('night'), 0);
  assert.equal(at('day', 'rain'), 0);
  assert.equal(at('day', 'snow', 'winter'), 0);
  assert.ok(at('morning', 'clear', 'winter') < at('morning'), 'fewer in winter');
});

test('crickets come on warm nights, rain has its own layer, bare trees have no leaves to rustle', () => {
  assert.equal(mixFor({ period: 'night', weather: 'clear', season: 'summer' }).crickets, 1);
  assert.ok(mixFor({ period: 'evening', weather: 'clear', season: 'autumn' }).crickets > 0);
  assert.equal(mixFor({ period: 'night', weather: 'clear', season: 'winter' }).crickets, 0);
  assert.equal(mixFor({ period: 'night', weather: 'rain', season: 'summer' }).crickets, 0);
  assert.equal(mixFor({ period: 'day', weather: 'rain', season: 'spring' }).rain, 1);
  assert.equal(mixFor({ period: 'day', weather: 'clear', season: 'spring' }).rain, 0);
  assert.equal(mixFor({ period: 'day', weather: 'clear', season: 'winter' }).leaves, 0);
});

test('cues are notes of the pentatonic scale above C6', () => {
  assert.equal(Math.round(stepHz(0)), 1047);
  assert.equal(Math.round(stepHz(5)), 2093, 'five steps up is an octave');
  assert.equal(Math.round(stepHz(3)), 1568, 'the fourth step is G6');
  for (const steps of Object.values(CUES)) for (const s of steps) assert.ok(stepHz(s) >= 1046 && stepHz(s) < 5000);
});
