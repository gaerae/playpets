// Finds out of the album come alive: a fish's size follows its length, every find answers a poke on
// the desktop in its own way, friends who visit one name it, and sixteen new entries join the album
// (src/yard/find-out.js, src/yard/poke.js; docs/design/2026-11-20-finds-come-alive.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { catalog } from './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

globalThis.playPets = {};
const { STRINGS, loadStrings } = await import('../src/core/strings.js');
const { list, t } = await import('../src/core/i18n.js');
const { drawHeld, findScale, heldLayers, pokeOf, visitLines } = await import('../src/yard/find-out.js');
const { giftSize } = await import('../src/yard/props.js');
const { poke } = await import('../src/yard/poke.js');

const NEW = {
  flowers: ['lily_of_the_valley', 'peony', 'rose', 'lily', 'marigold', 'japanese_anemone', 'poinsettia', 'amaryllis'],
  trees: ['lilac', 'silk_tree', 'osmanthus', 'holly'],
  treasures: ['heart_locket', 'perfume_bottle', 'pearl_hair_clip', 'shell_mirror'],
};
const NAME = { flowers: id => `garden.kind_${id}`, trees: id => `tree.${id}`, treasures: id => `treasure.${id}` };
// A tree is drawn by its stages, the rest by one painting.
const drawings = (book, kind) => (book === 'trees' ? kind.stages.map(stage => stage.art) : [kind.art]);
const LANGS = ['ko', 'en', 'ja', 'zh-hans'];
await Promise.all(LANGS.map(loadStrings));

test('sixteen new entries join the album, each painted and named in every language', () => {
  for (const [book, ids] of Object.entries(NEW))
    for (const id of ids) {
      const kind = catalog[book].find(k => k.id === id);
      assert.ok(kind, `${book}: ${id}`);
      for (const art of drawings(book, kind)) assert.match(art, /\.svg$/, id);
      for (const lang of LANGS) assert.ok(STRINGS[lang][NAME[book](id)], `${lang}: ${id}`);
    }
});

test('a fish comes out sized by its length, from a killifish to a sturgeon', () => {
  assert.equal(findScale('fish_out', ['killifish']), 0.7);
  assert.equal(findScale('fish_out', ['sturgeon']), 1.45);
  const goldfish = findScale('fish_out', ['goldfish']);
  assert.ok(goldfish > 0.9 && goldfish < 1.05, `goldfish ${goldfish}`);
  assert.ok(findScale('fish_out', ['minnow']) < findScale('fish_out', ['carp']));
  // A gift keeps its own size.
  assert.equal(findScale('bench'), 1);
  assert.equal(findScale('fish_out', []), 1);
  const big = giftSize('fish_out', undefined, ['sturgeon']),
    small = giftSize('fish_out', undefined, ['killifish']);
  assert.ok(Math.abs(big.w / small.w - 1.45 / 0.7) < 1e-9);
  assert.equal(giftSize('fish_out').w, giftSize('fish_out', undefined, []).w);
});

// Every book's finds are sized by their length as a fish is (catalog.json "length", in cm, on the
// log scale of the book's find out, "grow"): a ladybug comes out smaller than a lantern, not as big
// as a swallowtail; the backend sizes them the same (content.rs find_scale).
test('bugs, treasures and footprint animals come out sized by their length, as fish do', () => {
  const s = (kind, id) => findScale(kind, [id]);
  for (const [book, kind] of [
    ['bugs', 'bug_out'],
    ['treasures', 'treasure_out'],
    ['tracks', 'track_out'],
  ]) {
    const [[, least], [, most]] = catalog.findsOut.find(k => k.id === kind).grow;
    for (const found of catalog[book]) {
      assert.ok(found.length > 0, `${found.id} has a length`);
      const scale = s(kind, found.id);
      assert.ok(scale >= least && scale <= most, `${found.id}: ${scale}`);
    }
  }
  assert.equal(s('bug_out', 'ladybug'), 0.55, 'the smallest bug');
  assert.ok(s('bug_out', 'ladybug') < s('bug_out', 'firefly'));
  assert.ok(s('bug_out', 'firefly') < s('bug_out', 'cabbage_white'));
  assert.ok(s('bug_out', 'cabbage_white') < s('bug_out', 'swallowtail'));
  const ladybug = giftSize('bug_out', undefined, ['ladybug']),
    lantern = giftSize('lantern');
  assert.ok(ladybug.w <= lantern.w && ladybug.h < lantern.h, 'a ladybug is smaller than a lantern');
  assert.equal(s('treasure_out', 'freshwater_pearl'), 0.65, 'the smallest treasure');
  assert.ok(s('treasure_out', 'old_coin') < s('treasure_out', 'toy_robot'));
  assert.equal(s('track_out', 'water_deer'), 1.3, 'the largest animal');
  assert.ok(s('track_out', 'sparrow') < s('track_out', 'cat'));
  assert.equal(s('bug_out', 'no-such-bug'), 1);
});

test('every find answers a poke in its own way, and a few make a sound', () => {
  const book = { fish: 'fish', bugs: 'bug', treasures: 'treasure' };
  const motion = (b, id) => pokeOf(b, id)?.motion;
  assert.equal(motion('fish', 'goldfish'), 'swim');
  const byKind = { butterfly: 'flutter', dragonfly: 'dart', firefly: 'blink', beetle: 'hop', cricket: 'hop' };
  for (const bug of catalog.bugs) assert.equal(motion('bug', bug.id), byKind[bug.kind], `${bug.id} (${bug.kind})`);
  assert.equal(motion('treasure', 'quartz'), 'twinkle');
  assert.deepEqual(pokeOf('treasure', 'perfume_bottle'), { motion: 'twinkle', cue: 'spritz' });
  assert.equal(motion('treasure', 'heart_locket'), 'rock');
  assert.equal(pokeOf('bug', 'no-such-bug'), null);
  // Every find of every book has a motion the stylesheet draws.
  const css = readFileSync(new URL('../src/styles/answer.css', import.meta.url), 'utf8');
  for (const [b, list] of Object.entries(catalog).filter(([b]) => b in book))
    for (const k of list) {
      const m = motion(book[b], k.id);
      assert.ok(m, `${b}: ${k.id}`);
      assert.match(css, new RegExp(`\\.held\\.moving\\[data-motion="${m}"\\]`), `${k.id}: ${m}`);
    }
  // Every treasure has sparkles to show, the locket that sways too (yard-pokes.test.mjs).
  assert.equal(heldLayers('treasure_out', ['quartz']).match(/class="sparkle"/g).length, 1);
});

test('a poke plays the find’s motion, and its sound even with reduced motion', () => {
  const view = (kind, holds) => {
    const held = element('span');
    held.className = 'held';
    const button = element('button');
    button.querySelector = selector => (selector === '.held' ? held : null);
    return { id: kind, kind, holds, button, held };
  };
  const cues = [];
  const ring = cue => cues.push(cue);
  const perfume = view('treasure_out', ['perfume_bottle']);
  poke(perfume, { period: 'day', reduced: false, ring });
  assert.equal(perfume.held.dataset.motion, 'twinkle');
  assert.ok(perfume.held.classList.contains('moving'));
  assert.deepEqual(cues, ['spritz']);
  const again = view('treasure_out', ['perfume_bottle']);
  poke(again, { period: 'day', reduced: true, ring });
  assert.equal(again.held.classList.contains('moving'), false, 'nothing moves');
  assert.deepEqual(cues, ['spritz', 'spritz'], 'the perfume still sprays');
  const locket = view('treasure_out', ['heart_locket']);
  poke(locket, { period: 'day', reduced: false, ring });
  assert.equal(locket.held.dataset.motion, 'rock');
  const butterfly = view('bug_out', ['swallowtail']);
  poke(butterfly, { period: 'day', reduced: false, ring });
  assert.equal(butterfly.held.dataset.motion, 'flutter');
  assert.deepEqual(cues, ['spritz', 'spritz'], 'a silent find makes no sound');
});

test('a friend who visits a find names it, by its book', () => {
  for (const lang of LANGS)
    for (const kind of ['fish_out', 'bug_out', 'treasure_out']) {
      const lines = STRINGS[lang][`decor.visit_${kind}`];
      assert.ok(lines.length >= 3, `${lang}: ${kind}`);
      assert.ok(
        lines.some(line => line.includes('{name')),
        `${lang}: ${kind} names the find`,
      );
    }
  const said = visitLines('fish_out', ['goldfish']);
  assert.ok(said.some(line => line.includes(t('catch.fish_goldfish'))));
  assert.ok(said.every(line => !line.includes('{')));
  assert.deepEqual(visitLines('bench'), list('decor.visit_bench'), 'a gift keeps its own lines');
});

test('the yard and the desktop draw what a find out holds with the one helper, only when it changed', ctx => {
  installDom(ctx);
  const fish = catalog.fish[0].id,
    other = catalog.fish[1].id,
    view = { kind: 'fish_out', button: element('button') };
  assert.equal(drawHeld(view, [fish]), true);
  assert.equal(view.button.children.at(-1), view.heldLayer, 'its layer is made once, on the button');
  assert.equal(view.heldLayer.className, 'held-layer');
  assert.equal(view.heldLayer.innerHTML, heldLayers('fish_out', [fish]));
  view.heldLayer.innerHTML = 'kept';
  assert.equal(drawHeld(view, [fish]), false, 'the same find is not drawn again');
  assert.equal(view.heldLayer.innerHTML, 'kept');
  assert.equal(drawHeld(view, [other]), true);
  assert.equal(view.heldLayer.innerHTML, heldLayers('fish_out', [other]));
  assert.equal(view.button.children.length, 1);
  for (const file of ['src/yard/decor.js', 'src/overlay/wear.js']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /drawHeld\(/, `${file} draws with drawHeld`);
    assert.doesNotMatch(source, /'held-layer'/, `${file} makes no layer of its own`);
  }
});
