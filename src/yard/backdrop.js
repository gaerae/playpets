// What the yard's backdrop is painted with, in the manner of hand-painted animation backgrounds
// (the fields and woods of Kazuo Oga's paintings, the soft round trees of Animal Crossing): a
// clean sky with heaped clouds lit white on top and blue in their shade, far mountains in haze,
// a far hill crowned with groves, a lake in the valley, the field friends stand on, and trees
// built from flat masses of leaves in a few values, deep shade below, light on the sun's side.
// The colours are the stylesheet's (scenery.css and the season's, passed in as `pal`); this file
// decides the shapes and the light. Each piece has its own seed, so the yard comes out the same
// each time it is painted again, only in other light.
// Docs: docs/design/2026-10-09-a-painted-yard.md.
// Where each piece goes is src/content/yard.json (layout.js reads it); the colours and light are
// palette.js's; trees.js, lake.js and clouds.js paint the pieces; this file has a painter for each
// kind of layer and paints the layers the composition lists.
import { bumpy, color, css, dot, fillShape, flat, gauss, light, mix, seeded, shade, vertical } from './brush.js';
import { lake } from './lake.js';
import { composition, down, heightAt, range, trace } from './layout.js';
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
    for (let x = -20; x < w + 20;) {
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

// Each layer of the composition (yard.json "layers") names its painter here. A painter gets the
// layer's own settings and what all of them share (`k`: the size, the colours, the light, the
// scene, the traced curves). Moving, adding or taking out a tree, a grove or a hill is a change to
// yard.json; a new kind of thing to paint is a new painter here (or a new thing in THINGS).
const THINGS = {
  tree: (ctx, x, y, H, k, rng) => roundTree(ctx, x, y, H, k.pal, rng, k.lit, 'crown', k.extras),
  maple: (ctx, x, y, H, k, rng) => roundTree(ctx, x, y, H, k.pal, rng, k.lit, 'maple', k.extras),
  bush: (ctx, x, y, H, k, rng) => bush(ctx, x, y, H, k.pal, rng, k.lit, k.extras),
  rock: (ctx, x, y, H, k, rng) => rock(ctx, x, y, H, k.pal, rng, k.lit, k.extras),
  cedar: (ctx, x, y, H, k, rng) => sugi(ctx, x, y, H, k.pal, rng, k.lit, k.extras),
};
// The big tree's height: smaller in a narrow yard (the panel open beside it), so it frames rather than fills.
const treeHeight = (tree, k) => tree.h * k.h * (0.4 + 0.6 * Math.min(1, k.w / k.h / 1.9));
const PAINTERS = {
  /** A mountain range through `peaks`, in `tone` hazed by `haze`, snow-capped `snowcap`. */
  mountains(ctx, l, k) {
    mountains(ctx, k.w, k.h, l.peaks, mix(k.pal[l.tone], k.haze, l.haze), seeded(l.seed), k.when(l.snowcap), k.haze);
  },
  /** Woods along a ridge seen from afar, with groves rising from behind it (`groves`: [x, size]). */
  woods(ctx, l, k) {
    const ridge = k.curve(l.along),
      rng = seeded(l.seed),
      tint = c => mix(c, k.haze, l.haze),
      t = k.leaves,
      far = { deep: tint(t.deep), dark: tint(t.dark), body: tint(t.body), glow: tint(t.glow) };
    woods(
      ctx,
      ridge.map(([x, y]) => [x, y + k.h * (l.lower || 0)]),
      k.w,
      k.h,
      k.pal,
      rng,
      k.lit,
      k.haze,
      l.haze,
      k.extras.cap,
    );
    for (const [gx, size] of l.groves || []) {
      const x = gx * k.w,
        R = size * k.h;
      canopy(ctx, x, heightAt(ridge, x) - R * 0.35, R, far, rng, k.lit, k.extras.cap);
    }
  },
  /** A hill below a curve, coloured from `from` to `to` (fractions of the height) through `stops`. */
  hill(ctx, l, k) {
    fillShape(
      ctx,
      down(k.curve(l.curve), k.h),
      vertical(
        ctx,
        k.h * l.from,
        k.h * l.to,
        l.stops.map(([at, c]) => [at, k.tone(c)]),
      ),
    );
  },
  /** A hedgerow along a hill, as fields are divided in the country. */
  hedgerow(ctx, l, k) {
    const { w, h, pal } = k;
    ctx.strokeStyle = css(mix(pal.far, k.leaves.dark, 0.55));
    ctx.lineWidth = Math.max(1.5, h * 0.006);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [i, [x, y]] of k.curve(l.along).entries()) {
      const yy = y + h * 0.03 + Math.sin(x / (w * 0.12)) * h * 0.004;
      i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
    }
    ctx.stroke();
  },
  /** Cedars standing on a hill, small at that distance (`at`: [x, size]). */
  cedars(ctx, l, k) {
    const ridge = k.curve(l.along),
      rng = seeded(l.seed);
    for (const [cx, size] of l.at)
      sugi(ctx, cx * k.w, heightAt(ridge, cx * k.w) + k.h * 0.012, size * k.h, k.pal, rng, k.lit, k.extras);
  },
  /** The lake (where it is: yard.json "lake"). */
  lake(ctx, l, k) {
    lake(ctx, k.w, k.h, k.pal, seeded(l.seed), k.lit, k.curve(composition.lake.under));
  },
  /** Broad bands across a hill, a shade lighter or darker. */
  bands(ctx, l, k) {
    bands(ctx, k.curve(l.along), k.h, k.pal[l.tone], k.lit, seeded(l.seed));
  },
  /** A thin line of light along a ridge. */
  ridgeLight(ctx, l, k) {
    ctx.strokeStyle = css(light(k.pal['back-hi'], 0.3), 0.5 + k.lit.strength * 0.3);
    ctx.lineWidth = Math.max(1, k.h * 0.003);
    ctx.beginPath();
    for (const [i, [x, y]] of k.curve(l.along).entries()) i ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1);
    ctx.stroke();
  },
  /** Things standing on the field (`things`: kind, x, foot y, height), the farther ones first. */
  standing(ctx, l, k) {
    [...l.things]
      .sort((a, b) => a.y - b.y)
      .forEach((t, i) => {
        const paint = THINGS[t.kind] || THINGS.tree;
        paint(ctx, t.x * k.w, t.y * k.h, t.h * k.h, k, seeded(l.seed + i * 17));
      });
  },
  /** Clumps of flowers (`at`: x, y, size). */
  flowers(ctx, l, k) {
    flowerClumps(ctx, k.w, k.h, k.pal, seeded(l.seed), l.at);
  },
  /** The big tree that frames the yard (treeHeight). */
  bigTree(ctx, l, k) {
    bigTree(ctx, l.x * k.w, l.y * k.h, treeHeight(l, k), k.pal, seeded(l.seed), k.lit, k.extras);
  },
  /** Strings of little lights draped over the big tree, lit from evening on (the winter lights
   * event). Each string is [x0, y0, x1, y1, sag] in the tree's heights from its foot. */
  fairyLights(ctx, l, k) {
    const tree = composition.layers.find(t => t.paint === 'bigTree');
    if (!tree) return;
    const H = treeHeight(tree, k),
      x = tree.x * k.w,
      y = tree.y * k.h,
      lit = k.scene.period === 'evening' || k.scene.period === 'night',
      rng = seeded(l.seed),
      colours = (l.colours || ['#ffe9a8']).map(color);
    for (const [x0, y0, x1, y1, sag] of l.strings) {
      const ax = x + x0 * H,
        ay = y - y0 * H,
        bx = x + x1 * H,
        by = y - y1 * H,
        mx = (ax + bx) / 2,
        my = (ay + by) / 2 + sag * H;
      ctx.strokeStyle = css(shade(k.pal.trunk, 0.4), 0.7);
      ctx.lineWidth = Math.max(0.8, H * 0.003);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my, bx, by);
      ctx.stroke();
      const n = Math.max(4, Math.round(Math.hypot(bx - ax, by - ay) / (H * 0.045)));
      for (let i = 1; i < n; i++) {
        const t = i / n,
          px = (1 - t) ** 2 * ax + 2 * (1 - t) * t * mx + t * t * bx,
          py = (1 - t) ** 2 * ay + 2 * (1 - t) * t * my + t * t * by + H * 0.006,
          c = colours[(i + Math.floor(rng() * 2)) % colours.length],
          r = Math.max(1.2, H * 0.0065);
        if (lit) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
          glow.addColorStop(0, css(c, 0.55));
          glow.addColorStop(1, css(c, 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, r * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        dot(ctx, px, py, r, lit ? light(c, 0.35) : mix(c, k.pal.trunk, 0.35));
      }
    }
  },
  /** Low shrubs (`at`: x, size) along a line (`y`), such as the near corners. */
  bushes(ctx, l, k) {
    const rng = seeded(l.seed);
    for (const [x, size] of l.at) bush(ctx, x * k.w, k.h * l.y, k.h * size, k.pal, rng, k.lit, k.extras);
  },
};

/** The painters a layer can name, and the things that can stand on the field (for the tests). */
export const PAINTER_NAMES = Object.keys(PAINTERS),
  THING_KINDS = Object.keys(THINGS);

/** The land, painted layer by layer as the composition (yard.json) lists them. */
export function paintLand(ctx, w, h, palette, { period, weather, season, event = null }) {
  const pal = weathered(palette, weather),
    lit = lightFor(period, weather),
    snowy = weather === 'snow',
    traced = new Map();
  // A condition a layer can name: a weather, a season, a time of day, a seasonal event (events.json),
  // or "bloomy" (flowers out).
  const holds = c =>
    c === weather ||
    c === season ||
    c === period ||
    (!!event && c === event) ||
    (c === 'bloomy' && season !== 'winter' && !snowy);
  const tone = c =>
    typeof c === 'string'
      ? pal[c]
      : c.mix
        ? mix(tone(c.mix[0]), tone(c.mix[1]), c.mix[2])
        : c.shade
          ? shade(tone(c.shade[0]), c.shade[1])
          : light(tone(c.light[0]), c.light[1]);
  const k = {
    w,
    h,
    pal,
    lit,
    haze: pal['sky-b'],
    leaves: tones([pal['leaf-hi'], pal.leaf, pal['leaf-lo']], lit),
    extras: { cap: pal.cap, blossom: season === 'spring' && !snowy },
    tone,
    scene: { period, weather, season, event },
    when: c => (Array.isArray(c) ? c.some(holds) : !!c && holds(c)),
    curve: name => {
      if (!traced.has(name)) traced.set(name, trace(composition.curves[name], w, h));
      return traced.get(name);
    },
  };
  for (const layer of composition.layers) {
    if (layer.when && !k.when(layer.when)) continue;
    PAINTERS[layer.paint]?.(ctx, layer, k);
  }
}
