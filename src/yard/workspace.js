// What an agent workspace adds to its picture (geometry in worlds.json; docs/design/2026-11-11-agent-workspaces.md):
// the stations a friend goes to for its agent's state, the furniture strolls keep off, and the
// furniture fronts drawn over a friend seated behind them. All are fractions of the picture,
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

/** Whether a point of the yard (a friend's feet) is on furniture, where a stroll does not end. */
export function blocked(px, py) {
  const blocks = shape().blocks;
  if (!blocks?.length) return false;
  const f = frame();
  return blocks.some(
    b =>
      ((px - f.x - b.x * f.width) / (b.rx * f.width)) ** 2 + ((py - f.y - b.y * f.height) / (b.ry * f.height)) ** 2 <=
      1,
  );
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
