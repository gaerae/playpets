// Where things are in the painted yard: the hills as curves, the mountain peaks, what stands on
// the near hill and the far one, the lake, all in fractions of the yard, and the helpers that
// turn them into yard pixels. The field friends stand on starts at the near hill's ridge
// (views.js FIELD_TOP), so these shapes and the friends' places agree.
import { gauss } from './brush.js';

// The hills, in fractions of the yard (x across, y down), as cubic curves: a start point, then
// two control points and an end point for each piece. The field friends stand on starts at the
// back hill's ridge (views.js FIELD_TOP).
export const FAR = [
  [0, 0.57],
  [0.16, 0.45],
  [0.33, 0.46],
  [0.5, 0.53],
  [0.67, 0.6],
  [0.83, 0.51],
  [1, 0.44],
];
export const BACK = [
  [0, 0.66],
  [0.2, 0.53],
  [0.41, 0.56],
  [0.6, 0.64],
  [0.79, 0.72],
  [0.87, 0.67],
  [1, 0.59],
];
export const FRONT = [
  [0, 0.82],
  [0.24, 0.72],
  [0.46, 0.77],
  [0.66, 0.85],
  [0.86, 0.93],
  [0.9, 0.86],
  [1, 0.79],
];
// Peaks of the two mountain ranges, far and near: [x, y].
export const FAR_PEAKS = [
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
export const NEAR_PEAKS = [
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
// What stands on the near hill: kind, place across, foot (fraction of height), height. The big
// tree at the right edge stands nearest and frames the yard.
export const STANDING = [
  { kind: 'tree', x: 0.33, y: 0.556, h: 0.12 },
  { kind: 'bush', x: 0.27, y: 0.59, h: 0.05 },
  { kind: 'tree', x: 0.1, y: 0.63, h: 0.36 },
  { kind: 'maple', x: 0.22, y: 0.6, h: 0.26 },
  { kind: 'bush', x: 0.03, y: 0.66, h: 0.09 },
  { kind: 'rock', x: 0.71, y: 0.68, h: 0.05 },
  { kind: 'bush', x: 0.84, y: 0.75, h: 0.075 },
];
export const BIG_TREE = { x: 0.985, y: 0.84, h: 0.86 };
// Groves along the far hill, seen from afar: place across and size (a fraction of the height).
export const GROVES = [
  [0.02, 0.05],
  [0.08, 0.034],
  [0.15, 0.046],
  [0.24, 0.062],
  [0.31, 0.04],
  [0.4, 0.052],
  [0.47, 0.034],
  [0.53, 0.028],
  [0.73, 0.044],
  [0.79, 0.06],
  [0.87, 0.05],
];
// Two cedars among the groves on the far hill, small at that distance.
export const FAR_CEDARS = [
  [0.648, 0.095],
  [0.668, 0.078],
];
// The lake in the valley between the hills: where it starts and ends across, where its far
// shore is highest, as fractions of the yard. Its near edge is hidden by the near hill's ridge.
export const LAKE = { from: 0.4, to: 0.64, top: 0.562 };

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
