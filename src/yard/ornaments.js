// Ornaments on the Christmas tree (docs/design/2026-11-09-a-winter-to-share.md, "Decorating the
// tree"): found flowers, trees, gifts and small finds hang on the tree's twelve hooks, three a day,
// and stay all winter; the first hang of the next December takes them down, so each December
// starts a fresh tree. The backend keeps them and the rule (src-tauri/src/pets/garden.rs
// hang_ornament); this module says what hangs this December and what still could, and draws it.
// Hook i is the same place on the small and the grand drawing (catalog.json xmas_tree hooks and
// night.hooks), so the same ornaments show on both.
//
// In the yard a bauble is tint, rim and shine only (garden.css "Ornaments"): in a full-width yard
// it is about 8 px on the small tree and 11 on the grand one, where the item's drawing would be
// noise. The view that hangs them is large enough to draw it inside. Each tree's layer is rebuilt
// only when what hangs on it changed, not at every drawing of the gifts.

import { t } from '../core/i18n.js';
import { data } from '../core/state.js';
import { artSvg } from './art.js';
import { FLOWERS, GIFTS, TREASURES, TREES, flowerKind, giftKind, treasureKind, treeKind } from './catalog.js';
import { percent } from './christmas-night.js';
import { flowerSvg, giftSvg } from './creatures.js';
import { shownDecor } from './decor.js';
import { localDay } from './growth.js';

/** The books an ornament comes from, in the order they are offered (album.js BOOKS ids). */
export const ORNAMENT_BOOKS = ['flower', 'tree', 'gift', 'treasure'];

const matureArt = tree => tree.stages.find(stage => stage.name === 'mature').art;
// Each book: its kinds in catalogue order, the ids found, one kind by id, and how it looks.
const BOOKS = {
  flower: {
    kinds: FLOWERS,
    found: d => Object.keys(d.album?.flowers || {}),
    kind: flowerKind,
    art: k => flowerSvg(k.id),
    name: k => `garden.kind_${k.id}`,
    tab: 'catch.tab_flowers',
  },
  tree: {
    kinds: TREES,
    found: d => Object.keys(d.album?.trees || {}),
    kind: treeKind,
    art: k => artSvg(k.seasonArt?.autumn || matureArt(k)),
    name: k => `tree.${k.id}`,
    tab: 'album.trees',
  },
  gift: {
    kinds: GIFTS,
    found: d => d.garden?.received || [],
    kind: giftKind,
    art: k => giftSvg(k),
    name: k => `decor.kind_${k.id}`,
    tab: 'catch.tab_gifts',
  },
  treasure: {
    kinds: TREASURES,
    found: d => Object.keys(d.album?.treasures || {}),
    kind: treasureKind,
    art: k => artSvg(k.art),
    name: k => `treasure.${k.id}`,
    tab: 'album.treasures',
  },
};
// A saved book is looked up only among the four, so one such as "constructor" finds nothing.
const bookOf = book => (Object.hasOwn(BOOKS, book) ? BOOKS[book] : null);
const known = o => !!bookOf(o.book)?.kind(o.id);

/** A book's name as the album calls it ("Flowers", "Keepsakes"); empty for one not of the four. */
export const bookName = book => (bookOf(book) ? t(bookOf(book).tab) : '');

/** The December whose ornaments `date` shows: its year in December, else the year before. */
export function ornamentSeason(date) {
  return date.getMonth() === 11 ? date.getFullYear() : date.getFullYear() - 1;
}
/** What hangs on the tree at `date`: the garden's ornaments while they are this December's. */
export function treeOrnaments(garden, date) {
  return garden?.ornamentYear === ornamentSeason(date) ? garden.ornaments || [] : [];
}
/** How many more can hang today, of `perDay`: today's count is this December's and today's only. */
export function leftToday(garden, date, perDay) {
  const day = garden?.ornamentDay;
  if (garden?.ornamentYear !== ornamentSeason(date) || day?.day !== localDay(date)) return perDay;
  return Math.max(0, perDay - day.count);
}
/** The hooks (0 to `hooks` - 1) nothing hangs on at `date`, in order. */
export function freeHooks(garden, date, hooks) {
  const taken = new Set(treeOrnaments(garden, date).map(o => o.hook));
  return Array.from({ length: hooks }, (_, i) => i).filter(i => !taken.has(i));
}
/** What could hang at `date`: every find of the four books the catalogue still has, in book and
 * catalogue order, but the tree itself and what already hangs this December. */
export function hangable(d, date) {
  const hanging = new Set(treeOrnaments(d.garden, date).map(o => `${o.book}:${o.id}`));
  return ORNAMENT_BOOKS.flatMap(book => {
    const b = BOOKS[book],
      found = new Set(b.found(d));
    return b.kinds
      .filter(k => found.has(k.id) && k.id !== 'xmas_tree' && !hanging.has(`${book}:${k.id}`))
      .map(k => ({ book, id: k.id }));
  });
}
/** How an ornament looks: its drawing, its name and its book's name; null for one unknown. */
export function ornamentLook(book, id) {
  const b = bookOf(book),
    k = b?.kind(id);
  if (!k) return null;
  return { art: b.art(k), name: t(b.name(k)), book: t(b.tab) };
}
/** A bauble tinted by the ornament's book; with `art`, the item's drawing inside. A span is only
 * drawn (aria-hidden); another tag is the caller's to name. */
export function bauble(o, { tag = 'span', art = false } = {}) {
  const node = document.createElement(tag),
    ball = document.createElement('span');
  node.className = `bauble ${o.book}`;
  ball.className = 'bauble-ball';
  if (art) ball.innerHTML = ornamentLook(o.book, o.id)?.art || '';
  node.append(ball);
  if (tag === 'span') node.setAttribute('aria-hidden', 'true');
  return node;
}

const span = className => {
  const node = document.createElement('span');
  node.className = className;
  return node;
};
// The `.ornaments` layer that is a child of `parent`, made the first time.
function layerIn(parent) {
  const found = Array.from(parent.children).find(c => c.classList?.contains('ornaments'));
  if (found) return found;
  const layer = span('ornaments');
  layer.setAttribute('aria-hidden', 'true');
  parent.append(layer);
  return layer;
}
// Hangs `hanging` on `hooks` in `layer`; what has no hook there or no kind is left out. The same
// list as last time changes nothing.
function hang(layer, hanging, hooks, season) {
  const shown = hanging.filter(o => Number.isInteger(o.hook) && hooks[o.hook] && known(o)),
    key = `${season}|${shown.map(o => `${o.book}:${o.id}:${o.hook}`).join(',')}`;
  if (layer.dataset.key === key) return;
  layer.dataset.key = key;
  layer.replaceChildren(
    ...shown.map(o => {
      const node = bauble(o),
        [x, y] = hooks[o.hook];
      node.style.left = percent(x);
      node.style.top = percent(y);
      return node;
    }),
  );
}

/** Brings the yard's Christmas tree's baubles in line with what hangs on it: on the small drawing,
 * and on the grand one once it is made, with the grand tree's tree-shaped handle beside them. Run
 * after every drawing of the gifts, after the Christmas night check. */
export function drawTreeOrnaments() {
  const found = shownDecor('xmas_tree');
  if (!found) return;
  const now = new Date(),
    season = ornamentSeason(now),
    hanging = treeOrnaments(data.garden, now),
    gift = giftKind('xmas_tree');
  hang(layerIn(found.button), hanging, gift.hooks, season);
  const art = found.button.querySelector('.xmas-art'),
    night = found.button.querySelector('.xmas-night');
  if (!art || !night) return;
  hang(layerIn(art), hanging, gift.night.hooks, season);
  if (!night.querySelector('.xmas-hit')) night.append(span('xmas-hit'));
}
