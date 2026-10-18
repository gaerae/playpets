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
