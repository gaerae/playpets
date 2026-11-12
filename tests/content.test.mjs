// The yard's content (src/content/, src/art/): everything it names is there, so adding a kind, a
// drawing or a layer is a change to these files and a test says what is missing.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { LIMITS } from '../src/core/limits.js';
import { STRINGS } from '../src/core/strings.js';
import { PAINTER_NAMES, THING_KINDS } from '../src/yard/backdrop.js';
import { artOf, eventGifts, giftKind, SHOOTS, shootKind, TRACKS, trailArt } from '../src/yard/catalog.js';
import { SHOWN } from '../src/yard/decor-shown.js';
import { EFFECT_NAMES } from '../src/yard/effects.js';
import { readPalette } from '../src/yard/palette.js';
import { catalog, events, yard } from './support/content.mjs';

const LANGUAGES = Object.keys(STRINGS);

test('every kind has its name, and every gift its lines, in every language', () => {
  const keys = [
    ...catalog.flowers.map(f => `garden.kind_${f.id}`),
    ...catalog.gifts.flatMap(g => [`decor.kind_${g.id}`, `decor.visit_${g.id}`]),
    ...catalog.fish.map(f => `catch.fish_${f.id}`),
    ...catalog.bugs.map(b => `catch.bug_${b.id}`),
    ...catalog.garden.stages.map(s => `garden.stage_${s.name}`),
    ...catalog.shoots.map(s => `shoot.${s.id}`),
  ];
  for (const lang of LANGUAGES) for (const key of keys) assert.ok(STRINGS[lang][key], `${lang}: ${key}`);
});

test('the spring shoots are eight spring kinds with their drawings', () => {
  assert.deepEqual(
    catalog.shoots.map(s => s.id),
    ['shepherds_purse', 'mugwort', 'fiddlehead', 'wild_garlic', 'bamboo_shoot', 'horsetail', 'asparagus', 'morel'],
  );
  for (const s of catalog.shoots) {
    assert.equal(s.season, 'spring', s.id);
    assert.equal(s.art, `shoots/${s.id}.svg`);
    assert.ok(s.size.length === 2 && s.size.every(Number.isFinite), `${s.id}: a size`);
    assert.equal(Math.max(...s.size), 40, `${s.id}: the longer side is 40`);
  }
  assert.equal(SHOOTS.length, 8);
  assert.equal(shootKind('morel').art, 'shoots/morel.svg');
  assert.equal(shootKind('carp'), null);
});

test('every drawing the catalogue names is an SVG file with a view box, and nothing in it runs', () => {
  for (const path of artOf(catalog, events)) {
    const file = new URL(`../src/art/${path}`, import.meta.url);
    assert.ok(existsSync(file), `src/art/${path}`);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /^<svg[^>]*viewBox="0 0 [\d.]+ [\d.]+"/, `${path}: an svg with a view box from 0 0`);
    assert.doesNotMatch(text, /<script|\son\w+=/i, path);
    for (const [, href] of text.matchAll(/<image[^>]+href="([^"]+)"/g)) {
      assert.match(href, /^art\/[\w/-]+\.webp$/, `${path}: raster art stays local`);
      assert.ok(existsSync(new URL(`../src/${href}`, import.meta.url)), `${path}: ${href} exists`);
    }
  }
});

test('the garden grows in stages that each have a drawing, and flowers in its last', () => {
  const stages = catalog.garden.stages;
  assert.equal(stages[0].minutes, 0);
  for (let i = 1; i < stages.length; i++) assert.ok(stages[i].minutes > stages[i - 1].minutes, 'later and later');
  assert.equal(stages.at(-1).name, 'bloom');
  for (const s of stages.slice(0, -1)) assert.ok(s.art, `${s.name} has a drawing`);
  for (const f of catalog.flowers) assert.ok(f.art && f.colors?.petal, `${f.id}: a drawing and its colours`);
});

test('flower raster specimens resolve locally with transparent isolated atlas crops', () => {
  const sheet = readFileSync(new URL('../assets/art/flowers/specimens.png', import.meta.url));
  assert.equal(sheet.readUInt32BE(16), 1536);
  assert.equal(sheet.readUInt32BE(20), 1024);
  assert.equal(sheet[25], 6, 'RGBA preserves transparent specimen edges');
  for (const flower of catalog.flowers) {
    const svg = readFileSync(new URL(`../src/art/${flower.art}`, import.meta.url), 'utf8');
    assert.match(
      svg,
      /<image[^>]+href="art\/(?:flowers\/(?:specimens|seasonal-extension)|collection-extension\/flowers(?:-2)?)\.webp"/,
    );
    assert.match(svg, /overflow="hidden"/, 'a specimen cannot show its neighboring cell');
  }
});

// The desktop draws a gift by its footprint as the yard does, and the backend reads the same number
// to know where a press on the desktop lands on it, so every gift names it.
test('every gift has a footprint in the shape of its drawing', () => {
  for (const g of catalog.gifts) {
    assert.ok(Array.isArray(g.size) && g.size.length === 2 && g.size.every(n => n > 0), `${g.id}: size`);
    const box = readFileSync(new URL(`../src/art/${g.art}`, import.meta.url), 'utf8').match(/viewBox="([^"]+)"/)[1];
    const [, , w, h] = box.split(/\s+/).map(Number);
    assert.ok(Math.abs(g.size[0] / g.size[1] - w / h) < 0.03 * (w / h), `${g.id}: ${g.size} keeps ${w}×${h}`);
  }
});

test('every effect a gift names exists', () => {
  for (const g of catalog.gifts)
    for (const name of g.effects || []) assert.ok(EFFECT_NAMES.includes(name), `${g.id}: ${name}`);
  for (const g of catalog.gifts) assert.ok(!g.stand || g.stand === 'on', `${g.id}: stand is "on" or left out`);
});

test('every layer of the scenery names a painter, every thing a kind, and every colour the palette', () => {
  const palette = Object.keys(readPalette(() => ''));
  const tones = c =>
    typeof c === 'string' ? [c] : Object.values(c).flatMap(v => v.filter(x => typeof x !== 'number').flatMap(tones));
  for (const layer of yard.layers) {
    assert.ok(PAINTER_NAMES.includes(layer.paint), `a painter for "${layer.paint}"`);
    for (const name of ['curve', 'along'])
      if (layer[name]) assert.ok(yard.curves[layer[name]], `curve "${layer[name]}"`);
    if (layer.tone) assert.ok(palette.includes(layer.tone), `colour ${layer.tone}`);
    for (const [, c] of layer.stops || [])
      for (const name of tones(c)) assert.ok(palette.includes(name), `colour ${name}`);
    for (const thing of layer.things || []) assert.ok(THING_KINDS.includes(thing.kind), `a thing "${thing.kind}"`);
  }
  assert.ok(yard.curves[yard.field] && yard.curves[yard.lake.under], 'the field and the lake are on curves there are');
});

test('every seasonal event has its words, its gift in the catalogue as its own, and real looks', () => {
  for (const e of events.events) {
    for (const lang of LANGUAGES)
      for (const key of ['name', 'about', 'lines'])
        assert.ok(STRINGS[lang][`event.${e.id}.${key}`], `${lang}: ${e.id}.${key}`);
    assert.ok(eventGifts(e.id).length, `${e.id} brings a gift`);
    assert.match(e.from, /^\d\d-\d\d$/);
    assert.match(e.to, /^\d\d-\d\d$/);
  }
  assert.ok(!events.events.some(e => 'gift' in e), 'an event’s gifts are the catalogue’s');
  // A kind marked with an event names one there is.
  for (const k of [...catalog.gifts, ...catalog.fish, ...catalog.bugs])
    if (k.event)
      assert.ok(
        events.events.some(e => e.id === k.event),
        `${k.id}: ${k.event}`,
      );
  // Every look an event names has its rules in the stylesheet.
  const css = readFileSync(new URL('../src/styles/scenery.css', import.meta.url), 'utf8');
  for (const look of events.events.flatMap(e => e.looks || [])) assert.ok(css.includes(`.look-${look}`), look);
});

test('a gift says how it comes and when it shows', () => {
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  for (const g of catalog.gifts) {
    if (g.built) assert.ok(!g.event, `${g.id}: a built kind has no event`);
    if (g.shown) assert.ok(Object.hasOwn(SHOWN, g.shown), `${g.id}: shown`);
    for (const s of g.seasons || []) assert.ok(SEASONS.includes(s), `${g.id}: ${s}`);
  }
  assert.ok(catalog.gifts.filter(g => g.shown || g.seasons).length <= 4);
  assert.deepEqual(eventGifts('lights'), ['xmas_tree', 'baby_reindeer', 'santa']);
  assert.deepEqual(
    catalog.gifts.slice(-3).map(g => g.id),
    ['xmas_tree', 'baby_reindeer', 'santa'],
  );
});

test("a gift's Christmas night names its drawings, its star, its bulbs and its guests", () => {
  const loaded = new Set(artOf(catalog, events));
  const nights = catalog.gifts.filter(g => g.night);
  assert.deepEqual(
    nights.map(g => g.id),
    ['xmas_tree'],
  );
  for (const { id, event, night } of nights) {
    assert.ok(loaded.has(night.art) && loaded.has(night.sleigh), `${id}: its drawings load`);
    const inside = ([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1;
    assert.ok(inside(night.star), `${id}: star`);
    assert.ok(night.bulbs.length >= 6 && night.bulbs.every(inside), `${id}: bulbs`);
    for (const guest of night.guests)
      assert.equal(catalog.gifts.find(g => g.id === guest)?.event, event, `${id}: ${guest}`);
  }
});

test('the Christmas tree has twelve hooks on each drawing, apart from each other and from the lights', () => {
  const tree = catalog.gifts.find(g => g.id === 'xmas_tree');
  const collection = JSON.parse(readFileSync(new URL('../src/art/collection.json', import.meta.url), 'utf8'));
  const grand = collection.find(r => r.id === 'xmas_tree_grand');
  const tiersOf = hooks =>
    hooks.reduce((tiers, h, i) => {
      if (i && h[1] - hooks[i - 1][1] <= 0.06) tiers.at(-1).push(h);
      else tiers.push([h]);
      return tiers;
    }, []);
  for (const [hooks, [w, h], label] of [
    [tree.hooks, tree.size, 'small'],
    [tree.night.hooks, grand.size, 'grand'],
  ]) {
    assert.equal(hooks.length, LIMITS.ornamentHooks, label);
    assert.ok(
      hooks.every(([x, y]) => x > 0 && x < 1 && y > 0 && y < 1),
      `${label}: inside`,
    );
    assert.ok(
      hooks.every(p => p.every(v => v === Math.round(v * 1000) / 1000)),
      `${label}: three decimals`,
    );
    assert.deepEqual(
      hooks,
      hooks.toSorted((a, b) => a[1] - b[1] || a[0] - b[0]),
      `${label}: top to bottom`,
    );
    const far = (a, b, min) => Math.hypot(a[0] - b[0], ((a[1] - b[1]) * h) / w) >= min;
    hooks.forEach((a, i) =>
      hooks.slice(i + 1).forEach(b => assert.ok(far(a, b, 0.18), `${label}: ${a} and ${b} apart`)),
    );
    if (label === 'grand')
      for (const a of hooks)
        for (const b of [tree.night.star, ...tree.night.bulbs])
          assert.ok(far(a, b, 0.06), `grand: ${a} clear of the lights`);
  }
  // Hook i is the same place on both drawings: the same tier, and the same place left to right in it.
  // The small tree's green comes in three bands (a snowy tree, 56 px wide), so its tiers are 1, 2, 5 and 4.
  const small = tiersOf(tree.hooks);
  const big = tiersOf(tree.night.hooks);
  assert.deepEqual(
    small.map(t => t.length),
    [1, 2, 5, 4],
    'small: tiers',
  );
  assert.deepEqual(
    big.map(t => t.length),
    [1, 2, 5, 4],
    'grand: tiers',
  );
  const leftToRight = tiers => tiers.map(t => t.map(p => t.filter(q => q[0] < p[0]).length));
  assert.deepEqual(leftToRight(small), leftToRight(big), 'hook i is in the same place in its tier on both');
});

test('the snowman has a ball, a stack and three things to wear, all drawn', () => {
  const s = giftKind('snowman');
  assert.equal(s.built, true);
  assert.deepEqual(s.seasons, ['winter']);
  assert.deepEqual(
    s.dress.map(p => p.id),
    ['scarf', 'nose', 'hat'],
    'drawn in this order',
  );
  for (const p of s.dress) assert.ok(p.at.length === 3 && p.at.every(v => v > 0 && v < 1), p.id);
  // A part may be turned a little, never so far it reads as falling off.
  for (const p of s.dress) assert.ok(p.turn === undefined || (p.turn !== 0 && Math.abs(p.turn) <= 15), p.id);
  assert.ok(s.stack.length === 2 && s.stack[0] > 0.5 && s.stack[0] < 1 && s.stack[1] >= 0 && s.stack[1] < 0.3);
  const arts = artOf(catalog);
  for (const art of [s.ball, ...s.dress.map(p => p.art)])
    assert.ok(arts.includes(art) && existsSync(`src/art/${art}`), art);
});

test("every animal's prints, tail and finds are in the catalogue", () => {
  assert.deepEqual(
    TRACKS.map(k => k.id),
    ['hare', 'fox', 'water_deer', 'raccoon_dog', 'squirrel', 'sparrow', 'magpie', 'cat'],
  );
  const art = artOf(catalog, events);
  const treasures = catalog.treasures.map(t => t.id);
  for (const k of TRACKS) {
    for (const path of [k.print, k.tail]) {
      assert.ok(art.includes(path), `${k.id}: ${path} is named`);
      assert.ok(existsSync(new URL(`../src/art/${path}`, import.meta.url)), `src/art/${path}`);
    }
    for (const find of k.finds) assert.ok(treasures.includes(find), `${k.id}: ${find} is a treasure`);
    assert.equal(typeof k.gait.group, 'boolean', k.id);
    for (const key of ['step', 'size']) assert.ok(k.gait[key] > 0, `${k.id}: ${key}`);
    assert.ok(k.gait.side >= 0, `${k.id}: side`);
    assert.equal(k.bird, k.id === 'sparrow' || k.id === 'magpie', k.id);
  }
  for (const id of ['bush', 'twigs', 'puff']) assert.ok(trailArt(id), id);
});
