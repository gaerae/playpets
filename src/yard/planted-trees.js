// Planted trees stand in every place with soil, wherever they were planted, as flowers and gifts
// do. Their roots stay at the saved field coordinate; growing or resizing changes only the drawing
// above that foot. Dragged to move; its menu sends it out to the desktop or removes it.

import { openTreeMenu } from '../core/controls.js';
import { put, putAttribute } from '../core/dom.js';
import { joinList, t } from '../core/i18n.js';
import { clamp } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { aiming, call, data, guard } from '../core/state.js';
import { artSvg } from './art.js';
import { treeArt, treeKind, treeSize } from './catalog.js';
import { freeSpot, groundAllows, treesIn, treeStage } from './discovery-rules.js';
import { depthAt, field, measureYard, standAt } from './field.js';
import { groundProfile } from './ground.js';
import { shapeHits } from './hit-shape.js';
import { answer, answerOf } from './press-answer.js';
import { movable, moveSaved, propButton, propScale, reconcile, removeWithUndo, setDown } from './props.js';
import { scene } from './world.js';

const shown = new Map();
// A tree stands as low as a gift may, below the friends' field (groundAllows).
const PLANTING = { planting: true };
const stageKeys = ['tree.growth', 'tree.young', 'tree.mature'];
const current = id => treesIn(data.garden?.trees, scene.world).find(tree => tree.id === id);

/** Free soil in the current place for a tree out of the album (album.js): a spot on the field the
 * ground allows for planting, and that ground for the backend to check again, or null when twenty
 * draws find none. */
export function treeSpot(rng = Math.random) {
  const ground = groundProfile(),
    point = freeSpot(rng, ground, { x: [0.15, 0.85], y: [0.3, 0.9] }, undefined, PLANTING);
  return point && { point, ground };
}

/** How big a `kind` of tree at `stage` (grown by default) is drawn with its foot at `foot` (yard
 * pixels): its width and height, and the zoom of that depth. Smaller farther back, as a friend at its
 * foot is. Fallen fruit and visits to a tree measure it the same way. */
export function treeBox(kind, foot, stage = 2) {
  const [width, height] = treeSize(kind, stage),
    zoom = propScale(foot);
  return { width: width * zoom, height: height * zoom, zoom };
}

/** Where a tree whose place is `point` (its own by default) is drawn at `stage`, in yard pixels: its
 * foot, no lower than a gift may stand and far enough from the yard's sides that the whole tree
 * shows, as a wide gift is (decor.js placement). Its ground (ground.js), fruit and visits are
 * measured from here. */
export function treeFoot(tree, stage = 2, point = tree) {
  const foot = standAt(point);
  // Smaller farther back, so its width is measured again where it is moved in to.
  for (let pass = 0; pass < 2; pass++) {
    const { width } = treeBox(tree.kind, foot, stage);
    foot.x = clamp(foot.x, width / 2 + 4, field().width - width / 2 - 4);
  }
  return foot;
}

function position(view, tree, point = tree) {
  const stage = Math.min(2, treeStage(tree, Date.now(), data.limits)),
    kind = treeKind(tree.kind),
    drawing = kind?.stages[stage];
  if (!drawing) return;
  const art = treeArt(tree.kind, stage, scene.season);
  if (view.art !== art) {
    view.button.innerHTML = artSvg(art);
    view.art = art;
    shapeHits(view.button, art);
  }
  const foot = treeFoot(tree, stage, point),
    { width, height } = treeBox(tree.kind, foot, stage);
  setDown(view.button, foot.x, foot.y, width, height, depthAt(foot.y));
  view.at = foot;
  put(view.button, 'title', t('tree.drag', { kind: t(`tree.${tree.kind}`) }));
  put(view.button.dataset, 'name', t(`tree.${tree.kind}`));
  putAttribute(view.button, 'aria-label', joinList([view.button.title, t(stageKeys[stage])]));
}

const save = guard(async (view, point) => {
  const tree = current(view.id);
  if (!tree || view.busy) return;
  const ground = groundProfile({ skipTreeId: tree.id });
  if (!groundAllows(point, ground, PLANTING)) return renderTrees();
  view.button.disabled = true;
  try {
    await moveSaved(view, tree, point, {
      send: () => call('moveTree', tree.id, point.x, point.y, ground),
      current: () => current(tree.id),
      show: () => position(view, tree),
      settle: renderTrees,
    });
  } finally {
    view.button.disabled = false;
  }
});

/** Removes a planted tree at once, with a moment to undo it (props.js); the backend removes it only
 * after that. Its menu (core/controls.js) and Delete come here. */
export function removeTree(id) {
  const view = shown.get(id);
  if (view) remove(view);
}
const remove = view => {
  const tree = current(view.id);
  if (!tree || view.busy) return;
  removeWithUndo(view.id, view, t('garden.pulled', { kind: t(`tree.${tree.kind}`) }), async () => {
    // Looked up in every place: the person may have moved on before the Undo window ended.
    if (!data.garden?.trees?.some(item => item.id === tree.id)) return;
    view.busy = true;
    try {
      await call('removeTree', tree.id);
    } finally {
      view.busy = false;
    }
  });
};

function create(tree) {
  const button = propButton('planted-tree', tree.kind, tree.id),
    view = { id: tree.id, button, drag: null, busy: false, art: null };
  button.dataset.id = tree.id;
  // Dragged, or moved with the arrow keys, only onto ground a tree may stand on; its menu sends it
  // out to the desktop or removes it, and Delete removes it at once (with Undo).
  movable(view, {
    current: () => current(view.id),
    show: at => position(view, current(view.id), at),
    save: at => save(view, at),
    menu: at => openTreeMenu(view.id, at),
    remove: () => remove(view),
    settle: renderTrees,
    // A press rustles it and lets a few leaves go; the ground behind takes no click.
    press: e => {
      if (aiming) return;
      e.stopPropagation();
      const tree = current(view.id);
      if (tree)
        answer(view.button, answerOf({ what: 'tree', kind: tree.kind, season: scene.season }), {
          reduced: reduced.matches,
        });
    },
    // The ground does not change under one drag: measured at its first move, not at every one.
    allowed: (at, drag) => groundAllows(at, (drag.ground ??= groundProfile({ skipTreeId: view.id })), PLANTING),
  });
  return view;
}

/** Draws only saved trees in the current place; no animation or frame-loop work. */
export function renderTrees() {
  const trees = treesIn(data.garden?.trees, scene.world).filter(tree => treeKind(tree.kind));
  reconcile(shown, trees, create, (view, tree) => {
    if (!view.drag?.moved) position(view, tree);
  });
}

/** Resizing cancels any drag before updating the roots' pixel coordinates. Called once by app.js. */
export function setupTrees() {
  globalThis.window?.addEventListener('resize', () => {
    for (const view of shown.values()) {
      view.drag = null;
      view.button.classList.remove('dragging', 'invalid');
    }
    measureYard();
    renderTrees();
  });
}
