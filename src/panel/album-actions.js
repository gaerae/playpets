// What a found card sets out and brings back. One that can be out once has one button, Set out
// that turns to Put back; one found more often has − and + within what the album found and the
// yard holds. The small screen beside it sets one out on the desktop too, by the same call (the
// backend saves it once). The screen turns every copy of the kind on the desktop
// or off it (they stay in the yard). Flowers and trees come out grown (garden.rs take_out_flower,
// discovery.rs take_out_tree), fish, bugs and keepsakes on their own (garden.rs take_out_find).
// Design: docs/design/2026-11-19-album-take-out.md, docs/design/2026-11-19-album-finds-out.md,
// docs/design/2026-11-20-album-in-and-out.md.

import { desktopTip } from '../core/controls.js';
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { limit } from '../core/limits.js';
import { call, data, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { findOutFor, heldName } from '../yard/find-out.js';

/** Where something set out from the album lands: near the front of the yard, as a gift is. */
export const landing = () => [0.3 + Math.random() * 0.4, 0.8];

/** The copies of an album kind out in the yard, in the order they came, as the backend counts them
 * (garden.rs out_of_album): a flower in bloom, a grown tree, a find out holding it, a gift. */
export function outOfAlbum(book, item) {
  const garden = data.garden || {};
  if (book === 'flower') return (garden.plants || []).filter(p => p.kind === item && p.bloomed);
  if (book === 'tree') return (garden.trees || []).filter(tree => tree.kind === item && tree.matured);
  if (book === 'gift') return (garden.decor || []).filter(d => d.kind === item);
  const kind = findOutFor(book)?.id;
  return (garden.decor || []).filter(d => d.kind === kind && d.holds?.[0] === item);
}
// Bringing one back is what its own menu does, without the Undo: the card sets it out again.
const BRING_IN = { flower: 'pullPlant', tree: 'removeTree' };
const bringIn = (book, id) => call(BRING_IN[book] || 'putAway', id);

function button(label, title, role, className = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `album-take-out ${className}`.trim();
  b.dataset.role = role;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.textContent = label;
  return b;
}
// A press that cannot happen now stays focusable, and its title says why (a disabled button would
// drop the focus mid-press and show no title in WebKit).
const off = (b, why) => {
  b.setAttribute('aria-disabled', String(!!why));
  return b;
};

/** A card's row for `item` of `book`, called `name`: `most` can be out at once (the album's count,
 * or one for a gift), up to `room`, the most the yard holds of it. `why` says why no more can come
 * out (a full yard, no soil, out of season), or is empty. `setOut(desktop)` sets one more out and
 * resolves with it.
 * The row keeps its shape as things go out and come back, so the next press is where the last one
 * was: one that can be out once is a single button that turns from Set out to Put back; one found
 * more often is − n/m + from the first press on. A press holds the row until the album redraws, and
 * lets it go after a refusal. */
export function setOutRow({ book, item, name, most, room, why = '', setOut }) {
  const row = document.createElement('div');
  row.className = 'album-actions';
  row.dataset.card = `${book}:${item}`;
  const copies = outOfAlbum(book, item),
    out = copies.length,
    cap = Math.min(most, room),
    onDesktop = copies.some(c => c.onDesktop),
    more = why || (out >= most ? t('album.all_out', { count: most }) : '');
  // One press at a time: a second before the album redraws would act on what is already changing.
  const press = (b, act) => {
    b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true' || row.dataset.pending) return;
      row.dataset.pending = 'true';
      act().catch(error => {
        delete row.dataset.pending;
        toast(spoken(error, t('error.generic')), { error: true });
      });
    };
    return b;
  };
  const oneMore = desktop =>
    setOut(desktop).then(made => {
      if (desktop && made?.id) desktopTip();
    });
  const last = () => bringIn(book, copies.at(-1).id);
  if (cap <= 1 && out <= 1) {
    const toggle = out
      ? press(button(t('album.put_back'), t('album.put_back_one', { kind: name }), 'yard'), last)
      : press(button(t('album.take_out'), why || t('album.set_out', { kind: name }), 'yard'), () => oneMore(false));
    toggle.classList.add('album-toggle');
    toggle.setAttribute('aria-pressed', String(!!out));
    row.append(off(toggle, !out && why));
  } else {
    const fewer = press(button('−', t('album.put_back_one', { kind: name }), 'fewer', 'album-step'), last),
      count = document.createElement('span'),
      plus = press(
        button('+', more || t(out ? 'album.set_out_more' : 'album.set_out', { kind: name }), 'more', 'album-step'),
        () => oneMore(onDesktop),
      );
    count.className = 'album-count';
    // Kept from before the album's count held them, more may be out than it allows now.
    const shown = Math.max(cap, out);
    count.textContent = `${out}/${shown}`;
    count.title = t('album.out_count', { count: out, limit: shown });
    count.setAttribute('aria-label', count.title);
    row.append(off(fewer, !out), count, off(plus, more));
  }
  // The desktop's switch: pressed while any copy is out there. Off, with none out, it sets one out
  // there, and so waits on whatever stops Set out.
  const waits = !out && !!why,
    screen = press(
      button(
        '',
        waits
          ? why
          : t(onDesktop ? 'album.desktop_off' : out ? 'album.desktop_on' : 'album.set_out_desktop', { kind: name }),
        'desktop',
        'album-to-desktop',
      ),
      () =>
        out ? call('albumOnDesktop', book, item, !onDesktop).then(() => !onDesktop && desktopTip()) : oneMore(true),
    );
  screen.innerHTML = '<span data-icon="monitor"></span>';
  icons(screen);
  screen.setAttribute('aria-pressed', String(onDesktop));
  row.append(off(screen, waits));
  return row;
}

/** Where the focus was in a card's row, before the album redraws it; null when it was not in one. */
export function rowFocus(active = document.activeElement) {
  const row = active?.closest?.('.album-actions');
  return row && active.dataset?.role ? { card: row.dataset.card, role: active.dataset.role } : null;
}
/** Puts the focus back on the same control of the redrawn row in `grid`: a press that cannot happen
 * now stays focusable, so the next press lands where the last one did. A control the row no longer
 * has gives the focus to its first. */
export function restoreRowFocus(grid, was) {
  if (!was) return;
  const row = [...grid.querySelectorAll('.album-actions')].find(r => r.dataset.card === was.card);
  if (!row) return;
  const buttons = [...row.querySelectorAll('button')];
  (buttons.find(b => b.dataset.role === was.role) || buttons[0])?.focus();
}

/** A found fish, bug or keepsake card's row. Null for a book whose finds do not come out. */
export function findButtons(book, item, entry) {
  if (!findOutFor(book)) return null;
  const room = limit(data, 'decor'),
    full = (data.garden?.decor?.length ?? 0) >= room ? t('album.set_out_full') : '';
  return setOutRow({
    book,
    item,
    name: heldName(book, item),
    most: entry?.count ?? 1,
    room,
    why: full,
    setOut: desktop => call('takeOutFind', book, item, ...landing(), desktop),
  });
}
