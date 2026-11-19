// An album card's buttons that put a find on display (garden.rs display, undisplay): a fish into a
// fishbowl, a bug into a jar, a treasure into the specimen case, a flower pressed in a frame. Each
// goes into the yard near its front, as a gift is set out; the small screen beside it sends it out
// on the desktop too. A treasure already in a case has its button take it out again.
// Design: docs/design/2026-11-19-album-on-display.md.

import { desktopTip } from '../core/controls.js';
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { limit } from '../core/limits.js';
import { call, data, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { displayFor, heldName } from '../yard/display.js';

// Where a display lands: near the front of the yard, as a gift is set out (album.js takeOutButton).
const landing = () => [0.3 + Math.random() * 0.4, 0.8];
const caseHolding = (kind, item) =>
  (data.garden?.decor || []).find(d => d.kind === kind && (d.holds || []).includes(item)) || null;

function button(className, title, disabled) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.disabled = disabled;
  b.title = title;
  b.setAttribute('aria-label', title);
  return b;
}
function iconButton(icon, title, disabled) {
  const b = button('album-take-out album-to-desktop', title, disabled);
  b.innerHTML = `<span data-icon="${icon}"></span>`;
  icons(b);
  return b;
}
// One press at a time: the row's buttons wait for the backend, and come back as they were on a
// refusal.
function pressing(row, work) {
  return () => {
    const all = [...row.children],
      was = all.map(b => b.disabled);
    for (const b of all) b.disabled = true;
    work().catch(error => {
      all.forEach((b, i) => (b.disabled = was[i]));
      toast(spoken(error, t('error.generic')), { error: true });
    });
  };
}
async function show(book, item, desktop) {
  const decor = await call('display', book, item, ...landing());
  if (!desktop || !decor?.id) return;
  await call('setOnDesktop', decor.id, true);
  desktopTip();
}
// Each book's button and its title.
const WORDS = {
  fish: ['album.display_fish', 'album.display_fish_title'],
  bug: ['album.display_bug', 'album.display_bug_title'],
  treasure: ['album.display_treasure', 'album.display_treasure_title'],
};
const full = () => (data.garden?.decor?.length ?? 0) >= limit(data, 'decor');

/** A found fish, bug or treasure card's row: its display's worded button and the desktop's. A
 * treasure in a case has one button, to take it out. Null for a book with no display. */
export function displayButtons(book, item) {
  const display = displayFor(book);
  if (!display || !WORDS[book]) return null;
  const row = document.createElement('div'),
    name = heldName(book, item);
  row.className = 'album-actions';
  const inCase = display.room > 1 && caseHolding(display.id, item);
  if (inCase) {
    const out = button('album-take-out', t('album.undisplay_treasure_title', { item: name }), false);
    out.textContent = t('album.undisplay_treasure');
    out.onclick = pressing(row, () => call('undisplay', inCase.id, item));
    row.append(out);
    return row;
  }
  // A case with room takes it without a new place in the yard.
  const roomInCase =
      display.room > 1 &&
      (data.garden?.decor || []).some(d => d.kind === display.id && (d.holds || []).length < display.room),
    off = full() && !roomInCase ? t('album.set_out_full') : '';
  const [word, title] = WORDS[book];
  const yard = button('album-take-out', off || t(title, { item: name }), !!off);
  yard.textContent = t(word);
  yard.onclick = pressing(row, () => show(book, item, false));
  const desktop = iconButton('monitor', off || t('album.display_desktop_title', { item: name }), !!off);
  desktop.onclick = pressing(row, () => show(book, item, true));
  row.append(yard, desktop);
  return row;
}

/** A found flower's frame button, beside its Set out and desktop buttons (album.js growingButtons). */
export function pressButton(item, row) {
  const off = full() ? t('album.set_out_full') : '',
    b = iconButton('frame', off || t('album.display_flower_title', { item: heldName('flower', item) }), !!off);
  b.onclick = pressing(row, () => show('flower', item, false));
  return b;
}
