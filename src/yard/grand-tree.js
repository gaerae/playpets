// The Christmas tree's grand look, drawn alike in the yard (christmas-night.js) and out on the
// desktop (overlay/wear.js): a layer inside the small tree's own button, sized from the two drawings
// and standing on the same foot. The `xmas-grand` class shows it and `xmas-rise` is the change
// (worn.css); this only makes the layer.

import { percent } from '../core/math.js';
import { artSize, artSvg } from './art.js';
import { giftKind } from './catalog.js';

/** How long the change takes (worn.css .xmas-rise). */
export const RISE_MS = 2600;

/** The small tree's drawing's size and the grand one's, in their own units, and the grand look
 * (catalog.json `night`). */
export function treeSizes() {
  const gift = giftKind('xmas_tree');
  return { small: gift.size || artSize(gift.art), big: artSize(gift.night.art), night: gift.night };
}
const span = className => {
  const node = document.createElement('span');
  node.className = className;
  return node;
};
/** The grand tree's layer inside the tree's `button`, made the first time it is asked for: the
 * light pooling on the snow, the drawing behind the window it is revealed through, the veil, the
 * star's glow and a glint for a bulb. It takes no presses. */
export function grandLayers(button) {
  const made = button.querySelector('.xmas-night');
  if (made) return made;
  const { small, big, night } = treeSizes();
  const layer = span('xmas-night'),
    reveal = span('xmas-reveal'),
    art = span('xmas-art'),
    star = span('xmas-star');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.width = percent(big[0] / small[0]);
  layer.style.height = percent(big[1] / small[1]);
  art.innerHTML = artSvg(night.art);
  reveal.append(art);
  star.style.left = percent(night.star[0]);
  star.style.top = percent(night.star[1]);
  layer.append(span('xmas-pool'), reveal, span('xmas-veil'), star, span('xmas-glint'));
  button.append(layer);
  return layer;
}
