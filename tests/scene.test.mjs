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
  initialSceneChoices,
  moonGlow,
  moonLit,
  moonMask,
  moonPhase,
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

test('each season keeps its tree and field colors under every precipitation', () => {
  for (const season of Object.keys(SEASON_COLORS)) {
    for (const period of Object.keys(PERIODS)) {
      const vars = seasonVars(season, period, 'clear');
      for (const [name, value] of Object.entries(vars)) {
        assert.match(name, /^--[a-z-]+$/, `${season}/${period}: ${name} is a custom property`);
        assert.match(value, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${season}/${period}: ${name} is a colour`);
      }
      assert.deepEqual(seasonVars(season, period, 'snow'), vars, `${season}/${period}: snow preserves seasonal colors`);
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
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(close(moonLit(0).edge, 1), 'new moon: the terminator lies on the bright limb, nothing is lit');
  assert.ok(close(moonLit(0.25).edge, 0), 'first quarter: half lit, the terminator straight down the middle');
  assert.ok(close(moonLit(0.5).edge, -1), 'full moon: the terminator reaches the far limb');
  assert.equal(moonLit(0.1).lit, 'right', 'waxing, the right side is lit north of the equator');
  assert.equal(moonLit(0.9).lit, 'left', 'waning, the left side');
  assert.equal(moonLit(0.1, true).lit, 'left', 'south of the equator it is mirrored');
  assert.ok(moonLit(0.1).edge > 0 && moonLit(0.4).edge < 0, 'a crescent before the quarter, gibbous after');
  assert.ok(close(moonLit(0.1).edge, moonLit(0.9).edge), 'waning retraces waxing');
});

test('the lit part is drawn as a limb and an elliptical terminator, never a second disc', () => {
  const arcs = svg => [...svg.matchAll(/A([\d.]+) 50 0 0 ([01]) 50 (0|100)/g)].map(m => [Number(m[1]), m[2], m[3]]);
  // Waxing crescent: the limb runs down the right side, the terminator comes back up through it.
  assert.deepEqual(arcs(moonMask({ lit: 'right', edge: 0.6 })), [
    [50, '1', '100'],
    [30, '0', '0'],
  ]);
  // Waxing gibbous: the terminator bows out through the dark left side instead.
  assert.deepEqual(arcs(moonMask({ lit: 'right', edge: -0.6 })), [
    [50, '1', '100'],
    [30, '1', '0'],
  ]);
  // Waning crescent: everything mirrored.
  assert.deepEqual(arcs(moonMask({ lit: 'left', edge: 0.6 })), [
    [50, '0', '100'],
    [30, '1', '0'],
  ]);
  assert.match(moonMask({ lit: 'right', edge: -1 }), /^<svg [^>]*viewBox="0 0 100 100"/);
  // The dark side keeps a trace of the moon, as earthshine shows it, gone before the painted moon's
  // bright rim so the dark side has no outline.
  const shine = moonMask({ lit: 'right', edge: 0.6 });
  assert.match(shine, /<circle cx="50" cy="50" r="50" fill="url\(#shine\)"\/><path /);
  assert.match(shine, /<stop offset="0\.8" stop-opacity="0\.08"\/><stop offset="0\.92" stop-opacity="0"\/>/);
  // A quarter moon's terminator is all but straight; a zero-width arc would lose its soft edge.
  assert.match(moonMask({ lit: 'right', edge: 0 }), /A1 50 /);
});

test('the glow comes from the lit part only and stops at the rim, so the dark limb has no bright ring', () => {
  const lit = { lit: 'right', edge: -0.6 },
    glow = moonGlow(lit),
    path = moonMask(lit).match(/ d="([^"]+)"/)[1];
  assert.match(glow, /viewBox="-50 -50 200 200"/, 'twice the moon, centred on it');
  assert.ok(glow.includes(`d="${path}"`), 'the same lit shape, blurred');
  assert.match(glow, /<circle cx="50" cy="50" r="50" fill="#000"\/>/, 'the disc itself is cut out');
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

test('fresh yards start sunny in spring while explicit and automatic saved choices survive', () => {
  assert.deepEqual(initialSceneChoices({}), { season: 'spring', period: 'day', weather: 'clear' });
  assert.deepEqual(initialSceneChoices({ season: 'winter', period: 'night', weather: 'snow' }), {
    season: 'winter',
    period: 'night',
    weather: 'snow',
  });
  assert.deepEqual(initialSceneChoices({ season: 'auto', period: 'auto', weather: 'auto' }), {
    season: 'auto',
    period: 'auto',
    weather: 'auto',
  });
  assert.deepEqual(initialSceneChoices({ season: 'invalid', period: 'constructor', weather: 'toString' }), {
    season: 'auto',
    period: 'auto',
    weather: 'auto',
  });
});
