// When and where spring shoots sprout, as pure rules. After rain, once the sky clears, two or three
// come up (at most once in three hours); on a fair spring morning one does (once a day); at most
// three stand out at a time, each for six hours, on free ground and apart from the others. They are
// the page's to decide because only the page knows the local day, the weather the yard shows and
// the ground; the backend keeps only what was found.
import { SHOOTS, shootKind } from './catalog.js';
import { yardSeason } from './decor-shown.js';
import { behind, freeSpot } from './discovery-rules.js';

export const SHOOTS_OUT = 3;
export const SHOOT_STAYS_MS = 6 * 3600_000;
export const RAIN_GAP_MS = 3 * 3600_000;
/** The least distance between two shoots, in field units. */
export const SHOOT_APART = 0.1;

/** Whether the yard can grow shoots now: spring, in a place that shows seasons, on soil. */
export const shootTime = (scene, soil) => yardSeason(scene) === 'spring' && soil;

/** How many shoots come up at this look at the yard, and the record after it. `before` is the
 * weather seen last time (null on the first repaint, which never counts as a rain that just
 * ended). Returns a new record; the caller caps `count` by room, so a full yard still spends the
 * morning. */
export function sprouting(kept, { before, weather, period, day, now }, rng) {
  const fair = weather === 'clear';
  if (before === 'rain' && fair && now - kept.rainAt >= RAIN_GAP_MS)
    return {
      count: rng() < 0.5 ? 2 : 3,
      kept: { ...kept, rainAt: now, morning: period === 'morning' ? day : kept.morning },
    };
  if (period === 'morning' && fair && kept.morning !== day) return { count: 1, kept: { ...kept, morning: day } };
  return { count: 0, kept };
}

/** Up to `count` kinds not already out, each equally likely. */
export function pickShoots(count, out, rng) {
  const left = SHOOTS.map(s => s.id).filter(id => !out.some(s => s.kind === id));
  const picked = [];
  while (picked.length < count && left.length) picked.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
  return picked;
}

/** A spot on free ground, where no body hides it, at least SHOOT_APART from each of `near` (plain
 * {x, y} points: other shoots, the rainbow's end); null when twenty tries find none. */
export const shootSpot = (rng, ground, near) =>
  freeSpot(
    rng,
    ground,
    { x: [0.12, 0.88], y: [0.3, 0.9] },
    p => !behind(p, ground) && near.every(n => Math.hypot(p.x - n.x, p.y - n.y) >= SHOOT_APART),
  );

/** The shoots still standing at `now`. */
export const freshShoots = (out, now) => out.filter(s => now - s.at >= 0 && now - s.at < SHOOT_STAYS_MS);

const unit = n => Number.isFinite(n) && n >= 0 && n <= 1;

/** Reads the webview's stored record back, keeping only what makes sense. */
export function keptShoots(text, now) {
  let saved = null;
  try {
    saved = JSON.parse(text);
  } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { morning: '', rainAt: 0, out: [] };
  const ids = new Set();
  const good = freshShoots(Array.isArray(saved.out) ? saved.out : [], now).filter(s => {
    const ok =
      s &&
      typeof s === 'object' &&
      shootKind(s.kind) &&
      typeof s.id === 'string' &&
      s.id &&
      typeof s.world === 'string' &&
      s.world &&
      unit(s.x) &&
      unit(s.y) &&
      !ids.has(s.id);
    if (ok) ids.add(s.id);
    return ok;
  });
  return {
    morning: typeof saved.morning === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.morning) ? saved.morning : '',
    rainAt: Number.isFinite(saved.rainAt) && saved.rainAt <= now ? saved.rainAt : 0,
    out: good.slice(0, SHOOTS_OUT).map(({ id, kind, world, x, y, at }) => ({ id, kind, world, x, y, at })),
  };
}
