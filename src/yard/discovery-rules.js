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
export function projectFootprint(ellipse, bounds) {
  const width = Math.max(1, bounds.width - EDGE * 2),
    height = Math.max(1, bounds.bottom - bounds.top);
  return {
    x: (ellipse.x - EDGE) / width,
    y: (ellipse.y - bounds.top) / height,
    rx: ellipse.rx / width,
    ry: ellipse.ry / height,
  };
}
export function treeStage(tree, now = Date.now(), limits = LIMITS) {
  const age = Math.max(0, now - tree.planted);
  return Math.max(tree.stage || 0, age >= limits.treeMatureMs ? 2 : age >= limits.treeYoungMs ? 1 : 0);
}

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
