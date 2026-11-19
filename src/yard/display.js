// A find out of the album on its own: a fish, a bug or a treasure, with no container and no shadow
// (catalog.json "displays": the book it holds from and where in its box the find is drawn). The
// yard and the desktop draw one the same way: the find's own painting in its slot, and for a fish
// the bubbles it lets out when it swims. Design: docs/design/2026-11-19-album-finds-out.md.

import { t } from '../core/i18n.js';
import { artSvg } from './art.js';
import { BUGS, DISPLAYS, FISH, TREASURES } from './catalog.js';

const BOOKS = { fish: FISH, bug: BUGS, treasure: TREASURES };
const NAMES = {
  fish: id => t(`catch.fish_${id}`),
  bug: id => t(`catch.bug_${id}`),
  treasure: id => t(`treasure.${id}`),
};

/** The kind a find of `book` comes out as, or null. */
export const displayFor = book => DISPLAYS.find(d => d.holds === book) || null;
/** A find out's kind by its id, or null for a gift. */
export const displayKind = kind => DISPLAYS.find(d => d.id === kind) || null;
/** A find of `book` by its id, as the catalogue has it, or null. */
export const heldKind = (book, id) => BOOKS[book]?.find(k => k.id === id) || null;
/** A find's name, as its album card says it. */
export const heldName = (book, id) => NAMES[book]?.(id) ?? id;

const share = n => `${+(n * 100).toFixed(2)}%`;
// What a fish lets out while it swims (overlay.css .bubbles).
const BUBBLES = '<span class="bubbles"><i></i><i></i><i></i></span>';
/** The find a kind out holds, as markup: its full painting in its slot, in proportion and centred,
 * and a fish's bubbles. Nothing for a gift, or for an id its book does not have. */
export function heldLayers(kind, holds = []) {
  const display = displayKind(kind);
  if (!display) return '';
  return holds
    .slice(0, display.slots.length)
    .map((id, i) => {
      const found = heldKind(display.holds, id);
      if (!found?.art) return '';
      const [x, y, w, h] = display.slots[i];
      const held = `<span class="held" data-held="${id}" data-book="${display.holds}" style="left:${share(x)};top:${share(y)};width:${share(w)};height:${share(h)}">${artSvg(found.art)}</span>`;
      return display.holds === 'fish' ? held + BUBBLES : held;
    })
    .join('');
}
/** The drawings a find out is drawn from, to load with it. */
export function heldArt(kind, holds = []) {
  const display = displayKind(kind);
  return display ? holds.map(id => heldKind(display.holds, id)?.art).filter(Boolean) : [];
}
/** A find out's effects: a firefly glows from evening, as a lit gift does, but casts no light on the
 * ground, as it casts no shadow. */
export function displayEffects(kind, holds = []) {
  const display = displayKind(kind);
  if (display?.holds !== 'bug') return [];
  return holds.some(id => heldKind('bug', id)?.kind === 'firefly') ? ['halo'] : [];
}
/** What a find out is called: the find's own name ("Crucian carp"); a gift's own name. */
export function displayName(kind, holds = []) {
  const display = displayKind(kind);
  if (!display) return t(`decor.kind_${kind}`);
  return holds.length ? heldName(display.holds, holds[0]) : '';
}
