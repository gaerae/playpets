// When friends gather to view the blossom, where, and who stands where: rules only, apart from the
// page. viewing.js runs a gathering with them.

import { clamp } from '../core/math.js';
import { decorShown } from './decor-shown.js';
import { treeStage } from './discovery-rules.js';
import { EDGE } from './field.js';
import { worldAllows } from './worlds.js';

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
    event === 'blossom' &&
    worldAllows(world, 'seasonalEffects') &&
    season === 'spring' &&
    FAIR.includes(period) &&
    weather === 'clear'
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

// Four seats on a blanket: two rows of two across its inner 70 %.
const onMat = ({ x, y, w, h }) => [
  [x - 0.175 * w, y - 0.65 * h],
  [x + 0.175 * w, y - 0.65 * h],
  [x - 0.175 * w, y - 0.25 * h],
  [x + 0.175 * w, y - 0.25 * h],
];

/** Where each of `count` friends stands, in yard pixels (the foot), and `side`, which the tilt and
 * the look follow: 'left' when the spot is left of the seat. `spot` is in yard pixels too. */
export function viewingSeats({ spot, count, width, top, bottom, zoom }) {
  const lo = EDGE + 20 * zoom,
    hi = width - EDGE - 20 * zoom,
    seat = (x, y) => {
      const sx = clamp(x, lo, hi);
      return { x: sx, y: clamp(y, top, bottom), side: spot.x < sx ? 'left' : 'right' };
    },
    points = [];
  if (spot.kind === 'mat') {
    points.push(...onMat(spot).slice(0, count));
    // The rest sit beside its ends, left then right, a step further out for each pair.
    for (let i = 0; points.length < count; i++) {
      const out = spot.w / 2 + 28 * zoom + Math.floor(i / 2) * 36 * zoom;
      points.push([spot.x + (i % 2 ? out : -out), spot.y - 0.2 * spot.h]);
    }
    return points.map(([x, y]) => seat(x, y));
  }
  // A loose half circle in front of the foot, or above it when the yard has no room below. The arc's
  // centre is clamped, not each seat, so every seat keeps its own place.
  const rx = Math.min(Math.max(spot.w / 2 + 40 * zoom, 70 * zoom), (hi - lo) / 2),
    below = bottom - spot.y >= 60 * zoom,
    ry = Math.max(0, Math.min(rx * 0.35, below ? bottom - spot.y : spot.y - top)),
    cx = clamp(spot.x, lo + rx, hi - rx),
    dir = below ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const a = ((count === 1 ? 90 : 25 + (130 * i) / (count - 1)) * Math.PI) / 180;
    const x = cx + rx * Math.cos(a);
    let y = spot.y + dir * ry * Math.sin(a);
    // Too close to an earlier seat: step back into a second row.
    if (points.some(p => Math.hypot(p[0] - x, p[1] - y) < 30 * zoom)) y += dir * 24 * zoom;
    points.push([x, y]);
  }
  return points.map(([x, y]) => seat(x, y));
}
