// The light the night sky and the fireworks add, painted onto a context it is handed: stars,
// shooting stars, fireworks' sparks and the glow a burst casts on the yard. Where everything is and
// when it moves is scenery.js's (meteors.js and fireworks.js for the paths); this file only paints.
import { sparkAt } from './fireworks.js';
import { meteorAt } from './meteors.js';

const TAU = Math.PI * 2;
const STAR = '255,250,230';

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

/** Shooting stars add their light to the sky: a tail that tapers behind a glowing head. */
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
    ambient.star(c, { x: at.x, y: at.y, r: m.width * (m.wish ? 1.1 : 0.7) });
  }
  c.globalCompositeOperation = 'source-over';
}

/** Fireworks add their light, as fire does: a soft flash where a shell bursts, then each star as a
 * bright head with a fading tail; a burning-out star flickers, glitter all along. Shells climb from
 * the friends in front of the land (`front`); they burst in the sky behind it. */
export function drawSparks(c, sparks, now, front, scale) {
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  for (const s of sparks) {
    if (!!s.rise !== front) continue;
    const at = sparkAt(s, now);
    if (!at) continue;
    if (s.flash) {
      const glow = c.createRadialGradient(at.x, at.y, 0, at.x, at.y, 46 * scale);
      glow.addColorStop(0, s.color);
      glow.addColorStop(1, 'transparent');
      c.globalAlpha = at.alpha * 0.45;
      c.fillStyle = glow;
      c.fillRect(at.x - 46 * scale, at.y - 46 * scale, 92 * scale, 92 * scale);
      continue;
    }
    const flicker = Math.random() < (s.glitter ? 0.5 : at.alpha < 1 ? 0.3 : 0),
      alpha = flicker ? at.alpha * 0.3 : at.alpha;
    c.strokeStyle = s.color;
    tail(c, s, at, now - (s.trail ?? (s.rise ? 220 : 150)), 1.2 * scale, alpha * 0.35);
    tail(c, s, at, now - 40, 2.2 * scale, alpha);
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
  let left = 0.08;
  for (const s of sparks) {
    const at = s.flash && sparkAt(s, now);
    if (!at || left <= 0) continue;
    c.globalAlpha = Math.min(left, at.alpha * 0.05);
    left -= c.globalAlpha;
    c.fillStyle = s.color;
    c.fillRect(0, 0, w, h);
  }
  c.globalCompositeOperation = 'source-over';
}
