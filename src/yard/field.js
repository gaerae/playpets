// The field friends, plants and gifts stand on: the yard's size (measured when it changes), how
// much things shrink with it, and the conversions between a place on the field (0 to 1 each way,
// as the backend keeps it) and yard pixels.

import { clamp } from '../core/math.js';
import { $ } from '../core/state.js';
import { environmentFrame, environmentLake } from './environment.js';
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
// Where the picture shows walkable ground reaching back past the line (a path to a door, a gate, a
// dock), the field's top rises with it: geometry.edge in worlds.json, [x, y] points of the picture
// from left to right, joined by straight lines; past its ends, and below the line, the line holds.
// A place's y stays 0 to 1 at every x, so what the backend keeps does not change: at the path,
// 0 is up by the door. Over the place's water the field never begins higher than a step in front of
// the water's near shore (SHORE), whatever the edge says: ground drawn behind a pond or a dock out
// over it would put the pond inside the field, and a place saved on it, a stroll or a planting into
// the water; and a bench set at the very top would sit on the pond's stones.
// In yard pixels, kept with the size and the place they were measured for.
// A share of the picture's height: about 20 pixels of a full-size picture.
const SHORE = 0.02;
let edgeAt = null;
function edgeShape() {
  const place = worldFor(scene.world),
    points = place.geometry?.edge;
  if (!points?.length || paintedLand() || place.fit === 'cover-bottom' || !yardSize.width) return null;
  const key = `${scene.world} ${yardSize.width} ${yardSize.height}`;
  if (edgeAt?.key !== key || edgeAt.points !== points) {
    const frame = environmentFrame(yardSize.width, yardSize.height, scene);
    const yard = points.map(([x, y]) => [frame.x + x * frame.width, frame.y + y * frame.height]);
    edgeAt = {
      key,
      points,
      yard,
      lake: environmentLake(yardSize.width, yardSize.height, scene),
      shore: SHORE * frame.height,
    };
    // The highest the field begins anywhere, where draw order (depthAt) starts.
    edgeAt.high = Math.min(...yard.map(([x]) => edgeTop(edgeAt, x, Infinity)));
  }
  return edgeAt;
}
function edgeTop({ yard, lake, shore }, px, line) {
  let top = line;
  for (let i = 1; i < yard.length; i++) {
    const [x0, y0] = yard[i - 1],
      [x1, y1] = yard[i];
    if (px >= x0 && px <= x1) {
      top = Math.min(line, y0 + ((px - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0));
      break;
    }
  }
  // Never below the place's own line: that is where its field begins when it has no edge at all.
  return lake && px > lake.x0 && px < lake.x1 ? Math.min(line, Math.max(top, lake.ridgeAt(px) + shore)) : top;
}
/** Whether the field's top follows the land here (a place with an edge, as it is shown now). */
export const hasEdge = () => !!edgeShape();
/** Where the field begins at `px` across the yard, in yard pixels: its line, or higher where the
 * land reaches back. */
export function topAt(px) {
  const line = yardSize.height * fieldTop(),
    shape = edgeShape();
  return shape ? edgeTop(shape, px, line) : line;
}
let zoom = { friends: 1, props: 1 },
  zoomWorld = null;
// A room's furniture is drawn at the friends' size where its picture fills a window 850px tall
// (the picture at 850/1024); past that the picture grows with the window, and friends with it.
const ROOM_SCALE = 850 / 1024;
// Up to twice the friend size: a sprite's own pixels at the default size and more.
const ROOM_ZOOM_MAX = 2;
// How big friends, and the things set on the field, are drawn in a yard of this size. By the
// height, so a small window still reads as a whole scene; a strip (much wider than tall, like a bar
// along the screen's edge) gives the sky away and keeps the friends larger, and a narrow column
// keeps them from crowding each other.
// In a room (a floor without soil) a larger window shows its furniture larger, so friends grow
// as much as its picture (environment.js environmentFrame, 1536 by 1024 for every place) and
// stay the same size next to a desk; outdoors the land is open and friends keep their size. A
// smaller window shrinks the picture past what a friend can be read at, so friends stop there; a
// gift is furniture, and keeps to the picture's scale, or a bench would stand larger than the desk.
function zoomFor(width, height, world) {
  const strip = width > height * 3,
    fit = clamp(Math.min(height / (strip ? 380 : 560), width / 640), 0.35, 1);
  if (worldHasSoil(world)) return { friends: fit, props: fit };
  const picture = Math.min(ROOM_ZOOM_MAX, Math.max(width / 1536, height / 1024) / ROOM_SCALE);
  return { friends: Math.max(fit, picture), props: picture };
}
// The zoom follows the place as well as the size: another place measures it again.
const currentZoom = () => {
  if (zoomWorld !== scene.world && yardSize.width) {
    zoomWorld = scene.world;
    zoom = zoomFor(yardSize.width, yardSize.height, zoomWorld);
  }
  return zoom;
};
export const sizeOf = p => p.size * currentZoom().friends;
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
/** How big something whose foot is at (px, py) in the yard is drawn for its depth: as a friend whose
 * feet are there (views.js place). A friend's place runs from where the field begins at its feet
 * down to its name tag's room (geometry), so a gift, a plant or a tree on the same spot reads at the
 * same scale; one set below a friend's reach is as near as the nearest friend. */
export function depthScaleAt(px, py) {
  if (!yardSize.width) measureYard();
  const top = topAt(px);
  return depthScale((py - top) / Math.max(1, yardSize.height - TAG_ROOM - top));
}
export const petHeight = p => (sizeOf(p) * 208) / 192;
/** Where a friend's feet are in the yard: the middle of its bottom edge. */
export const footOf = v => ({ x: v.px + sizeOf(v.pet) / 2, y: v.py + petHeight(v.pet) });
/** Where a friend's drawing is in the yard, shrunk by its depth about its feet (views.js place):
 * what it holds (a rod and its line) starts from here, not from its unshrunk box. */
export function drawnBox(v) {
  const s = v.depth ?? 1,
    width = sizeOf(v.pet),
    height = petHeight(v.pet);
  return { x: v.px + (width * (1 - s)) / 2, y: v.py + height * (1 - s), width: width * s, height: height * s };
}
/** How much friends shrink in the yard as it is now. */
export const yardZoom = () => currentZoom().friends;
/** How much the things set on the field (gifts, plants, trees) shrink in the yard as it is now: as
 * much as friends outdoors, and as the picture in a room. */
export const propZoom = () => currentZoom().props;
// The yard's size is measured when it changes, not every time a friend takes a step.
const yardSize = { width: 0, height: 0, left: 0, top: 0 };
/** Measures the yard again (views.js, when it changes size). */
export function measureYard() {
  const r = $('yard').getBoundingClientRect();
  yardSize.width = r.width;
  yardSize.height = r.height;
  yardSize.left = r.left || 0;
  yardSize.top = r.top || 0;
  zoomWorld = scene.world;
  zoom = zoomFor(r.width, r.height, zoomWorld);
}
/** Where a pointer event `e` is in the yard, in pixels, from the yard's box as last measured: read
 * on every pointer move, the box would lay the page out each time. The yard fills its window, so it
 * moves only as it changes size, when it is measured again. */
export function inYard(e) {
  if (!yardSize.width) measureYard();
  return [e.clientX - yardSize.left, e.clientY - yardSize.top];
}
// Room kept at each side of the yard, so a friend at the edge is still whole.
export const EDGE = 14;
// Room kept at the foot of the yard for a friend's name tag, and for the tools floating over the
// scene. Small windows hide the dock and need only the name tag's room.
const footRoom = () => (document.body.classList.contains('compact') ? 42 : 76);
// A friend itself needs only its name tag's room below its feet (friends.css .pet-tag), so it walks
// on down past the field's foot; the dock floats over it there, and strolls end clear of it.
export const TAG_ROOM = 28;
/** The field friends and plants stand on, in yard pixels: its width, the ridge (top) and the
 * front edge (bottom) a foot can reach. */
export function field() {
  if (!yardSize.width) measureYard();
  const { width, height } = yardSize;
  return { width, height, top: height * fieldTop(), bottom: height - footRoom() };
}
/** The box a friend's place (0 to 1 each way) spans, in yard pixels: its width, and its top and
 * height at the field's line, or, given the place's `x`, where the field begins at its feet. */
export function geometry(p, x) {
  if (!yardSize.width) measureYard();
  const r = yardSize,
    w = Math.max(1, r.width - sizeOf(p) - EDGE * 2),
    ground = x === undefined ? r.height * fieldTop() : topAt(EDGE + x * w + sizeOf(p) / 2),
    top = Math.max(12, ground - petHeight(p));
  return { w, top, h: Math.max(1, r.height - petHeight(p) - TAG_ROOM - top) };
}
/** What floats over the yard's foot, in yard pixels: the strip of a tool in hand, which takes the
 * dock's place (garden.css .discovery-target), the dock (shell.css .yard-dock), or, in a small
 * window that hides it, the corner button there (compact.css); null while none shows. It reads the
 * layout: measure it once for the many questions a stroll asks. */
export function dockBox() {
  let dock;
  for (const selector of ['.discovery-target:not([hidden])', '.yard-dock', '.compact-launcher']) {
    dock = document.querySelector(selector)?.getBoundingClientRect?.();
    if (dock?.width) break;
  }
  if (!dock?.width) return null;
  const yard = $('yard').getBoundingClientRect();
  return { left: dock.left - (yard.left || 0), top: dock.top - (yard.top || 0), width: dock.width };
}
/** Whether a friend whose feet are at (px, py) in the yard, `half` its width each side, stands
 * behind the dock (`box`, dockBox), or would hang its name tag behind it: a stroll does not end
 * there. */
export function underDock(px, py, half, box = dockBox()) {
  return !!box && px + half > box.left && px - half < box.left + box.width && py + TAG_ROOM > box.top;
}
/** A place on the field (0 to 1 each way, as plants and decorations keep it; a gift's y may go
 * past 1, decorFloor) in yard pixels. */
export function fieldToYard({ x, y }) {
  const f = field(),
    px = EDGE + x * Math.max(1, f.width - EDGE * 2),
    top = topAt(px);
  return { x: px, y: top + y * Math.max(1, f.bottom - top) };
}
/** A point in the yard, in pixels, as a place on the field. */
export function yardToField(px, py) {
  const f = field(),
    top = topAt(px);
  return {
    x: clamp((px - EDGE) / Math.max(1, f.width - EDGE * 2)),
    y: clamp((py - top) / Math.max(1, f.bottom - top)),
  };
}
// Gifts have no name tag, so they stand lower than friends can: down to just above the dock
// (42px tall, 12px from the foot, shell.css .yard-dock), or nearly to the foot in a small window,
// where the dock is hidden. Their place stays on the friends' field, going past 1 below it, so a
// gift placed before keeps its place (garden.rs DECOR_FLOOR_MAX holds the same bound).
const decorRoom = () => (document.body.classList.contains('compact') ? 8 : 58);
const DECOR_FLOOR_MAX = 4;
/** The lowest a gift's place goes (1 or more): just above the dock, in the friends' field (at
 * `px` across the yard, where the field may begin higher). */
export function decorFloor(px) {
  const f = field(),
    top = px === undefined ? f.top : topAt(px);
  return clamp((f.height - decorRoom() - top) / Math.max(1, f.bottom - top), 1, DECOR_FLOOR_MAX);
}
/** A point in the yard, in pixels, as a gift's place: as yardToField, reaching down to decorFloor. */
export function yardToDecor(px, py) {
  const f = field(),
    top = topAt(px);
  return {
    x: clamp((px - EDGE) / Math.max(1, f.width - EDGE * 2)),
    y: clamp((py - top) / Math.max(1, f.bottom - top), 0, decorFloor(px)),
  };
}
/** How near the viewer something whose foot is at `py` stands: the draw order friends use
 * (views.js), so a gift below every friend's foot is in front of them all. */
export function depthAt(py) {
  const f = field(),
    // From the highest the field begins (up a path) to its foot, so all of it orders above flat
    // gifts (0) and plants, gifts and friends share one scale from 1 to 101 wherever they stand.
    top = Math.min(f.top, edgeShape()?.high ?? f.top);
  return 1 + Math.round(((py - top) / Math.max(1, f.bottom - top)) * 100);
}
/** Where a friend heads (its place, 0 to 1 each way) so that its feet come to (px, py) in the yard. */
export function footTarget(v, px, py, lift = 4) {
  const x = clamp((px - EDGE - sizeOf(v.pet) / 2) / geometry(v.pet).w),
    { h, top } = geometry(v.pet, x);
  return { x, y: clamp((py - top - petHeight(v.pet) + lift) / h) };
}
