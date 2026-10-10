// Where things are in the painted yard: the composition (src/content/yard.json: the hills as
// curves, the lake, what stands where, all in fractions of the yard) and the helpers that turn it
// into yard pixels. The field friends stand on starts at the near hill's ridge (field.js
// fieldTop), so these shapes and the friends' places agree.
import { gauss } from './brush.js';

// The scenery's composition, from src/content/yard.json: its curves (the hills, in fractions of the
// yard, x across and y down, as cubic curves: a start point, then two control points and an end
// point for each piece), which curve the field friends stand on starts at (field.js fieldTop), the
// lake, and the layers painted from the back to the front (each names its painter, backdrop.js).
export const composition = { curves: {}, field: 'back', lake: { from: 0, to: 0, top: 0, under: 'back' }, layers: [] };
/** Takes the scenery's composition (the parsed src/content/yard.json). */
export function useScenery(yard) {
  Object.assign(composition, yard);
}

/** Points along the curves, in yard pixels. */
export function trace(curves, w, h, steps = 40) {
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
export function heightAt(ridge, x) {
  if (x <= ridge[0][0]) return ridge[0][1];
  for (let i = 1; i < ridge.length; i++) {
    const [ax, ay] = ridge[i - 1],
      [bx, by] = ridge[i];
    if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
  }
  return ridge[ridge.length - 1][1];
}

/** A mountain ridge through the peaks, broken up finer and finer, in pixels. */
export function range(peaks, w, h, rng) {
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
export const down = (ridge, h) => [...ridge, [ridge[ridge.length - 1][0], h], [ridge[0][0], h]];

/**
 * The lake as it lies in a yard w × h, the one shape the painter (lake.js) and fishing (catch.js)
 * share: its far shore is half an oval from `from` to `to` across, rising to `top`, whose ends sink
 * behind the ridge in front of it (`ridge`, traced), so the water's ends round off where they meet
 * the hill instead of thinning to a point. `shoreAt(x)` is the far shore's height, `ridgeAt(x)` the
 * near edge (the hill hides the rest), `ends` where the water shows between, and `onWater(x, y)`.
 */
export function lakeShape(w, h, ridge) {
  const { from, to, top } = composition.lake,
    x0 = from * w,
    x1 = to * w,
    peak = top * h,
    sink = h * 0.015,
    left = heightAt(ridge, x0) + sink,
    right = heightAt(ridge, x1) + sink;
  const shoreAt = x => {
    const f = (x - x0) / (x1 - x0);
    if (f <= 0 || f >= 1) return Infinity;
    const base = left + (right - left) * f;
    return base + (peak - base) * Math.sqrt(1 - (2 * f - 1) ** 2) ** 0.7;
  };
  const ridgeAt = x => heightAt(ridge, x);
  // Where the far shore comes out above the ridge, one end and the other.
  let first = null,
    last = null;
  for (let k = 1; k < 200; k++) {
    const x = x0 + ((x1 - x0) * k) / 200;
    if (shoreAt(x) < ridgeAt(x)) {
      first ??= x;
      last = x;
    }
  }
  return {
    x0,
    x1,
    top: peak,
    shoreAt,
    ridgeAt,
    ends: [first ?? x0, last ?? x1],
    onWater: (x, y) => y > shoreAt(x) && y < ridgeAt(x),
  };
}
