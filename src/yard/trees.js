// Trees, bushes and a rock, painted as background painters lay foliage in: flat masses with bumpy
// edges in value bands (deep shade, shade, body, light on the sun's side), trunks that flare into
// roots under the crown's shadow, Japanese cedars as columns of clumps, the big tree at the edge.
import { bumpy, css, dot, flat, gauss, light, mix, paint, shade, smooth, smoothPath } from './brush.js';
import { tones } from './palette.js';

/**
 * Clumps of leaves painted in value bands, as background painters lay foliage in: every clump in
 * deep shade; again a little higher and smaller in shade; the clumps that face the light again
 * higher and smaller in the body colour, lighter at the top; the most sunward ones once more in
 * light. Each clump has `toward` (how much it faces the light, -1 to 1).
 */
function layers(ctx, clumps, t, rng, side, bump) {
  const band = (fill, lift, size, reach, b) => {
    for (const c of clumps)
      if (c.toward > reach)
        bumpy(ctx, c.x + side * c.r * lift * 0.6, c.y - c.r * lift, c.r * size, c.r * size * 0.86, fill, rng, b);
  };
  band(t.deep, 0, 1, -2, bump);
  band({ top: t.dark, bottom: mix(t.dark, t.deep, 0.45) }, 0.12, 0.9, -0.9, bump);
  band({ top: mix(t.body, t.glow, 0.35), bottom: t.body }, 0.26, 0.74, -0.35, bump * 0.9);
  band(t.glow, 0.42, 0.5, 0.25, bump * 0.75);
}

/**
 * A crown of leaves: a ring of clumps around each part (a crown can be several, for a big tree),
 * painted in value bands, with a few small clusters catching the light along the sunny edge.
 */
export function canopy(ctx, cx, cy, R, t, rng, lit, cap, more = []) {
  const side = lit.side,
    clumps = [];
  for (const part of [{ x: cx, y: cy, R }, ...more]) {
    clumps.push({ x: part.x, y: part.y, r: part.R * 0.62, toward: 0.3 });
    const n = 10 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + gauss(rng) * 0.2,
        d = part.R * (0.46 + rng() * 0.16),
        x = part.x + Math.cos(a) * d * 1.05,
        y = part.y + Math.sin(a) * d * 0.82;
      // How much it faces the light, over the whole crown and not only its own part.
      const dx = (x - cx) / R,
        dy = (y - cy) / R;
      clumps.push({ x, y, r: part.R * (0.34 + rng() * 0.12), toward: Math.max(-1, Math.min(1, dx * side - dy)) });
    }
  }
  layers(ctx, clumps, t, rng, side, R * 0.07);
  for (let j = 0; j < 5; j++) {
    const a = Math.atan2(-0.8, side * 0.6) + gauss(rng) * 0.9,
      r = R * (0.07 + rng() * 0.05);
    bumpy(ctx, cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.66, r, r * 0.8, t.glow, rng, r * 0.35);
  }
  if (cap[3] > 0.4)
    for (const c of clumps)
      if (c.toward > 0.2) bumpy(ctx, c.x, c.y - c.r * 0.6, c.r * 0.6, c.r * 0.22, cap, rng, R * 0.05);
}

/**
 * A Japanese cedar seen from afar: a tall column of foliage clumps, alternately left and right,
 * narrowing to a point, in the same value bands as a crown.
 */
export function sugi(ctx, x, y, H, pal, rng, lit, extras) {
  const t = tones([light(pal.pine, 0.2), pal.pine, pal['pine-lo']], lit),
    side = lit.side;
  groundShadow(ctx, x, y, H * 0.18, pal, lit);
  trunk(ctx, x, y, y - H * 0.3, H * 0.025, H * 0.016, pal, lit, rng);
  const clumps = [];
  const levels = 6;
  for (let i = 0; i < levels; i++) {
    const f = i / (levels - 1),
      cy = y - H * (0.25 + f * 0.62),
      half = H * 0.13 * (1 - f * 0.6);
    for (const d of [-1, 1])
      clumps.push({
        x: x + d * half * 0.5 + gauss(rng) * half * 0.1,
        y: cy + (d > 0 ? H * 0.03 : 0),
        r: half * 0.75,
        toward: d * side * 0.8 - f * 0.3,
      });
  }
  clumps.push({ x, y: y - H * 0.92, r: H * 0.05, toward: 0.4 });
  bumpy(ctx, x, y - H * 0.56, H * 0.07, H * 0.36, t.deep, rng, H * 0.03);
  layers(ctx, clumps, t, rng, side, H * 0.025);
  if (extras.cap[3] > 0.4)
    for (const c of clumps) bumpy(ctx, c.x, c.y - c.r * 0.55, c.r * 0.7, c.r * 0.25, extras.cap, rng, H * 0.015);
}

/** The big tree at the yard's edge: a thick trunk and a crown of several parts, cut off by the frame. */
export function bigTree(ctx, x, y, H, pal, rng, lit, extras) {
  ctx.fillStyle = css(shade(pal.front, 0.5), 0.1 + lit.strength * 0.1);
  ctx.beginPath();
  ctx.ellipse(x - H * 0.2, y + H * 0.005, H * 0.34, H * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  trunk(ctx, x, y, y - H * 0.45, H * 0.06, H * 0.038, pal, lit, rng, y - H * 0.24);
  const R = H * 0.3;
  canopy(
    ctx,
    x - H * 0.08,
    y - H * 0.7,
    R,
    tones([pal['crown-hi'], pal.crown, pal['crown-lo']], lit),
    rng,
    lit,
    extras.cap,
    [
      { x: x - H * 0.3, y: y - H * 0.5, R: H * 0.19 },
      { x: x - H * 0.04, y: y - H * 0.46, R: H * 0.2 },
      { x: x - H * 0.25, y: y - H * 0.84, R: H * 0.2 },
      { x: x + H * 0.04, y: y - H * 0.98, R: H * 0.22 },
    ],
  );
}

/** A ground shadow, cast away from the sun: flat and see-through. */
function groundShadow(ctx, x, y, rx, pal, lit) {
  ctx.fillStyle = css(shade(pal.back, 0.55), 0.18 + lit.strength * 0.14);
  ctx.beginPath();
  ctx.ellipse(x - lit.side * rx * 0.25, y, rx, rx * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A narrow stroke along a gentle curve, thinning to a point: a line of bark. */
export function strand(ctx, x0, y0, x1, y1, width, bend, c) {
  const mx = (x0 + x1) / 2 + bend,
    my = (y0 + y1) / 2;
  ctx.fillStyle = css(c);
  ctx.beginPath();
  ctx.moveTo(x0 - width / 2, y0);
  ctx.quadraticCurveTo(mx - width * 0.3, my, x1, y1);
  ctx.quadraticCurveTo(mx + width * 0.3, my, x0 + width / 2, y0);
  ctx.fill();
}

/**
 * A trunk, as painted in the references: it leans a little and flares into roots at the foot, is
 * darker under the crown's shadow (a band with a leafy lower edge, down to `shadeTo`), lit in a
 * band on the sun's side, and marked with a few lines of bark.
 */
function trunk(ctx, x, y, top, base, neck, pal, lit, rng, shadeTo = top) {
  const H = y - top,
    s = lit.side,
    lean = gauss(rng) * neck * 0.6,
    dark = pal['trunk-lo'],
    sunlit = mix(pal.trunk, light(pal.trunk, 0.22), lit.strength),
    edge = (dir, k) => [
      [x + dir * base * 2.1, y + 1],
      [x + dir * base * 1.15, y - H * 0.05],
      [x + dir * base * 0.98, y - H * 0.18],
      [x + dir * neck * (1.1 + k) + lean * 0.6, y - H * 0.58],
      [x + dir * neck + lean, top],
    ];
  const outline = [...edge(-1, 0.05), ...edge(1, -0.03).reverse()];
  const outlinePath = () => {
    ctx.beginPath();
    smoothPath(ctx, outline);
  };
  ctx.fillStyle = paint(ctx, { top: shade(dark, 0.15), bottom: dark }, top, y);
  outlinePath();
  ctx.fill();
  ctx.save();
  outlinePath();
  ctx.clip();
  // The lit band on the sun's side, its inner edge wavering.
  const band = [];
  for (let k = 0; k <= 8; k++) {
    const f = k / 8,
      yy = y - H * f,
      half = base + (neck - base) * Math.min(1, f * 1.4) + (f < 0.1 ? base * (1 - f / 0.1) : 0);
    band.push([x + s * half * (0.05 + 0.12 * Math.sin(f * 7 + 1)) + lean * f, yy]);
  }
  flat(ctx, [...band, [x + s * base * 3, top], [x + s * base * 3, y + 2]], sunlit);
  // Lines of bark, and a knot.
  for (let k = 0; k < 3; k++) {
    const bx = x + (k / 2 - 0.5) * neck * 1.2 + gauss(rng) * neck * 0.15,
      y0 = y - H * (0.06 + rng() * 0.25),
      y1 = y0 - H * (0.25 + rng() * 0.35);
    strand(
      ctx,
      bx,
      y0,
      bx + lean * 0.3,
      y1,
      Math.max(1, neck * 0.16),
      gauss(rng) * neck * 0.2,
      shade(k % 2 ? dark : sunlit, 0.2),
    );
  }
  ctx.fillStyle = css(shade(dark, 0.3));
  ctx.beginPath();
  ctx.ellipse(x - s * neck * 0.25 + lean * 0.4, y - H * 0.42, neck * 0.18, neck * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // The crown's shadow over the top of the trunk, with a leafy lower edge.
  if (shadeTo > top) {
    ctx.fillStyle = css(shade(dark, 0.35), 0.85);
    ctx.beginPath();
    ctx.rect(x - base * 3, top - 2, base * 6, shadeTo - top);
    for (let k = 0; k < 7; k++) {
      const bx = x - neck * 1.6 + (k / 6) * neck * 3.2,
        r = neck * (0.35 + rng() * 0.35);
      ctx.moveTo(bx + r, shadeTo);
      ctx.arc(bx, shadeTo, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

/** A round tree: trunk, then its crown (winter's are bare). */
export function roundTree(ctx, x, y, H, pal, rng, lit, which, extras) {
  groundShadow(ctx, x, y, H * 0.3, pal, lit);
  const R = H * 0.36,
    cy = y - H * 0.62;
  trunk(ctx, x, y, cy + R * 0.2, H * 0.045, H * 0.026, pal, lit, rng, cy + R * 0.95);
  canopy(ctx, x, cy, R, tones([pal[`${which}-hi`], pal[which], pal[`${which}-lo`]], lit), rng, lit, extras.cap);
  if (extras.blossom) {
    const petal = light([250, 228, 236, 1], 0.2);
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2,
        d = Math.sqrt(rng()) * R * 0.85;
      dot(ctx, x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, R * (0.025 + rng() * 0.02), petal, 0.9);
    }
  }
}

/** A bush: a low crown sitting on the ground. */
export function bush(ctx, x, y, H, pal, rng, lit, extras) {
  groundShadow(ctx, x, y, H * 0.95, pal, lit);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - H * 3, y - H * 3, H * 6, H * 3);
  ctx.clip();
  canopy(ctx, x, y - H * 0.45, H * 0.62, tones([pal['leaf-hi'], pal.leaf, pal['leaf-lo']], lit), rng, lit, extras.cap);
  ctx.restore();
}

/** A rock: rounded, its top lit from the sun's side, darker towards the ground. */
export function rock(ctx, x, y, H, pal, rng, lit, extras) {
  groundShadow(ctx, x, y, H * 0.95, pal, lit);
  const s = lit.side;
  smooth(
    ctx,
    [
      [x - H * 0.9, y + 1],
      [x - H * 0.7, y - H * 0.45],
      [x - H * 0.15, y - H * 0.82],
      [x + H * 0.45, y - H * 0.6],
      [x + H * 0.85, y + 1],
    ],
    shade(pal.rock, 0.2),
  );
  smooth(
    ctx,
    [
      [x - H * 0.75, y - H * 0.12],
      [x - H * 0.62, y - H * 0.5],
      [x - H * 0.12, y - H * 0.8],
      [x + H * 0.42, y - H * 0.58],
      [x + H * 0.7, y - H * 0.12],
      [x, y - H * 0.25],
    ],
    pal.rock,
  );
  smooth(
    ctx,
    [
      [x + s * H * 0.5, y - H * 0.45],
      [x - H * 0.05, y - H * 0.76],
      [x - s * H * 0.35, y - H * 0.55],
      [x, y - H * 0.55],
    ],
    pal['rock-hi'],
  );
  if (extras.cap[3] > 0.4) bumpy(ctx, x - H * 0.05, y - H * 0.72, H * 0.45, H * 0.14, extras.cap, rng, H * 0.06);
}
