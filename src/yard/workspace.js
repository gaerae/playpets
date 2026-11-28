// What an agent workspace adds to its picture (geometry in worlds.json; docs/design/2026-11-11-agent-workspaces.md):
// the stations a friend goes to for its agent's state, the furniture friends keep off and walk
// around, and the furniture fronts drawn over a friend seated behind them. All are fractions of the picture,
// framed with it as it is cropped (environment.js environmentFrame).
import { environmentFrame } from './environment.js';
import { depthAt, field } from './field.js';
import { scene } from './world.js';
import { worldFor } from './worlds.js';

const shape = () => worldFor(scene.world).geometry ?? {};
const frame = () => {
  const { width, height } = field();
  return environmentFrame(width, height, scene);
};

/** The place's stations ({ desks: [points], approval: point, rest: point }), or null. */
export const stations = () => shape().stations ?? null;

/** Where a point of the picture is in the yard now, in pixels; a point cropped away lies outside
 * the window, and a friend sent there stops at the floor's edge (field.js footTarget). */
export function stationAt(point) {
  const f = frame();
  return { x: f.x + point.x * f.width, y: f.y + point.y * f.height };
}

// The furniture as ellipses of the yard now, in pixels.
function blocksNow() {
  const blocks = shape().blocks;
  if (!blocks?.length) return [];
  const f = frame();
  return blocks.map(b => ({
    x: f.x + b.x * f.width,
    y: f.y + b.y * f.height,
    rx: b.rx * f.width,
    ry: b.ry * f.height,
  }));
}
const inside = (p, e) => ((p.x - e.x) / e.rx) ** 2 + ((p.y - e.y) / e.ry) ** 2 <= 1;

// In a window wider than the picture, its sides are the picture's edge out of focus
// (environment.js paintSides), not floor.
function offPicture(px) {
  const f = frame();
  return f.x > 0 && (px < f.x || px > f.x + f.width);
}
/** Whether a point of the yard (a friend's feet) is on furniture, or off the picture at its sides,
 * where a stroll does not end. */
export const blocked = (px, py) => offPicture(px) || blocksNow().some(e => inside({ x: px, y: py }, e));

// Pixels between two points looked at along a walk: less than the thinnest furniture is deep.
const STEP_PX = 8;
// Whether the walk from `a` to `b` passes over any of `blocks` but one either end is on: a friend
// set down on furniture walks off it, and one going to a seat there walks onto it.
function crossesIn(blocks, a, b) {
  const open = blocks.filter(e => !inside(a, e) && !inside(b, e));
  if (!open.length) return false;
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / STEP_PX);
  for (let i = 1; i < steps; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
    if (open.some(e => inside(p, e))) return true;
  }
  return false;
}
/** Whether a walk between two feet (yard pixels) passes over furniture. */
export const crossesFurniture = (a, b) => crossesIn(blocksNow(), a, b);

// How far a friend's feet keep from furniture it walks around, in pixels: about half its body.
const ROOM = 28;
/** The points (yard pixels) a friend's feet pass on the way from `a` to `b` so it walks around the
 * furniture instead of over it: none where the way is clear, and none where no way round is found
 * (it walks straight, as before). A seat on furniture's back half (a desk's, under its front) is
 * reached and left from behind it, never over the front. `room` is how far the feet keep off. */
export function wayAround(a, b, room = ROOM) {
  const blocks = blocksNow();
  if (!blocks.length) return [];
  const { width, top, bottom } = field();
  const onFloor = p => p.x >= room / 2 && p.x <= width - room / 2 && p.y >= top && p.y <= bottom;
  const free = p => onFloor(p) && !blocks.some(e => inside(p, e));
  // Behind the furniture whose back half `p` is on, or null.
  const behind = p => {
    const e = blocks.find(e => inside(p, e));
    if (!e || p.y >= e.y) return null;
    const back = { x: p.x, y: Math.max(top, e.y - e.ry - room / 2) };
    return free(back) ? back : null;
  };
  const out = behind(a),
    into = behind(b),
    start = out ?? a,
    goal = into ?? b;
  // On the same furniture, or behind it already, a friend sits straight down or gets straight up.
  const near = (p, back) => !back || p.y <= back.y + room / 2,
    same = blocks.find(e => inside(a, e) && inside(b, e));
  if ((same || (near(a, into) && near(b, out))) && !crossesIn(blocks, a, b)) return [];
  const route = crossesIn(blocks, start, goal) ? shortestWay(blocks, start, goal, room, free) : [];
  if (!route) return [];
  return [...(out ? [out] : []), ...route, ...(into ? [into] : [])];
}
// The shortest way from `a` to `b` by the corners of the furniture, each `room` off it (half that
// up and down, as the floor is seen at a slant): the corners passed, or null when none leads there.
function shortestWay(blocks, a, b, room, free) {
  const corners = blocks.flatMap(e =>
    [-1, 1].flatMap(sx => [-1, 1].map(sy => ({ x: e.x + sx * (e.rx + room), y: e.y + sy * (e.ry + room / 2) }))),
  );
  const nodes = [a, ...corners.filter(free), b],
    last = nodes.length - 1,
    far = nodes.map(() => Infinity),
    from = nodes.map(() => -1),
    done = nodes.map(() => false);
  far[0] = 0;
  for (;;) {
    let i = -1;
    for (let j = 0; j <= last; j++) if (!done[j] && far[j] < Infinity && (i < 0 || far[j] < far[i])) i = j;
    if (i < 0) return null;
    if (i === last) break;
    done[i] = true;
    for (let j = 1; j <= last; j++) {
      if (done[j]) continue;
      const d = far[i] + Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
      if (d < far[j] && !crossesIn(blocks, nodes[i], nodes[j])) [far[j], from[j]] = [d, i];
    }
  }
  const way = [];
  for (let i = from[last]; i > 0; i = from[i]) way.unshift(nodes[i]);
  return way;
}

/** The furniture fronts of a yard `w` by `h` with a picture of `sourceWidth` by `sourceHeight`: each
 * one's box in yard pixels, its `shape` (the outline cut from that box, as [x, y] fractions of it;
 * the whole box when it has none), and `z`, the layer of a friend whose feet are on its foot line
 * (views.js place, depthAt), so a friend standing behind it is drawn under it. */
export function frontsIn(w, h, sourceWidth, sourceHeight) {
  const fronts = shape().fronts;
  if (!fronts?.length) return [];
  const f = environmentFrame(w, h, scene, sourceWidth, sourceHeight);
  return fronts.map(front => ({
    shape: front.shape ?? null,
    x: f.x + front.x * f.width,
    y: f.y + front.y * f.height,
    width: front.width * f.width,
    height: front.height * f.height,
    z: depthAt(f.y + front.foot * f.height),
  }));
}
