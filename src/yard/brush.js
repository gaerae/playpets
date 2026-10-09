// A brush for the painted yard: seeded chance (the yard comes out the same each time it is painted
// again, only in other light), colours, and the three strokes the backdrop is made of. A wash lays
// a shape down several times, each a little deformed and nearly clear, so its edges come out soft
// and uneven like watercolour; a dab is one touch of the brush (a clump of leaves, a petal); a
// blade is a short curved line (grass). Works on any 2D context and touches nothing else.

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
/** Lighter towards a warm white, as sunlight is. */
export const light = (c, k) => mix(c, [255, 250, 236, c[3]], k);
/** Darker towards a cool blue-violet, as shade is under an open sky (never towards black). */
export const shade = (c, k) => mix(c, [38, 44, 78, c[3]], k);
/** A little off, so no two touches are quite the same colour. */
export function vary(c, rng, amount = 10) {
  const d = gauss(rng) * amount;
  return [c[0] + d + gauss(rng) * amount * 0.4, c[1] + d, c[2] + d + gauss(rng) * amount * 0.4, c[3]];
}
/** Greyer and a little darker (a rainy day). */
export function dull(c, k) {
  const grey = (c[0] + c[1] + c[2]) / 3;
  return mix(c, [grey * 0.94, grey * 0.96, grey, c[3]], k);
}

/** An ellipse as a polygon of n points. */
export function ellipse(cx, cy, rx, ry, n = 10, rng = null) {
  const start = rng ? rng() * Math.PI : 0;
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

/** The polygon with every edge broken in two at a point pushed off it, `depth` times over. */
export function deform(points, rng, depth, amount) {
  let out = points;
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let i = 0; i < out.length; i++) {
      const [ax, ay] = out[i],
        [bx, by] = out[(i + 1) % out.length],
        dx = bx - ax,
        dy = by - ay,
        len = Math.hypot(dx, dy) || 1,
        push = gauss(rng) * len * amount;
      next.push([ax, ay], [(ax + bx) / 2 - (dy / len) * push, (ay + by) / 2 + (dx / len) * push]);
    }
    out = next;
    amount *= 0.62;
  }
  return out;
}

function fillPoly(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

/**
 * A watercolour wash of the polygon: laid down `layers` times, each deformed a little more and
 * nearly clear, so the middle builds up and the edge stays soft. `edge` darkens the rim a touch,
 * where pigment gathers as it dries.
 */
export function wash(ctx, points, c, rng, { layers = 5, alpha = 0.2, depth = 3, amount = 0.28, edge = 0 } = {}) {
  const base = deform(points, rng, 1, amount);
  ctx.fillStyle = css(c, alpha);
  for (let i = 0; i < layers; i++) fillPoly(ctx, deform(base, rng, depth, amount * 0.7));
  if (edge) {
    ctx.strokeStyle = css(shade(c, 0.35), edge);
    ctx.lineWidth = 1;
    fillPoly(ctx, base);
    ctx.stroke();
  }
}

/** One touch of the brush: a small tilted ellipse. */
export function dab(ctx, x, y, r, c, alpha = 1, tilt = 0, squash = 0.7) {
  ctx.fillStyle = css(c, alpha);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * squash, tilt, 0, Math.PI * 2);
  ctx.fill();
}

/** A blade of grass from its root, leaning by `lean` (its tip's sideways offset). */
export function blade(ctx, x, y, length, lean, width, c, alpha = 1) {
  ctx.strokeStyle = css(c, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.2, y - length * 0.6, x + lean, y - length);
  ctx.stroke();
}

/**
 * Paper grain over what is painted: a faint light and dark speckle, only where there is paint
 * already (the clear sky above the land stays clear), so flat colour reads as paint on paper.
 */
export function grain(ctx, rng, strength = 0.05) {
  const tile = 128,
    canvas = new OffscreenCanvas(tile, tile),
    g = canvas.getContext('2d'),
    img = g.createImageData(tile, tile);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = gauss(rng),
      tone = v > 0 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = tone;
    img.data[i + 3] = Math.min(255, Math.abs(v) * strength * 255);
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  // Grains a little larger than a pixel, so it reads as paper rather than a screen's noise.
  ctx.setTransform(1.6, 0, 0, 1.6, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = ctx.createPattern(canvas, 'repeat');
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
