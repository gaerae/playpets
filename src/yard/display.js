// A find out of the album on its own: a fish, a bug or a treasure, with no container and no shadow
// (catalog.json "displays": the book it holds from and where in its box the find is drawn). The
// yard and the desktop draw one the same way: the find's own painting in its slot, and for a fish
// the bubbles it lets out when it swims. On the desktop each answers a poke in its own way, and a
// fish is drawn by its length. Design: docs/design/2026-11-19-album-finds-out.md,
// docs/design/2026-11-20-finds-come-alive.md.

import { lines, list, t } from '../core/i18n.js';
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

// How a find answers a poke by its book, and a bug by how it moves (catalog.json bug "kind"); a
// find's own "poke" (catalog.json) says otherwise, and may ring a cue (soundscape.js).
const BUG_MOTIONS = { butterfly: 'flutter', dragonfly: 'dart', firefly: 'blink', beetle: 'hop', cricket: 'hop' };
/** How a find of `book` answers a poke on the desktop: { motion } (overlay.css), and a `cue` when
 * it makes a sound; null for an id its book does not have. */
export function pokeOf(book, id) {
  const found = heldKind(book, id);
  if (!found) return null;
  const own = found.poke || {},
    motion = own.motion || (book === 'fish' ? 'swim' : book === 'treasure' ? 'twinkle' : BUG_MOTIONS[found.kind]);
  return own.cue ? { motion, cue: own.cue } : { motion };
}

// A fish's longest length (catalog.json "size") on a log scale, from a killifish's 4 cm to a
// sturgeon's 150 cm; the backend sizes it the same (content.rs find_scale).
const [SHORT, LONG, SMALLEST, BIGGEST] = [Math.log(4), Math.log(150), 0.7, 1.45];
/** How much bigger than its book's box a find out is drawn: a fish by its length, 1 for the rest. */
export function findScale(kind, holds = []) {
  const max = displayKind(kind)?.holds === 'fish' && heldKind('fish', holds[0])?.size?.[1];
  if (!max) return 1;
  const at = Math.min(1, Math.max(0, (Math.log(max) - SHORT) / (LONG - SHORT)));
  return SMALLEST + (BIGGEST - SMALLEST) * at;
}

const share = n => `${+(n * 100).toFixed(2)}%`;
// What shows a poke beside the find (overlay.css): a fish's bubbles, a treasure's sparkles. Each
// rests unseen until the find moves.
const BUBBLES = '<span class="bubbles"><i></i><i></i><i></i></span>',
  AROUND = { twinkle: '<span class="sparkle"><i></i><i></i><i></i></span>' };
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
      return held + (display.holds === 'fish' ? BUBBLES : AROUND[pokeOf(display.holds, id)?.motion] || '');
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
/** What a friend says on reaching a thing of `kind` out in the yard or on the desktop: a find out
 * names the find it holds ("Hi there, Crucian carp!"), a gift has its own lines. */
export function visitLines(kind, holds = []) {
  const display = displayKind(kind),
    key = `decor.visit_${kind}`;
  if (!display) return list(key);
  const name = holds.length ? heldName(display.holds, holds[0]) : '';
  return name ? lines(key, { name }) : list(key).filter(line => !line.includes('{'));
}
