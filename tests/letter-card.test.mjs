// The year-end letter card (src/yard/letter-card.js): the letter on paper, an answer counted by
// characters and drawn as text, Not now with a warm line from the friend, and Delete after a question.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { installDom, installStorage } from './support/dom.mjs';

const answers = [],
  deletes = [];
let failWith = null;
globalThis.playPets = {
  answerLetter: async (...args) => {
    answers.push(args);
    return failWith ? { ok: false, error: failWith } : { ok: true, data: null };
  },
  deleteLetter: async (...args) => {
    deletes.push(args);
    return failWith ? { ok: false, error: failWith } : { ok: true, data: null };
  },
};
// The namespace, not a copy: setData replaces `data`.
const state = await import('../src/core/state.js');
const { list, t: words } = await import('../src/core/i18n.js');
const { setupConfirm } = await import('../src/core/confirm.js');
const { openLetter, setupLetterCard } = await import('../src/yard/letter-card.js');

const flush = () => new Promise(resolve => setImmediate(resolve));
const LETTER = { year: 2026, friend: 'a', text: 'Hi\nHow was it?', answer: null, at: 1 };

// A page with the card wired, a friend called Mochi and the letter (or `letter`); `view` puts
// Mochi in the yard. Returns a lookup by id and the years `onClosed` saw.
function page(t, { pets = [{ id: 'a', name: 'Mochi' }], letter = LETTER, view = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes, element } = installDom(t, { anyId: true });
  state.setData({ ...state.data, pets, assets: [], letters: [letter] });
  state.views.clear();
  t.after(() => state.views.clear());
  if (view) {
    const pet = pets[0];
    state.views.set(pet.id, { pet, bubble: element('span', { hidden: true }) });
  }
  answers.length = 0;
  deletes.length = 0;
  failWith = null;
  const closed = [];
  setupConfirm();
  setupLetterCard({ onClosed: year => closed.push(year) });
  return { closed, $: id => nodes.get(id) ?? document.getElementById(id) };
}

const type = ($, text) => {
  $('letter-answer').value = text;
  return $('letter-answer').dispatch('input');
};
const send = $ => $('letter-form').onsubmit({ preventDefault() {} });

test('an unanswered letter opens with its text and a box to write back', t => {
  const { $ } = page(t);
  openLetter(2025);
  assert.notEqual($('letter-dialog').open, true, 'no letter that year');
  openLetter(2026);
  assert.equal($('letter-title').textContent, words('letter.title', { name: 'Mochi' }));
  assert.equal($('letter-text').textContent, 'Hi\nHow was it?');
  assert.equal($('letter-form').hidden, false);
  assert.equal($('letter-answered').hidden, true);
  assert.equal($('letter-dialog').open, true);
  assert.equal(document.activeElement, $('letter-answer'));
  assert.equal($('letter-send').disabled, true, 'nothing written yet');
});

test('a deleted letter does not open', t => {
  const { $ } = page(t, { letter: { ...LETTER, text: '' } });
  openLetter(2026);
  assert.notEqual($('letter-dialog').open, true);
});

test('the answer is counted by characters and drawn as text', async t => {
  const { $ } = page(t);
  openLetter(2026);
  await type($, '🎄'.repeat(200));
  assert.equal($('letter-count').textContent, words('letter.count', { count: 200, limit: 200 }));
  assert.equal($('letter-send').disabled, false);
  await type($, '🎄'.repeat(201));
  assert.equal($('letter-send').disabled, true);
  await type($, '   ');
  assert.equal($('letter-send').disabled, true, 'only spaces is no answer');
  await type($, '<b>hi</b>\nthere');
  await send($);
  assert.deepEqual(answers, [[2026, '<b>hi</b>\nthere']]);
  assert.equal($('letter-dialog').open, false);

  state.setData({ ...state.data, letters: [{ ...LETTER, answer: '<b>hi</b> there' }] });
  openLetter(2026);
  assert.equal($('letter-form').hidden, true);
  assert.equal($('letter-answered').hidden, false);
  assert.equal($('letter-quote').textContent, '<b>hi</b> there');
  assert.equal($('letter-quote').children.length, 0);
  assert.equal(document.activeElement, $('letter-close'));
});

test('sending thanks you, and not now still ends warmly', async t => {
  const { $ } = page(t, { view: true });
  const bubble = state.views.get('a').bubble;
  openLetter(2026);
  await type($, 'Camping, lots of it');
  await send($);
  assert.ok(list('letter.thanks').includes(bubble.textContent), bubble.textContent);
  assert.equal(bubble.hidden, false);

  openLetter(2026);
  answers.length = 0;
  $('letter-later').onclick();
  assert.equal($('letter-dialog').open, false);
  assert.deepEqual(answers, []);
  assert.ok(list('letter.skip').includes(bubble.textContent), bubble.textContent);
});

test('with the friend nowhere in the yard the line comes as a notice', async t => {
  const { $ } = page(t);
  openLetter(2026);
  $('letter-later').onclick();
  assert.ok(
    list('letter.skip').some(line => $('toast').textContent.includes(line)),
    $('toast').textContent,
  );
});

test('a typed answer stays when Esc or a click beside the card would close it', async t => {
  const { $ } = page(t);
  // Whether Esc would close the card: the dialog's cancel event, kept from closing or not.
  const escCloses = async () => {
    let closes = true;
    await $('letter-dialog').dispatch('cancel', {
      preventDefault() {
        closes = false;
      },
    });
    return closes;
  };
  openLetter(2026);
  assert.equal(await escCloses(), true, 'nothing written');
  await type($, 'A good year');
  assert.equal(await escCloses(), false);
  assert.equal($('letter-error').textContent, words('letter.unsaved'));
  // Close is the deliberate way out, as Cancel is in the other form dialogs.
  $('letter-close').onclick();
  assert.equal($('letter-dialog').open, false);
  openLetter(2026);
  assert.equal(await escCloses(), true, 'opened again, the card starts fresh');
});

test('a failed answer says why and keeps the card open', async t => {
  const { $ } = page(t, { view: true });
  openLetter(2026);
  failWith = 'The letter could not be saved.';
  await type($, 'Hello');
  await send($);
  assert.equal($('letter-error').textContent, 'The letter could not be saved.');
  assert.equal($('letter-dialog').open, true);
  assert.equal(state.data.letters[0].text, LETTER.text, 'not deleted: kept as it was');
  assert.equal(state.views.get('a').bubble.hidden, true, 'no thanks for an answer not kept');
});

test('deleting asks first and then clears the letter', async t => {
  const { $, closed } = page(t);
  openLetter(2026);
  const first = $('letter-delete').onclick();
  assert.equal($('confirm-title').textContent, words('letter.delete_title'));
  assert.equal($('confirm-body').textContent, words('letter.delete_body'));
  $('confirm-cancel').onclick();
  await $('confirm-dialog').dispatch('close');
  await first;
  assert.deepEqual(deletes, []);
  assert.equal($('letter-dialog').open, true);

  const second = $('letter-delete').onclick();
  $('confirm-ok').onclick();
  await second;
  assert.deepEqual(deletes, [[2026]]);
  // Cleared here at once, so the chip, the envelope and the menu row go as the card closes,
  // without waiting for the backend's change.
  const kept = state.data.letters.find(letter => letter.year === 2026);
  assert.deepEqual([kept.friend, kept.text, kept.answer], ['', '', null]);
  assert.equal($('letter-dialog').open, false);
  await $('letter-dialog').dispatch('close');
  assert.deepEqual(closed, [2026]);
});

test('a failed delete says why, even on an answered letter', async t => {
  const { $ } = page(t, { letter: { ...LETTER, answer: 'Camping' } });
  openLetter(2026);
  failWith = 'The letter could not be saved.';
  const deleting = $('letter-delete').onclick();
  $('confirm-ok').onclick();
  await deleting;
  await flush();
  assert.equal($('letter-error').textContent, 'The letter could not be saved.');
  assert.equal($('letter-dialog').open, true);
  assert.equal(state.data.letters[0].text, LETTER.text, 'not deleted: kept as it was');
  // The answer box is hidden on an answered letter, so the error line sits outside it.
  const html = await readFile('src/index.html', 'utf8');
  const form = html.slice(
    html.indexOf('<form id="letter-form"'),
    html.indexOf('</form>', html.indexOf('<form id="letter-form"')),
  );
  assert.ok(html.includes('id="letter-error"') && !form.includes('letter-error'));
});

test('a letter from a friend who left opens with a plain title', t => {
  const { $ } = page(t, { pets: [] });
  openLetter(2026);
  assert.equal($('letter-title').textContent, words('letter.title_plain'));
});

test('opening the letter is remembered for the mark on the mailbox', t => {
  const { $ } = page(t);
  const storage = installStorage(t);
  openLetter(2026);
  assert.equal(storage.getItem('letter-opened-2026'), '1');
  assert.equal($('letter-dialog').open, true);
});

test('opening the card while it is open keeps the answer being written', async t => {
  const { $ } = page(t);
  const dialog = $('letter-dialog');
  // A browser refuses to open a dialog that is already open.
  dialog.showModal = () => {
    if (dialog.open) throw new Error('InvalidStateError');
    dialog.open = true;
  };
  openLetter(2026);
  await type($, 'A good year');
  openLetter(2026);
  assert.equal($('letter-answer').value, 'A good year');
  assert.equal(dialog.open, true);
});

test('the counter is read with the answer box, not on every key', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const count = html.match(/<small id="letter-count"[^>]*>/)[0],
    box = html.match(/<textarea id="letter-answer"[^>]*>/)[0];
  assert.doesNotMatch(count, /aria-live/);
  assert.match(box, /aria-describedby="letter-count"/);
});
