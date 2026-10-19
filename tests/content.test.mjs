// The yard's content (src/content/, src/art/): everything it names is there, so adding a kind, a
// drawing or a layer is a change to these files and a test says what is missing.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { STRINGS } from '../src/core/strings.js';
import { PAINTER_NAMES, THING_KINDS } from '../src/yard/backdrop.js';
import { artOf } from '../src/yard/catalog.js';
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
  ];
  for (const lang of LANGUAGES) for (const key of keys) assert.ok(STRINGS[lang][key], `${lang}: ${key}`);
});

test('every drawing the catalogue names is an SVG file with a view box, and nothing in it runs', () => {
  for (const path of artOf(catalog, events)) {
    const file = new URL(`../src/art/${path}`, import.meta.url);
    assert.ok(existsSync(file), `src/art/${path}`);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /^<svg[^>]*viewBox="0 0 [\d.]+ [\d.]+"/, `${path}: an svg with a view box from 0 0`);
    assert.doesNotMatch(text, /<script|\son\w+=/i, path);
    for (const [, href] of text.matchAll(/<image[^>]+href="([^"]+)"/g)) {
      assert.match(href, /^art\/[\w/-]+\.png$/, `${path}: raster art stays local`);
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
  const sheet = readFileSync(new URL('../src/art/flowers/specimens.png', import.meta.url));
  assert.equal(sheet.readUInt32BE(16), 1536);
  assert.equal(sheet.readUInt32BE(20), 1024);
  assert.equal(sheet[25], 6, 'RGBA preserves transparent specimen edges');
  for (const flower of catalog.flowers) {
    const svg = readFileSync(new URL(`../src/art/${flower.art}`, import.meta.url), 'utf8');
    assert.match(
      svg,
      /<image[^>]+href="art\/(?:flowers\/(?:specimens|seasonal-extension)|collection-extension\/flowers).png"/,
    );
    assert.match(svg, /overflow="hidden"/, 'a specimen cannot show its neighboring cell');
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
    if (e.gift) assert.equal(catalog.gifts.find(g => g.id === e.gift)?.event, e.id, `${e.id}: ${e.gift}`);
    assert.match(e.from, /^\d\d-\d\d$/);
    assert.match(e.to, /^\d\d-\d\d$/);
  }
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
