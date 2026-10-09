// What the yard's backdrop is painted with, in the manner of hand-painted animation backgrounds
// (the fields and woods of Kazuo Oga's paintings, the soft round trees of Animal Crossing): a
// clean sky with heaped clouds lit white on top and blue in their shade, far mountains in haze,
// a far hill crowned with groves, a lake in the valley, the field friends stand on, and trees
// built from flat masses of leaves in a few values, deep shade below, light on the sun's side.
// The colours are the stylesheet's (scenery.css and the season's, passed in as `pal`); this file
// decides the shapes and the light. Each piece has its own seed, so the yard comes out the same
// each time it is painted again, only in other light.
// Docs: docs/design/2026-10-09-a-painted-yard.md.
// The pieces are painted by layout.js (where), palette.js (colours and light), trees.js,
// lake.js and clouds.js; this file composes the land from them.
import { bumpy, css, dot, fillShape, flat, gauss, light, mix, seeded, shade, vertical } from './brush.js';
import { lake } from './lake.js';
import {
  BACK,
  BIG_TREE,
  down,
  FAR,
  FAR_CEDARS,
  FAR_PEAKS,
  FRONT,
  GROVES,
  heightAt,
  NEAR_PEAKS,
  range,
  STANDING,
  trace,
} from './layout.js';
import { lightFor, tones, weathered } from './palette.js';
import { bigTree, bush, canopy, rock, roundTree, sugi } from './trees.js';

/** A mountain range: flat in the haze, with snow up high in winter. */
function mountains(ctx, w, h, peaks, base, rng, snowy, haze) {
  const ridge = range(peaks, w, h, rng),
    top = Math.min(...ridge.map(p => p[1]));
  fillShape(
    ctx,
    down(ridge, h * 0.75),
    vertical(ctx, top, h * 0.6, [
      [0, base],
      [1, mix(base, haze, 0.5)],
    ]),
  );
  if (snowy) {
    const line = top + (h * 0.5 - top) * 0.32,
      snow = mix(base, [248, 251, 255, 1], 0.85);
    let run = [];
    const close = () => {
      if (run.length > 2)
        flat(ctx, [...run, ...run.map(([x, y]) => [x, y + (line - y) * (0.7 + rng() * 0.4) + 2]).reverse()], snow, 0.9);
      run = [];
    };
    for (const p of ridge) {
      if (p[1] < line) run.push(p);
      else close();
    }
    close();
  }
}

/**
 * A band of woods along a ridge, seen from afar: a back row of taller trees and a front row of
 * lower ones, merged into one mass, lit in patches on the sun's side and tinted by the haze.
 */
function woods(ctx, ridge, w, h, pal, rng, lit, haze, amount, cap) {
  const t = tones([pal['leaf-hi'], pal.leaf, pal['leaf-lo']], lit);
  const tint = c => mix(c, haze, amount);
  const far = { dark: tint(t.deep), body: tint(t.dark), glow: tint(t.body) };
  const row = (lift, size) => {
    const tops = [];
    for (let x = -20; x < w + 20; ) {
      const tall = rng() < 0.18 ? 1.7 : 1,
        r = h * size * (0.7 + rng() * 0.6) * tall;
      tops.push({ x, r, y: heightAt(ridge, x) - r * (0.3 + lift) });
      x += r * (0.75 + rng() * 0.5);
    }
    return tops;
  };
  for (const tops of [row(0.35, 0.02), row(0, 0.016)]) {
    for (const p of tops) bumpy(ctx, p.x, p.y, p.r * 1.15, p.r, far.dark, rng, p.r * 0.13);
    for (const p of tops)
      bumpy(ctx, p.x + lit.side * p.r * 0.22, p.y - p.r * 0.22, p.r * 0.8, p.r * 0.62, far.body, rng, p.r * 0.12);
    for (const p of tops)
      if (rng() < 0.35)
        bumpy(ctx, p.x + lit.side * p.r * 0.35, p.y - p.r * 0.42, p.r * 0.42, p.r * 0.34, far.glow, rng, p.r * 0.12);
    if (cap[3] > 0.4)
      for (const p of tops) bumpy(ctx, p.x, p.y - p.r * 0.6, p.r * 0.7, p.r * 0.22, cap, rng, p.r * 0.12);
  }
}

/** Broad bands across a hill, a shade lighter or darker, as fields lie in these paintings. */
function bands(ctx, ridge, h, c, lit, rng) {
  for (const [from, to, tone] of [
    [0.12, 0.2, light(c, 0.12)],
    [0.42, 0.5, shade(c, 0.06)],
  ]) {
    const upper = ridge.map(([x, y]) => [x, y + (h - y) * from + gauss(rng) * 0.5]),
      lower = ridge.map(([x, y]) => [x, y + (h - y) * to]).reverse();
    flat(ctx, [...upper, ...lower], tone, 0.35 + lit.strength * 0.25);
  }
}

/** A few clumps of flowers, where flowers grow: at the foot of trees and along the path. */
function flowerClumps(ctx, w, h, pal, rng, places) {
  for (const [fx, fy, size] of places) {
    const x = fx * w,
      y = fy * h,
      r = h * 0.007 * size,
      green = shade(pal.leaf, 0.25);
    for (let k = 0; k < 4; k++)
      bumpy(ctx, x + gauss(rng) * r * 2.4, y + r * 0.4, r * 1.3, r * 0.8, green, rng, r * 0.45);
    for (let k = 0; k < 6; k++) {
      const px = x + gauss(rng) * r * 3,
        py = y - r * 0.6 + gauss(rng) * r * 0.8,
        petal = k % 3 ? pal['flower-a'] : pal['flower-b'];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        dot(ctx, px + Math.cos(a) * r * 0.55, py + Math.sin(a) * r * 0.45, r * 0.5, petal);
      }
      dot(ctx, px, py, r * 0.3, pal['flower-c']);
    }
  }
}

/** The land: mountains, the far hill with its groves and lake, the field, the big tree. */
export function paintLand(ctx, w, h, palette, { period, weather, season }) {
  const pal = weathered(palette, weather),
    lit = lightFor(period, weather),
    snowy = weather === 'snow',
    bloomy = season !== 'winter' && !snowy,
    extras = { cap: pal.cap, blossom: season === 'spring' && !snowy },
    haze = pal['sky-b'],
    leaves = tones([pal['leaf-hi'], pal.leaf, pal['leaf-lo']], lit);
  mountains(ctx, w, h, FAR_PEAKS, mix(pal['mount-b'], haze, 0.15), seeded(31), snowy || season === 'winter', haze);
  mountains(ctx, w, h, NEAR_PEAKS, mix(pal['mount-a'], haze, 0.1), seeded(37), snowy, haze);

  // The far hill: groves rising from behind it with low woods between them, then the hill itself.
  const far = trace(FAR, w, h),
    grng = seeded(41),
    tint = c => mix(c, haze, 0.22),
    farLeaves = { deep: tint(leaves.deep), dark: tint(leaves.dark), body: tint(leaves.body), glow: tint(leaves.glow) };
  woods(
    ctx,
    far.map(([x, y]) => [x, y + h * 0.008]),
    w,
    h,
    pal,
    grng,
    lit,
    haze,
    0.22,
    extras.cap,
  );
  for (const [gx, size] of GROVES) {
    const x = gx * w,
      R = size * h;
    canopy(ctx, x, heightAt(far, x) - R * 0.35, R, farLeaves, grng, lit, extras.cap);
  }
  fillShape(
    ctx,
    down(far, h),
    vertical(ctx, h * 0.44, h * 0.62, [
      [0, pal['far-hi']],
      [1, pal.far],
    ]),
  );
  // A hedgerow along the far hill, as fields are divided in the country.
  ctx.strokeStyle = css(mix(pal.far, leaves.dark, 0.55));
  ctx.lineWidth = Math.max(1.5, h * 0.006);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [k, [x, y]] of far.entries()) {
    const yy = y + h * 0.03 + Math.sin(x / (w * 0.12)) * h * 0.004;
    k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
  }
  ctx.stroke();
  const crng = seeded(43);
  for (const [cx, size] of FAR_CEDARS)
    sugi(ctx, cx * w, heightAt(far, cx * w) + h * 0.012, size * h, pal, crng, lit, extras);
  const back = trace(BACK, w, h);
  lake(ctx, w, h, pal, seeded(73), lit, back);

  // The near hill: the field friends stand on.
  fillShape(
    ctx,
    down(back, h),
    vertical(ctx, h * 0.53, h, [
      [0, pal['back-hi']],
      [0.5, pal.back],
      [1, shade(pal.back, 0.05)],
    ]),
  );
  bands(ctx, back, h, pal.back, lit, seeded(47));
  ctx.strokeStyle = css(light(pal['back-hi'], 0.3), 0.5 + lit.strength * 0.3);
  ctx.lineWidth = Math.max(1, h * 0.003);
  ctx.beginPath();
  for (const [i, [x, y]] of back.entries()) i ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1);
  ctx.stroke();
  [...STANDING]
    .sort((a, b) => a.y - b.y)
    .forEach((t, i) => {
      const rng = seeded(101 + i * 17),
        x = t.x * w,
        y = t.y * h,
        H = t.h * h;
      if (t.kind === 'bush') bush(ctx, x, y, H, pal, rng, lit, extras);
      else if (t.kind === 'rock') rock(ctx, x, y, H, pal, rng, lit, extras);
      else roundTree(ctx, x, y, H, pal, rng, lit, t.kind === 'maple' ? 'maple' : 'crown', extras);
    });
  if (bloomy)
    flowerClumps(ctx, w, h, pal, seeded(57), [
      [0.17, 0.635, 1],
      [0.8, 0.765, 0.9],
    ]);

  // The front of the field, the path coming in, and the big tree at the edge.
  const front = trace(FRONT, w, h);
  fillShape(
    ctx,
    down(front, h),
    vertical(ctx, h * 0.72, h, [
      [0, mix(pal.back, pal['front-hi'], 0.6)],
      [0.4, pal.front],
      [1, shade(pal.front, 0.12)],
    ]),
  );
  if (bloomy)
    flowerClumps(ctx, w, h, pal, seeded(59), [
      [0.35, 0.97, 1.4],
      [0.62, 0.87, 1],
    ]);
  // In a narrow yard (beside an open panel) the big tree is smaller, so it frames rather than fills.
  const roomy = Math.min(1, w / h / 1.9);
  bigTree(ctx, BIG_TREE.x * w, BIG_TREE.y * h, BIG_TREE.h * h * (0.55 + 0.45 * roomy), pal, seeded(63), lit, extras);
  // Low shrubs in the near corners, framing the bottom of the yard.
  const corner = seeded(61);
  for (const [x, size] of [
    [0.03, 0.1],
    [0.1, 0.065],
    [0.93, 0.08],
  ])
    bush(ctx, x * w, h * 1.02, h * size, pal, corner, lit, extras);
}
