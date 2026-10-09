// What the yard's backdrop is painted with, in the manner of the backgrounds of hand-painted
// animated films: a sky with towering clouds, far mountains fading into the haze, a hill with a
// cottage and a row of trees, the field friends stand on, and round trees built up from clumps of
// leaves lit from the sun's side. The colours are the stylesheet's (scenery.css and the season's,
// passed in as `pal`); this file decides the shapes and the light. Each piece has its own seed,
// so the yard comes out the same each time it is painted again, only in other light.
// Docs: docs/design/2026-10-09-a-painted-yard.md.
import {
  blade,
  color,
  css,
  dab,
  deform,
  dull,
  ellipse,
  gauss,
  grain,
  light,
  mix,
  seeded,
  shade,
  vary,
  wash,
} from './brush.js';

// The hills, in fractions of the yard (x across, y down), as cubic curves: a start point, then
// two control points and an end point for each piece. The field friends stand on starts at the
// back hill's ridge (views.js FIELD_TOP).
const FAR = [
  [0, 0.57],
  [0.16, 0.45],
  [0.33, 0.46],
  [0.5, 0.53],
  [0.67, 0.6],
  [0.83, 0.51],
  [1, 0.44],
];
const BACK = [
  [0, 0.66],
  [0.2, 0.53],
  [0.41, 0.56],
  [0.6, 0.64],
  [0.79, 0.72],
  [0.87, 0.67],
  [1, 0.59],
];
const FRONT = [
  [0, 0.82],
  [0.24, 0.72],
  [0.46, 0.77],
  [0.66, 0.85],
  [0.86, 0.93],
  [0.9, 0.86],
  [1, 0.79],
];
// The path across the front of the field, as a closed shape of curves.
const PATH = [
  [0.38, 1],
  [0.42, 0.93],
  [0.55, 0.92],
  [0.53, 0.87],
  [0.51, 0.83],
  [0.58, 0.81],
  [0.6, 0.835],
  [0.6, 0.835],
  [0.64, 0.846],
  [0.64, 0.846],
  [0.61, 0.84],
  [0.56, 0.85],
  [0.58, 0.88],
  [0.6, 0.93],
  [0.52, 0.95],
  [0.5, 1],
];
// Peaks of the two mountain ranges, far and near: [x, y].
const FAR_PEAKS = [
  [0, 0.5],
  [0.1, 0.41],
  [0.2, 0.47],
  [0.32, 0.31],
  [0.46, 0.46],
  [0.57, 0.38],
  [0.68, 0.48],
  [0.8, 0.33],
  [0.92, 0.46],
  [1, 0.39],
];
const NEAR_PEAKS = [
  [0, 0.56],
  [0.13, 0.46],
  [0.26, 0.54],
  [0.4, 0.42],
  [0.54, 0.55],
  [0.68, 0.45],
  [0.82, 0.55],
  [0.94, 0.47],
  [1, 0.5],
];
// What stands on the hill: kind, place across, foot (fraction of height), height.
const STANDING = [
  { kind: 'pine', x: 0.79, y: 0.5, h: 0.22 },
  { kind: 'pine', x: 0.86, y: 0.485, h: 0.17 },
  { kind: 'pine', x: 0.93, y: 0.47, h: 0.13 },
  { kind: 'tree', x: 0.36, y: 0.495, h: 0.12 },
  { kind: 'tree', x: 0.12, y: 0.62, h: 0.34 },
  { kind: 'maple', x: 0.22, y: 0.595, h: 0.24 },
  { kind: 'bush', x: 0.04, y: 0.635, h: 0.09 },
  { kind: 'bush', x: 0.91, y: 0.64, h: 0.1 },
  { kind: 'rock', x: 0.7, y: 0.67, h: 0.06 },
];
// The cottage on the far hill, and its fence.
const COTTAGE = { x: 0.635, size: 0.06 };

const TAU = Math.PI * 2;

/** Points along the curves, in yard pixels. */
function trace(curves, w, h, steps = 40) {
  const out = [];
  for (let i = 0; i + 3 < curves.length; i += 3) {
    const [p0, c1, c2, p1] = curves.slice(i, i + 4);
    for (let k = 0; k < steps; k++) {
      const t = k / steps,
        u = 1 - t,
        a = u * u * u,
        b = 3 * u * u * t,
        c = 3 * u * t * t,
        d = t * t * t;
      out.push([
        (a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0]) * w,
        (a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]) * h,
      ]);
    }
  }
  const last = curves[curves.length - 1];
  out.push([last[0] * w, last[1] * h]);
  return out;
}

/** The height of a traced ridge at x (pixels). */
function heightAt(ridge, x) {
  if (x <= ridge[0][0]) return ridge[0][1];
  for (let i = 1; i < ridge.length; i++) {
    const [ax, ay] = ridge[i - 1],
      [bx, by] = ridge[i];
    if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
  }
  return ridge[ridge.length - 1][1];
}

/** A mountain ridge through the peaks, broken up finer and finer, in pixels. */
function range(peaks, w, h, rng) {
  let pts = peaks.map(([x, y]) => [x * w, y * h]);
  let amount = h * 0.05;
  for (let d = 0; d < 6; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i];
      next.push([(ax + bx) / 2 + gauss(rng) * (bx - ax) * 0.08, (ay + by) / 2 + gauss(rng) * amount], [bx, by]);
    }
    pts = next;
    amount *= 0.55;
  }
  return pts;
}

/** Closes a ridge down to the bottom of the yard, as a polygon. */
const down = (ridge, h) => [...ridge, [ridge[ridge.length - 1][0], h], [ridge[0][0], h]];

function fillShape(ctx, points, style) {
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

function vertical(ctx, top, bottom, stops) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  for (const [at, c, alpha = 1] of stops) g.addColorStop(at, css(c, alpha));
  return g;
}

/**
 * The light: where the sun stands (`side` -1 on the left, 1 on the right) and how strongly it
 * lights things (0 to 1), by the time of day and the weather.
 */
export function lightFor(period, weather) {
  const side = { morning: -1, day: -0.45, evening: 1, night: 0.3 }[period] ?? -0.45,
    strength = { morning: 0.85, day: 1, evening: 0.85, night: 0.35 }[period] ?? 1;
  return { side, strength: weather === 'clear' ? strength : strength * 0.4 };
}

/** The stylesheet's colours as the painter uses them, with the fallbacks the stylesheet has. */
export function readPalette(get) {
  const names = [
    'sky-a',
    'sky-m',
    'sky-b',
    'mount-a',
    'mount-b',
    'far',
    'far-hi',
    'back',
    'back-hi',
    'front',
    'front-hi',
    'rim',
    'path',
    'cloud',
    'cloud-shade',
    'leaf',
    'leaf-hi',
    'leaf-lo',
    'pine',
    'pine-lo',
    'trunk',
    'trunk-lo',
    'blade',
    'rock',
    'rock-hi',
    'flower-a',
    'flower-b',
    'flower-c',
    'shadow',
    'cap',
    'crown',
    'crown-hi',
    'crown-lo',
    'maple',
    'maple-hi',
    'maple-lo',
  ];
  const raw = Object.fromEntries(names.map(n => [n, get(n)]));
  // A round tree's crown is the bushes' green unless the season gives it its own (scenery.css).
  for (const tone of ['', '-hi', '-lo']) {
    raw[`crown${tone}`] ||= raw[`leaf${tone}`];
    raw[`maple${tone}`] ||= raw[`leaf${tone}`];
  }
  raw.cap ||= 'transparent';
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === 'transparent' ? [0, 0, 0, 0] : color(v)]));
}

/** On a rainy day the land is greyer and a little darker. */
function weathered(pal, weather) {
  if (weather !== 'rain') return pal;
  const out = { ...pal };
  for (const k of Object.keys(out))
    if (!k.startsWith('sky') && !k.startsWith('cloud')) out[k] = shade(dull(out[k], 0.28), 0.08);
  return out;
}

/** One cloud: puffs heaped into a dome over a flat, shaded base, lit from the sun's side. */
export function paintCloud(ctx, cx, bottom, width, height, pal, rng, lit, alpha = 1) {
  const body = pal.cloud,
    under = pal['cloud-shade'],
    puffs = [];
  const n = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const across = (i / (n - 1) - 0.5) * 2 + gauss(rng) * 0.12,
      dome = (1 - Math.abs(across)) ** 1.3,
      r = height * (0.2 + dome * 0.24) * (0.85 + rng() * 0.3);
    puffs.push({ x: cx + across * width * 0.4, y: bottom - r * 0.6 - dome * height * 0.42 * (0.7 + rng() * 0.3), r });
  }
  puffs.sort((a, b) => b.y - a.y);
  wash(ctx, ellipse(cx, bottom - height * 0.12, width * 0.46, height * 0.14, 12), under, rng, {
    alpha: 0.3 * alpha,
    layers: 4,
  });
  for (const p of puffs)
    wash(ctx, ellipse(p.x, p.y + p.r * 0.18, p.r, p.r * 0.9, 10, rng), under, rng, { alpha: 0.2 * alpha, layers: 4 });
  for (const p of puffs)
    wash(ctx, ellipse(p.x + lit.side * p.r * 0.1, p.y - p.r * 0.1, p.r * 0.86, p.r * 0.8, 10, rng), body, rng, {
      alpha: 0.26 * alpha,
      layers: 5,
    });
  // The sunlit tops, brightest on the sun's side.
  const glow = light(body, 0.6);
  for (const p of puffs.slice(-Math.ceil(n / 2)))
    wash(ctx, ellipse(p.x + lit.side * p.r * 0.3, p.y - p.r * 0.35, p.r * 0.5, p.r * 0.38, 9, rng), glow, rng, {
      alpha: 0.22 * alpha * (0.4 + lit.strength * 0.6),
      layers: 3,
    });
}

/** The sky: its light from the top down to the haze, and the clouds that stand still in it. */
export function paintSky(ctx, w, h, palette, { period, weather, season }) {
  const pal = palette,
    lit = lightFor(period, weather),
    rng = seeded(11);
  ctx.fillStyle = vertical(ctx, 0, h, [
    [0, pal['sky-a']],
    [0.34, pal['sky-m']],
    [0.6, pal['sky-b']],
    [1, pal['sky-b']],
  ]);
  ctx.fillRect(0, 0, w, h);
  // Broad, barely-there strokes, so the sky is painted and not a flat gradient.
  for (let i = 0; i < 16; i++) {
    const y = rng() * h * 0.6,
      c = vary(mix(pal['sky-a'], pal['sky-m'], y / (h * 0.6)), rng, 6);
    wash(ctx, ellipse(rng() * w, y, w * (0.2 + rng() * 0.3), h * (0.03 + rng() * 0.05), 10, rng), c, rng, {
      alpha: 0.07,
      layers: 3,
    });
  }
  const crng = seeded(23);
  if (weather === 'clear' && period !== 'night') {
    // Towering clouds along the horizon, behind the mountains; taller in summer.
    const tall = season === 'summer' ? 1.35 : 1;
    for (const [x, size] of [
      [0.14, 0.9],
      [0.46, 1.15],
      [0.83, 1],
    ]) {
      const width = w * 0.22 * size,
        height = h * 0.2 * size * tall;
      paintCloud(ctx, x * w, h * 0.5, width, height, pal, crng, lit, 0.9);
    }
    // A few high, thin streaks.
    for (let i = 0; i < 5; i++)
      wash(
        ctx,
        ellipse(crng() * w, h * (0.08 + crng() * 0.18), w * (0.08 + crng() * 0.1), h * 0.008, 8, crng),
        pal.cloud,
        crng,
        {
          alpha: period === 'evening' ? 0.16 : 0.1,
          layers: 3,
        },
      );
  } else if (weather === 'clear') {
    for (let i = 0; i < 3; i++)
      wash(ctx, ellipse(crng() * w, h * (0.15 + crng() * 0.25), w * 0.18, h * 0.012, 8, crng), pal.cloud, crng, {
        alpha: 0.08,
        layers: 3,
      });
  } else {
    // Overcast: wide, flat layers of cloud, darker underneath.
    const heavy = weather === 'rain' ? 0.32 : 0.22;
    for (let i = 0; i < 14; i++) {
      const y = h * (0.02 + crng() * 0.45),
        c = mix(pal.cloud, pal['cloud-shade'], crng());
      wash(ctx, ellipse(crng() * w, y, w * (0.25 + crng() * 0.3), h * (0.04 + crng() * 0.05), 12, crng), c, crng, {
        alpha: heavy,
        layers: 4,
      });
    }
  }
  grain(ctx, seeded(5), 0.025);
}

/** A mountain range: a ridge, lighter on the slopes that face the sun, with snow up high in winter. */
function mountains(ctx, w, h, peaks, base, rng, lit, snowy, haze) {
  const ridge = range(peaks, w, h, rng),
    top = Math.min(...ridge.map(p => p[1]));
  fillShape(
    ctx,
    down(ridge, h * 0.75),
    vertical(ctx, top, h * 0.62, [
      [0, light(base, 0.06)],
      [1, mix(base, haze, 0.45)],
    ]),
  );
  // Slopes: lit or shaded by which way they face, as long strokes down from the ridge.
  for (let i = 2; i < ridge.length - 2; i += 2) {
    const [x, y] = ridge[i],
      slope = (ridge[i + 2][1] - ridge[i - 2][1]) / (ridge[i + 2][0] - ridge[i - 2][0] || 1),
      facing = slope * lit.side,
      length = (h * 0.62 - y) * (0.25 + rng() * 0.5);
    if (rng() < 0.55) continue;
    const c = facing > 0 ? light(base, 0.25) : shade(base, 0.2),
      alpha = (facing > 0 ? 0.12 : 0.1) * (0.5 + lit.strength * 0.5);
    ctx.strokeStyle = css(c, alpha);
    ctx.lineWidth = 2 + rng() * 5;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(
      x - slope * length * 0.2,
      y + length * 0.5,
      x - slope * length * 0.45 + gauss(rng) * 6,
      y + length,
    );
    ctx.stroke();
  }
  if (snowy) {
    const line = top + (h * 0.5 - top) * 0.35,
      snow = light(base, 0.75);
    for (let i = 0; i < ridge.length; i++) {
      const [x, y] = ridge[i];
      if (y > line) continue;
      ctx.strokeStyle = css(snow, 0.55);
      ctx.lineWidth = 2.5 + rng() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x + gauss(rng) * 2, y + (line - y) * (0.6 + rng() * 0.7));
      ctx.stroke();
    }
  }
  return ridge;
}

/**
 * A crown built up from clumps of leaves, as background painters do: the whole crown first in
 * shade, then the clumps the light reaches laid over it, the most sunlit last, each with a leafy
 * scalloped top, a bright cap on the sun's side and a shadow cast on the clump below.
 */
function crown(ctx, cx, cy, R, colors, rng, lit, unit, extras) {
  const [hi, mid, lo] = colors,
    deep = shade(lo, 0.18),
    clumps = [];
  const n = 15 + Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU,
      d = Math.sqrt(rng()) * 0.8,
      x = cx + Math.cos(a) * d * R * 1.08,
      y = cy + Math.sin(a) * d * R * 0.86;
    clumps.push({ x, y, r: R * (0.3 + rng() * 0.15), toward: ((x - cx) / R) * lit.side + (cy - y) / R });
  }
  for (const c of clumps)
    wash(ctx, ellipse(c.x, c.y + c.r * 0.1, c.r * 1.02, c.r * 0.92, 9, rng), lo, rng, { alpha: 0.5, layers: 3 });
  wash(ctx, ellipse(cx - lit.side * R * 0.15, cy + R * 0.35, R * 0.75, R * 0.35, 10, rng), deep, rng, {
    alpha: 0.3,
    layers: 3,
  });
  const sunlit = clumps.filter(c => c.toward > -0.35).sort((a, b) => a.toward - b.toward);
  for (const c of sunlit) {
    const bx = c.x + lit.side * c.r * 0.06,
      by = c.y - c.r * 0.06;
    // The clump's shadow on whatever is below it.
    wash(ctx, ellipse(c.x - lit.side * c.r * 0.12, c.y + c.r * 0.52, c.r * 0.72, c.r * 0.2, 8, rng), deep, rng, {
      alpha: 0.22,
      layers: 2,
    });
    wash(ctx, ellipse(bx, by, c.r * 0.86, c.r * 0.72, 9, rng), mid, rng, { alpha: 0.55, layers: 3 });
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + ((k + 0.5) / 7) * Math.PI;
      dab(
        ctx,
        bx + Math.cos(a) * c.r * 0.8,
        by + Math.sin(a) * c.r * 0.66,
        c.r * (0.14 + rng() * 0.06),
        mid,
        0.85,
        a,
        0.8,
      );
    }
    if (c.toward > 0.1) {
      const hx = c.x + lit.side * c.r * 0.28,
        hy = c.y - c.r * 0.3,
        glow = 0.3 + lit.strength * 0.25;
      wash(ctx, ellipse(hx, hy, c.r * 0.46, c.r * 0.32, 8, rng), hi, rng, { alpha: glow, layers: 3 });
      for (let k = 0; k < 5; k++) {
        const a = Math.PI * (1.15 + k * 0.18);
        dab(ctx, hx + Math.cos(a) * c.r * 0.42, hy + Math.sin(a) * c.r * 0.28, c.r * 0.1, hi, glow + 0.2, a, 0.8);
      }
    }
  }
  // The ragged edge: single leaves where the crown meets the sky.
  for (let i = 0; i < 46; i++) {
    const a = rng() * TAU,
      x = cx + Math.cos(a) * R * (0.95 + rng() * 0.18),
      y = cy + Math.sin(a) * R * 0.82 * (0.95 + rng() * 0.18),
      toward = Math.cos(a) * lit.side - Math.sin(a);
    dab(ctx, x, y, unit * (1.4 + rng() * 1.6), toward > 0.3 ? hi : rng() < 0.5 ? mid : lo, 0.8, rng() * TAU, 0.6);
  }
  if (extras.blossom)
    for (let i = 0; i < 46; i++) {
      const a = rng() * TAU,
        d = Math.sqrt(rng()) * R;
      dab(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, unit * (0.9 + rng()), [255, 246, 248, 1], 0.6, 0, 1);
    }
  if (extras.cap[3] > 0.4)
    for (const c of sunlit.slice(-Math.ceil(n * 0.5)))
      wash(ctx, ellipse(c.x, c.y - c.r * 0.5, c.r * 0.7, c.r * 0.28, 8, rng), extras.cap, rng, {
        alpha: 0.5,
        layers: 3,
      });
}

/** A bare winter crown: a few last leaves on the twigs, and snow along them if it snowed. */
function lastLeaves(ctx, cx, cy, R, c, rng, unit, extras) {
  const leaf = [c[0], c[1], c[2], 1];
  for (let i = 0; i < 18; i++) {
    const a = rng() * TAU,
      d = Math.sqrt(rng()) * R * 0.9;
    dab(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, unit * (1.2 + rng()), leaf, 0.6, rng() * TAU, 0.6);
  }
  if (extras.cap[3] > 0.4)
    for (let i = 0; i < 24; i++) {
      const a = Math.PI + rng() * Math.PI,
        d = Math.sqrt(rng()) * R * 0.85;
      dab(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, unit * (1.5 + rng() * 1.5), extras.cap, 0.7, 0, 0.4);
    }
}

/** A ground shadow, cast away from the sun. */
function groundShadow(ctx, x, y, rx, pal, rng, lit) {
  wash(ctx, ellipse(x - lit.side * rx * 0.3, y, rx, rx * 0.13, 12), shade(pal.back, 0.5), rng, {
    alpha: 0.07 + lit.strength * 0.09,
    layers: 4,
  });
}

/** A round tree: trunk and branches, the crown over them (winter's crowns are nearly clear). */
function roundTree(ctx, x, y, H, pal, rng, lit, unit, which, extras) {
  const R = H * 0.34,
    cy = y - H * 0.62;
  groundShadow(ctx, x, y, H * 0.32, pal, rng, lit);
  const trunk = pal.trunk,
    base = H * 0.042,
    neck = H * 0.022,
    top = cy + R * 0.25;
  // The trunk flares into roots at the foot and leans a little.
  const lean = gauss(rng) * H * 0.015,
    body = [
      [x - base * 2, y + 1],
      [x - base, y - H * 0.05],
      [x - neck + lean, top],
      [x + neck + lean, top],
      [x + base, y - H * 0.05],
      [x + base * 2, y + 1],
    ];
  fillShape(ctx, body, css(trunk));
  // The side away from the sun in shade, the sun's side lit, and a few lines of bark.
  const away = -lit.side;
  fillShape(
    ctx,
    [
      [x + away * base * 0.2, y],
      [x + away * neck * 0.2 + lean, top],
      [x + away * neck + lean, top],
      [x + away * base, y - H * 0.05],
      [x + away * base * 2, y + 1],
    ],
    css(pal['trunk-lo'], 0.85),
  );
  ctx.strokeStyle = css(light(trunk, 0.3), 0.5 * lit.strength);
  ctx.lineWidth = Math.max(1, neck * 0.45);
  ctx.beginPath();
  ctx.moveTo(x - away * base * 0.6, y - H * 0.04);
  ctx.lineTo(x - away * neck * 0.55 + lean, top);
  ctx.stroke();
  ctx.strokeStyle = css(pal['trunk-lo'], 0.6);
  ctx.lineWidth = Math.max(0.8, neck * 0.18);
  for (let k = 0; k < 4; k++) {
    const f = rng() * 0.8,
      bx = x + gauss(rng) * neck * 0.5 + lean * f;
    ctx.beginPath();
    ctx.moveTo(bx, y - H * 0.06 - f * (y - top) * 0.6);
    ctx.lineTo(bx + gauss(rng), y - H * 0.06 - (f + 0.15) * (y - top) * 0.6);
    ctx.stroke();
  }
  // Branches and twigs, which winter shows.
  ctx.strokeStyle = css(trunk);
  ctx.lineCap = 'round';
  const limb = (x0, y0, angle, length, width, depth) => {
    const x1 = x0 + Math.cos(angle) * length,
      y1 = y0 + Math.sin(angle) * length;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + gauss(rng) * length * 0.15, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
    if (depth > 0)
      for (let k = 0; k < 2; k++)
        limb(
          x1,
          y1,
          angle + (k ? 0.45 : -0.45) + gauss(rng) * 0.25,
          length * (0.62 + rng() * 0.15),
          width * 0.6,
          depth - 1,
        );
  };
  // Under a leafy crown the branches stay inside it; in winter they reach out bare.
  const leafy = pal[which][3] > 0.5;
  ctx.save();
  if (leafy) {
    ctx.beginPath();
    ctx.ellipse(x, cy, R * 0.9, R * 0.72, 0, 0, TAU);
    ctx.rect(x - R * 2, cy, R * 4, H);
    ctx.clip();
  }
  for (const a of [-2.3, -1.85, -1.3, -0.85])
    limb(x + lean, top, a + gauss(rng) * 0.1, R * 0.5, H * 0.018, leafy ? 3 : 4);
  ctx.restore();
  if (leafy) crown(ctx, x, cy, R, [pal[`${which}-hi`], pal[which], pal[`${which}-lo`]], rng, lit, unit, extras);
  else lastLeaves(ctx, x, cy, R, pal[which], rng, unit, extras);
}

/** A pine: tiers of drooping boughs, dark beneath and lit along the sun's edge. */
function pine(ctx, x, y, H, pal, rng, lit, unit, extras) {
  groundShadow(ctx, x, y, H * 0.2, pal, rng, lit);
  ctx.fillStyle = css(pal.trunk);
  ctx.fillRect(x - H * 0.025, y - H * 0.16, H * 0.05, H * 0.16);
  const tiers = 6,
    W = H * 0.3;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers,
      bottom = y - H * 0.1 - t * H * 0.72,
      half = W * (1 - t * 0.82),
      top = bottom - H * 0.24;
    const shape = [[x, top]];
    const tips = 5;
    for (let k = 0; k <= tips; k++) {
      const f = 1 - (k / tips) * 2,
        px = x + f * half;
      shape.push([px, bottom + (k % 2 ? -H * 0.02 : H * 0.015) + gauss(rng) * H * 0.006]);
    }
    wash(ctx, shape, pal['pine-lo'], rng, { alpha: 0.42, layers: 4, amount: 0.12 });
    const lit_ = shape.map(([px, py]) => [px + lit.side * half * 0.12, py - H * 0.02]);
    wash(ctx, lit_.slice(0, Math.ceil(lit_.length * 0.6)).concat([[x, bottom]]), pal.pine, rng, {
      alpha: 0.32,
      layers: 3,
      amount: 0.12,
    });
    for (let k = 0; k < 8; k++) {
      const f = rng(),
        px = x + lit.side * f * half * 0.9,
        py = top + (bottom - top) * (0.3 + f * 0.6);
      dab(ctx, px, py, unit * (1.2 + rng()), light(pal.pine, 0.25), 0.4 * lit.strength, -lit.side * 0.6, 0.5);
    }
    if (extras.cap[3] > 0.4)
      wash(
        ctx,
        [
          [x, top + H * 0.02],
          [x + half * 0.8, bottom - H * 0.03],
          [x - half * 0.8, bottom - H * 0.03],
        ],
        extras.cap,
        rng,
        {
          alpha: 0.35,
          layers: 3,
          amount: 0.15,
        },
      );
  }
}

/** A bush: a low heap of leaf clumps. */
function bush(ctx, x, y, H, pal, rng, lit, unit, extras) {
  groundShadow(ctx, x, y, H, pal, rng, lit);
  crown(ctx, x, y - H * 0.42, H * 0.62, [pal['leaf-hi'], pal.leaf, pal['leaf-lo']], rng, lit, unit, {
    cap: extras.cap,
    blossom: false,
  });
}

/** A rock, with moss at its foot. */
function rock(ctx, x, y, H, pal, rng, lit, unit, extras) {
  groundShadow(ctx, x, y, H * 0.9, pal, rng, lit);
  const shape = [
    [x - H * 0.85, y],
    [x - H * 0.6, y - H * 0.55],
    [x - H * 0.1, y - H * 0.85],
    [x + H * 0.45, y - H * 0.6],
    [x + H * 0.8, y],
  ];
  wash(ctx, shape, pal.rock, rng, { alpha: 0.5, layers: 4, amount: 0.12, edge: 0.15 });
  wash(
    ctx,
    shape.map(([px, py]) => [px * 0.55 + (x + lit.side * H * 0.3) * 0.45, py * 0.7 + (y - H * 0.75) * 0.3]),
    pal['rock-hi'],
    rng,
    {
      alpha: 0.4,
      layers: 3,
      amount: 0.15,
    },
  );
  for (let i = 0; i < 6; i++)
    dab(ctx, x + gauss(rng) * H * 0.6, y - rng() * H * 0.12, unit * 2.2, pal['leaf-lo'], 0.5, 0, 0.5);
  if (extras.cap[3] > 0.4)
    wash(ctx, ellipse(x - H * 0.05, y - H * 0.72, H * 0.5, H * 0.16, 9), extras.cap, rng, { alpha: 0.5, layers: 3 });
}

/** In other light a painted thing takes on the light's colour: at night, the night's blue. */
function inLight(c, pal, period) {
  const k = { morning: 0.1, day: 0.04, evening: 0.22, night: 0.68 }[period] ?? 0.04;
  return mix(c, pal['mount-a'], k);
}

/** The cottage on the far hill: walls, a gabled roof, a chimney, a window that is lit at dusk. */
function cottage(ctx, x, y, s, pal, rng, lit, period, extras) {
  const wall = inLight([238, 226, 204, 1], pal, period),
    wallShade = shade(wall, 0.25),
    roof = inLight([170, 88, 70, 1], pal, period),
    wood = inLight([128, 92, 66, 1], pal, period);
  groundShadow(ctx, x, y, s * 0.9, pal, rng, lit);
  const left = x - s * 0.55,
    right = x + s * 0.55,
    eave = y - s * 0.55;
  fillShape(
    ctx,
    [
      [left, y],
      [left, eave],
      [right, eave],
      [right, y],
    ],
    css(wall),
  );
  // The gable end in shade on the side away from the sun.
  const gable = lit.side < 0 ? [right - s * 0.42, right] : [left, left + s * 0.42];
  fillShape(
    ctx,
    [
      [gable[0], y],
      [gable[0], eave],
      [gable[1], eave],
      [gable[1], y],
    ],
    css(wallShade, 0.7),
  );
  ctx.fillStyle = css(roof);
  ctx.beginPath();
  ctx.moveTo(left - s * 0.14, eave + s * 0.04);
  ctx.lineTo(x - s * 0.12, y - s * 1.08);
  ctx.lineTo(x + s * 0.12, y - s * 1.08);
  ctx.lineTo(right + s * 0.14, eave + s * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(shade(roof, 0.3), 0.6);
  ctx.fillRect(left - s * 0.14, eave, right - left + s * 0.28, s * 0.05);
  ctx.fillStyle = css(wood);
  ctx.fillRect(x + s * 0.18, y - s * 1.08, s * 0.12, s * 0.28);
  if (extras.cap[3] > 0.4) {
    ctx.fillStyle = css(extras.cap, 0.9);
    ctx.beginPath();
    ctx.moveTo(left - s * 0.1, eave - s * 0.02);
    ctx.lineTo(x - s * 0.12, y - s * 1.1);
    ctx.lineTo(x + s * 0.12, y - s * 1.1);
    ctx.lineTo(right + s * 0.1, eave - s * 0.02);
    ctx.lineTo(right - s * 0.05, eave + s * 0.06);
    ctx.lineTo(left + s * 0.05, eave + s * 0.06);
    ctx.closePath();
    ctx.fill();
  }
  // The door, and the window: warm and glowing from evening on.
  ctx.fillStyle = css(wood);
  ctx.fillRect(x - s * 0.36, y - s * 0.36, s * 0.16, s * 0.36);
  const glowing = period === 'evening' || period === 'night',
    pane = glowing ? [255, 214, 130, 1] : inLight([150, 178, 196, 1], pal, period);
  if (glowing) {
    const g = ctx.createRadialGradient(x + s * 0.12, y - s * 0.3, 0, x + s * 0.12, y - s * 0.3, s * 0.8);
    g.addColorStop(0, css([255, 200, 110, 1], period === 'night' ? 0.45 : 0.25));
    g.addColorStop(1, css([255, 200, 110, 1], 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - s, y - s * 1.2, s * 2.2, s * 1.4);
  }
  ctx.fillStyle = css(pane);
  ctx.fillRect(x + s * 0.02, y - s * 0.42, s * 0.22, s * 0.18);
  ctx.fillStyle = css(wood, 0.8);
  ctx.fillRect(x + s * 0.12, y - s * 0.42, s * 0.02, s * 0.18);
  // A little fence running off down the hill.
  ctx.strokeStyle = css(wood, 0.85);
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const fx = right + s * 0.35 + k * s * 0.32,
      fy = y + k * s * 0.05;
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - s * 0.26);
  }
  ctx.moveTo(right + s * 0.35, y - s * 0.18);
  ctx.lineTo(right + s * 0.35 + 5 * s * 0.32, y + 5 * s * 0.05 - s * 0.18);
  ctx.moveTo(right + s * 0.35, y - s * 0.08);
  ctx.lineTo(right + s * 0.35 + 5 * s * 0.32, y + 5 * s * 0.05 - s * 0.08);
  ctx.stroke();
}

/** Grass over a stretch of hill: blades, smaller near its ridge and larger near the front. */
function grass(ctx, ridge, w, h, base, tip, rng, unit, density, near = 0) {
  const count = Math.min(9000, Math.round((w * h * density) / 900));
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng() * w,
      top = heightAt(ridge, x),
      f = rng() ** 0.8,
      y = top + 3 + f * (h - top),
      depth = near + ((y - top) / (h - top || 1)) * (1 - near),
      length = unit * (2.5 + depth * 6) * (0.6 + rng() * 0.8);
    blade(
      ctx,
      x,
      y,
      length,
      gauss(rng) * length * 0.5,
      unit * (0.7 + depth * 0.7),
      vary(mix(base, tip, rng()), rng, 9),
      0.42,
    );
  }
}

/** Patches of sunlight and shade over the field, as the light falls through scattered cloud. */
function patches(ctx, ridge, w, h, c, rng, lit) {
  for (let i = 0; i < 7; i++) {
    const x = rng() * w,
      top = heightAt(ridge, x),
      y = top + (h - top) * (0.15 + rng() * 0.75),
      sunny = rng() < 0.65;
    wash(
      ctx,
      ellipse(x, y, w * (0.08 + rng() * 0.14), (h - top) * (0.025 + rng() * 0.035), 12, rng),
      sunny ? light(c, 0.35) : shade(c, 0.2),
      rng,
      {
        alpha: (sunny ? 0.11 : 0.08) * (0.4 + lit.strength * 0.6),
        layers: 4,
      },
    );
  }
}

/** Flowers scattered in clumps, small near the ridge. */
function flowers(ctx, ridge, w, h, pal, rng, unit, amount) {
  const clumps = Math.round((w / 55) * amount);
  for (let i = 0; i < clumps; i++) {
    const x = rng() * w,
      top = heightAt(ridge, x),
      y0 = top + 6 + rng() * (h - top - 10),
      depth = (y0 - top) / (h - top || 1),
      kind = rng(),
      petal = kind < 0.45 ? pal['flower-a'] : kind < 0.85 ? pal['flower-b'] : pal['flower-c'],
      n = 3 + Math.floor(rng() * 5);
    for (let k = 0; k < n; k++) {
      const fx = x + gauss(rng) * unit * 10 * (0.5 + depth),
        fy = y0 + gauss(rng) * unit * 3 * (0.5 + depth),
        r = unit * (0.9 + depth * 1.6);
      blade(ctx, fx, fy + r * 3, r * 3, gauss(rng) * r, Math.max(0.6, r * 0.35), pal.blade, 0.5);
      if (r > 1.6)
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU;
          dab(ctx, fx + Math.cos(a) * r * 0.8, fy + Math.sin(a) * r * 0.65, r * 0.62, petal, 0.9, a, 0.8);
        }
      else dab(ctx, fx, fy, r, petal, 0.9, 0, 0.8);
      dab(ctx, fx, fy, r * 0.38, pal['flower-c'], 0.95, 0, 1);
    }
  }
}

/** Darker tufts of grass here and there, so the field has clumps and not an even lawn. */
function tufts(ctx, ridge, w, h, c, rng, unit, count) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w,
      top = heightAt(ridge, x),
      y = top + 8 + rng() ** 0.7 * (h - top - 8),
      depth = (y - top) / (h - top || 1),
      size = unit * (5 + depth * 9);
    for (let k = 0; k < 7; k++)
      blade(
        ctx,
        x + gauss(rng) * size * 0.4,
        y,
        size * (0.6 + rng() * 0.6),
        gauss(rng) * size * 0.5,
        unit * (0.9 + depth),
        vary(c, rng, 8),
        0.6,
      );
  }
}

/** Drifts of tiny flowers, a scatter of dots along a soft band, as a meadow seen from afar. */
function drifts(ctx, ridge, w, h, pal, rng, unit, count) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w,
      top = heightAt(ridge, x),
      y = top + 10 + rng() * (h - top) * 0.6,
      depth = (y - top) / (h - top || 1),
      petal = rng() < 0.6 ? pal['flower-b'] : pal['flower-c'],
      spread = w * (0.03 + rng() * 0.05);
    for (let k = 0; k < 26; k++)
      dab(ctx, x + gauss(rng) * spread, y + gauss(rng) * spread * 0.12, unit * (0.6 + depth * 0.9), petal, 0.75, 0, 1);
  }
}

/**
 * A bough reaching in from the top corner, framing the yard as if seen from under a tree: leaves
 * hanging from it, and the branch itself over them where it is nearest.
 */
function bough(ctx, w, h, pal, rng, lit, unit, extras, which) {
  const R = Math.min(h * 0.1, w * 0.07),
    tones = [pal[`${which}-hi`], pal[which], pal[`${which}-lo`]],
    branch = (width, points) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      ctx.quadraticCurveTo(...points[1], ...points[2]);
      ctx.stroke();
    };
  ctx.lineCap = 'round';
  ctx.strokeStyle = css(pal['trunk-lo']);
  const main = [
      [w + R * 0.5, -R * 0.2],
      [w - R * 1.4, R * 0.15],
      [w - R * 3.2, R * 0.75],
    ],
    twig = [
      [w - R * 1.6, R * 0.32],
      [w - R * 2.1, R * 0.9],
      [w - R * 1.9, R * 1.45],
    ];
  branch(R * 0.2, main);
  branch(R * 0.08, twig);
  if (pal[which][3] <= 0.5) {
    // Bare in winter: small twigs off the branch instead.
    ctx.strokeStyle = css(pal['trunk-lo']);
    for (let k = 0; k < 7; k++) {
      const t = 0.15 + k * 0.12,
        bx = w + R * 0.5 - t * R * 3.7,
        by = -R * 0.2 + t * t * R * 0.95,
        a = (k % 2 ? 1 : -1) * (0.5 + rng() * 0.5) + Math.PI * 0.5;
      branch(R * 0.035, [
        [bx, by],
        [bx + Math.cos(a) * R * 0.25, by + Math.sin(a) * R * 0.3],
        [bx + Math.cos(a) * R * 0.45 + gauss(rng) * R * 0.1, by + Math.sin(a) * R * 0.55],
      ]);
    }
  }
  const leaves = pal[which][3] > 0.5 ? crown : (c, x, y, r) => lastLeaves(c, x, y, r, pal[which], rng, unit, extras);
  leaves(ctx, w - R * 0.5, R * 0.1, R * 0.9, tones, rng, lit, unit, extras);
  leaves(ctx, w - R * 2.6, R * 0.95, R * 0.55, tones, rng, lit, unit, extras);
  leaves(ctx, w - R * 1.75, R * 1.55, R * 0.45, tones, rng, lit, unit, extras);
  // The branch in front where it comes in, lit along its top.
  ctx.save();
  ctx.beginPath();
  ctx.rect(w - R * 1.9, -R, R * 3, R * 1.6);
  ctx.clip();
  branch(R * 0.2, main);
  ctx.strokeStyle = css(light(pal.trunk, 0.2), 0.6 * lit.strength);
  branch(
    R * 0.05,
    main.map(([x, y]) => [x, y - R * 0.07]),
  );
  ctx.restore();
}

/** The land: mountains, the far hill with its cottage and trees, the field, the path. */
export function paintLand(ctx, w, h, palette, { period, weather, season }) {
  const pal = weathered(palette, weather),
    lit = lightFor(period, weather),
    unit = Math.max(0.55, Math.min(1.6, h / 560)),
    snowy = weather === 'snow',
    bloomy = season !== 'winter' && !snowy,
    extras = { cap: pal.cap, blossom: season === 'spring' && !snowy };
  const haze = pal['sky-b'];
  mountains(ctx, w, h, FAR_PEAKS, pal['mount-b'], seeded(31), lit, snowy || season === 'winter', haze);
  // Haze between the ranges.
  ctx.fillStyle = vertical(ctx, h * 0.3, h * 0.62, [
    [0, haze, 0],
    [1, haze, 0.35],
  ]);
  ctx.fillRect(0, h * 0.3, w, h * 0.35);
  const near = mountains(ctx, w, h, NEAR_PEAKS, pal['mount-a'], seeded(37), lit, snowy, haze);
  // Woods along the near mountains' feet: a band of treetops, each lit on the sun's side.
  const woods = seeded(41),
    wood = mix(pal['leaf-lo'], pal['mount-a'], 0.5),
    edge = x => Math.max(heightAt(near, x) + 8, h * (0.53 + Math.sin(x / (w * 0.07)) * 0.012));
  const band = [];
  for (let x = -10; x <= w + 10; x += unit * 5) band.push([x, edge(x) - unit * (2 + woods() * 4)]);
  fillShape(ctx, [...band, [w + 10, h * 0.62], [-10, h * 0.62]], css(wood, 0.8));
  for (let i = 0; i < Math.round(w / 7); i++) {
    const x = woods() * w,
      r = unit * (3 + woods() * 3),
      y = edge(x) - r * 0.4;
    dab(ctx, x, y, r, vary(wood, woods, 4), 0.85, 0, 1.25);
    dab(ctx, x + lit.side * r * 0.35, y - r * 0.45, r * 0.5, light(wood, 0.16), 0.55 * lit.strength, 0, 1.1);
  }
  ctx.fillStyle = vertical(ctx, h * 0.42, h * 0.6, [
    [0, haze, 0],
    [1, haze, 0.4],
  ]);
  ctx.fillRect(0, h * 0.42, w, h * 0.2);

  // The far hill, a row of small trees along it, and the cottage.
  const far = trace(FAR, w, h),
    frng = seeded(43);
  fillShape(
    ctx,
    down(far, h),
    vertical(ctx, h * 0.44, h * 0.62, [
      [0, pal['far-hi']],
      [1, pal.far],
    ]),
  );
  patches(ctx, far, w, h * 0.66, pal.far, frng, lit);
  const hedge = [mix(pal['leaf-hi'], pal.far, 0.35), mix(pal.leaf, pal.far, 0.3), mix(pal['leaf-lo'], pal.far, 0.25)];
  for (const gx of [0.05, 0.09, 0.27, 0.31, 0.44, 0.52, 0.76, 0.8, 0.97]) {
    const x = gx * w,
      y = heightAt(far, x) + unit * 4,
      s = unit * (8 + frng() * 6);
    crown(ctx, x, y - s * 0.9, s, hedge, frng, lit, unit * 0.5, { cap: extras.cap, blossom: false });
  }
  const cx = COTTAGE.x * w,
    cs = h * COTTAGE.size;
  cottage(ctx, cx, heightAt(far, cx) + cs * 0.25, cs, pal, frng, lit, period, extras);

  // The back hill: the field friends stand on.
  const back = trace(BACK, w, h),
    brng = seeded(47);
  fillShape(
    ctx,
    down(back, h),
    vertical(ctx, h * 0.53, h, [
      [0, pal['back-hi']],
      [0.45, pal.back],
      [1, shade(pal.back, 0.06)],
    ]),
  );
  patches(ctx, back, w, h, pal.back, brng, lit);
  ctx.strokeStyle = css(pal.rim, 0.8);
  ctx.lineWidth = unit * 1.4;
  ctx.beginPath();
  for (const [i, [x, y]] of back.entries()) i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  ctx.stroke();
  grass(ctx, back, w, h, pal.back, pal.blade, brng, unit, 1.1);
  tufts(ctx, back, w, h, shade(mix(pal.back, pal.blade, 0.6), 0.1), brng, unit, Math.round(w / 30));
  if (bloomy) {
    drifts(ctx, back, w, h, pal, brng, unit, Math.round(w / 260));
    flowers(ctx, back, w, h, pal, brng, unit, season === 'autumn' ? 0.6 : 1.4);
  }

  // What stands on the hill, the farthest first.
  const things = [...STANDING].sort((a, b) => a.y - b.y);
  things.forEach((t, i) => {
    const rng = seeded(101 + i * 17),
      x = t.x * w,
      y = t.y * h,
      H = t.h * h;
    if (t.kind === 'pine') pine(ctx, x, y, H, pal, rng, lit, unit, extras);
    else if (t.kind === 'bush') bush(ctx, x, y, H, pal, rng, lit, unit, extras);
    else if (t.kind === 'rock') rock(ctx, x, y, H, pal, rng, lit, unit, extras);
    else roundTree(ctx, x, y, H, pal, rng, lit, unit, t.kind === 'maple' ? 'maple' : 'crown', extras);
  });

  // The front of the field, and the path.
  const front = trace(FRONT, w, h),
    frontRng = seeded(53);
  fillShape(
    ctx,
    down(front, h),
    vertical(ctx, h * 0.72, h, [
      [0, light(pal['front-hi'], 0.08), 0.7],
      [0.35, pal.front, 0.85],
      [1, shade(pal.front, 0.1)],
    ]),
  );
  const path = trace(PATH, w, h, 12);
  wash(ctx, path, pal.path, frontRng, { alpha: 0.4, layers: 5, amount: 0.05, edge: 0.12 });
  wash(
    ctx,
    deform(path, frontRng, 1, 0.02).map(([x, y]) => [x + w * 0.004, y]),
    light(pal.path, 0.25),
    frontRng,
    {
      alpha: 0.18,
      layers: 2,
      amount: 0.04,
    },
  );
  for (let i = 0; i < 26; i++) {
    const p = path[Math.floor(frontRng() * path.length)];
    dab(
      ctx,
      p[0] + gauss(frontRng) * w * 0.01,
      p[1] + gauss(frontRng) * 3,
      unit * (1 + frontRng() * 1.5),
      shade(pal.path, 0.25),
      0.5,
    );
  }
  grass(ctx, front, w, h, pal.front, pal.blade, frontRng, unit, 0.9, 0.5);
  tufts(ctx, front, w, h, shade(mix(pal.front, pal.blade, 0.6), 0.14), frontRng, unit * 1.2, Math.round(w / 45));
  if (bloomy) flowers(ctx, front, w, h, pal, frontRng, unit * 1.2, season === 'autumn' ? 0.4 : 0.9);
  // The near ground a little darker, so the eye settles on the friends in the middle.
  ctx.fillStyle = vertical(ctx, h * 0.8, h, [
    [0, shade(pal.front, 0.2), 0],
    [1, shade(pal.front, 0.2), 0.3],
  ]);
  ctx.fillRect(0, h * 0.8, w, h * 0.2);

  // Tall grass in the near corners, framing the yard.
  const corner = seeded(59),
    dark = shade(mix(pal.front, pal.blade, 0.5), 0.12);
  for (const [from, to] of [
    [0, 0.12],
    [0.88, 1],
  ])
    for (let i = 0; i < 70; i++) {
      const x = (from + corner() * (to - from)) * w,
        edge = Math.min(x / w - from, to - x / w) / (to - from),
        length = h * (0.03 + corner() * 0.06) * (1 - edge * 0.8);
      blade(ctx, x, h + 2, length, gauss(corner) * length * 0.5, unit * 1.6, vary(dark, corner, 8), 0.75);
    }
  bough(ctx, w, h, pal, seeded(67), lit, unit, extras, 'crown');
  grain(ctx, seeded(7), 0.04);
}
