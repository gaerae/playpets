// The year-end letter's rules without the page (src/yard/letter.js): when it is written and read,
// who writes it, and the true things it says. Dates are built locally so no test reads the clock.

import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import './support/content.mjs';
import { list, t } from '../src/core/i18n.js';
import {
  bringerOf,
  composeLetter,
  factLines,
  letterFacts,
  letterTime,
  letterYear,
  readableLetter,
  writerOf,
} from '../src/yard/letter.js';

const d = (y, m, day, h = 12) => new Date(y, m - 1, day, h);

test('the letter comes from December 26 and comes back from January 1 to 7', () => {
  assert.equal(letterTime(d(2026, 12, 25)), null);
  assert.equal(letterTime(d(2026, 12, 26, 0)), 'write');
  assert.equal(letterTime(d(2026, 12, 31, 23)), 'write');
  assert.equal(letterTime(d(2027, 1, 1, 0)), 'back');
  assert.equal(letterTime(d(2027, 1, 7, 23)), 'back');
  assert.equal(letterTime(d(2027, 1, 8, 0)), null);
  assert.equal(letterYear(d(2027, 1, 3)), 2026);
  assert.equal(letterYear(d(2026, 12, 30)), 2026);
  const letters = [{ year: 2026, friend: 'a', text: 'hi', answer: null, at: 1 }];
  assert.equal(readableLetter(letters, d(2026, 12, 27))?.year, 2026);
  assert.equal(readableLetter(letters, d(2027, 1, 7))?.year, 2026);
  assert.equal(readableLetter(letters, d(2027, 1, 8)), null);
  assert.equal(readableLetter(letters, d(2026, 12, 25)), null, 'not yet');
  assert.equal(readableLetter([{ ...letters[0], text: '' }], d(2026, 12, 27)), null, 'deleted');
});

test('the closest friend writes, and the one earlier in the list on a tie', () => {
  const pets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(writerOf(pets, { b: { points: 300 }, c: { points: 300 } }).id, 'b');
  assert.equal(writerOf(pets, {}).id, 'a', 'no bonds yet: the first friend');
  assert.equal(writerOf([], {}), null);
});

test('the friend who wrote brings the answer back, or the closest one if it left', () => {
  const pets = [{ id: 'a' }, { id: 'b' }];
  assert.equal(bringerOf({ friend: 'a' }, pets, { b: { points: 9 } }).id, 'a');
  assert.equal(bringerOf({ friend: 'gone' }, pets, { b: { points: 9 } }).id, 'b');
});

test('the facts are this year’s, and days since meeting only when known', () => {
  const at = (y, m, day) => d(y, m, day).getTime();
  const album = {
    fish: { koi: { count: 1, first: at(2026, 3, 1) } },
    bugs: { ant: { count: 2, first: at(2025, 6, 1) } },
    flowers: { tulip: { count: 1, first: at(2026, 9, 1) } },
    secrets: { wish: { count: 1, first: at(2026, 10, 1) } },
  };
  const trees = [
    { kind: 'cherry', planted: at(2026, 4, 1), matured: true },
    { kind: 'pine', planted: at(2026, 8, 1), matured: false },
  ];
  const f = letterFacts({
    album,
    trees,
    bond: { points: 300, met: '2026-12-01' },
    level: 3,
    year: 2026,
    today: '2026-12-27',
  });
  assert.deepEqual(f, { finds: 2, newest: { book: 'flowers', id: 'tulip' }, tree: 'cherry', level: 3, days: 26 });
  assert.equal(
    letterFacts({ album: {}, trees: [], bond: { points: 0 }, level: 1, year: 2026, today: '2026-12-27' }).days,
    null,
  );
  assert.equal(
    letterFacts({ album: {}, trees: [], bond: { met: '2027-01-01' }, level: 1, year: 2026, today: '2026-12-27' }).days,
    null,
    'a clock set ahead',
  );
});

test('the footprint book counts too, and the newest find can be a track', () => {
  const at = (y, m, day) => d(y, m, day).getTime();
  const album = {
    fish: { koi: { count: 1, first: at(2026, 3, 1) } },
    tracks: { fox: { count: 1, first: at(2026, 12, 20) } },
  };
  const f = letterFacts({ album, trees: [], bond: {}, level: 1, year: 2026, today: '2026-12-27' });
  assert.equal(f.finds, 2);
  assert.deepEqual(f.newest, { book: 'tracks', id: 'fox' });
  const lines = factLines({ finds: 1, newest: f.newest, tree: null, level: 1, days: null });
  assert.equal(lines[0], t('letter.fact_finds_one', { thing: t('track.fox') }));
});

test('the letter says only what is true, and asks about the year and the next', () => {
  mock.method(Math, 'random', () => 0);
  try {
    const lines = factLines({ finds: 0, newest: null, tree: null, level: 5, days: null });
    assert.deepEqual(lines, [t('letter.fact_close_5')]);
    const full = factLines({ finds: 2, newest: { book: 'flowers', id: 'tulip' }, tree: 'cherry', level: 3, days: 1 });
    assert.deepEqual(full, [
      t('letter.fact_finds', { count: 2, thing: t('garden.kind_tulip') }),
      t('letter.fact_tree', { tree: t('tree.cherry') }),
      t('letter.fact_close_3'),
      t('letter.fact_days_one', { days: 1 }),
    ]);
    const text = composeLetter(lines, 'more hikes');
    assert.equal(text.split('\n')[0], list('letter.hello')[0]);
    assert.ok(text.includes(t('letter.recall', { answer: 'more hikes' })));
    assert.equal(text.split('\n').at(-1), t('letter.ask'));
    assert.ok(!composeLetter(lines, null).includes('more hikes'));
  } finally {
    mock.restoreAll();
  }
});

test('every closeness level has its line', () => {
  for (let level = 1; level <= 5; level++)
    assert.deepEqual(factLines({ finds: 0, newest: null, tree: null, level, days: null }), [
      t(`letter.fact_close_${level}`),
    ]);
});

async function letterEntries(lang) {
  const { strings } = await import(`../src/core/strings/${lang}.js`);
  return Object.entries(strings).filter(([key]) => key.startsWith('letter.'));
}

test('no letter line asks whether a plan was done', async () => {
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    const entries = await letterEntries(lang);
    assert.ok(entries.length > 0, `${lang} has letter strings`);
    for (const [key, value] of entries)
      assert.ok(
        !/did you|have you done|했어[?？]|했니|した[?？]|できた[?？]|做了吗|完成了吗/i.test([value].flat().join(' ')),
        `${lang} ${key}`,
      );
  }
});
