// The field friends, plants and gifts stand on: the yard's size (measured when it changes), how
// much things shrink with it, and the conversions between a place on the field (0 to 1 each way,
// as the backend keeps it) and yard pixels.

import { clamp } from '../core/math.js';
import { $ } from '../core/state.js';
import { composition } from './layout.js';
import { scene } from './world.js';
import { worldAllows, worldFor } from './worlds.js';

// Friends stand on the field: y=0 is its top, y=1 the front edge of the yard. Where its top is
// (a fraction of the yard's height) follows the land that is shown: the place's picture (its
// geometry.fieldTop in worlds.json), or, when the picture could not be loaded and the painted
// land stands in for it (easel.js), that land's near hill (yard.json "fieldTop"), where the painted
// lake lies too. A place without a sky paints a plain floor instead and keeps its own line.
// Friends, plants and gifts shrink with the yard, so a small window still reads as a whole scene.
const paintedLand = () => worldAllows(scene.world, 'sky') && $('yard')?.dataset.environment === 'painted';
export const fieldTop = () =>
  (paintedLand() ? composition.fieldTop : worldFor(scene.world).geometry?.fieldTop) ?? composition.fieldTop ?? 0.6;
let zoom = 1;
// How much friends shrink in a yard of this size. By the height, so a small window still reads as a
// whole scene; a strip (much wider than tall, like a bar along the screen's edge) gives the sky
// away and keeps the friends larger, and a narrow column keeps them from crowding each other.
function zoomFor(width, height) {
  const strip = width > height * 3;
  return clamp(Math.min(height / (strip ? 380 : 560), width / 640), 0.35, 1);
}
export const sizeOf = p => p.size * zoom;
export const petHeight = p => (sizeOf(p) * 208) / 192;
/** How much things on the field shrink in the yard as it is now (friends, plants and gifts alike). */
export const yardZoom = () => zoom;
// The yard's size is measured when it changes, not every time a friend takes a step.
const yardSize = { width: 0, height: 0 };
/** Measures the yard again (views.js, when it changes size). */
export function measureYard() {
  const r = $('yard').getBoundingClientRect();
  yardSize.width = r.width;
  yardSize.height = r.height;
  zoom = zoomFor(r.width, r.height);
}
// Room kept at each side of the yard, so a friend at the edge is still whole.
export const EDGE = 14;
// Room kept at the foot of the yard for a friend's name tag, and for the tools floating over the
// scene (in the mini view they only rise under the pointer, so the tag's room is enough).
const footRoom = () => (document.body.classList.contains('mini') ? 42 : 76);
/** The field friends and plants stand on, in yard pixels: its width, the ridge (top) and the
 * front edge (bottom) a foot can reach. */
export function field() {
  if (!yardSize.width) measureYard();
  const { width, height } = yardSize;
  return { width, height, top: height * fieldTop(), bottom: height - footRoom() };
}
export function geometry(p) {
  if (!yardSize.width) measureYard();
  const r = yardSize,
    top = Math.max(12, r.height * fieldTop() - petHeight(p));
  return {
    w: Math.max(1, r.width - sizeOf(p) - EDGE * 2),
    top,
    h: Math.max(1, r.height - petHeight(p) - footRoom() - top),
  };
}
/** A place on the field (0 to 1 each way, as plants and decorations keep it) in yard pixels. */
export function fieldToYard({ x, y }) {
  const f = field();
  return { x: EDGE + x * Math.max(1, f.width - EDGE * 2), y: f.top + y * Math.max(1, f.bottom - f.top) };
}
/** A point in the yard, in pixels, as a place on the field. */
export function yardToField(px, py) {
  const f = field();
  return {
    x: clamp((px - EDGE) / Math.max(1, f.width - EDGE * 2)),
    y: clamp((py - f.top) / Math.max(1, f.bottom - f.top)),
  };
}
/** Where a friend heads (its place, 0 to 1 each way) so that its feet come to (px, py) in the yard. */
export function footTarget(v, px, py, lift = 4) {
  const { w, h, top } = geometry(v.pet);
  return { x: clamp((px - EDGE - sizeOf(v.pet) / 2) / w), y: clamp((py - top - petHeight(v.pet) + lift) / h) };
}
