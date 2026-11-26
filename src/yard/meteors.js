// Shooting stars for the sky layer (scenery.js): now and then one on a clear night, in a meteor
// shower one to three at a time, every one coming from the same point above the sky, and a wish
// that falls from the moon, long and slow, and leaves glittering dust behind it. meteorAt says
// where a star's head is and how long its tail; light-art.js draws them, each head in a glow
// (`halo`, its radius).

// The point a shower's stars seem to come from, as a share of the sky: high on the left, above it.
const RADIANT = { x: 0.14, y: -0.18 };
const DUST = ['#fff3d6', '#ffe2a8', '#fff8ec'];
// How many motes of dust a wish leaves, and the light round the moon as it goes.
const MOTES = 48;
const MOON_GLOW = '#ffe7b0';

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
    star.halo = star.width * 2.6;
    return star;
  });
}

/** A star that leaves the moon at `from` for the middle of the sky, the dust it lets go, and the
 * glow round the moon as it leaves. */
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
      halo: 16,
      wish: true,
    };
  // The dust drifts down slowly, each mote shimmering in its own phase (fireworks.js twinkle).
  const dust = Array.from({ length: MOTES }, (_, i) => {
    const k = (i + rng() * 0.5) / MOTES,
      cx = meteor.x + meteor.dx * k,
      cy = meteor.y + meteor.dy * k;
    return {
      cx,
      cy,
      tx: cx + (rng() - 0.5) * 16,
      ty: cy + 8 + rng() * 18,
      fall: 10,
      drag: 2.5,
      since: now + k * meteor.life,
      life: 1400 + rng() * 1400,
      color: DUST[i % DUST.length],
      glitter: true,
      trail: 50,
      phase: rng() * Math.PI * 2,
    };
  });
  const glow = {
    cx: from.x,
    cy: from.y,
    tx: from.x,
    ty: from.y,
    fall: 0,
    since: now,
    life: 1600,
    color: MOON_GLOW,
    glow: true,
    r: 46,
  };
  return { meteor, dust, glow };
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
