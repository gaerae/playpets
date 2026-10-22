// Planted trees belong to their saved world. Their roots stay at the saved field coordinate;
// growing or resizing changes only the drawing above that foot.
import { joinList, t } from '../core/i18n.js';
import { clamp } from '../core/math.js';
import { aiming, call, data, game, guard } from '../core/state.js';
import { artSvg } from './art.js';
import { treeKind } from './catalog.js';
import { groundAllows, treeStage } from './discovery-rules.js';
import { EDGE, field, fieldToYard, measureYard, yardZoom } from './field.js';
import { groundProfile } from './ground.js';
import { propButton, reconcile, removeWithUndo, setDown } from './props.js';
import { scene } from './world.js';

const shown = new Map();
const sizes = [
  [35, 40],
  [70, 95],
  [160, 170],
];
const stageKeys = ['tree.growth', 'tree.young', 'tree.mature'];
const current = id => data.garden?.trees?.find(tree => tree.id === id && tree.world === scene.world);

function position(view, tree, point = tree) {
  const stage = Math.min(2, treeStage(tree, Date.now(), data.limits)),
    kind = treeKind(tree.kind),
    drawing = kind?.stages[stage];
  if (!drawing) return;
  const art = (stage === 2 && kind.seasonArt?.[scene.season]) || drawing.art;
  if (view.art !== art) {
    view.button.innerHTML = artSvg(art);
    view.art = art;
  }
  const [width, height] = drawing.size || sizes[stage],
    foot = fieldToYard(point),
    zoom = yardZoom();
  setDown(view.button, foot.x, foot.y, width * zoom, height * zoom, 1 + Math.round(point.y * 100));
  view.button.title = t('tree.drag', { kind: t(`tree.${tree.kind}`) });
  view.button.setAttribute('aria-label', joinList([view.button.title, t(stageKeys[stage])]));
}

const save = guard(async (view, point) => {
  const tree = current(view.id);
  if (!tree || view.busy) return;
  const ground = groundProfile({ skipTreeId: tree.id });
  if (!groundAllows(point, ground)) return renderTrees();
  const previous = { x: tree.x, y: tree.y };
  view.busy = true;
  view.button.disabled = true;
  Object.assign(tree, point);
  position(view, tree);
  try {
    await call('moveTree', tree.id, point.x, point.y, ground);
  } catch (error) {
    if (current(tree.id) === tree) Object.assign(tree, previous);
    throw error;
  } finally {
    view.busy = false;
    view.button.disabled = false;
    renderTrees();
  }
});

// Pulled up at once with a moment to undo it (props.js); the backend removes it only after that.
const remove = view => {
  const tree = current(view.id);
  if (!tree || view.busy) return;
  removeWithUndo(view.id, view, t('garden.pulled', { kind: t(`tree.${tree.kind}`) }), async () => {
    if (!current(view.id)) return;
    view.busy = true;
    try {
      await call('removeTree', tree.id);
    } finally {
      view.busy = false;
    }
  });
};

function create(tree) {
  const button = propButton('planted-tree', tree.kind),
    view = { id: tree.id, button, drag: null, busy: false, art: null };
  button.dataset.id = tree.id;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || aiming || game || view.busy || !current(view.id)) return;
    event.stopPropagation();
    const f = field(),
      tree = current(view.id);
    view.drag = {
      x: tree.x,
      y: tree.y,
      startX: event.clientX,
      startY: event.clientY,
      width: Math.max(1, f.width - EDGE * 2),
      height: Math.max(1, f.bottom - f.top),
      moved: false,
      world: scene.world,
    };
    try {
      button.setPointerCapture(event.pointerId);
    } catch {}
  });
  button.addEventListener('pointermove', event => {
    const drag = view.drag,
      tree = current(view.id);
    if (!drag || !tree || drag.world !== scene.world) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    drag.at = {
      x: clamp(drag.x + (event.clientX - drag.startX) / drag.width),
      y: clamp(drag.y + (event.clientY - drag.startY) / drag.height),
    };
    button.classList.add('dragging');
    button.classList.toggle('invalid', !groundAllows(drag.at, groundProfile({ skipTreeId: tree.id })));
    position(view, tree, drag.at);
  });
  const finish = async event => {
    const drag = view.drag;
    view.drag = null;
    button.classList.remove('dragging', 'invalid');
    try {
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    } catch {}
    if (event.type === 'pointerup' && drag?.moved && drag.world === scene.world && !aiming && !game && drag.at)
      await save(view, drag.at);
    renderTrees();
  };
  button.addEventListener('pointerup', finish);
  button.addEventListener('pointercancel', finish);
  button.addEventListener('contextmenu', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!aiming && !game) return remove(view);
  });
  button.addEventListener('keydown', event => {
    const tree = current(view.id);
    if (!tree || aiming || game) return;
    const step = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[event.key];
    if (step) {
      event.preventDefault();
      return save(view, { x: clamp(tree.x + step[0]), y: clamp(tree.y + step[1]) });
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      return remove(view);
    }
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
