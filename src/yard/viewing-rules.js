// When friends gather to view the blossom, where, and who stands where: rules only, apart from the
// page. viewing.js runs a gathering with them.

import { clamp } from '../core/math.js';
import { decorShown, yardSeason } from './decor-shown.js';
import { treeStage } from './discovery-rules.js';
import { EDGE } from './field.js';

/** How long a gathering lasts, in ms (from, to). */
export const VIEWING_MS = [60_000, 90_000];
/** The least time between two calls from the play menu, in ms. */
export const CALL_EVERY_MS = 3_600_000;
/** The most friends in one gathering. */
export const VIEWING_MAX = 6;

const FAIR = ['morning', 'day', 'evening'];
const MIDDLE = { x: 0.5, y: 0.12 };

/** Blossom time: a fair spring day of the festival, in a place that has seasons. `season` is the one
 * the yard shows (decor-shown.js), so a place without seasons never has it. */
export function viewingTime({ event, season, period, weather, world }) {
  return (
    event === 'blossom' && yardSeason({ world, season }) === 'spring' && FAIR.includes(period) && weather === 'clear'
  );
}

/** Whether friends may start a gathering of their own: once a local day, with two free friends. */
export function mayGather({ today, viewed, free, busy }) {
  return viewed !== today && free >= 2 && !busy;
}
/** Whether the person may call one from the menu: not within an hour of the last call. */
export function mayCall(now, last) {
  return last == null || now - last >= CALL_EVERY_MS;
}

/** Where to gather, in field coordinates: a grown cherry tree here (the one nearest the middle),
 * else the first picnic blanket shown, else the middle. `season` is the yard's shown season. */
export function viewingSpot({ trees = [], decor = [], world, now, limits, season }) {
  let best = null;
  for (const tree of trees) {
    if (tree.kind !== 'cherry' || tree.world !== world || treeStage(tree, now, limits) < 2) continue;
    if (!best || Math.abs(tree.x - 0.5) < Math.abs(best.x - 0.5)) best = tree;
  }
  if (best) return { kind: 'tree', id: best.id, x: best.x, y: best.y };
  const mat = decor.find(d => d.kind === 'picnic' && decorShown(d.kind, new Date(now), season));
  if (mat) return { kind: 'mat', id: mat.id, x: mat.x, y: mat.y };
  return { kind: 'middle', id: null, ...MIDDLE };
}

// Neighbours keep most of a friend's width apart (or a name tag's, if wider), and a second row stands
// this many gaps behind (or in front of) the first, half a gap aside, so it is as far from them.
const GAP = 0.85;
const ROW = 0.9;
// Under a tree, how far in front of the foot the nearest seats stand, and how much further forward
// each step out (a shallow arc); in the middle, how far in front of its point the row stands.
const IN_FRONT = 10;
const ARC = 8;
const MIDDLE_FRONT = 12;
// Rows tried before fewer friends come instead.
const ROWS = 3;

// Places along a row, by distance from its middle, in gaps: 0, -1, 1, … for an odd row, -0.5, 0.5,
// … for an even one. `n` is how many the row holds at most.
function slots(odd, n) {
  const out = [];
  for (let k = 0; out.length < n; k++) {
    const d = odd ? k : k + 0.5;
    if (odd && k === 0) out.push(0);
    else out.push(-d, d);
  }
  return out.slice(0, n);
}

/** Where each of up to `count` friends stands, in yard pixels (the foot), and `side`, which the tilt and
 * the look follow: 'left' when the spot is left of the seat. `spot` is in yard pixels too; `size` is the
 * widest friend's drawn width and `tag` its widest name tag. Neighbours keep apart so neither friends nor
 * tags overlap: under a tree to both sides of the trunk, its crown left open; on a blanket in one row
 * across it; in the middle in a shallow arc in front. A full row sends the rest to a row behind it (or in
 * front, without room behind); a yard with no room for everyone gives fewer seats, never closer ones. */
export function viewingSeats({ spot, count, width, top, bottom, zoom, size, tag = 0 }) {
  const gap = Math.max(GAP * size, tag + 4 * zoom),
    step = ROW * gap,
    lo = EDGE + size / 2,
    hi = width - EDGE - size / 2,
    fit = hi >= lo ? Math.floor((hi - lo) / gap + 1e-9) + 1 : 0,
    tree = spot.kind === 'tree',
    open = spot.w / 2 + gap / 2,
    // The first row, and which way the next ones go: behind a blanket when there is room, else in
    // front; in front of a tree or the middle when there is room, else behind.
    y0 =
      spot.kind === 'mat'
        ? spot.y - 0.45 * spot.h
        : clamp(spot.y + (tree ? IN_FRONT : MIDDLE_FRONT) * zoom, top, bottom),
    dir = spot.kind === 'mat' ? (y0 - step >= top ? -1 : 1) : y0 + step <= bottom ? 1 : -1,
    // A blanket's or the middle's row is shifted whole to stay inside the field, as far as it fits.
    n0 = Math.min(count, fit),
    span = ((n0 - 1) / 2) * gap,
    cx = tree ? spot.x : clamp(spot.x, Math.min(lo + span, (lo + hi) / 2), Math.max(hi - span, (lo + hi) / 2)),
    candidates = [];
  for (let r = 0; r < ROWS; r++) {
    const y = clamp(y0 + dir * r * step, top, bottom),
      stagger = r % 2 ? 0.5 : 0;
    if (tree)
      for (let k = 0; open + (k + stagger) * gap <= width; k++)
        for (const d of [-1, 1])
          candidates.push({
            x: spot.x + d * (open + (k + stagger) * gap),
            y: clamp(y + ARC * k * zoom, top, bottom),
          });
    else {
      const row = slots((n0 % 2 === 1) !== !!stagger, fit + 1),
        far = Math.max(...row.map(Math.abs));
      for (const j of row)
        candidates.push({
          x: cx + j * gap,
          y: spot.kind === 'mat' || r ? y : clamp(y + ARC * zoom * (far - Math.abs(j)), top, bottom),
        });
    }
  }
  const seats = [];
  for (const c of candidates) {
    if (seats.length >= count) break;
    if (c.x < lo - 1e-6 || c.x > hi + 1e-6) continue;
    if (seats.some(s => Math.hypot(s.x - c.x, s.y - c.y) < gap - 1e-6)) continue;
    seats.push({ x: c.x, y: c.y, side: spot.x < c.x ? 'left' : 'right' });
  }
  return seats;
}
