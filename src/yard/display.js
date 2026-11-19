// A display: a fishbowl, a bug jar, a specimen case or a pressed-flower frame, holding finds from the
// album (catalog.json "displays": the book it holds from, how many, and where each is drawn). The
// yard and the desktop draw one the same way: its own drawing, then each find's album preview in its
// slot. Design: docs/design/2026-11-19-album-on-display.md.

import { joinList, t } from '../core/i18n.js';
import { previewSvg } from './art.js';
import { BUGS, DISPLAYS, FISH, FLOWERS, TREASURES } from './catalog.js';

const BOOKS = { fish: FISH, bug: BUGS, treasure: TREASURES, flower: FLOWERS };
const NAMES = {
  fish: id => t(`catch.fish_${id}`),
  bug: id => t(`catch.bug_${id}`),
  treasure: id => t(`treasure.${id}`),
  flower: id => t(`garden.kind_${id}`),
};

/** The display kind for a find of `book`, or null. */
export const displayFor = book => DISPLAYS.find(d => d.holds === book) || null;
/** A display kind by its id, or null for a gift. */
export const displayKind = kind => DISPLAYS.find(d => d.id === kind) || null;
/** A find of `book` by its id, as the catalogue has it, or null. */
export const heldKind = (book, id) => BOOKS[book]?.find(k => k.id === id) || null;
/** A find's name, as its album card says it. */
export const heldName = (book, id) => NAMES[book]?.(id) ?? id;

const share = n => `${+(n * 100).toFixed(2)}%`;
/** The finds a display of `kind` holds, as markup over its drawing: each one's album preview in its
 * slot, in proportion and centred. Nothing for a gift, or for an id its book does not have. */
export function heldLayers(kind, holds = []) {
  const display = displayKind(kind);
  if (!display) return '';
  return holds
    .slice(0, display.slots.length)
    .map((id, i) => {
      const found = heldKind(display.holds, id);
      if (!found?.art) return '';
      const [x, y, w, h] = display.slots[i];
      return `<span class="held" data-held="${id}" style="left:${share(x)};top:${share(y)};width:${share(w)};height:${share(h)}">${previewSvg(found.art)}</span>`;
    })
    .join('');
}
/** The drawings a display's finds are drawn from, to load with it. */
export function heldArt(kind, holds = []) {
  const display = displayKind(kind);
  return display ? holds.map(id => heldKind(display.holds, id)?.art).filter(Boolean) : [];
}
/** A display's effects: a jar holding a firefly glows from evening, as a lit gift does. */
export function displayEffects(kind, holds = []) {
  const display = displayKind(kind);
  if (display?.holds !== 'bug') return [];
  return holds.some(id => heldKind('bug', id)?.kind === 'firefly') ? ['glow'] : [];
}
/** What a display is called with what it holds ("Fishbowl: Crucian carp"); a gift's own name. */
export function displayName(kind, holds = []) {
  const name = t(`decor.kind_${kind}`),
    display = displayKind(kind);
  if (!display || !holds.length) return name;
  return t('decor.holding', { kind: name, items: joinList(holds.map(id => heldName(display.holds, id))) });
}
