// Shooting stars for the sky layer (scenery.js): now and then one on a clear night, in a meteor
// shower one to three at a time, every one coming from the same point above the sky, and a wish
// that falls from the moon, long and slow, and leaves glittering dust behind it. meteorAt says
// where a star's head is and how long its tail; scenery draws them.

// The point a shower's stars seem to come from, as a share of the sky: high on the left, above it.
const RADIANT = { x: 0.14, y: -0.18 };
const DUST = '#fff3d6';

/** One to three shooting stars from the shower's radiant, close together, from `now` on. */
export function shower(w, h, now, rng = Math.random) {
  const count = rng() < 0.62 ? 1 : rng() < 0.65 ? 2 : 3,
    radiant = { x: w * RADIANT.x, y: h * RADIANT.y };
  let since = now;
  return Array.from({ length: count }, () => {
    const x = w * (0.2 + rng() * 0.65),
      y = h * (0.03 + rng() * 0.22),
      angle = Math.atan2(y - radiant.y, x - radiant.x) + (rng() - 0.5) * 0.12,
      length = w * (0.13 + rng() * 0.15),
      star = {
        x,
        y,
        dx: Math.cos(angle) * length,
        dy: Math.sin(angle) * length,
        tail: length * 0.55,
        since,
        life: 550 + rng() * 450,
        width: 1.5 + rng() * 1.1,
        radiant,
      };
    since += 120 + rng() * 260;
    return star;
  });
}

/** A star that leaves the moon at `from` for the middle of the sky, and the dust it lets go. */
export function wish(from, w, h, now, rng = Math.random) {
  const side = Math.sign(w / 2 - from.x) || 1,
    length = w * (0.42 + rng() * 0.08),
    angle = Math.atan2(h * (0.2 + rng() * 0.06), side * length),
    meteor = {
      x: from.x + side * 12,
      y: from.y + 8,
      dx: Math.cos(angle) * length,
      dy: Math.sin(angle) * length,
      tail: length * 0.4,
      since: now,
      life: 1700,
      width: 3.2,
      wish: true,
    };
  const dust = Array.from({ length: 30 }, (_, i) => {
    const k = (i + rng() * 0.5) / 30,
      cx = meteor.x + meteor.dx * k,
      cy = meteor.y + meteor.dy * k;
    return {
      cx,
      cy,
      tx: cx + (rng() - 0.5) * 14,
      ty: cy + 6 + rng() * 14,
      fall: 6,
      since: now + k * meteor.life,
      life: 900 + rng() * 1100,
      color: DUST,
      glitter: true,
      trail: 40,
    };
  });
  return { meteor, dust };
}

/** Where a star's head is at `now`, which way it flies, how long its tail and how bright, or null
 * before it starts and after it is gone. */
export function meteorAt(m, now) {
  const t = (now - m.since) / m.life;
  if (t < 0 || t >= 1) return null;
  const travel = Math.hypot(m.dx, m.dy);
  return {
    x: m.x + m.dx * t,
    y: m.y + m.dy * t,
    angle: Math.atan2(m.dy, m.dx),
    length: Math.min(m.tail, travel * t),
    alpha: t < 0.12 ? t / 0.12 : t > 0.7 ? ((1 - t) / 0.3) ** 1.5 : 1,
  };
}
