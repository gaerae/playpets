// Ground snapshots use the same measured field and prop feet as the rendered yard.
import { clamp } from '../core/math.js';
import { data } from '../core/state.js';
import { giftKind, treeKind, treeSize } from './catalog.js';
import { decorShown, yardSeason } from './decor-shown.js';
import { projectFootprint, treeStage } from './discovery-rules.js';
import { environmentLake } from './environment.js';
import { decorFloor, depthScaleAt, EDGE, field, hasEdge, propZoom, topAt } from './field.js';
import { plantBreadth, stageOf } from './growth.js';
import { giftSize } from './props.js';
import { scene } from './world.js';
import { worldFor } from './worlds.js';

const MAX_EXCLUSIONS = 64;
const LINE_SAMPLES = 33;
const treeScale = [0.4, 0.65, 1];

// Whether an ellipse reaches the ground things stand on: the field, and below it down to `floor`.
function intersectsField(e, floor) {
  return (
    [e.x, e.y].every(v => Number.isFinite(v) && v >= -4 && v <= 4) &&
    [e.rx, e.ry].every(v => Number.isFinite(v) && v > 0 && v <= 4) &&
    ((clamp(e.x) - e.x) / e.rx) ** 2 + ((clamp(e.y, 0, floor) - e.y) / e.ry) ** 2 <= 1
  );
}

/** Builds a normalized snapshot from measured pixel geometry; injectable sizes keep layout tests deterministic. */
export function buildGroundProfile({
  world,
  bounds,
  // How far below the field a gift, a flower or a tree may stand (field.js decorFloor); 1 keeps
  // them on it.
  giftFloor = 1,
  garden = {},
  lake = null,
  scale = 1,
  // A gift's box and foot share before its depth (props.js giftSize), by what a find out holds.
  giftDimensions = (kind, holds) => giftSize(kind, undefined, holds),
  // How big a thing whose foot is at a yard point is drawn for its depth (field.js depthScaleAt), so
  // what friends walk around is the size drawn; 1 everywhere leaves depth out.
  depthScaleAt = () => 1,
  skipTreeId = null,
  now = Date.now(),
  // The season the yard shows (decor-shown.js yardSeason): a gift it does not draw takes no ground.
  season = null,
  // Where the field begins at a yard x (field.js topAt), when a path raises it there; else its line.
  topAt = null,
  // The lowest a gift goes at a yard x (field.js decorFloor), where the field begins higher; else giftFloor.
  giftFloorAt = null,
}) {
  const profile = {
    soil: world?.capabilities?.soil ?? world?.capabilities?.sky !== false,
    bounds: { left: 0, top: 0, right: 1, bottom: 1 },
    water: [],
    obstacles: [],
    // What tall things are drawn over (trees, gifts that stand up), as boxes on the field: a thing
    // behind one is drawn under it, and the click there is the box's.
    bodies: [],
    // One pixel of a drawing at the yard's zoom, in field units each way.
    unit: { x: 0, y: 0 },
    // The lowest a flower or a tree stands, as a gift (discovery-rules.js groundAllows `planting`).
    floor: 1,
  };
  const validField =
    bounds &&
    [bounds.width, bounds.height, bounds.top, bounds.bottom, scale, giftFloor].every(Number.isFinite) &&
    bounds.width > EDGE * 2 &&
    bounds.bottom > bounds.top &&
    scale > 0;
  if (!validField) profile.soil = false;
  if (!profile.soil) return profile;
  profile.floor = Math.max(1, giftFloor);

  const width = bounds.width - EDGE * 2,
    height = bounds.bottom - bounds.top;
  profile.unit = { x: scale / width, y: scale / height };
  // A place (0 to 1 each way) in yard pixels, from where the field begins at its x.
  const top = px => topAt?.(px) ?? bounds.top,
    floorAt = x => giftFloorAt?.(EDGE + x * width) ?? giftFloor,
    foot = item => {
      const x = EDGE + item.x * width,
        y0 = top(x);
      return { x, y: y0 + item.y * (bounds.bottom - y0) };
    };
  // Where a path raises the field's top, what stands back there is the picture's own (its bushes,
  // a tree's skirt): the field's own line in field y, at LINE_SAMPLES points across, says how far
  // back that is (0 where nothing raises it). A trail ends in front of it (trail-rules.js).
  if (topAt)
    profile.line = Array.from({ length: LINE_SAMPLES }, (_, i) => {
      const y0 = top(EDGE + (i / (LINE_SAMPLES - 1)) * width);
      return clamp((bounds.top - y0) / Math.max(1, bounds.bottom - y0));
    });
  // A drawing of w x h yard pixels with its foot at `at`, as setDown places it: `foot` is the share
  // of its height at which the drawing ends.
  const body = (at, w, h, foot = 1) => {
    const y0 = top(at.x),
      deep = Math.max(1, bounds.bottom - y0);
    const box = {
      left: (at.x - w / 2 - EDGE) / width,
      right: (at.x + w / 2 - EDGE) / width,
      top: (at.y - h * foot - y0) / deep,
      bottom: (at.y + h * (1 - foot) - y0) / deep,
    };
    if (profile.bodies.length < MAX_EXCLUSIONS && box.left < 1 && box.right > 0 && box.top < 1 && box.bottom > 0)
      profile.bodies.push(box);
  };
  const add = (book, ellipse) => {
    if (profile.water.length + profile.obstacles.length >= MAX_EXCLUSIONS) return;
    const projected = projectFootprint(ellipse, bounds, top(ellipse.x));
    if (intersectsField(projected, profile.floor)) book.push(projected);
  };
  // The field never begins over the water (field.js topAt), so the lake is one ellipse placed on the
  // field from where it begins at its middle: it stays out of the field unless a place's own line
  // runs through it.
  if (lake) {
    const x = (lake.x0 + lake.x1) / 2,
      shore = lake.shoreAt(x),
      ridge = lake.ridgeAt(x);
    add(profile.water, { x, y: (shore + ridge) / 2, rx: (lake.x1 - lake.x0) / 2, ry: (ridge - shore) / 2 });
  }
  for (const tree of garden.trees || []) {
    // Every tree stands in every place with soil (discovery-rules.js treesIn).
    if (tree.id === skipTreeId) continue;
    const [rx, ry] = treeKind(tree.kind)?.footprint || [22, 9],
      stage = treeStage({ ...tree, planted: tree.planted ?? now }, now),
      at = foot({ x: tree.x, y: Math.min(tree.y, floorAt(tree.x)) }),
      [w, h] = treeSize(tree.kind, Math.min(2, stage));
    // Drawn whole inside the yard, as planted-trees.js treeFoot keeps it: its width there decides
    // how far in it stands, so it is measured again where it is moved to.
    let depth = depthScaleAt(at.x, at.y);
    for (let pass = 0; pass < 2; pass++) {
      at.x = clamp(at.x, (w * scale * depth) / 2 + 4, bounds.width - (w * scale * depth) / 2 - 4);
      depth = depthScaleAt(at.x, at.y);
    }
    const zoom = scale * depth * (treeScale[stage] ?? treeScale[0]);
    add(profile.obstacles, { ...at, rx: rx * zoom, ry: ry * zoom });
    body(at, w * scale * depth, h * scale * depth);
  }
  const date = new Date(now);
  for (const item of garden.decor || []) {
    if (!decorShown(item.kind, date, season)) continue;
    const gift = giftKind(item.kind),
      // Drawn as decor.js places it: one friends stand on stays on the field.
      at = foot({ x: item.x, y: Math.min(item.y, gift?.stand === 'on' ? 1 : floorAt(item.x)) }),
      size = giftDimensions(item.kind, item.holds),
      depth = depthScaleAt(at.x, at.y),
      w = size.w * depth,
      h = size.h * depth,
      flat = gift?.flat;
    // Furniture drawing clamps its foot inward by half its rendered width plus four pixels.
    at.x = clamp(at.x, w / 2 + 4, bounds.width - w / 2 - 4);
    add(profile.obstacles, {
      x: at.x,
      y: at.y - (flat ? h / 2 : 0),
      rx: w * 0.46,
      ry: flat ? h / 2 : Math.min(h * 0.18, w * 0.2),
    });
    // A flat gift lies under everything (decor.js draws it at the back).
    if (!flat) body(at, w, h, size.foot);
  }
  for (const plant of garden.plants || []) {
    // Drawn as garden.js places it, no lower than the floor.
    // As wide as it is drawn: a patch takes the ground of its patch.
    const at = foot({ x: plant.x, y: Math.min(plant.y, floorAt(plant.x)) }),
      breadth = plantBreadth(plant, stageOf(plant.planted ?? now, now).name, { outdoors: profile.soil }),
      zoom = scale * depthScaleAt(at.x, at.y) * breadth;
    add(profile.obstacles, { ...at, rx: 10 * zoom, ry: 5 * zoom });
  }
  return profile;
}

/** The current scene's soil, water and occupied roots, as the backend validates them; `garden` and
 * `now` give another garden (an earlier look at it) on the same field. */
export function groundProfile({ skipTreeId = null, garden = data.garden, now = Date.now() } = {}) {
  const bounds = field();
  return buildGroundProfile({
    world: worldFor(scene.world),
    bounds,
    giftFloor: decorFloor(),
    garden,
    lake: environmentLake(bounds.width, bounds.height, scene),
    scale: propZoom(),
    depthScaleAt,
    skipTreeId,
    now,
    season: yardSeason(scene),
    topAt: hasEdge() ? topAt : null,
    giftFloorAt: hasEdge() ? decorFloor : null,
  });
}
