// Ground snapshots use the same measured field and prop feet as the rendered yard.
import { clamp } from '../core/math.js';
import { data } from '../core/state.js';
import { giftKind, treeKind } from './catalog.js';
import { projectFootprint, treeStage } from './discovery-rules.js';
import { environmentLake } from './environment.js';
import { decorField, EDGE, field, yardZoom } from './field.js';
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
  // Gifts stand on a deeper field than friends and plants (field.js decorField).
  decorBottom = bounds?.bottom,
  garden = {},
  lake = null,
  scale = 1,
  giftDimensions = giftSize,
  skipTreeId = null,
  now = Date.now(),
}) {
  const profile = {
    soil: world?.capabilities?.soil ?? world?.capabilities?.sky !== false,
    bounds: { left: 0, top: 0, right: 1, bottom: 1 },
    water: [],
    obstacles: [],
  };
  const validField =
    bounds &&
    [bounds.width, bounds.height, bounds.top, bounds.bottom, scale].every(Number.isFinite) &&
    bounds.width > EDGE * 2 &&
    bounds.bottom > bounds.top &&
    scale > 0;
  if (!validField) profile.soil = false;
  if (!profile.soil) return profile;

  const width = bounds.width - EDGE * 2,
    height = bounds.bottom - bounds.top;
  const foot = item => ({ x: EDGE + item.x * width, y: bounds.top + item.y * height });
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
      zoom = scale * (treeScale[stage] ?? treeScale[0]);
    add(profile.obstacles, { ...foot(tree), rx: rx * zoom, ry: ry * zoom });
  }
  const decorHeight = Math.max(1, (Number.isFinite(decorBottom) ? decorBottom : bounds.bottom) - bounds.top);
  for (const item of garden.decor || []) {
    const at = { x: EDGE + item.x * width, y: bounds.top + item.y * decorHeight },
      { w, h } = giftDimensions(item.kind),
      flat = giftKind(item.kind)?.flat;
    // Furniture drawing clamps its foot inward by half its rendered width plus four pixels.
    at.x = clamp(at.x, w / 2 + 4, bounds.width - w / 2 - 4);
    add(profile.obstacles, {
      x: at.x,
      y: at.y - (flat ? h / 2 : 0),
      rx: w * 0.46,
      ry: flat ? h / 2 : Math.min(h * 0.18, w * 0.2),
    });
  }
  for (const plant of garden.plants || []) {
    add(profile.obstacles, { ...foot(plant), rx: 10 * scale, ry: 5 * scale });
  }
  return profile;
}

/** The current scene's soil, water and occupied roots, as the backend validates them. */
export function groundProfile({ skipTreeId = null } = {}) {
  const bounds = field();
  return buildGroundProfile({
    world: worldFor(scene.world),
    worldId: scene.world,
    bounds,
    decorBottom: decorField().bottom,
    garden: data.garden,
    lake: environmentLake(bounds.width, bounds.height, scene),
    scale: yardZoom(),
    skipTreeId,
  });
}
