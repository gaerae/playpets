// What a gift out on the desktop wears, as the yard draws it: a snowman's dress over its drawing
// and the Christmas tree's ornaments on it, from the garden the overlay is sent, and the grand tree
// while the yard has its Christmas night. The yard's own modules draw all three (dress-layers.js,
// ornaments.js, grand-tree.js); this only keeps a desktop gift in step.

import { t } from '../core/i18n.js';
import { reduced } from '../core/sprites.js';
import { giftKind } from '../yard/catalog.js';
import { dressLayers } from '../yard/dress-layers.js';
import { grandLayers, RISE_MS } from '../yard/grand-tree.js';
import { drawTreeOrnaments } from '../yard/ornaments.js';

/** The drawings a gift of `kind` needs out on the desktop: its own, then what it can wear and its
 * night look. */
export function wearArt(kind) {
  const gift = giftKind(kind);
  if (!gift) return [];
  return [gift.art, ...(gift.dress || []).map(part => part.art), ...(gift.night ? [gift.night.art] : [])];
}

// The tree stands grand while `grand` (the yard said so: christmas-night.js tells the backend, which
// tells this window). Out here when the night begins, it is grand at once; turning grand while out,
// it grows as in the yard, or crossfades with reduced motion.
function standGrand(view, grand) {
  const was = view.grand;
  view.grand = grand;
  if (was === grand || (was === undefined && !grand)) return;
  const button = view.button;
  if (grand) grandLayers(button);
  clearTimeout(view.riseTimer);
  button.classList.remove('xmas-rise');
  button.classList.toggle('xmas-grand', grand);
  button.title = t(grand ? 'decor.kind_xmas_tree_grand' : 'decor.kind_xmas_tree');
  button.setAttribute('aria-label', button.title);
  if (grand && was === false && !reduced.matches) {
    button.classList.add('xmas-rise');
    view.riseTimer = setTimeout(() => button.classList.remove('xmas-rise'), RISE_MS);
  }
}

/** Brings what the desktop gift `view` ({ id, kind, button }) wears in line with `garden`, as of
 * `now`: what a snowman wears, drawn again only when that changed, and what hangs on the tree and
 * whether it stands grand (`night`: the kinds the yard shows in their night look). */
export function wear(view, garden, now = new Date(), night = []) {
  if (giftKind(view.kind)?.dress) {
    const dress = garden?.decor?.find(d => d.id === view.id)?.dress || [];
    if (dress.join() !== view.worn) {
      view.worn = dress.join();
      if (!view.dressLayer) {
        view.dressLayer = document.createElement('span');
        view.dressLayer.className = 'dress-layers';
        view.button.append(view.dressLayer);
      }
      view.dressLayer.innerHTML = dressLayers(view.kind, dress);
    }
  }
  if (view.kind !== 'xmas_tree') return;
  standGrand(view, night.includes('xmas_tree'));
  drawTreeOrnaments(view.button, garden, now);
}
