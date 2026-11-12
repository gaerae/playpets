// What a gift out on the desktop wears, as the yard draws it: a snowman's dress over its drawing
// and the Christmas tree's ornaments on it, from the garden the overlay is sent. The yard's own
// modules draw both (dress-layers.js, ornaments.js); this only keeps a desktop gift in step.

import { giftKind } from '../yard/catalog.js';
import { dressLayers } from '../yard/dress-layers.js';
import { drawTreeOrnaments } from '../yard/ornaments.js';

/** The drawings a gift of `kind` needs out on the desktop: its own, then what it can wear. */
export function wearArt(kind) {
  const gift = giftKind(kind);
  return gift ? [gift.art, ...(gift.dress || []).map(part => part.art)] : [];
}

/** Brings what the desktop gift `view` ({ id, kind, button }) wears in line with `garden`, as of
 * `now`: what a snowman wears, drawn again only when that changed, and what hangs on the tree. */
export function wear(view, garden, now = new Date()) {
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
  if (view.kind === 'xmas_tree') drawTreeOrnaments(view.button, garden, now);
}
