// The rules of a winter footprint trail, as pure functions: when a trail is laid, which friend
// leaves it, where it runs, where its prints go and when new snow covers it.
// Snow covers a trail only after a full hour of fresh snow (three weather blocks) that began after
// the trail was laid, so a passing flurry leaves the prints alone. Weather the person fixed by hand
// is the same in every block, so it never has a block where snow begins: it covers no trail and
// makes no snowy morning, and only the yard's own weather draw can.
import { distance, seeded } from '../core/math.js';
import { groundAllows, tileOf } from './discovery-rules.js';

// One weather block, as `autoWeather` draws it from epoch 0.
export const BLOCK_MS = 1200000;
const HOUR_MS = 3600000;
// The bush at a trail's end shrinks with the yard only this far: smaller, in the mini window, the
// tail peeking from it is a speck.
const END_ZOOM_MIN = 0.75;
/** The scale of a trail end's bush and tail in a yard drawn at `zoom`. */
export const endZoom = zoom => Math.max(zoom, END_ZOOM_MIN);

/** Start of the first snowfall that begins in [fromMs, toMs): three snow blocks after a block that is not snow. */
export function snowfallStart(fromMs, toMs, weatherAt) {
  for (let b = Math.ceil(fromMs / BLOCK_MS) * BLOCK_MS; b < toMs; b += BLOCK_MS) {
    if (
      weatherAt(b) === 'snow' &&
      weatherAt(b + BLOCK_MS) === 'snow' &&
      weatherAt(b + 2 * BLOCK_MS) === 'snow' &&
      weatherAt(b - BLOCK_MS) !== 'snow'
    )
      return b;
  }
  return null;
}

/** When snow that began after `laid` has fallen for an hour, or null while it has not (or has not begun). */
export function coveredAt(laid, now, weatherAt) {
  const s = snowfallStart(laid, now, weatherAt);
  if (s === null) return null;
  const done = s + 2 * BLOCK_MS;
  return done <= now ? done : null;
}

/** December 26 to January 7: the days the yard keeps to one quiet trail. */
export function quietDay(date) {
  const m = date.getMonth(),
    d = date.getDate();
  return (m === 11 && d >= 26) || (m === 0 && d <= 7);
}

/** Trails a day holds: the morning one, and a second when snow began in the small hours. */
export function trailsOn(date, weatherAt) {
  const out = [0];
  if (quietDay(date)) return out;
  const y = date.getFullYear(),
    m = date.getMonth(),
    d = date.getDate();
  const from = new Date(y, m, d).getTime(),
    to = new Date(y, m, d, 5).getTime();
  if (snowfallStart(from, to, weatherAt) !== null) out.push(1);
  return out;
}

/** When trail n of a day was laid: the first when it was first seen, the snowy-night one at 05:00. */
export function laidAt(n, date, seen) {
  return n === 0 ? seen : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 5).getTime();
}

/** FNV-1a of `${day}#${n}` as an unsigned 32-bit number. */
export function seedOf(day, n) {
  let h = 0x811c9dc5;
  for (const c of `${day}#${n}`) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The friend that leaves trail n of a day; a second trail is always another friend. */
export function trailAnimal(day, n, ids) {
  const i0 = seedOf(day, 0) % ids.length;
  if (n === 0 || ids.length < 2) return ids[i0];
  return ids[(i0 + 1 + (seedOf(day, 1) % (ids.length - 1))) % ids.length];
}

function walksOnGround(points, profile) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const steps = Math.max(1, Math.ceil(distance(a, b) / 0.01));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      if (!groundAllows({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, profile)) return false;
    }
  }
  return true;
}

/** A trail in field coordinates: in from a side, winding to an end on ground a friend can dig. */
export function trailPath(seed, profile, { taken = [], other = null } = {}) {
  if (!profile?.soil || !profile.bounds) return null;
  const { left, right, top, bottom } = profile.bounds;
  const bandTop = top + (bottom - top) * 0.15,
    bandHeight = (bottom - top) * 0.7;
  const takenTiles = new Set(taken.map(tileOf));
  for (let attempt = 0; attempt < 20; attempt++) {
    const rng = seeded(seed + attempt);
    const fromLeft = rng() < 0.5;
    const startX = fromLeft ? left : right;
    const startY = bandTop + rng() * bandHeight;
    // A third of the seeds want the far side; the choice follows the seed, not the try, and a far
    // trail that keeps meeting water gives up and ends inside in the last tries.
    const far = (Math.imul(seed, 2654435761) >>> 0) / 4294967296 < 1 / 3 && attempt < 14;
    let endX;
    if (far) endX = fromLeft ? 0.9 + rng() * 0.04 : 0.06 + rng() * 0.04;
    else endX = 0.25 + rng() * 0.5;
    const endY = bandTop + rng() * bandHeight;
    const count = 5 + Math.floor(rng() * 4);
    let sign = rng() < 0.5 ? 1 : -1;
    const points = [{ x: startX, y: startY }];
    for (let i = 1; i < count - 1; i++) {
      const t = i / (count - 1);
      const swing = 0.08 + rng() * 0.07;
      points.push({ x: startX + (endX - startX) * t, y: startY + (endY - startY) * t + sign * swing });
      sign = -sign;
    }
    points.push({ x: endX, y: endY });
    const end = points[points.length - 1];
    if (end.x < 0.06 || end.x > 0.94) continue;
    if (takenTiles.has(tileOf(end))) continue;
    if (other && (distance(end, other) < 0.15 || tileOf(end) === tileOf(other))) continue;
    let length = 0;
    for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
    if (length < 0.6 || length > 1.6) continue;
    if (!walksOnGround(points, profile)) continue;
    const last = points[points.length - 2];
    return { points, end, bush: seed % 3 === 0 ? 'twigs' : 'bush', exit: end.x >= last.x ? 'right' : 'left' };
  }
  return null;
}

/** Prints along a pixel polyline: one every gait.step * zoom px, walkers alternating sides, bounders in line. */
export function stamps(points, gait, zoom) {
  const out = [];
  // A repeated point has no direction; dropping it keeps the first real segment's angle.
  const pixels = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  const gap = gait.step * zoom,
    size = gait.size * zoom,
    side = gait.group ? 0 : gait.side * zoom;
  if (!(gap > 0) || pixels.length === 0) return out;
  const place = (p, dx, dy) => {
    const len = Math.hypot(dx, dy) || 1;
    const off = side * (out.length % 2 === 0 ? 1 : -1);
    out.push({
      x: p.x + (-dy / len) * off,
      y: p.y + (dx / len) * off,
      angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
      size,
    });
  };
  if (pixels.length === 1) {
    place(pixels[0], 0, -1);
    return out;
  }
  let next = 0,
    walked = 0;
  for (let i = 1; i < pixels.length; i++) {
    const a = pixels[i - 1],
      b = pixels[i];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy);
    while (next <= walked + len + 1e-9) {
      const t = len ? Math.min(1, (next - walked) / len) : 0;
      place({ x: a.x + dx * t, y: a.y + dy * t }, dx, dy);
      next += gap;
    }
    walked += len;
  }
  return out;
}

/** Prints soften over their first eight hours, in steps of 0.05. */
export function trailOpacity(laid, now) {
  const v = 0.6 - 0.25 * Math.min(1, Math.max(0, now - laid) / (8 * HOUR_MS));
  return Math.round(v * 20) / 20;
}
