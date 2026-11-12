// What a built snowman wears, drawn over its drawing from the catalogue's anchors (catalog.json
// "dress"): in the yard (decor.js) and out on the desktop (overlay.js) alike, so this module keeps
// to the catalogue and the drawings. Putting things on and taking them off is snowman-dress.js.

import { percent } from '../core/math.js';
import { artSize, artSvg } from './art.js';
import { giftKind } from './catalog.js';

/** A part's box over the snowman's drawing, as fractions of it: placed by its anchor's centre, its
 * height from its own drawing's shape. */
export function partBox(gift, part) {
  const [boxW, boxH] = artSize(gift.art),
    [x, y, w] = part.at,
    [partW, partH] = artSize(part.art),
    h = (w * boxW * partH) / partW / boxH;
  return { left: x - w / 2, top: y - h / 2, width: w };
}

/** The parts a snowman of `kind` wears, as spans over its drawing, in the catalogue's (drawing)
 * order; each is placed by its anchor's centre, so a hat may rise above the box, and turned by its
 * `turn` (degrees), as a hat sits a little askew. */
export function dressLayers(kind, dress) {
  const gift = giftKind(kind),
    worn = new Set(dress || []);
  if (!gift?.dress || !worn.size) return '';
  return gift.dress
    .filter(part => worn.has(part.id))
    .map(part => {
      const box = partBox(gift, part);
      const style =
        `left:${percent(box.left, 2)};top:${percent(box.top, 2)};width:${percent(box.width, 2)}` +
        (part.turn ? `;rotate:${part.turn}deg` : '');
      return `<span class="dress-part" data-part="${part.id}" style="${style}">${artSvg(part.art)}</span>`;
    })
    .join('');
}
