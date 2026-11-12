// A flower or a planted tree out on the desktop, drawn as the yard draws it (yard/garden.js,
// yard/planted-trees.js): a flower at the stage the clock says, in its colours; a tree at the stage
// the backend last grew it to, which is the box desktop/items.rs gives it, and grown in the season
// the yard shows. The overlay looks again each minute and draws again only when the look changed.

import { t } from '../core/i18n.js';
import { artSize, artSvg, colorStyle } from '../yard/art.js';
import { flowerKind, STAGES, treeArt, treeKind, treeSize } from '../yard/catalog.js';
import { plantArt, plantStature, stageOf } from '../yard/growth.js';

// Yard pixels per unit of a plant's drawing (garden.js UNIT): a friend's sprite on the desktop is
// its size in pixels, as in a yard at full size.
const UNIT = 1.25;

/** What the desktop thing `id` is in `garden`: a flower ({ what: 'plant', item }), a planted tree
 * ({ what: 'tree', item }), or null for a gift. */
export function growing(garden, id) {
  const plant = garden?.plants?.find(p => p.id === id);
  if (plant) return { what: 'plant', item: plant };
  const tree = garden?.trees?.find(x => x.id === id);
  return tree ? { what: 'tree', item: tree } : null;
}

/** Every drawing a flower or a tree of `kind` may be drawn with, to load before it is. */
export function growingArt(kind) {
  const flower = flowerKind(kind);
  if (flower) return [...STAGES.map(s => s.art), flower.art].filter(Boolean);
  const tree = treeKind(kind);
  return tree ? [...tree.stages.map(s => s.art), ...Object.values(tree.seasonArt || {})] : [];
}

/** How `thing` (from growing) looks at `now` in `season`: its drawing, its stage and its size in
 * pixels. `size` gives a drawing's own size (art.js artSize, once loaded). */
export function growingLook(thing, season, now = Date.now(), size = artSize) {
  if (thing.what === 'plant') {
    const plant = thing.item,
      stage = stageOf(plant.planted, now).name,
      art = plantArt(plant, stage),
      [w, h] = size(art),
      tall = plantStature(plant, stage);
    return { art, stage, width: w * UNIT * tall, height: h * UNIT * tall };
  }
  const tree = thing.item,
    stage = Math.min(2, tree.stage || 0),
    [width, height] = treeSize(tree.kind, stage);
  return { art: treeArt(tree.kind, stage, season) || '', stage, width, height };
}

/** Its name, as the yard's label says it: a flower is a young plant until its bud shows. */
export function growingName(thing, now = Date.now()) {
  if (thing.what === 'tree') return t(`tree.${thing.item.kind}`);
  const stage = stageOf(thing.item.planted, now).name;
  return ['seed', 'sprout', 'leaves'].includes(stage) ? t('garden.young') : t(`garden.kind_${thing.item.kind}`);
}

/** The lines a friend says on reaching a desktop thing of `kind`: a flower's and a tree's are the
 * yard's, a gift its own. */
export function visitKey(kind) {
  if (flowerKind(kind)) return 'garden.visit';
  if (treeKind(kind)) return 'tree.visit';
  return `decor.visit_${kind}`;
}

/** Draws `thing` in its desktop button (`view.button`), standing on the bottom middle of its box;
 * only when its look changed since the last time. */
export function drawGrowing(view, thing, season, now = Date.now()) {
  const look = growingLook(thing, season, now),
    key = `${look.art}|${look.width}|${look.height}`;
  if (!look.art || key === view.look) return;
  view.look = key;
  const colors = thing.what === 'plant' ? colorStyle(flowerKind(thing.item.kind)?.colors) : '';
  view.button.dataset.stage = String(look.stage);
  view.button.innerHTML = artSvg(
    look.art,
    `class="growing" style="width:${look.width}px;height:${look.height}px;${colors}"`,
  );
  view.button.title = growingName(thing, now);
  view.button.setAttribute('aria-label', view.button.title);
}
