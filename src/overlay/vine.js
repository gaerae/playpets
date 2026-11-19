// A climbing flower out on the desktop (catalog.json "climbs": the morning glory). Once it blooms,
// standing on the bottom of its screen, it sends a vine along the bottom to the nearer side and up
// that side: a tenth of the way on the day it blooms, all of it a week later. Leaves sit on the inner
// side, flowers with a closed bud each (overlay.css shows one or the other by the hour), a tendril
// now and then and a young leaf at the tip, chosen from the flower's id so the vine is the same each
// time it is drawn. It is one drawing under the desktop's things, with no pointer, drawn again only
// when it grew or its flower moved. Design: docs/design/2026-11-19-desktop-edges.md.

import { artSize, artSvg } from '../yard/art.js';
import { flowerKind, STAGES } from '../yard/catalog.js';

const DAY = 24 * 60 * 60 * 1000;
/** reach: how near the work area's bottom its foot stands to climb; lift: how far above its foot
 * the vine runs; edge: how far in from the side
 * the vine climbs; climb: how much of the screen's height it climbs; start: the share grown on the
 * day it blooms; days: until it is all grown; step: the room between two leaves (px). */
export const VINE = Object.freeze({ reach: 48, lift: 3, edge: 8, climb: 2 / 3, start: 0.1, days: 7, step: 26 });
// Each piece's height on the screen (px); its width keeps its drawing's proportions.
const HEIGHT = { leaf: 17, flower: 20, tendril: 17, tip: 12 };
// How far from the stem a piece sits, toward the middle of the screen.
const INSET = 7;
// How often the vine is measured again while nothing moves: it grows about 4 px in that time.
const REMEASURE = 15 * 60 * 1000;

const seedOf = id => [...String(id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const round = n => Math.round(n * 10) / 10;

/** The vine the flower `plant` sends along its screen's edges at `now`, standing where `position`
 * (a layout row: its box and its screen's work area, `origin`) says; null when it does not climb. */
export function vineOf(plant, position, now = Date.now()) {
  const flower = flowerKind(plant?.kind);
  if (!flower?.climbs || !position?.origin) return null;
  const age = now - plant.planted - (STAGES.find(s => s.name === 'bloom')?.at ?? Infinity);
  if (!(age >= 0)) return null;
  const { origin } = position,
    standing = position.y + position.height * (flower.foot ?? 1) - origin.y;
  if (origin.height - standing > VINE.reach) return null;
  const foot = standing - VINE.lift;
  const from = position.x + position.width / 2 - origin.x,
    side = from < origin.width / 2 ? 'left' : 'right',
    edge = side === 'left' ? VINE.edge : origin.width - VINE.edge,
    top = Math.min(foot, origin.height * (1 - VINE.climb)),
    across = Math.abs(from - edge),
    total = across + (foot - top);
  const share = Math.min(1, VINE.start + ((1 - VINE.start) * age) / (VINE.days * DAY)),
    length = share >= 1 ? total : total * share;
  // A point `d` along the vine, and which way it grows there.
  const along = d => {
    if (d >= total) return { at: [edge, top], up: true };
    if (d <= across) return { at: [from + Math.sign(edge - from) * d, foot], up: false };
    return { at: [edge, foot - (d - across)], up: true };
  };
  const points = [[from, foot]];
  if (length > across) points.push([edge, foot]);
  points.push(along(length).at);
  return { side, points, total, length, width: origin.width, height: origin.height, pieces: pieces(flower.climbs) };

  function pieces(climbs) {
    const seed = seedOf(plant.id),
      inward = side === 'left' ? 1 : -1,
      out = [];
    const place = (kind, d, art, i, extra = {}) => {
      const { at, up } = along(d),
        tilt = ((seed + i * 7) % 5) * 10 - 20;
      out.push({
        kind,
        art,
        x: round(at[0] + (up ? inward * INSET : 0)),
        y: round(at[1] - (up ? 0 : INSET)),
        height: HEIGHT[kind],
        // Its drawing points up: on the bottom it leans a little, up the side it turns inward.
        angle: (up ? inward * 90 : 0) + tilt,
        ...extra,
      });
    };
    for (let i = 1; i * VINE.step < length - VINE.step / 2; i++) {
      const d = i * VINE.step;
      if (i % 3 === 2) place('flower', d, climbs.flowers[(seed + i) % climbs.flowers.length], i, { bud: climbs.bud });
      else if ((seed + i) % 5 === 4) place('tendril', d, climbs.tendril, i);
      else place('leaf', d, climbs.leaves[(seed + i) % climbs.leaves.length], i);
    }
    place('tip', length, climbs.tip, 0);
    return out;
  }
}

/** A piece as markup: its drawing turned about where it sits. */
function pieceSvg(art, { x, y, height, angle }) {
  const [w, h] = artSize(art),
    width = round((height * w) / h);
  return `<g transform="rotate(${angle} ${x} ${y})">${artSvg(art, `x="${round(x - width / 2)}" y="${round(y - height)}" width="${width}" height="${height}"`)}</g>`;
}

/** The vine as one drawing over its screen's work area: a gently waving stem, then its pieces. */
export function vineSvg(vine) {
  // The stem waves 2 px either side of its line, a crest every 13 px, drawn as smooth curves
  // through the crests.
  const crests = [];
  for (let d = 0, i = 0; ; d = Math.min(vine.length, d + 13), i++) {
    const [x, y, up] = pointAt(vine.points, d),
      wave = d > 0 && d < vine.length ? (i % 2 ? 2 : -2) : 0;
    crests.push(up ? [x + wave, y] : [x, y + wave]);
    if (d >= vine.length) break;
  }
  const stem = [`M${crests[0].map(round).join(' ')}`];
  for (let i = 1; i < crests.length; i++) {
    const [ax, ay] = crests[i - 1],
      [bx, by] = crests[i],
      end = i === crests.length - 1 ? [bx, by] : [(ax + bx) / 2, (ay + by) / 2];
    stem.push(`Q${round(ax)} ${round(ay)} ${round(end[0])} ${round(end[1])}`);
  }
  const parts = vine.pieces
    .map(p =>
      p.kind === 'flower'
        ? `<g class="vine-open">${pieceSvg(p.art, p)}</g><g class="vine-closed">${pieceSvg(p.bud, { ...p, height: p.height * 0.85 })}</g>`
        : pieceSvg(p.art, p),
    )
    .join('');
  return `<svg class="vine" width="${vine.width}" height="${vine.height}" aria-hidden="true"><path class="vine-stem" d="${stem.join(' ')}"/>${parts}</svg>`;
}

/** The point `d` along the vine's line, and whether it is on the climb up the side (its second
 * stretch). */
function pointAt(points, d) {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1],
      [bx, by] = points[i],
      span = Math.hypot(bx - ax, by - ay);
    if (d <= span || i === points.length - 1) {
      const t = span ? Math.min(1, d / span) : 0;
      return [ax + (bx - ax) * t, ay + (by - ay) * t, i === 2];
    }
    d -= span;
  }
  return [...points[0], false];
}

/** Brings the desktop flower `view`'s vine in line with where it stands (`position`) at `now`, in
 * `layer`, under the desktop's things: none while it is carried, or for a flower that does not
 * climb. Measured again only when it moved or a while has passed. */
export function showVine(view, position, garden, layer, now = Date.now()) {
  const plant = view.growing ? garden?.plants?.find(p => p.id === view.id) : null,
    o = position?.origin,
    key =
      plant && !position.dragging
        ? `${position.x}|${position.y}|${position.width}|${position.height}|${o.x}|${o.y}|${o.width}|${o.height}|${plant.planted}|${Math.floor(now / REMEASURE)}`
        : '';
  if (key === view.vineKey) return;
  view.vineKey = key;
  const vine = key ? vineOf(plant, position, now) : null;
  view.vine?.remove();
  view.vine = null;
  if (!vine) return;
  layer.insertAdjacentHTML('afterbegin', vineSvg(vine));
  view.vine = layer.firstElementChild;
}
