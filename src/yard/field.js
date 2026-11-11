// The field friends, plants and gifts stand on: the yard's size (measured when it changes), how
// much things shrink with it, and the conversions between a place on the field (0 to 1 each way,
// as the backend keeps it) and yard pixels.

import { clamp } from '../core/math.js';
import { $ } from '../core/state.js';
import { environmentFrame } from './environment.js';
import { composition } from './layout.js';
import { scene } from './world.js';
import { worldAllows, worldFor, worldHasSoil } from './worlds.js';

// Friends stand on the field: y=0 is its top, y=1 the front edge of the yard. Where its top is
// (a fraction of the yard's height) follows the land that is shown: the place's picture (its
// geometry.fieldTop in worlds.json), or, when the picture could not be loaded and the painted
// land stands in for it (easel.js), that land's near hill (yard.json "fieldTop"), where the painted
// lake lies too. A place without a sky paints a plain floor instead and keeps its own line.
// Friends, plants and gifts shrink with the yard, so a small window still reads as a whole scene.
// A picture framed from its foot ("cover-bottom", a room) loses its top in a window wider than it,
// so its floor begins higher in the yard: there, the field follows the picture's own floor line.
const paintedLand = () => worldAllows(scene.world, 'sky') && $('yard')?.dataset.environment === 'painted';
export const fieldTop = () => {
  const place = worldFor(scene.world),
    top = (paintedLand() ? composition.fieldTop : place.geometry?.fieldTop) ?? composition.fieldTop ?? 0.6;
  if (paintedLand() || place.fit !== 'cover-bottom' || !yardSize.height) return top;
  const frame = environmentFrame(yardSize.width, yardSize.height, scene);
  return (frame.y + top * frame.height) / yardSize.height;
};
let zoom = 1,
  zoomWorld = null;
// A room's furniture is drawn at the friends' size where its picture fills a window 850px tall
// (the picture at 850/1024); past that the picture grows with the window, and friends with it.
const ROOM_SCALE = 850 / 1024;
// Up to twice the friend size: a sprite's own pixels at the default size and more.
const ROOM_ZOOM_MAX = 2;
// How big friends are drawn in a yard of this size. By the height, so a small window still reads as
// a whole scene; a strip (much wider than tall, like a bar along the screen's edge) gives the sky
// away and keeps the friends larger, and a narrow column keeps them from crowding each other.
// In a room (a floor without soil) a larger window shows its furniture larger, so friends grow
// as much as its picture (environment.js environmentFrame, 1536 by 1024 for every place) and
// stay the same size next to a desk; outdoors the land is open and friends keep their size.
function zoomFor(width, height, world) {
  const strip = width > height * 3,
    fit = clamp(Math.min(height / (strip ? 380 : 560), width / 640), 0.35, 1);
  if (worldHasSoil(world)) return fit;
  const picture = Math.max(width / 1536, height / 1024) / ROOM_SCALE;
  return Math.min(ROOM_ZOOM_MAX, Math.max(fit, picture));
}
// The zoom follows the place as well as the size: another place measures it again.
const currentZoom = () => {
  if (zoomWorld !== scene.world && yardSize.width) {
    zoomWorld = scene.world;
    zoom = zoomFor(yardSize.width, yardSize.height, zoomWorld);
  }
  return zoom;
};
export const sizeOf = p => p.size * currentZoom();
// How big a friend at the ridge looks next to one at the front edge. Only the drawing shrinks,
// about its feet (views.js place): the box, the place and the tag stay as they are, so where a
// friend stands, what it walks to and where it is clicked do not change with it.
// A deep room (an agent workspace) says its own (geometry.depthFar in worlds.json).
export const DEPTH_FAR = 0.84;
/** How big a friend looks where it stands (its place's y, 0 the ridge to 1 the front edge). */
export function depthScale(y) {
  const far = worldFor(scene.world).geometry?.depthFar ?? DEPTH_FAR;
  return far + (1 - far) * clamp(y);
}
export const petHeight = p => (sizeOf(p) * 208) / 192;
/** Where a friend's feet are in the yard: the middle of its bottom edge. */
export const footOf = v => ({ x: v.px + sizeOf(v.pet) / 2, y: v.py + petHeight(v.pet) });
/** How much things on the field shrink in the yard as it is now (friends, plants and gifts alike). */
export const yardZoom = () => currentZoom();
// The yard's size is measured when it changes, not every time a friend takes a step.
const yardSize = { width: 0, height: 0 };
/** Measures the yard again (views.js, when it changes size). */
export function measureYard() {
  const r = $('yard').getBoundingClientRect();
  yardSize.width = r.width;
  yardSize.height = r.height;
  zoomWorld = scene.world;
  zoom = zoomFor(r.width, r.height, zoomWorld);
}
// Room kept at each side of the yard, so a friend at the edge is still whole.
export const EDGE = 14;
// Room kept at the foot of the yard for a friend's name tag, and for the tools floating over the
// scene. Small windows hide the dock and need only the name tag's room.
const footRoom = () => (document.body.classList.contains('compact') ? 42 : 76);
// A friend itself needs only its name tag's room below its feet (friends.css .pet-tag), so it walks
// on down past the field's foot; the dock floats over it there, and strolls end clear of it.
const TAG_ROOM = 28;
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
    h: Math.max(1, r.height - petHeight(p) - TAG_ROOM - top),
  };
}
/** Whether a friend whose feet are at (px, py) in the yard, `half` its width each side, stands
 * behind the dock floating over the yard's foot (shell.css .yard-dock): a stroll does not end there. */
export function underDock(px, py, half) {
  const dock = document.querySelector('.yard-dock')?.getBoundingClientRect?.();
  if (!dock?.width) return false;
  const yard = $('yard').getBoundingClientRect();
  const left = dock.left - (yard.left || 0),
    top = dock.top - (yard.top || 0);
  return px + half > left && px - half < left + dock.width && py > top;
}
/** A place on the field (0 to 1 each way, as plants and decorations keep it; a gift's y may go
 * past 1, decorFloor) in yard pixels. */
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
// Gifts have no name tag, so they stand lower than friends can: down to just above the dock
// (42px tall, 12px from the foot, shell.css .yard-dock), or nearly to the foot in a small window,
// where the dock is hidden. Their place stays on the friends' field, going past 1 below it, so a
// gift placed before keeps its place (garden.rs DECOR_FLOOR_MAX holds the same bound).
const decorRoom = () => (document.body.classList.contains('compact') ? 8 : 58);
const DECOR_FLOOR_MAX = 4;
/** The lowest a gift's place goes (1 or more): just above the dock, in the friends' field. */
export function decorFloor() {
  const f = field();
  return clamp((f.height - decorRoom() - f.top) / Math.max(1, f.bottom - f.top), 1, DECOR_FLOOR_MAX);
}
/** A point in the yard, in pixels, as a gift's place: as yardToField, reaching down to decorFloor. */
export function yardToDecor(px, py) {
  const f = field();
  return {
    x: clamp((px - EDGE) / Math.max(1, f.width - EDGE * 2)),
    y: clamp((py - f.top) / Math.max(1, f.bottom - f.top), 0, decorFloor()),
  };
}
/** How near the viewer something whose foot is at `py` stands: the draw order friends use
 * (views.js), so a gift below every friend's foot is in front of them all. */
export function depthAt(py) {
  const f = field();
  return 1 + Math.round(((py - f.top) / Math.max(1, f.bottom - f.top)) * 100);
}
/** Where a friend heads (its place, 0 to 1 each way) so that its feet come to (px, py) in the yard. */
export function footTarget(v, px, py, lift = 4) {
  const { w, h, top } = geometry(v.pet);
  return { x: clamp((px - EDGE - sizeOf(v.pet) / 2) / w), y: clamp((py - top - petHeight(v.pet) + lift) / h) };
}
