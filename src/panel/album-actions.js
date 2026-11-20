// What a found card can set out: Set out puts one in the yard, and the small screen beside it puts
// it on the desktop too, by the same call (the backend saves it once). Flowers and trees come out
// grown (garden.rs take_out_flower, discovery.rs take_out_tree), fish, bugs and keepsakes on their
// own (garden.rs take_out_find). Each press sets out one more.
// Design: docs/design/2026-11-19-album-take-out.md, docs/design/2026-11-19-album-finds-out.md.

import { desktopTip } from '../core/controls.js';
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { limit } from '../core/limits.js';
import { call, data, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { findOutFor, heldName } from '../yard/find-out.js';

/** Where something set out from the album lands: near the front of the yard, as a gift is. */
export const landing = () => [0.3 + Math.random() * 0.4, 0.8];

function button(title, disabled, desktop) {
  const b = document.createElement('button');
  b.type = 'button';
  // The desktop one is a small screen beside Set out: two words each would not fit a card's width.
  b.className = desktop ? 'album-take-out album-to-desktop' : 'album-take-out';
  b.disabled = disabled;
  b.title = title;
  b.setAttribute('aria-label', title);
  if (desktop) {
    b.innerHTML = '<span data-icon="monitor"></span>';
    icons(b);
  } else b.textContent = t('album.take_out');
  return b;
}

/** A card's row: Set out, and the desktop's button beside it, each titled for `name`, or both off
 * with `why`. A press runs `setOut(desktop)`, which resolves with what came out; the row waits for
 * it, and comes back on a refusal. */
export function setOutRow(name, why, setOut) {
  const row = document.createElement('div');
  row.className = 'album-actions';
  for (const desktop of [false, true]) {
    const b = button(why || t(desktop ? 'album.set_out_desktop' : 'album.set_out', { kind: name }), !!why, desktop);
    // One press at a time: a second before the album redraws would set out another.
    b.onclick = () => {
      for (const each of row.children) each.disabled = true;
      setOut(desktop)
        .then(out => {
          if (desktop && out?.id) desktopTip();
        })
        .catch(error => {
          for (const each of row.children) each.disabled = false;
          toast(spoken(error, t('error.generic')), { error: true });
        });
    };
    row.append(b);
  }
  return row;
}

/** A found fish, bug or keepsake card's row. Null for a book whose finds do not come out. */
export function findButtons(book, item) {
  if (!findOutFor(book)) return null;
  const full = (data.garden?.decor?.length ?? 0) >= limit(data, 'decor') ? t('album.set_out_full') : '';
  return setOutRow(heldName(book, item), full, desktop => call('takeOutFind', book, item, ...landing(), desktop));
}
