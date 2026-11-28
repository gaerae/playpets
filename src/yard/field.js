// The field friends, plants and gifts stand on: the yard's size (measured when it changes), how
// much things shrink with it, and the conversions between a place on the field (0 to 1 each way,
// as the backend keeps it) and yard pixels.

import { clamp } from '../core/math.js';
import { cellHeight } from '../core/sprites.js';
import { $ } from '../core/state.js';
import { environmentFrame, environmentLake, stripShare } from './environment.js';
import { composition, lakeShape, trace } from './layout.js';
import { scene } from './world.js';
import { worldAllows, worldFor, worldHasSoil } from './worlds.js';

// Friends stand on the field: y=0 is its top, y=1 the front edge of the yard. Where its top is
// (a fraction of the yard's height) follows the land that is shown: the place's picture (its
// geometry.fieldTop in worlds.json), or, when the picture could not be loaded and the painted
// land stands in for it (easel.js), that land's near hill (yard.json "fieldTop"), where the painted
// lake lies too. A place without a sky paints a plain floor instead and keeps its own line.
// Friends, plants and gifts shrink with the yard, so a small window still reads as a whole scene.
// The picture is placed to keep the part always seen in view (environment.js environmentFrame), so
// its floor line is not always at the same share of the yard: the field follows the picture's own.
const paintedLand = () => worldAllows(scene.world, 'sky') && $('yard')?.dataset.environment === 'painted';
// Where the picture lies in the yard, made again only when the yard or the place changes: the field
// asks it at every friend's step.
let framed = { key: '' };
function frameNow() {
  const place = worldFor(scene.world),
    key = `${scene.world} ${yardSize.width} ${yardSize.height}`;
  if (framed.key !== key || framed.place !== place || framed.geometry !== place.geometry)
    framed = { key, place, geometry: place.geometry, frame: environmentFrame(yardSize.width, yardSize.height, scene) };
  return framed.frame;
}
export const fieldTop = () => {
  const place = worldFor(scene.world),
    top = (paintedLand() ? composition.fieldTop : place.geometry?.fieldTop) ?? composition.fieldTop ?? 0.6;
  if (paintedLand() || !yardSize.height) return top;
  const frame = frameNow();
  // Never above the window: a short, wide room crops its floor's far end away.
  return Math.max(0, (frame.y + top * frame.height) / yardSize.height);
};
// Across, the field is the picture: in a window wider than it, its sides are its own edge out of
// focus (environment.js paintSides), not ground. A place's x, 0 to 1, spans the picture there, so a
// flower planted by the cottage stays by it, and nothing stands, is planted or dug in the blur.
function across() {
  const { width } = yardSize,
    frame = width && !paintedLand() ? frameNow() : null;
  return frame && frame.x > 0 ? { left: frame.x, right: frame.x + frame.width } : { left: 0, right: width };
}
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
  if (edgeAt?.key !== key || edgeAt.geometry !== place.geometry) {
    const frame = frameNow();
    const yard = points.map(([x, y]) => [frame.x + x * frame.width, frame.y + y * frame.height]);
    const far = place.geometry.far;
    edgeAt = {
      key,
      geometry: place.geometry,
      yard,
      lake: environmentLake(yardSize.width, yardSize.height, scene),
      shore: SHORE * frame.height,
      far: far === undefined ? undefined : frame.y + far * frame.height,
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
  // Never above the window: in a strip a path's far end can be cut off at the top.
  return shape ? Math.max(0, edgeTop(shape, px, line)) : line;
}
let zoom = { friends: 1, props: 1 },
  zoomWorld = null;
// A place's picture is drawn for the friends' size where it fills a window 850px tall (the picture
// at 850/1024); past that the picture grows with the window, and friends with it.
const ROOM_SCALE = 850 / 1024;
// Up to twice the friend size: a sprite's own pixels at the default size and more.
const ROOM_ZOOM_MAX = 2;
// The smallest a tall, narrow window shrinks friends to with its picture: still readable.
const NARROW_MIN = 0.6;
// How big friends, and the things set on the field, are drawn in a yard of this size. By the
// height, so a small window still reads as a whole scene; a strip (much wider than tall, like a bar
// along the screen's edge) gives the sky away and keeps the friends larger, and a narrow column
// keeps them from crowding each other.
// A larger window shows its picture larger (environment.js environmentFrame, 1536 by 1024 for every
// place), so friends grow as much and stay the same size next to a house or a desk; kept at one, a
// big screen drew them small beside the cottage. A smaller window shrinks the picture past what a
// friend can be read at, so friends stop there. Outdoors what stands on the grass keeps to the
// friends; in a room (a floor without soil) a gift is furniture, and keeps to the picture's scale
// there too, or a bench would stand larger than the desk.
// A strip shows a slice of a wide picture, so nothing grows taller than its height allows; in a room
// at 2400 by 300 a friend stood 224px tall in it, though the painted furniture stays as large.
function zoomFor(width, height, world) {
  // Eased from a wide window's to a strip's between 2.4 and 3 times as wide as tall, as the
  // picture is (environment.js stripShare), so a window dragged wider never jumps.
  const tall = height / (560 - 180 * stripShare(width, height)),
    framedAt = w => environmentFrame(w, height, { world }).width / 1536,
    framed = framedAt(width) / ROOM_SCALE,
    // Narrower than 4:3 an outdoor picture shrinks to the part always seen across, sky above:
    // friends shrink as much as it does from a 4:3 window as tall, down to NARROW_MIN, so they stay
    // as big next to the cottage. A room covers its height there, so nothing shrinks.
    narrow = framedAt(width) / framedAt(Math.max(width, (height * 4) / 3)),
    fit = clamp(Math.min(tall, width / 640), 0.35, 1),
    picture = Math.min(ROOM_ZOOM_MAX, framed, tall),
    friends = Math.max(Math.min(fit, Math.max(NARROW_MIN, fit * narrow)), picture);
  return { friends, props: worldHasSoil(world) ? friends : picture };
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
 * feet are there (views.js place), so a gift, a plant or a tree on the same spot reads at the same
 * scale; one set below a friend's reach is as near as the nearest friend. By the height on the
 * screen, the same at every x, from a far line down to the name tag's room at the yard's foot: the
 * place's own (geometry.far, a share of the picture's height, where the lawn reaches far back), else
 * the highest the field begins (up a path). Measured from the field's top at each x instead, a
 * friend walking down and across a path's side shrank as the edge fell away, then grew again. */
export function depthScaleAt(px, py) {
  if (!yardSize.width) measureYard();
  const shape = edgeShape(),
    top = shape?.far ?? shape?.high ?? topAt(px);
  return depthScale((py - top) / Math.max(1, yardSize.height - TAG_ROOM - top));
}
export const petHeight = p => cellHeight(sizeOf(p));
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
/** One body length of `pet`, across and down, in field units where it stands at `x` (wander.js
 * measures a stroll by it). A place is drawn across the field's width and down its height
 * (geometry, views.js place), not the yard's: the field is the yard's lower band, so a step down is
 * a far larger share of it than a step across. */
export function bodyInField(pet, x = 0.5, y) {
  const { w, h, top, left } = geometry(pet, x),
    // As drawn where its feet are, when it is said where (`y`): farther back it is smaller.
    depth = y === undefined ? 1 : depthScaleAt(left + x * w + sizeOf(pet) / 2, top + y * h + petHeight(pet)),
    body = (sizeOf(pet) || 1) * depth;
  return { x: body / w, y: body / h };
}
/** Where the feet of the friend `pet` standing at `at` (field shares, 0 to 1 each way) are in the
 * yard, in pixels (views.js place). */
export function feetAt(pet, at) {
  const { w, h, top, left } = geometry(pet, at.x);
  return { x: left + at.x * w + sizeOf(pet) / 2, y: top + at.y * h + petHeight(pet) };
}
/** How far apart two places (field shares) are on the screen, from feet to feet, in body lengths of
 * the friend `pet` as it is drawn at the first (motion.js paces a walk by it): farther back a body
 * is smaller, so the same pixels are more of its steps. */
export function bodiesApart(pet, a, b) {
  const from = feetAt(pet, a),
    to = feetAt(pet, b);
  return Math.hypot(to.x - from.x, to.y - from.y) / ((sizeOf(pet) || 1) * depthScaleAt(from.x, from.y));
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
/** The field friends and plants stand on, in yard pixels: the yard's width and height, the ridge
 * (top) and the front edge (bottom) a foot can reach, and the picture's left and right edges
 * (across; the yard's own, unless the window is wider than the picture). */
export function field() {
  if (!yardSize.width) measureYard();
  const { width, height } = yardSize;
  return { width, height, top: height * fieldTop(), bottom: height - footRoom(), ...across() };
}
/** Where a place's x (0 to 1) starts across the yard, in pixels, and how many pixels it spans: the
 * picture less EDGE each side. */
export function fieldAcross(f = field()) {
  return { from: f.left + EDGE, span: Math.max(1, f.right - f.left - EDGE * 2) };
}
// The lake as it lies in the yard now: the same shape the painter draws (layout.js lakeShape), or the
// picture's own water once the illustrated yard shows; made again only when the yard changes.
let lakeKey = '',
  lakeArea = null;
/** The lake in yard pixels, as drawn now (fishing, catch.js; the hand on the water, show-how.js). */
export function lakeNow() {
  const { width, height } = field(),
    illustrated = $('yard').dataset.environment === 'illustrated',
    key = `${width}x${height}:${illustrated}:${scene.world}`;
  if (key !== lakeKey) {
    lakeKey = key;
    lakeArea = illustrated
      ? environmentLake(width, height, scene)
      : lakeShape(width, height, trace(composition.curves[composition.lake.under], width, height));
  }
  return lakeArea;
}
/** The box a friend's place (0 to 1 each way) spans, in yard pixels: its left and width, and its
 * top and height at the field's line, or, given the place's `x`, where the field begins at its feet. */
export function geometry(p, x) {
  if (!yardSize.width) measureYard();
  const r = yardSize,
    { left: from, right } = across(),
    left = from + EDGE,
    w = Math.max(1, right - from - sizeOf(p) - EDGE * 2),
    ground = x === undefined ? r.height * fieldTop() : topAt(left + x * w + sizeOf(p) / 2),
    top = Math.max(12, ground - petHeight(p));
  return { w, top, h: Math.max(1, r.height - petHeight(p) - TAG_ROOM - top), left };
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
    { from, span } = fieldAcross(f),
    px = from + x * span,
    top = topAt(px);
  return { x: px, y: top + y * Math.max(1, f.bottom - top) };
}
/** A point in the yard, in pixels, as a place on the field. */
export function yardToField(px, py) {
  const f = field(),
    { from, span } = fieldAcross(f),
    top = topAt(px);
  return {
    x: clamp((px - from) / span),
    y: clamp((py - top) / Math.max(1, f.bottom - top)),
  };
}
// Gifts, flowers and trees have no name tag, so they stand lower than friends' field: down to just
// above the dock (42px tall, 12px from the foot, shell.css .yard-dock), or nearly to the foot in a
// small window, where the dock is hidden. Their place stays on the friends' field, going past 1
// below it, so a thing placed before keeps its place (garden.rs DECOR_FLOOR_MAX holds the same bound).
const decorRoom = () => (document.body.classList.contains('compact') ? 8 : 58);
const DECOR_FLOOR_MAX = 4;
/** The lowest a gift's, a flower's or a tree's place goes (1 or more): just above the dock, in the
 * friends' field (at `px` across the yard, where the field may begin higher). */
export function decorFloor(px) {
  const f = field(),
    top = px === undefined ? f.top : topAt(px);
  return clamp((f.height - decorRoom() - top) / Math.max(1, f.bottom - top), 1, DECOR_FLOOR_MAX);
}
/** Where a gift, a flower or a tree whose place is `point` stands, in yard pixels: as fieldToYard,
 * no lower than decorFloor there. A place kept in a smaller window, or in another place, may be
 * lower than this one lets it stand. */
export function standAt(point) {
  const across = fieldToYard({ x: point.x, y: 0 }).x;
  return fieldToYard({ x: point.x, y: Math.min(point.y, decorFloor(across)) });
}
/** A point in the yard, in pixels, as a gift's place: as yardToField, reaching down to decorFloor. */
export function yardToDecor(px, py) {
  const f = field(),
    { from, span } = fieldAcross(f),
    top = topAt(px);
  return {
    x: clamp((px - from) / span),
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
  const { left, w } = geometry(v.pet),
    x = clamp((px - left - sizeOf(v.pet) / 2) / w),
    { h, top } = geometry(v.pet, x);
  return { x, y: clamp((py - top - petHeight(v.pet) + lift) / h) };
}
