// Ground snapshots use the same measured field and prop feet as the rendered yard.
import { clamp } from '../core/math.js';
import { data } from '../core/state.js';
import { giftKind, treeKind, treeSize } from './catalog.js';
import { decorShown, yardSeason } from './decor-shown.js';
import { projectFootprint, treeStage } from './discovery-rules.js';
import { environmentLake } from './environment.js';
import { decorFloor, EDGE, field, yardZoom } from './field.js';
import { giftSize } from './props.js';
import { scene } from './world.js';
import { worldFor } from './worlds.js';

const MAX_EXCLUSIONS = 64;
const treeScale = [0.4, 0.65, 1];

function intersectsField(e) {
  return (
    [e.x, e.y].every(v => Number.isFinite(v) && v >= -4 && v <= 4) &&
    [e.rx, e.ry].every(v => Number.isFinite(v) && v > 0 && v <= 4) &&
    ((clamp(e.x) - e.x) / e.rx) ** 2 + ((clamp(e.y) - e.y) / e.ry) ** 2 <= 1
  );
}

/** Builds a normalized snapshot from measured pixel geometry; injectable sizes keep layout tests deterministic. */
export function buildGroundProfile({
  world,
  worldId = world?.id,
  bounds,
  // How far below the field a gift may stand (field.js decorFloor); 1 keeps gifts on it.
  giftFloor = 1,
  garden = {},
  lake = null,
  scale = 1,
  giftDimensions = giftSize,
  skipTreeId = null,
  now = Date.now(),
  // The season the yard shows (decor-shown.js yardSeason): a gift it does not draw takes no ground.
  season = null,
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
  };
  const validField =
    bounds &&
    [bounds.width, bounds.height, bounds.top, bounds.bottom, scale, giftFloor].every(Number.isFinite) &&
    bounds.width > EDGE * 2 &&
    bounds.bottom > bounds.top &&
    scale > 0;
  if (!validField) profile.soil = false;
  if (!profile.soil) return profile;

  const width = bounds.width - EDGE * 2,
    height = bounds.bottom - bounds.top;
  profile.unit = { x: scale / width, y: scale / height };
  const foot = item => ({ x: EDGE + item.x * width, y: bounds.top + item.y * height });
  // A drawing of w x h yard pixels with its foot at `at`, as setDown places it.
  const body = (at, w, h) => {
    const box = {
      left: (at.x - w / 2 - EDGE) / width,
      right: (at.x + w / 2 - EDGE) / width,
      top: (at.y - h - bounds.top) / height,
      bottom: (at.y - bounds.top) / height,
    };
    if (profile.bodies.length < MAX_EXCLUSIONS && box.left < 1 && box.right > 0 && box.top < 1 && box.bottom > 0)
      profile.bodies.push(box);
  };
  const add = (book, ellipse) => {
    if (profile.water.length + profile.obstacles.length >= MAX_EXCLUSIONS) return;
    const projected = projectFootprint(ellipse, bounds);
    if (intersectsField(projected)) book.push(projected);
  };
  if (lake) {
    const x = (lake.x0 + lake.x1) / 2,
      shore = lake.shoreAt(x),
      ridge = lake.ridgeAt(x);
    add(profile.water, { x, y: (shore + ridge) / 2, rx: (lake.x1 - lake.x0) / 2, ry: (ridge - shore) / 2 });
  }
  for (const tree of garden.trees || []) {
    if (tree.world !== worldId || tree.id === skipTreeId) continue;
    const [rx, ry] = treeKind(tree.kind)?.footprint || [22, 9],
      stage = treeStage({ ...tree, planted: tree.planted ?? now }, now),
      zoom = scale * (treeScale[stage] ?? treeScale[0]),
      [w, h] = treeSize(tree.kind, Math.min(2, stage));
    add(profile.obstacles, { ...foot(tree), rx: rx * zoom, ry: ry * zoom });
    body(foot(tree), w * scale, h * scale);
  }
  const date = new Date(now);
  for (const item of garden.decor || []) {
    if (!decorShown(item.kind, date, season)) continue;
    const gift = giftKind(item.kind),
      // Drawn as decor.js places it: one friends stand on stays on the field.
      at = foot({ x: item.x, y: Math.min(item.y, gift?.stand === 'on' ? 1 : giftFloor) }),
      { w, h } = giftDimensions(item.kind),
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
    if (!flat) body(at, w, h);
  }
  for (const plant of garden.plants || []) {
    add(profile.obstacles, { ...foot(plant), rx: 10 * scale, ry: 5 * scale });
  }
  return profile;
}

/** The current scene's soil, water and occupied roots, as the backend validates them; `garden` and
 * `now` give another garden (an earlier look at it) on the same field. */
export function groundProfile({ skipTreeId = null, garden = data.garden, now = Date.now() } = {}) {
  const bounds = field();
  return buildGroundProfile({
    world: worldFor(scene.world),
    worldId: scene.world,
    bounds,
    giftFloor: decorFloor(),
    garden,
    lake: environmentLake(bounds.width, bounds.height, scene),
    scale: yardZoom(),
    skipTreeId,
    now,
    season: yardSeason(scene),
  });
}
