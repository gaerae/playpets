// Planted trees belong to their saved world. Their roots stay at the saved field coordinate;
// growing or resizing changes only the drawing above that foot. Dragged to move; its menu sends it
// out to the desktop or removes it.
import { openTreeMenu } from '../core/controls.js';
import { joinList, t } from '../core/i18n.js';
import { call, data, guard } from '../core/state.js';
import { artSvg } from './art.js';
import { treeArt, treeKind, treeSize } from './catalog.js';
import { groundAllows, treeStage } from './discovery-rules.js';
import { depthAt, fieldToYard, measureYard, yardZoom } from './field.js';
import { groundProfile } from './ground.js';
import { shapeHits } from './hit-shape.js';
import { movable, moveSaved, propButton, reconcile, removeWithUndo, setDown } from './props.js';
import { scene } from './world.js';

const shown = new Map();
const stageKeys = ['tree.growth', 'tree.young', 'tree.mature'];
const current = id => data.garden?.trees?.find(tree => tree.id === id && tree.world === scene.world);

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
  const [width, height] = treeSize(tree.kind, stage),
    foot = fieldToYard(point),
    zoom = yardZoom();
  setDown(view.button, foot.x, foot.y, width * zoom, height * zoom, depthAt(foot.y));
  view.button.title = t('tree.drag', { kind: t(`tree.${tree.kind}`) });
  view.button.setAttribute('aria-label', joinList([view.button.title, t(stageKeys[stage])]));
}

const save = guard(async (view, point) => {
  const tree = current(view.id);
  if (!tree || view.busy) return;
  const ground = groundProfile({ skipTreeId: tree.id });
  if (!groundAllows(point, ground)) return renderTrees();
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
    // The ground does not change under one drag: measured at its first move, not at every one.
    allowed: (at, drag) => groundAllows(at, (drag.ground ??= groundProfile({ skipTreeId: view.id }))),
  });
  return view;
}

/** Draws only saved trees in the current place; no animation or frame-loop work. */
export function renderTrees() {
  const trees = (data.garden?.trees || []).filter(tree => tree.world === scene.world && treeKind(tree.kind));
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
