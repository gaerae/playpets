import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { setLanguageForTests, t as translate } from '../src/core/i18n.js';
import { systemSouth } from '../src/core/season.js';
import { clueRow, clues, duration } from '../src/panel/album-clues.js';
import { BUGS, FISH, FLOWERS, GIFTS, TREASURES, TREES } from '../src/yard/catalog.js';
import { eventDates } from '../src/yard/events.js';
import { installDom } from './support/dom.mjs';

// How a kind is found is shown in pictures, read aloud as its sentence, in up to three rows that
// never share a line, each under its word: how (steps, one after another), when (what has to be
// so), and more often (what makes it likelier). Every picture carries its word, and nothing is a
// word alone: a place is its own thumbnail, as in the place picker.
const icons = row => row.map(c => c.icon ?? c.image ?? (c.svg ? 'event' : `"${c.text}"`)).join(' ');

test('a flower is dug up as a seed and blooms after its hours, planted in its season', () => {
  const tulip = FLOWERS.find(f => f.season === 'spring');
  const row = clues('flower', tulip);
  assert.equal(icons(row.how), 'dig seeds hourglass');
  assert.equal(row.how.at(-1).text, duration(240 * 60 * 1000), 'its hours, from the garden stages');
  assert.equal(icons(row.when), 'spring', 'its season is when to plant it, not a step');
  assert.deepEqual(row.likely, []);
});

test('a tree grows in its hours, and what makes one likelier is a row of its own', () => {
  const cherry = TREES.find(k => k.id === 'cherry');
  const row = clues('tree', cherry);
  assert.equal(icons(row.how), 'dig tree hourglass');
  assert.deepEqual(row.when, []);
  assert.ok(
    row.likely.some(c => c.icon === 'spring'),
    'a season it likes is its picture',
  );
  for (const p of cherry.affinity?.places || []) {
    const place = row.likely.find(c => c.text === translate(`world.${p}`));
    assert.match(place?.image ?? '', /environments\/previews\/.+\.webp$/, `${p} is the place picker's picture`);
  }
  assert.equal(icons(clues('treasure', TREASURES[0]).how), 'dig');
});

test('a fish is the rod, when it swims, and rain as what makes it likelier', () => {
  const rainy = FISH.find(k => k.rain > 1 && !k.event && k.seasons.length < 4);
  const row = clues('fish', rainy);
  assert.equal(icons(row.how), 'fish');
  for (const s of rainy.seasons)
    assert.ok(
      row.when.some(c => c.icon === s),
      `${s} is drawn`,
    );
  if (rainy.periods.length < 4)
    for (const p of rainy.periods)
      assert.ok(
        row.when.some(c => c.icon === p),
        `${p} is drawn, not written`,
      );
  assert.equal(icons(row.likely), 'rain');
});

test('a bug has no step: only when, in clear weather drawn as weather', () => {
  const row = clues(
    'bug',
    BUGS.find(k => !k.event),
  );
  assert.deepEqual(row.how, []);
  assert.equal(row.when.at(-1).icon, 'clear');
});

// A picture alone is a guess (summer's sunflower could be the flower it grows into, midday's sun the
// clear weather): every clue carries one word under it, a tool's own name where it is a tool, as on
// the strip's buttons. Never a sentence, and never a word without its picture.
test('every clue is a picture with its one word, the tools by the names their buttons have', () => {
  const kinds = [
    ['flower', FLOWERS.find(f => f.season === 'summer')],
    ['tree', TREES.find(k => k.id === 'cherry')],
    ['treasure', TREASURES.find(k => k.affinity?.places?.length)],
    ['fish', FISH.find(k => k.rain > 1 && !k.event && k.seasons.length < 4)],
    ['bug', BUGS.find(k => !k.event)],
  ];
  for (const [book, kind] of kinds) {
    const row = clues(book, kind);
    for (const c of [...row.how, ...row.when, ...row.likely]) {
      assert.ok(c.icon || c.image, `${book} "${c.text}" has a picture`);
      assert.ok(c.text, `${book} ${c.icon} has a word`);
      assert.doesNotMatch(c.text, /[.!?。！？]$/, 'a word, not a sentence');
    }
  }
  const flower = clues('flower', kinds[0][1]);
  assert.deepEqual(
    flower.how.slice(0, 2).map(c => c.text),
    [translate('discovery.dig'), translate('garden.plant')],
  );
  assert.equal(flower.when[0].text, translate('catch.season_summer'));
  assert.equal(clues('fish', kinds[3][1]).how[0].text, translate('catch.action'));
});

// A friend brings an everyday gift on a day the two played, every other day: three steps, the
// button, the days between, the gift. One built (the snowman) keeps its sentence.
test('an everyday gift is play, the days between, then the gift', () => {
  const row = clues(
    'gift',
    GIFTS.find(k => !k.event && !k.built),
  );
  assert.equal(icons(row.how), 'play hourglass gift');
  assert.deepEqual(
    row.how.map(c => c.text),
    [translate('controls.play'), duration(2 * 86_400_000), translate('album.clue_gift')],
  );
  assert.equal(clues('gift', GIFTS.find(k => k.built) ?? { built: true }), null, 'built, not brought');
});

// What comes only at an event shows the event by its own picture and name, then its dates on a
// calendar, then a fish's or a bug's own times as any other's.
test('an event kind is the event and its dates, then its own times', () => {
  const fish = FISH.find(k => k.event),
    row = clues('fish', fish);
  assert.equal(icons(row.how), 'fish');
  assert.equal(row.when[0].text, translate(`event.${fish.event}.name`));
  assert.match(row.when[0].svg, /^<svg /, 'the event in its own picture');
  assert.equal(row.when[1].icon, 'calendar');
  assert.equal(row.when[1].text, eventDates(fish.event, systemSouth()));
  for (const s of fish.seasons.length < 4 ? fish.seasons : [])
    assert.ok(
      row.when.some(c => c.icon === s),
      `${s} is drawn`,
    );
  assert.equal(row.or, undefined, 'the scene that calls it up stays in the sentence');
  const lights = clues(
    'gift',
    GIFTS.find(k => k.event === 'lights'),
  );
  assert.deepEqual(lights.how, []);
  assert.deepEqual(
    lights.when.map(c => c.icon ?? 'event'),
    ['event', 'calendar'],
  );
  const harvest = clues(
    'gift',
    GIFTS.find(k => k.event === 'harvest'),
  );
  assert.equal(harvest.when.at(-1).icon, 'autumn', 'while the yard shows its season');
});

test('hours read in the language without a sentence', () => {
  setLanguageForTests('ja');
  assert.match(duration(4 * 3600 * 1000), /^4\s?時間$/);
  assert.match(duration(2 * 86_400_000), /^2\s?日$/);
  setLanguageForTests('en');
  assert.match(duration(12 * 3600 * 1000), /^12\s?h(r)?$/);
  assert.match(duration(2 * 86_400_000), /^2\s?days?$/);
});

// Each row on a line of its own under its word: steps joined by arrows, then conditions side by side;
// a long row wraps between kinds of clue, never inside one.
test('the rows are drawn apart, each kind of clue kept together where a row wraps', t => {
  installDom(t);
  const tree = clueRow(
    clues(
      'tree',
      TREES.find(k => k.id === 'cherry'),
    ),
    'x',
  );
  assert.deepEqual(
    tree.children.map(r => r.dataset.row),
    ['how', 'likely'],
  );
  // Every row has the same shape at every size: its word on a tag above, then its clues.
  for (const [line, key] of [
    [tree.children[0], 'album.clue_how'],
    [tree.children[1], 'album.clue_likely'],
  ]) {
    assert.equal(line.children[0].className, 'clue-label');
    assert.equal(line.children[0].textContent, translate(key));
    assert.equal(line.children[1].className, 'clue-items');
  }
  // An arrow between each two steps, a place of its own, so a long word never pushes it off its picture.
  assert.deepEqual(
    tree.children[0].children[1].children.map(c => c.className),
    ['clue', 'clue-arrow', 'clue', 'clue-arrow', 'clue'],
  );
  const fish = FISH.find(
    k => !k.event && k.seasons.length > 1 && k.seasons.length < 4 && k.periods.length > 1 && k.periods.length < 4,
  );
  const when = clueRow(clues('fish', fish), 'x').children.find(r => r.dataset.row === 'when');
  assert.equal(when.children[0].textContent, translate('album.clue_when'));
  const groups = when.children[1].children.filter(c => c.className === 'clue-group');
  assert.equal(groups.length, 2, 'the seasons, then the times of day');
  assert.equal(groups[0].children.length, fish.seasons.length);
  assert.equal(groups[1].children.length, fish.periods.length);
});

test('the rows are one picture for a screen reader, saying the whole sentence', t => {
  installDom(t);
  const el = clueRow(clues('flower', FLOWERS[0]), 'Dig up a seed and plant it in spring.');
  assert.equal(el.getAttribute('role'), 'img');
  assert.equal(el.getAttribute('aria-label'), 'Dig up a seed and plant it in spring.');
  assert.equal(el.title, 'Dig up a seed and plant it in spring.');
});
