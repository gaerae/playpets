// A found fish, bug or treasure card's buttons (garden.rs display): Set out puts the find in the
// yard on its own, near its front, as a gift is set out; the small screen beside it sends it out on
// the desktop too. Each press sets out one more. Design: docs/design/2026-11-19-album-finds-out.md.

import { desktopTip } from '../core/controls.js';
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { limit } from '../core/limits.js';
import { call, data, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { displayFor, heldName } from '../yard/display.js';

// Where a find lands: near the front of the yard, as a gift is set out (album.js takeOutButton).
const landing = () => [0.3 + Math.random() * 0.4, 0.8];

function button(title, disabled, desktop) {
  const b = document.createElement('button');
  b.type = 'button';
  // The desktop one is a small screen beside Set out, as a flower card has (album.js growingButtons).
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
// One press at a time: the row's buttons wait for the backend, and come back on a refusal.
function pressing(row, work) {
  return () => {
    const all = [...row.children];
    for (const b of all) b.disabled = true;
    work().catch(error => {
      for (const b of all) b.disabled = false;
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

/** A found fish, bug or treasure card's row: Set out, and the desktop's button. Null for a book
 * whose finds do not come out. */
export function displayButtons(book, item) {
  if (!displayFor(book)) return null;
  const row = document.createElement('div'),
    kind = heldName(book, item),
    off = (data.garden?.decor?.length ?? 0) >= limit(data, 'decor') ? t('album.set_out_full') : '';
  row.className = 'album-actions';
  const yard = button(off || t('album.set_out', { kind }), !!off, false),
    desktop = button(off || t('album.set_out_desktop', { kind }), !!off, true);
  yard.onclick = pressing(row, () => show(book, item, false));
  desktop.onclick = pressing(row, () => show(book, item, true));
  row.append(yard, desktop);
  return row;
}
