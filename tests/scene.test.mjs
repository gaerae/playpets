// The yard follows the clock and a chosen weather; both must map to stable classes and captions.

import assert from 'node:assert/strict';
import test from 'node:test';
import { seasonFor, southern } from '../src/core/season.js';
import { STRINGS } from '../src/core/strings.js';
import {
  autoWeather,
  CHATTER,
  chatterFor,
  dropCount,
  fallerCount,
  GREETINGS,
  greetingFor,
  groundFor,
  moonPhase,
  moonShade,
  PERIODS,
  periodFor,
  SEASON_COLORS,
  sceneCaption,
  seasonVars,
  spawnDrop,
  spawnFaller,
  stepDrops,
  stepFallers,
  sunAt,
  WEATHERS,
} from '../src/yard/scene.js';

const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('the day is split into morning, day, evening and night', () => {
  assert.equal(periodFor(5), 'morning');
  assert.equal(periodFor(9), 'morning');
  assert.equal(periodFor(10), 'day');
  assert.equal(periodFor(16), 'day');
  assert.equal(periodFor(17), 'evening');
  assert.equal(periodFor(19), 'evening');
  assert.equal(periodFor(20), 'night');
  assert.equal(periodFor(0), 'night');
  assert.equal(periodFor(4), 'night');
});

test('captions name the period and weather, each language in its own words', () => {
  assert.equal(sceneCaption('day', 'clear'), STRINGS.en['caption.clear.day']);
  assert.equal(sceneCaption('night', 'snow'), STRINGS.en['caption.snow.night']);
  assert.equal(sceneCaption('morning', 'rain'), STRINGS.en['caption.rain.morning']);
  for (const lang of Object.keys(STRINGS)) {
    const captions = Object.keys(PERIODS).flatMap(p =>
      Object.keys(WEATHERS).map(w => STRINGS[lang][`caption.${w}.${p}`]),
    );
    assert.equal(new Set(captions).size, 12, `${lang}: every period and weather reads differently`);
  }
  assert.equal(sceneCaption('bogus', 'bogus'), sceneCaption('day', 'clear'), 'unknown values fall back to a clear day');
});

// Weather is drawn as particles with depth; the rules live in scene.js so they can be checked without a canvas.

test('far drops are smaller, slower and land nearer the horizon than close ones', () => {
  for (const kind of ['rain', 'snow']) {
    const far = spawnDrop(kind, 800, 400, seq(0.5, 0, 0.5, 0.5)),
      near = spawnDrop(kind, 800, 400, seq(0.5, 0.99, 0.5, 0.5));
    assert.ok(far.depth < near.depth);
    assert.ok(far.size < near.size, `${kind} size grows with depth`);
    assert.ok(far.vy < near.vy, `${kind} speed grows with depth`);
    assert.ok(groundFor(far.depth, 400) < groundFor(near.depth, 400));
    assert.ok(groundFor(0, 400) >= 400 * 0.55, 'nothing lands in the sky');
    assert.ok(groundFor(1, 400) <= 400);
  }
  assert.ok(
    spawnDrop('rain', 800, 400, Math.random).vy > spawnDrop('snow', 800, 400, Math.random).vy * 3,
    'rain falls much faster than snow',
  );
});

test('drops fall, land on their ground line and are recycled from the top', () => {
  const drops = [{ ...spawnDrop('rain', 800, 400, seq(0.5, 0.5, 0.5, 0.5)), y: groundFor(0.5, 400) - 1 }];
  const landed = stepDrops(drops, 'rain', 50, 800, 400, Math.random);
  assert.equal(landed.length, 1, 'a landing is reported so a splash can be drawn');
  assert.ok(Math.abs(landed[0].y - groundFor(landed[0].depth, 400)) < 1e-6);
  assert.equal(drops.length, 1);
  assert.ok(drops[0].y < 0, 'the drop restarts above the yard');
  const flake = spawnDrop('snow', 800, 400, seq(0.5, 0.5, 0.5, 0.5));
  const before = { x: flake.x, y: flake.y };
  stepDrops([flake], 'snow', 50, 800, 400, Math.random);
  assert.ok(flake.y > before.y);
});

test('particle counts scale with the yard but stay bounded', () => {
  assert.equal(dropCount('clear', 800, 400), 0);
  assert.ok(dropCount('rain', 1600, 800) > dropCount('rain', 800, 400));
  assert.ok(dropCount('rain', 5000, 3000) <= 320);
  assert.ok(dropCount('snow', 5000, 3000) <= 220);
});

test('greetings follow the time of day', () => {
  for (const p of Object.keys(PERIODS)) {
    assert.ok(GREETINGS[p].length >= 3);
    assert.ok(GREETINGS[p].includes(greetingFor(p, Math.random)));
  }
  assert.ok(GREETINGS.day.includes(greetingFor('bogus', () => 0)));
  assert.notEqual(
    greetingFor('morning', () => 0),
    greetingFor('morning', () => 0.99),
    'friends do not all say the same thing',
  );
});

test('idle chatter mentions the weather when there is some', () => {
  for (const p of Object.keys(PERIODS))
    for (const w of Object.keys(WEATHERS))
      for (const r of [0, 0.5, 0.99]) {
        const line = chatterFor(p, w, () => r);
        assert.equal(typeof line, 'string');
        assert.ok(line.length > 0 && line.length <= 20);
      }
  assert.ok(CHATTER.rain.includes(chatterFor('day', 'rain', () => 0)));
  assert.ok(CHATTER.snow.includes(chatterFor('day', 'snow', () => 0)));
  assert.ok(CHATTER.day.includes(chatterFor('day', 'clear', () => 0.99)), 'a clear sky leaves the time of day');
});

test('automatic weather is stable within a block, mostly clear, and snows only in winter', () => {
  const block = 20 * 60 * 1000,
    t = Date.UTC(2026, 8, 29, 3, 0, 0);
  assert.equal(autoWeather(t, 'autumn'), autoWeather(t + block - 1 - (t % block), 'autumn'));
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const seen = { clear: 0, rain: 0, snow: 0 };
    for (let i = 0; i < 600; i++) seen[autoWeather(t + i * block, season)]++;
    assert.ok(seen.clear > seen.rain && seen.clear > seen.snow, `${season}: mostly clear`);
    if (season === 'winter') assert.ok(seen.snow > 100 && seen.rain < seen.snow, 'winter brings snow more than rain');
    else assert.equal(seen.snow, 0, `${season}: no snow`);
    if (season !== 'winter') assert.ok(seen.rain > 60, `${season}: rain shows up`);
  }
});

test('the season follows the month, the other way round south of the equator', () => {
  const at = month => new Date(2026, month, 15);
  assert.equal(seasonFor(at(3)), 'spring');
  assert.equal(seasonFor(at(6)), 'summer');
  assert.equal(seasonFor(at(9)), 'autumn');
  assert.equal(seasonFor(at(0)), 'winter');
  assert.equal(seasonFor(at(11)), 'winter');
  assert.equal(seasonFor(at(9), true), 'spring');
  assert.equal(seasonFor(at(0), true), 'summer');
  assert.ok(southern('Australia/Sydney') && southern('America/Argentina/Buenos_Aires') && southern('Pacific/Auckland'));
  assert.ok(!southern('Asia/Seoul') && !southern('Europe/Berlin') && !southern('America/New_York') && !southern(''));
});

test('each season colours the trees and fields, and snow covers them all alike', () => {
  for (const season of Object.keys(SEASON_COLORS)) {
    for (const period of Object.keys(PERIODS)) {
      const vars = seasonVars(season, period, 'clear');
      for (const [name, value] of Object.entries(vars)) {
        assert.match(name, /^--[a-z-]+$/, `${season}/${period}: ${name} is a custom property`);
        assert.match(value, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${season}/${period}: ${name} is a colour`);
      }
      assert.deepEqual(seasonVars(season, period, 'snow'), {}, `${season}/${period}: snow keeps its own colours`);
    }
  }
  assert.ok(seasonVars('autumn', 'day', 'clear')['--crown'], 'autumn turns the round trees');
  assert.ok(seasonVars('autumn', 'day', 'clear')['--front'], 'by day the fields turn too');
  assert.equal(seasonVars('autumn', 'night', 'clear')['--front'], undefined, 'at night the fields keep the night');
  assert.deepEqual(seasonVars('bogus', 'day', 'clear'), {});
});

test('the sun crosses the sky by day and the moon by night, highest in the middle', () => {
  const minutes = (h, m = 0) => h * 60 + m;
  const rise = sunAt(minutes(6, 30)),
    noon = sunAt(minutes(12, 45)),
    set = sunAt(minutes(18, 30)),
    midnight = sunAt(minutes(0, 45));
  assert.ok(rise.x < noon.x && noon.x < set.x, 'east to west');
  assert.ok(noon.y < rise.y && noon.y < set.y, 'highest at midday');
  assert.equal(rise.body, 'sun');
  assert.equal(midnight.body, 'moon');
  assert.ok(sunAt(minutes(3)).x > sunAt(minutes(22)).x, 'the moon crosses too');
  for (let m = 0; m < 24 * 60; m += 7) {
    const p = sunAt(m);
    assert.ok(p.x >= 5 && p.x <= 90 && p.y >= 5 && p.y <= 40, `${m} min: stays in the sky (${p.x}, ${p.y})`);
  }
});

test('the moon shows its phase: dark when new, whole when full, lit on the right while waxing', () => {
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const month = 29.530588853 * 86400000;
  assert.ok(moonPhase(knownNew) < 0.01 || moonPhase(knownNew) > 0.99);
  assert.ok(Math.abs(moonPhase(knownNew + month / 2) - 0.5) < 0.01);
  assert.ok(Math.abs(moonPhase(knownNew + 10 * month + month / 4) - 0.25) < 0.01);
  assert.equal(moonShade(0), 0, 'new moon: the shade covers it');
  assert.equal(Math.abs(moonShade(0.5)), 100, 'full moon: the shade is off to one side');
  assert.ok(moonShade(0.25) < 0, 'waxing: the shade slides off to the left');
  assert.ok(moonShade(0.75) > 0, 'waning: the shade comes in from the right');
});

test('petals in spring and leaves in autumn drift down a few at a time, only in clear daylight', () => {
  assert.ok(fallerCount('spring', 'day', 'clear', 900) > 0);
  assert.ok(fallerCount('autumn', 'evening', 'clear', 900) > 0);
  assert.ok(fallerCount('autumn', 'day', 'clear', 4000) <= 12, 'a few, however wide the yard');
  for (const [season, period, weather] of [
    ['summer', 'day', 'clear'],
    ['winter', 'day', 'clear'],
    ['autumn', 'night', 'clear'],
    ['spring', 'day', 'rain'],
  ])
    assert.equal(fallerCount(season, period, weather, 900), 0, `${season} ${period} ${weather}`);
  const leaf = spawnFaller(800, 400, seq(0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  leaf.y = groundFor(leaf.depth, 400) - 0.5;
  assert.equal(stepFallers([leaf], 500, 800, 400, Math.random).length, 1);
  assert.ok(leaf.y < 0, 'a leaf that lands starts again above the yard');
  leaf.y = groundFor(leaf.depth, 400) - 0.5;
  assert.equal(stepFallers([leaf], 500, 800, 400, Math.random, false).length, 0, 'after the spell it stays down');
  const high = spawnFaller(800, 400, seq(0.5, 0.5, 0.1, 0.5, 0.5, 0.5));
  const y = high.y;
  stepFallers([high], 100, 800, 400, Math.random);
  assert.ok(high.y > y, 'it falls');
});
