// The year-end letter card: the friend's letter on paper, one answer of up to 200 characters, Not
// now, and Delete after a question. The letter and the answer are drawn as text only. When and
// whether the card can open is letter.js's; what is kept is the backend's (pets/letters.rs).
import { confirmAction, keepEdits, showFormError } from '../core/confirm.js';
import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { $, call, data, name, remember, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { bubble } from './views.js';

// The backend keeps at most this many characters (ANSWER_MAX in pets/letters.rs).
const LIMIT = 200;

// The year on the card, and whether an answer or a delete is on its way.
let shown = null,
  busy = false,
  opened = () => {};

const letterOf = year => (data.letters || []).find(letter => letter.year === year && letter.text);
const length = () => [...$('letter-answer').value.trim()].length;

function count() {
  const n = length();
  $('letter-count').textContent = t('letter.count', { count: n, limit: LIMIT });
  $('letter-send').disabled = busy || n < 1 || n > LIMIT;
}

// The writer says it above its head when it is in the yard; a friend who left leaves a notice.
function say(friend, lines) {
  const line = pick(list(lines)),
    v = views.get(friend);
  if (v?.bubble) bubble(v, line);
  else toast(line);
}

function setBusy(value) {
  busy = value;
  $('letter-form').setAttribute('aria-busy', String(value));
  $('letter-delete').disabled = value;
  count();
}

/** Opens the card for `year`'s letter, if it still has its text. */
export function openLetter(year) {
  const letter = letterOf(year);
  // Already open, the card keeps the answer being written.
  if (!letter || $('letter-dialog').open) return;
  shown = year;
  const writer = data.pets.find(pet => pet.id === letter.friend);
  $('letter-title').textContent = writer ? t('letter.title', { name: name(writer) }) : t('letter.title_plain');
  $('letter-text').textContent = letter.text;
  $('letter-error').textContent = '';
  $('letter-answer').value = '';
  const answered = Boolean(letter.answer);
  $('letter-form').hidden = answered;
  $('letter-answered').hidden = !answered;
  $('letter-quote').textContent = letter.answer || '';
  count();
  opened();
  remember(`letter-opened-${year}`, '1');
  $('letter-dialog').showModal();
  (answered ? $('letter-close') : $('letter-answer')).focus();
}

/** Wires the card once; `onClosed(year)` runs after every close. */
export function setupLetterCard({ onClosed = () => {} } = {}) {
  const dialog = $('letter-dialog');
  shown = null;
  busy = false;
  const close = () => {
    if (!busy) dialog.close();
  };
  dialog.addEventListener('close', () => onClosed(shown));
  // Esc or a click beside it keeps a typed answer: the card says to send it or press Not now.
  opened = keepEdits(
    dialog,
    () => $('letter-answer').value,
    () => showFormError('letter-error', t('letter.unsaved')),
    () => busy,
  );
  $('letter-close').onclick = close;
  $('letter-answer').addEventListener('input', count);
  $('letter-form').onsubmit = async e => {
    e.preventDefault();
    const year = shown,
      friend = letterOf(year)?.friend,
      value = $('letter-answer').value;
    if (busy || length() < 1 || length() > LIMIT) return;
    setBusy(true);
    $('letter-error').textContent = '';
    try {
      await call('answerLetter', year, value);
    } catch (error) {
      showFormError('letter-error', spoken(error, t('error.generic')));
      return;
    } finally {
      setBusy(false);
    }
    dialog.close();
    say(friend, 'letter.thanks');
  };
  $('letter-later').onclick = () => {
    if (busy) return;
    const friend = letterOf(shown)?.friend;
    dialog.close();
    say(friend, 'letter.skip');
  };
  $('letter-delete').onclick = async () => {
    if (busy) return;
    const year = shown;
    const sure = await confirmAction({
      title: t('letter.delete_title'),
      body: t('letter.delete_body'),
      action: t('letter.delete_action'),
      danger: true,
    });
    if (!sure || year !== shown || !dialog.open) return;
    setBusy(true);
    $('letter-error').textContent = '';
    try {
      await call('deleteLetter', year);
    } catch (error) {
      showFormError('letter-error', spoken(error, t('error.generic')));
      return;
    } finally {
      setBusy(false);
    }
    dialog.close();
  };
}
