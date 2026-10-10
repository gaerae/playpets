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
import { catalog, yard } from './support/content.mjs';

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
  for (const path of artOf(catalog)) {
    const file = new URL(`../src/art/${path}`, import.meta.url);
    assert.ok(existsSync(file), `src/art/${path}`);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /^<svg[^>]*viewBox="0 0 [\d.]+ [\d.]+"/, `${path}: an svg with a view box from 0 0`);
    assert.doesNotMatch(text, /<script|\son\w+=/i, path);
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
