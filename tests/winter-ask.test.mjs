// Most people keep the yard in spring, so in December the yard asks once whether to show winter
// until January 7; on January 8 the season before comes back (the backend keeps the answer).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const answers = [],
  ends = [];
let endsWith = 'spring';
globalThis.playPets = {
  answerWinter: async (...args) => {
    answers.push(args);
    return { ok: true, data: null };
  },
  endWinter: async (...args) => {
    ends.push(args);
    return { ok: true, data: endsWith };
  },
};
// The namespace, not a copy: setData replaces `data`.
const state = await import('../src/core/state.js');
const { seasonPickedByHand, setupWinter, winterAsk, winterOver } = await import('../src/yard/winter.js');
const { scene } = await import('../src/yard/world.js');

const d = (y, m, day) => new Date(y, m - 1, day, 12);
const flush = () => new Promise(resolve => setImmediate(resolve));

test('December asks once a year, in a place with seasons, when the yard is not winter', () => {
  assert.equal(winterAsk(d(2026, 12, 5), false, 'spring', null, true), true);
  assert.equal(winterAsk(d(2026, 12, 5), false, 'winter', null, true), false);
  assert.equal(winterAsk(d(2026, 12, 5), false, 'auto', null, true), false, 'auto is winter in the north');
  assert.equal(winterAsk(d(2026, 12, 5), true, 'auto', null, true), true, 'auto is summer in the south');
  assert.equal(winterAsk(d(2026, 12, 5), false, 'spring', { year: 2026, previous: null }, true), false);
  assert.equal(winterAsk(d(2027, 12, 5), false, 'spring', { year: 2026, previous: null }, true), true);
  assert.equal(winterAsk(d(2026, 11, 30), false, 'spring', null, true), false);
  assert.equal(winterAsk(d(2027, 1, 3), false, 'spring', null, true), false);
  assert.equal(winterAsk(d(2026, 12, 5), false, 'spring', null, false), false, 'not in the studio');
});

test('the season before comes back from January 8 of the next year', () => {
  const asked = { year: 2026, previous: 'spring' };
  assert.equal(winterOver(new Date(2027, 0, 7, 23, 59), asked), false);
  assert.equal(winterOver(new Date(2027, 0, 8, 0, 0), asked), true);
  assert.equal(winterOver(d(2027, 2, 10), asked), true, 'the first open after a long time');
  assert.equal(winterOver(d(2026, 12, 31), asked), false);
  assert.equal(winterOver(d(2027, 2, 10), { year: 2026, previous: null }), false);
});

// A yard on the given date, with fakes for the question and for showing a season.
function yard(t, { now, answer = true, world = 'woodland', asked = null, visible }) {
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  const { document } = installDom(t);
  scene.world = world;
  state.setData({ ...state.data, winterAsked: asked });
  answers.length = 0;
  ends.length = 0;
  const asks = [],
    shown = [];
  const check = setupWinter({
    choice: () => 'spring',
    show: season => shown.push(season),
    ask: question => {
      asks.push(question);
      return typeof answer === 'boolean' ? Promise.resolve(answer) : answer;
    },
    south: false,
    ...(visible ? { visible } : {}),
  });
  return { check, asks, shown, document };
}

test('a yes shows winter and keeps the season before, and the next check does not ask', async t => {
  const { check, asks, shown } = yard(t, { now: d(2026, 12, 5) });
  check();
  await flush();
  assert.equal(asks.length, 0, 'the start-up paint only arms the check');
  check();
  await flush();
  assert.equal(asks.length, 1);
  assert.deepEqual(answers, [[2026, 'spring']]);
  assert.deepEqual(shown, ['winter']);
  assert.deepEqual(state.data.winterAsked, { year: 2026, previous: 'spring' });
  check();
  await flush();
  assert.equal(asks.length, 1, 'asked once');
});

test('keeping the season is remembered and changes nothing', async t => {
  const { check, asks, shown } = yard(t, { now: d(2026, 12, 5), answer: false });
  check();
  check();
  await flush();
  assert.equal(asks.length, 1);
  assert.deepEqual(answers, [[2026, null]]);
  assert.deepEqual(shown, []);
  assert.deepEqual(state.data.winterAsked, { year: 2026, previous: null });
});

test('after January 7 the backend brings the season back and the yard shows it', async t => {
  endsWith = 'spring';
  const { check, asks, shown } = yard(t, {
    now: new Date(2027, 0, 8, 9),
    asked: { year: 2026, previous: 'spring' },
  });
  check();
  check();
  await flush();
  assert.equal(ends.length, 1);
  assert.deepEqual(shown, ['spring']);
  assert.equal(state.data.winterAsked.previous, null);
  assert.equal(asks.length, 0);
});

test('nothing is asked while the window is hidden or in the studio', async t => {
  const hidden = yard(t, { now: d(2026, 12, 5) });
  hidden.document.hidden = true;
  hidden.check();
  hidden.check();
  await flush();
  assert.equal(hidden.asks.length, 0, 'not while the window is hidden');
  t.mock.timers.reset();
  const studio = yard(t, { now: d(2026, 12, 5), world: 'studio' });
  studio.check();
  studio.check();
  await flush();
  assert.equal(studio.asks.length, 0, 'not in the studio');
  assert.deepEqual(answers, []);
  t.mock.timers.reset();
  const unseen = yard(t, { now: d(2026, 12, 5), visible: () => false });
  unseen.check();
  unseen.check();
  await flush();
  assert.equal(unseen.asks.length, 0, 'not while the app says the yard is hidden or minimized');
});

test('a hidden yard still brings the season back on January 8', async t => {
  endsWith = 'spring';
  const { check, asks, shown, document } = yard(t, {
    now: new Date(2027, 0, 8, 9),
    asked: { year: 2026, previous: 'spring' },
  });
  document.hidden = true;
  check();
  check();
  await flush();
  assert.equal(ends.length, 1);
  assert.deepEqual(shown, ['spring']);
  assert.equal(state.data.winterAsked.previous, null);
  assert.equal(asks.length, 0);
});

test('opened after January 7, the season before comes back at the first paint', async t => {
  endsWith = 'spring';
  const { check, asks, shown } = yard(t, {
    now: d(2027, 1, 9),
    asked: { year: 2026, previous: 'spring' },
  });
  check();
  await flush();
  assert.equal(ends.length, 1, 'not a minute of winter left over');
  assert.deepEqual(shown, ['spring']);
  assert.equal(asks.length, 0);
});

test('the start-up paint only delays the question, even in December', async t => {
  const { check, asks } = yard(t, { now: d(2026, 12, 5) });
  check();
  await flush();
  assert.equal(asks.length, 0);
  assert.equal(ends.length, 0);
});

test('nothing is asked while the person types or another dialog is open', async t => {
  const typing = yard(t, { now: d(2026, 12, 5) });
  for (const field of [
    typing.document.createElement('input'),
    typing.document.createElement('textarea'),
    typing.document.createElement('div'),
  ]) {
    if (field.localName === 'div') field.isContentEditable = true;
    field.focus();
    typing.check();
    typing.check();
    await flush();
    assert.equal(typing.asks.length, 0, `not while a ${field.localName} has focus`);
  }
  typing.document.body.focus?.();
  typing.document.activeElement = typing.document.body;
  const dialog = typing.document.createElement('dialog');
  typing.document.body.append(dialog);
  dialog.showModal();
  typing.check();
  await flush();
  assert.equal(typing.asks.length, 0, 'not over another dialog');
  dialog.close();
  typing.check();
  await flush();
  assert.equal(typing.asks.length, 1, 'asked once the person is free');
});

test('a person typing still gets the season back on January 8', async t => {
  endsWith = 'spring';
  const { check, shown, document } = yard(t, {
    now: new Date(2027, 0, 8, 9),
    asked: { year: 2026, previous: 'spring' },
  });
  document.createElement('input').focus();
  check();
  await flush();
  assert.deepEqual(shown, ['spring']);
});

test('a question still open is not asked again', async t => {
  const { check, asks } = yard(t, { now: d(2026, 12, 5), answer: new Promise(() => {}) });
  check();
  check();
  await flush();
  check();
  check();
  await flush();
  assert.equal(asks.length, 1);
  assert.deepEqual(answers, []);
});

test("a season picked by hand during the lights is this year's answer, so nothing is asked after", async t => {
  const { check, asks, shown } = yard(t, { now: d(2026, 12, 5) });
  seasonPickedByHand('winter', new Date(), false);
  seasonPickedByHand('auto', new Date(), false);
  await flush();
  assert.deepEqual(answers, [], 'winter (Auto in the north) needs no answer');
  assert.equal(state.data.winterAsked, null);
  seasonPickedByHand('spring', new Date(), false);
  await flush();
  assert.deepEqual(answers, [[2026, null]]);
  assert.deepEqual(state.data.winterAsked, { year: 2026, previous: null });
  check();
  check();
  await flush();
  assert.equal(asks.length, 0);
  assert.deepEqual(shown, []);
  seasonPickedByHand('summer', new Date(), false);
  await flush();
  assert.equal(answers.length, 1, 'answered once a year');
});

test('a season picked by hand outside the lights answers nothing', async t => {
  yard(t, { now: d(2026, 11, 30) });
  seasonPickedByHand('spring', new Date(), false);
  await flush();
  assert.deepEqual(answers, []);
  assert.equal(state.data.winterAsked, null);
});

// Japanese and Chinese lines may break between any two characters, so "1月8日" could end one line
// with "1"; a word joiner (U+2060) inside each date keeps it whole (WebKit's keep-all would stop
// every break in the sentence instead).
test('the dates in the winter question stay whole where lines break between any characters', async () => {
  for (const lang of ['ja', 'zh-hans']) {
    const { strings } = await import(`../src/core/strings/${lang}.js`);
    const body = strings['scene.winter_body'];
    assert.match(body, /1⁠月⁠7⁠日/, `${lang}: January 7`);
    assert.match(body, /1⁠月⁠8⁠日/, `${lang}: January 8`);
    assert.doesNotMatch(body, /\d[月日]|月\d/, `${lang}: no date left to split`);
  }
  // Korean and English break at spaces: a no-break space keeps the month with its day.
  const { strings: ko } = await import('../src/core/strings/ko.js');
  assert.match(ko['scene.winter_body'], /1월\u00a07일.*1월\u00a08일/);
  const { strings: en } = await import('../src/core/strings/en.js');
  assert.match(en['scene.winter_body'], /January\u00a07.*January\u00a08/);
});
