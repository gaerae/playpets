// The light the night sky and the fireworks add, painted onto a context it is handed: stars,
// shooting stars, fireworks' sparks and the glow a burst casts on the yard. Where everything is and
// when it moves is scenery.js's (meteors.js and fireworks.js for the paths); this file only paints.
import { sparkAt, twinkle } from './fireworks.js';
import { meteorAt } from './meteors.js';

const TAU = Math.PI * 2;
const STAR = '255,250,230';
// A soft glow, one small canvas for each colour, drawn scaled wherever a head or a burst shines: a
// radial gradient for each of hundreds of stars every frame would cost far more. They are made the
// first time a colour shines and let go when the sky is dark again (letGlowsGo).
const GLOW_PX = 64;
const glows = new Map();
function glowOf(color) {
  let sprite = glows.get(color);
  if (sprite || !globalThis.document?.createElement) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = GLOW_PX;
  const g = sprite.getContext('2d'),
    r = GLOW_PX / 2,
    fill = g.createRadialGradient(r, r, 0, r, r, r);
  fill.addColorStop(0, '#fff');
  fill.addColorStop(0.16, color);
  fill.addColorStop(0.45, `${color}55`);
  fill.addColorStop(1, `${color}00`);
  g.fillStyle = fill;
  g.fillRect(0, 0, GLOW_PX, GLOW_PX);
  glows.set(color, sprite);
  return sprite;
}
// A glow of `color` (#rrggbb) round (x, y), `r` px out, at `alpha`.
function glow(c, color, x, y, r, alpha) {
  const sprite = alpha > 0.01 && r > 0 && glowOf(color);
  if (!sprite) return;
  c.globalAlpha = Math.min(1, alpha);
  c.drawImage(sprite, x - r, y - r, r * 2, r * 2);
}
/** The glows are let go once nothing shines in the sky (scenery.js). */
export function letGlowsGo() {
  for (const sprite of glows.values()) sprite.width = sprite.height = 0;
  glows.clear();
}
// A glow's light over its life: it blooms quickly, then fades slowly.
const bloom = age => Math.min(1, age / 0.12) * (1 - age) ** 1.6;

/** The stars of a clear night, each as the ambient art's sprite or, before it is ready, a dot. */
export function drawStars(c, stars, ambient) {
  for (const s of stars) {
    c.globalAlpha = s.alpha;
    if (ambient.star(c, s)) continue;
    c.fillStyle = `rgb(${STAR})`;
    c.beginPath();
    c.arc(s.x, s.y, s.r, 0, TAU);
    c.fill();
  }
}

/** Shooting stars add their light to the sky: a tail that tapers behind a head in a soft glow. */
export function drawMeteors(c, meteors, now, ambient) {
  c.globalCompositeOperation = 'lighter';
  for (const m of meteors) {
    const at = meteorAt(m, now);
    if (!at) continue;
    c.globalAlpha = at.alpha;
    if (!ambient.streak(c, at.x, at.y, at.angle, at.length, m.width)) {
      const ex = at.x - Math.cos(at.angle) * at.length,
        ey = at.y - Math.sin(at.angle) * at.length,
        tail = c.createLinearGradient(at.x, at.y, ex, ey);
      tail.addColorStop(0, `rgba(${STAR},${at.alpha})`);
      tail.addColorStop(1, `rgba(${STAR},0)`);
      c.strokeStyle = tail;
      c.lineWidth = m.width;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(at.x, at.y);
      c.lineTo(ex, ey);
      c.stroke();
    }
    if (m.halo) glow(c, m.wish ? '#ffeec8' : '#f4f1ff', at.x, at.y, m.halo, at.alpha * (m.wish ? 0.75 : 0.45));
    ambient.star(c, { x: at.x, y: at.y, r: m.width * (m.wish ? 1.1 : 0.7) });
  }
  c.globalCompositeOperation = 'source-over';
}

/** Fireworks add their light, as fire does: a soft flash where a shell bursts and the glow of its
 * colour it leaves hanging, then each star as a bright head in a small glow with a fading tail,
 * shimmering as it burns out (twinkle), glitter all along. Shells climb from the friends in front
 * of the land (`front`); they burst in the sky behind it. */
export function drawSparks(c, sparks, now, front, scale) {
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  for (const s of sparks) {
    if (!!s.rise !== front) continue;
    const at = sparkAt(s, now);
    if (!at) continue;
    if (s.glow) {
      glow(c, s.color, at.x, at.y, s.r, bloom((now - s.since) / s.life) * 0.5);
      continue;
    }
    if (s.flash) {
      glow(c, s.color, at.x, at.y, 64 * scale, at.alpha * 0.75);
      continue;
    }
    const alpha = at.alpha * twinkle(s, now);
    c.strokeStyle = s.color;
    tail(c, s, at, now - (s.trail ?? (s.rise ? 220 : 150)), 1.2 * scale, alpha * 0.35);
    tail(c, s, at, now - 40, 2.2 * scale, alpha);
    glow(c, s.color, at.x, at.y, (s.rise ? 8 : 6.5) * scale, alpha * 0.45);
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

// A spark's tail: a line from where it was `since` to where it is now (`at`).
function tail(c, s, at, since, width, alpha) {
  const from = sparkAt(s, since) || { x: s.cx, y: s.cy };
  c.globalAlpha = alpha;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(from.x, from.y);
  c.lineTo(at.x, at.y);
  c.stroke();
}

/** Each burst lights the whole yard (w × h) for a moment in its colour, the friends too; bursts
 * together light it no more than a little, so the finale does not turn to haze. */
export function lightYard(c, sparks, now, w, h) {
  c.globalCompositeOperation = 'lighter';
  let left = 0.1;
  for (const s of sparks) {
    const at = s.flash && sparkAt(s, now);
    if (!at || left <= 0) continue;
    c.globalAlpha = Math.min(left, at.alpha * 0.06);
    left -= c.globalAlpha;
    c.fillStyle = s.color;
    c.fillRect(0, 0, w, h);
  }
  c.globalCompositeOperation = 'source-over';
}
