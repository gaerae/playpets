// A find out of the album on its own: a fish, a bug, a treasure or a footprint animal, with no
// container and no shadow (catalog.json "findsOut": the book it holds from, the list its kinds are
// in, which of a kind's drawings it shows, how it answers a poke and where in its box the find is
// drawn). The
// yard and the desktop draw one the same way: the find's own painting in its slot, and for a fish
// the bubbles it lets out when it swims. On the desktop each answers a poke in its own way, and a
// fish is drawn by its length. Design: docs/design/2026-11-19-album-finds-out.md,
// docs/design/2026-11-20-finds-come-alive.md.

import { lines, list, t } from '../core/i18n.js';
import { artSvg } from './art.js';
import { FINDS_OUT, LISTS, nameKey } from './catalog.js';

/** The kind a find of `book` comes out as, or null. */
export const findOutFor = book => FINDS_OUT.find(d => d.holds === book) || null;
/** A find out's kind by its id, or null for a gift. */
export const findOutKind = kind => FINDS_OUT.find(d => d.id === kind) || null;
/** The gifts among the yard's decorations, and the finds out of the album: each has its own room
 * (garden.rs DECOR_MAX and FIND_MAX). */
export const giftsOut = decor => (decor || []).filter(d => !findOutKind(d.kind));
export const findsOut = decor => (decor || []).filter(d => findOutKind(d.kind));
/** A find of `book` by its id, as the catalogue has it (the find out's `list`), or null. */
export const heldKind = (book, id) => LISTS[findOutFor(book)?.list]?.find(k => k.id === id) || null;
// The drawing a find out shows of its find: its painting, or for a footprint animal, the whole animal
// (`drawing`: "whole"), never the tail the yard's trail shows.
const drawingOf = (out, found) => found?.[out.drawing || 'art'];
/** How many of a find its card may set out: as many as the album found, or for a book whose kinds
 * come out once each (`onceAfter`), one once found that often (a footprint animal seen whole). */
export function copiesOf(book, entry) {
  const count = entry?.count ?? 1,
    after = findOutFor(book)?.onceAfter;
  return after ? Number(count >= after) : count;
}
/** A find's name, as its album card says it. */
export const heldName = (book, id) => {
  const list = findOutFor(book)?.list;
  return list ? t(nameKey(list, id)) : id;
};

// How a find answers a poke: its own "poke" (catalog.json), else its book's (the find out's
// "poke"), else, for a bug, how it moves (its "kind"). Its own may ring a cue (soundscape.js).
const BUG_MOTIONS = { butterfly: 'flutter', dragonfly: 'dart', firefly: 'blink', beetle: 'hop', cricket: 'hop' };
/** How a find of `book` answers a poke on the desktop: { motion } (overlay.css), and a `cue` when
 * it makes a sound; null for an id its book does not have. */
export function pokeOf(book, id) {
  const found = heldKind(book, id);
  if (!found) return null;
  const own = found.poke || {},
    motion = own.motion || findOutFor(book).poke || BUG_MOTIONS[found.kind];
  return own.cue ? { motion, cue: own.cue } : { motion };
}

// A fish's longest length (catalog.json "size") on a log scale, from a killifish's 4 cm to a
// sturgeon's 150 cm; the backend sizes it the same (content.rs find_scale).
const [SHORT, LONG, SMALLEST, BIGGEST] = [Math.log(4), Math.log(150), 0.7, 1.45];
/** How much bigger than its book's box a find out is drawn: a fish by its length, 1 for the rest. */
export function findScale(kind, holds = []) {
  const max = findOutKind(kind)?.holds === 'fish' && heldKind('fish', holds[0])?.size?.[1];
  if (!max) return 1;
  const at = Math.min(1, Math.max(0, (Math.log(max) - SHORT) / (LONG - SHORT)));
  return SMALLEST + (BIGGEST - SMALLEST) * at;
}

const share = n => `${+(n * 100).toFixed(2)}%`;
// What shows a poke beside the find, by how it moves (overlay.css): a swimming fish's bubbles, a
// twinkling keepsake's sparkles. Each rests unseen until the find moves.
const AROUND = {
  swim: '<span class="bubbles"><i></i><i></i><i></i></span>',
  twinkle: '<span class="sparkle"><i></i><i></i><i></i></span>',
};
/** The find a kind out holds, as markup: its full painting in its slot, in proportion and centred,
 * and a fish's bubbles. Nothing for a gift, or for an id its book does not have. */
export function heldLayers(kind, holds = []) {
  const out = findOutKind(kind);
  if (!out) return '';
  return holds
    .slice(0, out.slots.length)
    .map((id, i) => {
      const art = drawingOf(out, heldKind(out.holds, id));
      if (!art) return '';
      const [x, y, w, h] = out.slots[i];
      const held = `<span class="held" data-held="${id}" data-book="${out.holds}" style="left:${share(x)};top:${share(y)};width:${share(w)};height:${share(h)}">${artSvg(art)}</span>`;
      return held + (AROUND[pokeOf(out.holds, id)?.motion] || '');
    })
    .join('');
}
/** Draws the find a kind out `view` ({ kind, button }) holds into its layer, made on the button
 * the first time, only when `holds` changed since the last draw (the yard's decor.js and the
 * desktop's wear.js alike). True when it drew. */
export function drawHeld(view, holds = []) {
  const key = holds.join();
  if (view.heldLayer && key === view.held) return false;
  view.held = key;
  if (!view.heldLayer) {
    view.heldLayer = document.createElement('span');
    view.heldLayer.className = 'held-layer';
    view.button.append(view.heldLayer);
  }
  view.heldLayer.innerHTML = heldLayers(view.kind, holds);
  return true;
}
/** The drawings a find out is drawn from, to load with it. */
export function heldArt(kind, holds = []) {
  const out = findOutKind(kind);
  return out ? holds.map(id => drawingOf(out, heldKind(out.holds, id))).filter(Boolean) : [];
}
/** A find out's effects: a firefly glows from evening, as a lit gift does, but casts no light on the
 * ground, as it casts no shadow. */
export function findOutEffects(kind, holds = []) {
  const out = findOutKind(kind);
  if (!out) return [];
  return holds.some(id => heldKind(out.holds, id)?.kind === 'firefly') ? ['halo'] : [];
}
/** What a find out is called: the find's own name ("Crucian carp"); a gift's own name. */
export function decorName(kind, holds = []) {
  const out = findOutKind(kind);
  if (!out) return t(`decor.kind_${kind}`);
  return holds.length ? heldName(out.holds, holds[0]) : '';
}
/** What a friend says on reaching a thing of `kind` out in the yard or on the desktop: a find out
 * names the find it holds ("Hi there, Crucian carp!"), a gift has its own lines. */
export function visitLines(kind, holds = []) {
  const out = findOutKind(kind),
    key = `decor.visit_${kind}`;
  if (!out) return list(key);
  const name = holds.length ? heldName(out.holds, holds[0]) : '';
  return name ? lines(key, { name }) : list(key).filter(line => !line.includes('{'));
}
