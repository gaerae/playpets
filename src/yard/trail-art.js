// How a winter animal is drawn where it is not seen whole: a short run of its prints (the album's
// clue before it is followed) and its tail peeking from behind a snowy bush (the album once
// followed, and the end of a trail in the yard). Markup only; the peek's geometry, each tail's
// place behind the bush, is the stylesheet's (garden.css), so the yard and the album draw it alike.
import { artHref, artSvg } from './art.js';
import { trailArt } from './catalog.js';

// The album draws prints larger than the yard's, in a 48-unit box. REACH is how far a print's
// drawing reaches from its centre, turned along the diagonal, in its own size.
const SCALE = 1.6;
const BOX = 48;
const REACH = 0.57;
const round = n => Math.round(n * 10) / 10;

/** Three of an animal's prints along a diagonal, lower left to upper right, as it walks. */
export function printSpecimen(track) {
  const { group, step, side, size } = track.gait,
    room = BOX / 2 - 1,
    // As large as the album draws prints, as far apart as the gait steps; where three would leave
    // the box, closer, down to touching, and only then smaller (a hare's bounds are long).
    scale = Math.min(SCALE, (room * Math.SQRT2) / size / (0.85 + REACH * Math.SQRT2 + side / size)),
    mark = size * scale,
    reach = REACH * mark + (side * scale) / Math.SQRT2,
    gap = Math.min(step * scale, Math.SQRT2 * (room - reach));
  const stamps = [-1, 0, 1].map(i => {
    // Along the line (1, -1)/√2; a single foot sits to one side and the next to the other.
    const off = group ? 0 : (i === 0 ? -1 : 1) * side * scale,
      x = BOX / 2 + (i * gap + off) / Math.SQRT2,
      y = BOX / 2 + (-i * gap + off) / Math.SQRT2;
    return `<use href="${artHref(track.print)}" x="${round(-mark / 2)}" y="${round(-mark / 2)}" width="${round(mark)}" height="${round(mark)}" transform="translate(${round(x)} ${round(y)}) rotate(45)"/>`;
  });
  return `<svg class="print-run" viewBox="0 0 ${BOX} ${BOX}" aria-hidden="true">${stamps.join('')}</svg>`;
}

/** The animal's tail behind a bush (`bush`, `twigs`), never the whole animal; `classes` are added. */
export function tailPeek(track, bush = 'bush', classes = '') {
  return `<span class="tail-peek${track.bird ? ' bird' : ''} ${classes}" data-track="${track.id}">${artSvg(track.tail, 'class="tail"')}${artSvg(trailArt(bush), 'class="peek-bush"')}</span>`;
}
