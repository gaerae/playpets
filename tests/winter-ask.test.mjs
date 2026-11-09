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
const { setupWinter, winterAsk, winterOver } = await import('../src/yard/winter.js');
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
function yard(t, { now, answer = true, world = 'woodland', asked = null }) {
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
    ask: async question => {
      asks.push(question);
      return answer;
    },
    south: false,
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
});
