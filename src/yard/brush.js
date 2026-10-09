// A brush for the painted yard, in the manner of hand-painted animation backgrounds: flat,
// opaque colour in a few values (deep shade, shade, body, light), each shape with a crisp edge
// broken into small bumps where it is foliage or cloud. No soft smudges or noise.
// Seeded chance makes the yard come out the same each time it is painted again, only in other
// light. Works on any 2D context and touches nothing else.

const TAU = Math.PI * 2;

/** Chance from a seed: the same seed gives the same numbers (mulberry32). */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roughly bell-shaped chance around 0, mostly within ±1. */
export const gauss = rng => (rng() + rng() + rng() - 1.5) / 1.5;

/** A colour as the stylesheet writes it (#rgb, #rrggbb, #rrggbbaa, rgb(), rgba()) as [r, g, b, a]. */
export function color(text) {
  const s = String(text || '').trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16),
      a = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const [r, g, b, a = 1] = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return [r, g, b, a];
  }
  return [0, 0, 0, 0];
}

const lerp = (a, b, t) => a + (b - a) * t;
/** Between two colours: t 0 is the first, 1 the second. */
export const mix = (a, b, t) => [0, 1, 2, 3].map(i => lerp(a[i], b[i], t));
/** For the canvas, with the colour's own opacity times `alpha`. */
export function css(c, alpha = 1) {
  const [r, g, b, a] = c;
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+(a * alpha).toFixed(3)})`;
}
/** Lighter towards a warm, sunny yellow-white. */
export const light = (c, k) => mix(c, [255, 248, 214, c[3]], k);
/** Darker towards a deep blue-green, as shade is in these paintings (never towards black). */
export const shade = (c, k) => mix(c, [22, 48, 64, c[3]], k);
/** Greyer and a little darker (a rainy day). */
export function dull(c, k) {
  const grey = (c[0] + c[1] + c[2]) / 3;
  return mix(c, [grey * 0.94, grey * 0.96, grey, c[3]], k);
}

/** Adds a closed shape through the points to the current path, its corners rounded off. */
export function smoothPath(ctx, points) {
  const n = points.length,
    mid = i => {
      const [ax, ay] = points[i % n],
        [bx, by] = points[(i + 1) % n];
      return [(ax + bx) / 2, (ay + by) / 2];
    };
  ctx.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(points[i][0], points[i][1], ...mid(i));
  ctx.closePath();
}

/** A closed shape through the points, its corners rounded off, filled flat. */
export function smooth(ctx, points, c, alpha = 1) {
  ctx.fillStyle = css(c, alpha);
  ctx.beginPath();
  smoothPath(ctx, points);
  ctx.fill();
}

/** A shape with straight sides, filled flat. */
export function flat(ctx, points, c, alpha = 1) {
  ctx.fillStyle = css(c, alpha);
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Adds a bumpy mass to the current path (see bumpy), for several masses filled as one. Its outline
 * swells and dips a little around the ellipse and its bumps differ in size, so no two are alike.
 */
function bumpyPath(ctx, cx, cy, rx, ry, rng, bump = Math.min(rx, ry) * 0.2) {
  if (rx <= 0 || ry <= 0) return;
  bump = Math.max(0.6, Math.min(bump, rx, ry));
  const p1 = rng() * TAU,
    p2 = rng() * TAU,
    wobble = a => 1 + 0.1 * Math.sin(2 * a + p1) + 0.06 * Math.sin(3 * a + p2),
    ex = Math.max(0.1, rx - bump * 0.8),
    ey = Math.max(0.1, ry - bump * 0.8);
  ctx.moveTo(cx + ex, cy);
  ctx.ellipse(cx, cy, ex, ey, 0, 0, TAU);
  const n = Math.max(6, Math.round((Math.PI * (rx + ry)) / (bump * 1.1)));
  for (let i = 0; i < n; i++) {
    const a = ((i + rng() * 0.4) / n) * TAU,
      r = bump * (0.55 + rng() * 0.8),
      k = wobble(a),
      x = cx + Math.cos(a) * (rx * k - r * 0.85),
      y = cy + Math.sin(a) * (ry * k - r * 0.85);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
}

/**
 * The fill for a mass: one colour, or `{ top, bottom }` for a colour that deepens downwards across
 * it, as light falls on a mass from above.
 */
export function paint(ctx, c, top, bottom, alpha = 1) {
  if (Array.isArray(c)) return css(c, alpha);
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, css(c.top, alpha));
  g.addColorStop(1, css(c.bottom, alpha));
  return g;
}

/**
 * A mass of foliage or cloud: an ellipse whose edge is a row of small round bumps, filled flat
 * (or deepening downwards, see paint). The bumps are one fill with the body, so a see-through
 * colour does not darken where they overlap.
 */
export function bumpy(ctx, cx, cy, rx, ry, c, rng, bump, alpha = 1) {
  ctx.fillStyle = paint(ctx, c, cy - ry, cy + ry, alpha);
  ctx.beginPath();
  bumpyPath(ctx, cx, cy, rx, ry, rng, bump);
  ctx.fill();
}

/** A round dot, filled flat. */
export function dot(ctx, x, y, r, c, alpha = 1) {
  ctx.fillStyle = css(c, alpha);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A shape with straight sides, filled with a colour string or a gradient. */
export function fillShape(ctx, points, style) {
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

/** A gradient from `top` to `bottom`: stops of [where 0..1, colour, opacity]. */
export function vertical(ctx, top, bottom, stops) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  for (const [at, c, alpha = 1] of stops) g.addColorStop(at, css(c, alpha));
  return g;
}
