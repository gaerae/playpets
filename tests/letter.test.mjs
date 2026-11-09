// The year-end letter (src/yard/letter.js): when it is written and read, who writes it, the true
// things it says, and how it comes on the first day open from December 26. Dates are built locally
// and the clock is the test's, so no test reads the real one.

import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const writes = [],
  clears = [],
  backs = [];
const write = (year, friend, _facts, text) => ({ ok: true, data: { year, friend, text, answer: null, at: 1 } });
// What writeLetter answers in a test; by default the page's own letter is kept.
let writing = write;
// What letterBack answers.
let bringing = () => ({ ok: true, data: null });
globalThis.playPets = {
  writeLetter: async (...args) => {
    writes.push(args);
    return writing(...args);
  },
  // The backend's rule (pets/letters.rs clear_ended): text goes after January 7 by the page's date.
  clearLetters: async today => {
    clears.push(today);
    const letters = state.data.letters.map(letter =>
      today > `${letter.year + 1}-01-07` ? { ...letter, text: '' } : letter,
    );
    return { ok: true, data: letters };
  },
  letterBack: async year => {
    backs.push(year);
    return bringing(year);
  },
  // Not asked for in a test of the letter: the card answers it (letter-card.js).
  answerLetter: async () => assert.fail('answerLetter'),
  moveDecor: async () => ({ ok: true, data: null }),
  hideDecor: async () => ({ ok: true, data: null }),
};
// The namespace, not a copy: setData replaces `data`.
const state = await import('../src/core/state.js');
const { list, t } = await import('../src/core/i18n.js');
const { levelOf } = await import('../src/yard/bond.js');
const { markDecor, setupDecor } = await import('../src/yard/decor.js');
const {
  bringerOf,
  composeLetter,
  factLines,
  letterFacts,
  letterPress,
  letterReadable,
  letterTime,
  letterYear,
  readableLetter,
  setupLetters,
  writerOf,
} = await import('../src/yard/letter.js');
const { drawYard } = await import('./support/yard.mjs');

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

// How the letter comes. Two friends, b the closer; a check is the scene's minute repaint.
const flush = () => new Promise(resolve => setImmediate(resolve));
const PETS = [
  { id: 'a', name: 'Mochi', size: 96 },
  { id: 'b', name: 'Daisy', size: 96 },
];
const BONDS = { a: { points: 50 }, b: { points: 600, met: '2026-03-14' } };
const friendView = pet => ({
  pet,
  asset: { id: pet.id, version: 2 },
  bubble: element('span', { hidden: true }),
  x: 0.5,
  y: 0.5,
  px: 300,
  py: 300,
  look: null,
  pose: 'idle',
  until: 0,
  target: null,
  trip: null,
});
// The state and the friends in the yard, `writing` reset and the calls forgotten.
function friends(ctx, { pets = PETS, bonds = BONDS, letters = [] } = {}) {
  Object.assign(state.data, { pets, bonds, letters, album: {}, assets: [] });
  state.data.garden ??= { decor: [], plants: [], trees: [], boxed: [] };
  state.views.clear();
  ctx.after(() => state.views.clear());
  for (const pet of pets) state.views.set(pet.id, friendView(pet));
  writes.length = 0;
  clears.length = 0;
  backs.length = 0;
  writing = write;
  bringing = () => ({ ok: true, data: null });
}
// A page at `now` with the letter's ways in; `open` records the years opened.
function page(ctx, { now = d(2026, 12, 27, 10), ...rest } = {}) {
  // A test may open the page more than once, each time at its own date.
  ctx.mock.timers.reset();
  ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: now.getTime() });
  const { nodes } = installDom(ctx, { anyId: true });
  installStorage(ctx);
  state.setData({ ...state.data, garden: { decor: [], plants: [], trees: [], boxed: [] } });
  friends(ctx, rest);
  const opened = [];
  const check = setupLetters({ open: year => opened.push(year) });
  return { check, opened, $: id => nodes.get(id) ?? document.getElementById(id) };
}
const bubbleOf = id => state.views.get(id).bubble;

test('the letter is written on the first check from December 26 with the closest friend\u2019s facts', async ctx => {
  const { check, opened, $ } = page(ctx);
  check();
  assert.equal(writes.length, 0, 'the first check only arms');
  check();
  await flush();
  assert.equal(writes.length, 1);
  const [year, friend, lines, text] = writes[0];
  const facts = letterFacts({
    album: {},
    trees: [],
    bond: BONDS.b,
    level: levelOf('b'),
    year: 2026,
    today: '2026-12-27',
  });
  assert.deepEqual([year, friend, lines], [2026, 'b', factLines(facts)]);
  assert.ok(text.endsWith(t('letter.ask')));
  assert.equal(state.data.letters.length, 1, 'kept at once');
  assert.equal($('letter-chip').hidden, false);
  assert.ok(letterReadable());
  const said = bubbleOf('b');
  assert.ok(list('letter.bubble').includes(said.textContent));
  assert.equal(said.hidden, false);
  assert.ok(said.classList.contains('acts'), 'the bubble can be pressed');
  said.onclick({ stopPropagation() {} });
  assert.deepEqual(opened, [2026]);
  $('letter-chip').onclick();
  assert.deepEqual(opened, [2026, 2026], 'the chip opens it too');
  assert.equal(bubbleOf('a').hidden, true, 'only the writer says so');
});

test('a later bubble of the same friend is not pressable', async ctx => {
  const { check } = page(ctx);
  check();
  check();
  await flush();
  const { bubble } = await import('../src/yard/views.js');
  bubble(state.views.get('b'), 'Hello');
  assert.ok(!bubbleOf('b').classList.contains('acts'));
  assert.equal(bubbleOf('b').onclick, null);
});

test('a second check while the letter is being written asks nothing', async ctx => {
  const { check } = page(ctx);
  let done;
  check();
  writing = (...args) => new Promise(resolve => (done = () => resolve(write(...args))));
  check();
  check();
  check();
  assert.equal(writes.length, 1);
  done();
  await flush();
  check();
  assert.equal(writes.length, 1, 'written: not asked again');
});

test('a write the backend asks to wait for is tried again at the next check, with nothing on screen', async ctx => {
  const { check, $ } = page(ctx);
  check();
  writing = () => ({ ok: false, error: 'Still answering. Try again in a moment.' });
  check();
  await flush();
  assert.equal(writes.length, 1);
  assert.equal(state.data.letters.length, 0);
  assert.equal($('letter-chip').hidden, true);
  assert.equal($('toast').children.length, 0, 'no notice');
  assert.equal(bubbleOf('b').hidden, true);
  writing = write;
  check();
  await flush();
  assert.equal(writes.length, 2);
  assert.equal($('letter-chip').hidden, false);
});

test('the letter is delivered by the friend the backend kept it from, and only with its text', async ctx => {
  const { check, $ } = page(ctx);
  check();
  writing = year => ({ ok: true, data: { year, friend: 'a', text: 'Hi', answer: null, at: 1 } });
  check();
  await flush();
  assert.ok(list('letter.bubble').includes(bubbleOf('a').textContent));
  assert.equal(bubbleOf('b').hidden, true);
  // A letter deleted meanwhile (another window) comes back empty: nobody says a word.
  friends(ctx);
  writing = year => ({ ok: true, data: { year, friend: '', text: '', answer: null, at: 1 } });
  check();
  await flush();
  assert.equal(bubbleOf('a').hidden, true);
  assert.equal(bubbleOf('b').hidden, true);
  assert.equal($('letter-chip').hidden, true);
});

test('not before December 26, and once a year', async ctx => {
  let { check } = page(ctx, { now: d(2026, 12, 25, 10) });
  check();
  check();
  await flush();
  assert.equal(writes.length, 0, 'not yet');
  ({ check } = page(ctx, {
    now: d(2026, 12, 28, 10),
    letters: [{ year: 2026, friend: 'b', text: 'Hi', answer: null, at: 1 }],
  }));
  check();
  check();
  await flush();
  assert.equal(writes.length, 0, 'this year has its letter');
  ({ check } = page(ctx, {
    now: d(2027, 12, 26, 10),
    letters: [{ year: 2026, friend: 'b', text: '', answer: 'more hikes', at: 1 }],
  }));
  check();
  check();
  await flush();
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 2027);
  assert.ok(writes[0][3].includes(t('letter.recall', { answer: 'more hikes' })), 'last year\u2019s answer');
});

test('a deleted letter is not written again that year', async ctx => {
  const { check, $ } = page(ctx, {
    now: d(2026, 12, 28, 10),
    letters: [{ year: 2026, friend: '', text: '', answer: null, at: 1 }],
  });
  check();
  check();
  await flush();
  assert.equal(writes.length, 0);
  assert.equal($('letter-chip').hidden, true);
  assert.equal(letterReadable(), false);
});

test('the first check shows a letter already there at once, and writes nothing', ctx => {
  const { check, $ } = page(ctx, {
    now: d(2027, 1, 2, 10),
    letters: [{ year: 2026, friend: 'b', text: 'Hi', answer: null, at: 1 }],
  });
  // As index.html has it before the first check.
  $('letter-chip').hidden = true;
  check();
  assert.equal($('letter-chip').hidden, false);
  assert.equal(writes.length, 0);
});

test('the chip opens the letter until January 7', async ctx => {
  const letters = [{ year: 2026, friend: 'b', text: 'Hi', answer: null, at: 1 }];
  const { check, $ } = page(ctx, { now: d(2027, 1, 7, 23), letters });
  check();
  assert.equal($('letter-chip').hidden, false);
  ctx.mock.timers.setTime(new Date(2027, 0, 8, 0, 1).getTime());
  check();
  assert.equal($('letter-chip').hidden, true);
  assert.equal(letterReadable(), false);
});

test('nothing while the window is hidden, or with no friends', async ctx => {
  let { check, $ } = page(ctx);
  document.hidden = true;
  check();
  check();
  await flush();
  assert.equal(writes.length, 0, 'hidden');
  document.hidden = false;
  ({ check, $ } = page(ctx, { pets: [] }));
  check();
  check();
  await flush();
  assert.equal(writes.length, 0, 'no friends');
  assert.equal($('letter-chip').hidden, true);
  // The window the backend hid (visible() from app.js) counts as hidden too.
  friends(ctx);
  const quiet = setupLetters({ open() {}, visible: () => false });
  quiet();
  quiet();
  await flush();
  assert.equal(writes.length, 0, 'not seen');
});

test('with a mailbox the letter waits there, and a press on it opens the letter', async ctx => {
  const opened = [];
  ctx.after(() => {
    markDecor('mailbox', null);
    setupDecor();
  });
  const y = await drawYard(ctx, {
    now: d(2026, 12, 27, 10).getTime(),
    art: ['decor/mailbox.svg'],
    garden: { decor: [{ id: 'box', kind: 'mailbox', x: 0.6, y: 0.6 }], received: ['mailbox'] },
    setup: () => setupDecor({ press: { mailbox: { take: letterPress } } }),
    before: () => friends(ctx),
  });
  const check = setupLetters({ open: year => opened.push(year) });
  const mailbox = () => y.shown().find(b => b.dataset.kind === 'mailbox');
  check();
  check();
  await flush();
  assert.equal(writes.length, 1);
  assert.equal(mailbox().dataset.mark, 'letter');
  const said = bubbleOf('b');
  assert.ok(list('letter.mailbox_bubble').includes(said.textContent));
  assert.ok(!said.classList.contains('acts'), 'the mailbox is the way in');
  assert.equal(mailbox().title, t('decor.title', { kind: t('decor.kind_mailbox') }), 'not a thing to decorate');
  const press = async () => {
    await mailbox().dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    await mailbox().dispatch('pointerup', { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  };
  await press();
  assert.deepEqual(opened, [2026]);
  assert.ok(
    [...state.views.values()].every(v => !v.target),
    'no friend walks over',
  );
  state.remember('letter-opened-2026', '1');
  check();
  assert.equal(mailbox().dataset.mark, undefined, 'read: the mark goes');
  await press();
  assert.deepEqual(opened, [2026, 2026], 'a press still opens it');
  let prevented = false;
  await mailbox().dispatch('keydown', { key: 'Enter', preventDefault: () => (prevented = true) });
  assert.deepEqual(opened, [2026, 2026, 2026], 'Enter opens it too');
  assert.ok(prevented);
});

test('the yard menu offers the letter while one is there to read', async ctx => {
  const { closeControls, setupControls } = await import('../src/core/controls.js');
  keepGlobals(ctx, 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 1000;
  globalThis.innerHeight = 700;
  const { nodes } = installDom(ctx);
  const context = element('div', { id: 'yard-context-menu', hidden: true, rect: { width: 200, height: 160 } });
  for (const node of [element('div', { id: 'yard' }), element('button', { id: 'compact-launcher' }), context])
    nodes.set(node.id, node);
  const row = element('button', { dataset: { contextFor: 'yard', contextAction: 'letter' } });
  const other = element('button', { dataset: { contextFor: 'yard', contextAction: 'scene' } });
  context.append(row, other);
  let readable = false;
  const opened = [];
  setupControls({ letterReadable: () => readable, openLetter: () => opened.push('open') });
  await nodes.get('yard').dispatch('contextmenu', { clientX: 20, clientY: 20 });
  assert.equal(row.hidden, true);
  assert.equal(other.hidden, false);
  closeControls(false);
  readable = true;
  await nodes.get('compact-launcher').dispatch('pointerdown');
  await nodes.get('compact-launcher').dispatch('click');
  assert.equal(row.hidden, false, 'the small window\u2019s menu too');
  await context.dispatch('click', { target: row });
  assert.deepEqual(opened, ['open']);
});

test('a letter past January 7 has its text cleared by the backend once, and kept after', async ctx => {
  const letters = [
    { year: 2025, friend: 'b', text: '', answer: 'more hikes', at: 1 },
    { year: 2026, friend: 'b', text: 'Hi', answer: 'camping', at: 2 },
  ];
  const { check } = page(ctx, { now: d(2027, 1, 7, 23), letters });
  check();
  check();
  await flush();
  assert.deepEqual(clears, [], 'still its season');
  ctx.mock.timers.setTime(new Date(2027, 0, 8, 0, 1).getTime());
  check();
  check();
  await flush();
  assert.deepEqual(clears, ['2027-01-08']);
  assert.equal(state.data.letters.find(letter => letter.year === 2026).text, '', 'the page holds the answer');
  assert.equal(state.data.letters.find(letter => letter.year === 2026).answer, 'camping');
  check();
  await flush();
  assert.deepEqual(clears, ['2027-01-08'], 'nothing left to clear: not asked every minute');
});

test('the text is cleared while the window is hidden too, and nothing else happens', async ctx => {
  const { check } = page(ctx, {
    now: d(2027, 3, 1, 9),
    letters: [{ year: 2026, friend: 'b', text: 'Hi', answer: null, at: 1 }],
  });
  const doc = document;
  doc.hidden = true;
  // Put back even when an assertion fails (the fake document goes when the test ends anyway).
  ctx.after(() => (doc.hidden = false));
  check();
  await flush();
  assert.deepEqual(clears, ['2027-03-01']);
  assert.equal(writes.length, 0);
});

test('a letter that comes while the window hid is not said, and its ways in still lead to it', async ctx => {
  const { $ } = page(ctx);
  let seen = true,
    done;
  const check = setupLetters({ open() {}, visible: () => seen });
  check();
  writing = (...args) => new Promise(resolve => (done = () => resolve(write(...args))));
  check();
  seen = false;
  done();
  await flush();
  assert.equal(state.data.letters.length, 1, 'kept');
  assert.equal(bubbleOf('b').hidden, true, 'nobody there to hear it');
  assert.equal($('letter-chip').hidden, false);
});

test('a failure after the letter came is not left unhandled, and the check goes on', async ctx => {
  const unhandled = [];
  const record = reason => unhandled.push(reason);
  process.on('unhandledRejection', record);
  ctx.after(() => process.off('unhandledRejection', record));
  const { check } = page(ctx);
  // A friend whose bubble cannot be drawn: saying the letter throws.
  state.views.get('b').bubble = null;
  check();
  check();
  await flush();
  await flush();
  assert.deepEqual(unhandled, []);
  assert.equal(state.data.letters.length, 1);
  check();
  await flush();
  assert.equal(writes.length, 1, 'not busy for good, and not asked again');
});

// In the New Year. The card is the real one (card.js); its words are read from its two lines.
function newYear(ctx, { now = d(2027, 1, 2, 9), answer = 'Go camping <b>more</b>', friend = 'a', ...rest } = {}) {
  const letters = [{ year: 2026, friend, text: 'hi', answer, at: 1 }];
  const opened = page(ctx, { now, letters, ...rest });
  const card = opened.$('catch-card'),
    title = element('strong'),
    detail = element('small'),
    cheering = element('small');
  const slots = { strong: title, small: detail, '.catch-new': cheering };
  // Hidden as index.html has it; its slots are the three lines read below.
  Object.assign(card, { hidden: true, querySelector: selector => slots[selector] ?? element() });
  return { ...opened, card, title, detail, cheering };
}

test('on the first day open in the New Year the friend quotes the answer and cheers', async ctx => {
  const { check, card, title, detail, cheering } = newYear(ctx);
  check();
  assert.equal(card.hidden, true, 'the first check only arms');
  check();
  await flush();
  assert.equal(card.hidden, false);
  assert.equal(title.textContent, t('letter.back_title', { name: 'Mochi' }));
  assert.equal(detail.textContent, t('letter.back_quote', { answer: 'Go camping <b>more</b>' }), 'plain text');
  // A line of its own, so a long answer shortened to four lines (play.css) never hides it.
  assert.equal(cheering.textContent, t('letter.back_cheer'));
  assert.ok(list('letter.back_bubble').includes(bubbleOf('a').textContent));
  assert.equal(state.views.get('a').pose, 'jump');
  assert.deepEqual(backs, [2026], 'kept once it showed');
  assert.equal(state.data.letters[0].back, true);
  card.hidden = true;
  check();
  await flush();
  assert.equal(card.hidden, true, 'once');
  // The next start: the backend kept it.
  const again = setupLetters({ open() {} });
  again();
  again();
  await flush();
  assert.equal(card.hidden, true, 'not after a restart either');
  assert.deepEqual(backs, [2026]);
  assert.equal(writes.length, 0);
});

test('a friend that left: the closest one brings it back', async ctx => {
  const { check, title } = newYear(ctx, {
    friend: 'gone',
    pets: [
      { id: 'a', name: 'Mochi', size: 96 },
      { id: 'b', name: 'Daisy', size: 96 },
    ],
    bonds: { a: { points: 0 }, b: { points: 50 } },
  });
  check();
  check();
  await flush();
  assert.equal(title.textContent, t('letter.back_title', { name: 'Daisy' }));
  assert.ok(list('letter.back_bubble').includes(bubbleOf('b').textContent));
});

test('no answer, no cheer, and the letter still opens until January 7', async ctx => {
  const { check, card, $ } = newYear(ctx, { now: d(2027, 1, 1, 0), answer: null });
  check();
  check();
  await flush();
  assert.equal(card.hidden, true);
  assert.equal($('letter-chip').hidden, false);
  assert.deepEqual(backs, []);
  ctx.mock.timers.setTime(new Date(2027, 0, 8, 0, 1).getTime());
  check();
  check();
  await flush();
  assert.equal($('letter-chip').hidden, true);
  assert.equal(card.hidden, true);
});

test('no cheer while the window is hidden, or with no friends', async ctx => {
  let { check, card } = newYear(ctx);
  const doc = document;
  doc.hidden = true;
  ctx.after(() => (doc.hidden = false));
  check();
  check();
  await flush();
  assert.equal(card.hidden, true, 'hidden');
  doc.hidden = false;
  ({ check, card } = newYear(ctx, { pets: [] }));
  check();
  check();
  await flush();
  assert.equal(card.hidden, true, 'no friends');
  assert.deepEqual(backs, []);
});

test('a card that gave way in the queue is not kept as brought back, and comes once a run', async ctx => {
  newYear(ctx);
  const cards = [];
  // A card queue that drops the card: shown() never comes.
  const check = setupLetters({ open() {}, card: (...args) => cards.push(args) });
  check();
  check();
  check();
  await flush();
  assert.equal(cards.length, 1, 'asked for once this run');
  assert.equal(bubbleOf('a').hidden, true, 'the cheer comes with the card');
  assert.deepEqual(backs, [], 'never shown: not kept');
  assert.equal(state.data.letters[0].back, undefined);
  // The next start brings it again.
  const next = setupLetters({ open() {}, card: (...args) => cards.push(args) });
  next();
  next();
  await flush();
  assert.equal(cards.length, 2);
});

test('a card shown to a window hidden meanwhile is not kept, and one not kept is tried again', async ctx => {
  newYear(ctx);
  const cards = [];
  let seen = true;
  const check = setupLetters({ open() {}, visible: () => seen, card: (...args) => cards.push(args) });
  check();
  check();
  seen = false;
  cards[0][5]();
  await flush();
  assert.deepEqual(backs, [], 'nobody saw it');
  assert.equal(bubbleOf('a').hidden, true, 'nor heard it');
  seen = true;
  check();
  assert.equal(cards.length, 1, 'not again this run');
  // Keeping it failed: the next check shows it again and asks again.
  const retry = setupLetters({ open() {}, card: (...args) => cards.push(args) });
  bringing = () => ({ ok: false, error: 'Could not save.' });
  retry();
  retry();
  cards[1][5]();
  await flush();
  assert.deepEqual(backs, [2026]);
  assert.equal(state.data.letters[0].back, undefined);
  retry();
  assert.equal(cards.length, 3, 'tried again');
  bringing = () => ({ ok: true, data: null });
  cards[2][5]();
  await flush();
  assert.deepEqual(backs, [2026, 2026]);
  assert.equal(state.data.letters[0].back, true);
  retry();
  assert.equal(cards.length, 3);
});

test('a save that keeps failing is tried again once a run, so the card never comes every minute', async ctx => {
  newYear(ctx);
  const cards = [];
  const check = setupLetters({ open() {}, card: (...args) => cards.push(args) });
  bringing = () => ({ ok: false, error: 'Could not save.' });
  check();
  check();
  cards[0][5]();
  await flush();
  check();
  assert.equal(cards.length, 2, 'tried again once');
  cards[1][5]();
  await flush();
  check();
  check();
  assert.equal(cards.length, 2, 'not a third time this run');
  assert.deepEqual(backs, [2026, 2026]);
});
