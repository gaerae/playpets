// The yard follows the clock and a chosen weather; both must map to stable classes and captions.

import assert from 'node:assert/strict';
import test from 'node:test';
import { STRINGS } from '../src/core/strings.js';
import {
  autoWeather,
  CHATTER,
  chatterFor,
  dropCount,
  GREETINGS,
  greetingFor,
  groundFor,
  PERIODS,
  periodFor,
  sceneCaption,
  spawnDrop,
  stepDrops,
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

test('automatic weather is stable within a block and mostly clear over time', () => {
  const block = 20 * 60 * 1000,
    t = Date.UTC(2026, 8, 29, 3, 0, 0);
  assert.equal(autoWeather(t), autoWeather(t + block - 1 - (t % block)));
  const seen = { clear: 0, rain: 0, snow: 0 };
  for (let i = 0; i < 600; i++) seen[autoWeather(t + i * block)]++;
  assert.ok(seen.clear > seen.rain && seen.clear > seen.snow);
  assert.ok(seen.rain > 30 && seen.snow > 30, 'every weather shows up');
});
