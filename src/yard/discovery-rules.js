// Ground and growth rules shared by placement previews and saved discoveries.
import { LIMITS } from '../core/limits.js';
import { EDGE } from './field.js';

export function groundAllows(point, profile) {
  if (!profile?.soil || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const b = profile.bounds;
  if (!b || point.x < b.left || point.x > b.right || point.y < b.top || point.y > b.bottom) return false;
  return ![...(profile.water || []), ...(profile.obstacles || [])].some(
    e => ((point.x - e.x) / e.rx) ** 2 + ((point.y - e.y) / e.ry) ** 2 <= 1,
  );
}
/** A yard-pixel ellipse on the field (0 to 1 each way). `top` is where the field begins at the
 * ellipse's x (field.js topAt, higher where a path reaches back); the field's line by default. */
export function projectFootprint(ellipse, bounds, top = bounds.top) {
  const width = Math.max(1, bounds.width - EDGE * 2),
    height = Math.max(1, bounds.bottom - top);
  return {
    x: (ellipse.x - EDGE) / width,
    y: (ellipse.y - top) / height,
    rx: ellipse.rx / width,
    ry: ellipse.ry / height,
  };
}
export function treeStage(tree, now = Date.now(), limits = LIMITS) {
  const age = Math.max(0, now - tree.planted);
  return Math.max(tree.stage || 0, age >= limits.treeMatureMs ? 2 : age >= limits.treeYoungMs ? 1 : 0);
}

// The backend remembers each dig by its tile on an 8 × 8 grid over the field, for a day
// (discovery.rs dig): a second dig on a remembered tile only repeats what the first found.
const TILES = 8;
const DIG_MEMORY_MS = 86_400_000;
/** The dig tile a field point falls in, as the backend counts it. */
export const tileOf = p => `${Math.floor(p.x * TILES)},${Math.floor(p.y * TILES)}`;
/** The middle of the dig tile a field point falls in. */
export const tileMiddle = p => ({
  x: (Math.floor(p.x * TILES) + 0.5) / TILES,
  y: (Math.floor(p.y * TILES) + 0.5) / TILES,
});
/** The middles of the tiles dug in this place that the backend still remembers at `now` (ms). */
export const dugSpots = (digs, world, now) =>
  (digs || [])
    .filter(d => d.world === world && now - d.at < DIG_MEMORY_MS)
    .map(d => ({ x: (d.tileX + 0.5) / TILES, y: (d.tileY + 0.5) / TILES }));

/** A free spot for something set on the field: the first of twenty draws, `x` and `y` within the
 * ranges (field units), that the ground allows and `ok` accepts; null when none does. The draws
 * are taken x then y. */
export function freeSpot(rng, ground, { x, y }, ok = () => true) {
  for (let tries = 0; tries < 20; tries++) {
    const point = { x: x[0] + rng() * (x[1] - x[0]), y: y[0] + rng() * (y[1] - y[0]) };
    if (groundAllows(point, ground) && ok(point)) return point;
  }
  return null;
}
// The ground keeps only the feet of what stands on it, so a print may pass behind a gift as a
// friend's path would; but a bush behind one would hide the tail, so an end there is given up (its
// tile taken) and the trail laid again, a few times at most.
const BODY = 3;
export const behind = (p, profile) =>
  (profile.obstacles || []).some(
    o => ((p.x - o.x) / (o.rx * 1.2)) ** 2 + ((p.y - (o.y - o.ry * BODY)) / (o.ry * BODY)) ** 2 <= 1,
  );
