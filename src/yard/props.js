// What the garden (garden.js), the gifts (decor.js) and the planted trees share: things kept on the
// field, drawn as buttons in the garden layer, kept in line with the backend's list, sized with the
// yard as the friends are, set down by their foot, dragged about (friends too, views.js), and taken
// away gently, with a moment to undo it.
import { t } from '../core/i18n.js';
import { clamp } from '../core/math.js';
import { $, aiming, dropLine, game, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { artSize } from './art.js';
import { giftKind } from './catalog.js';
import { EDGE, field, yardZoom } from './field.js';
import { scene } from './world.js';

/** Brings `shown` (id → view) in line with `items`: views of items that went are removed, new ones
 * made with `create(item)`, and every view brought up to date with `update(view, item)`. */
export function reconcile(shown, items, create, update) {
  for (const [id, v] of shown)
    if (!items.some(item => item.id === id)) {
      v.button.remove();
      shown.delete(id);
    }
  for (const item of items) {
    let v = shown.get(item.id);
    if (!v) {
      v = create(item);
      shown.set(item.id, v);
    }
    update(v, item);
    if (leaving.has(item.id)) v.button.hidden = true;
  }
}
/** How much things on the field shrink in the yard as it is now: as much as the friends. */
export const propScale = () => yardZoom();
/** Sets a prop's box (w × h yard pixels) down with its foot at (x, y), in front of what is behind. */
export function setDown(button, x, y, w, h, z) {
  button.style.width = `${w}px`;
  button.style.height = `${h}px`;
  button.style.transform = `translate(${x - w / 2}px,${y - h}px)`;
  button.style.zIndex = String(z);
}
/** A new button for a prop in the garden layer. */
export function propButton(className, kind) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.kind = kind;
  $('garden-layer').append(button);
  return button;
}
// How long Undo is offered before a taken-away thing is removed for good.
const UNDO_MS = 6000;
const leaving = new Map();
/** Takes a thing on the field away without asking: it leaves at once, a notice offers Undo for a few
 * seconds, and only then is it removed for good (`commit`). Closing the app before then keeps it.
 * `restored` runs when it shows again, by Undo or because the removal could not be saved. */
export function removeWithUndo(id, view, message, commit, restored = () => {}) {
  if (leaving.has(id)) return;
  view.button.hidden = true;
  let line = null;
  const timer = setTimeout(async () => {
    leaving.delete(id);
    // Saved now: its Undo goes with it, even with the pointer resting on the notice.
    if (line) dropLine(line);
    try {
      await commit();
    } catch (error) {
      view.button.hidden = false;
      restored();
      toast(spoken(error, t('error.generic')), { error: true });
    }
  }, UNDO_MS);
  leaving.set(id, timer);
  line = toast(message, {
    ms: UNDO_MS,
    action: {
      label: t('common.undo'),
      run: () => {
        clearTimeout(leaving.get(id));
        leaving.delete(id);
        view.button.hidden = false;
        restored();
      },
    },
  });
}

/** How far an arrow key moves a gift or rolls a snowball, in yard pixels: [x, y]. */
export const KEY_STEPS = Object.freeze({
  ArrowLeft: [-16, 0],
  ArrowRight: [16, 0],
  ArrowUp: [0, -8],
  ArrowDown: [0, 8],
});
// A press that goes this far (screen pixels) is a drag; a shorter one is a click.
const DRAG_SLOP = 5;
/** Starts following a press on `target` (a prop, or a friend) that stands at the field point
 * `from`: the pointer is captured so the drag keeps up outside the button. `more` rides along. */
export function beginDrag(target, event, from, more = {}) {
  // A press that is not a live pointer (a script's) has nothing to capture.
  try {
    target.setPointerCapture(event.pointerId);
  } catch {}
  return { startX: event.clientX, startY: event.clientY, x: from.x, y: from.y, moved: false, ...more };
}
/** Where the pointer has dragged the thing to, as a field point: it moves by the pointer's travel
 * over the field's `width` × `height` pixels, never past the field (nor below `bottom`). Null while
 * the press has not gone far enough to be a drag. */
export function dragPoint(drag, event, width, height, bottom = 1) {
  const dx = event.clientX - drag.startX,
    dy = event.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return null;
  drag.moved = true;
  return { x: clamp(drag.x + dx / width), y: clamp(drag.y + dy / height, 0, bottom) };
}
/** How far an arrow key moves a flower or a planted tree, as a share of the field: [x, y]. */
const FIELD_STEPS = Object.freeze({
  ArrowLeft: [-0.03, 0],
  ArrowRight: [0.03, 0],
  ArrowUp: [0, -0.05],
  ArrowDown: [0, 0.05],
});
/** Lets a saved thing on the field (a flower, a planted tree; `view` is { id, button, drag, busy })
 * be dragged or moved with the arrow keys, its menu be opened by a right click, the menu key or
 * Shift+F10, and Delete take it away. `current()` is the saved thing now, or null once it is gone;
 * `show(point)` draws it at a field point while it is dragged; `save(point)` keeps a new spot;
 * `menu(point)` opens its menu at a window point; `remove()` takes it away; `settle()` draws the
 * field again after a drag; `allowed(point)`, when given, marks a spot it may not stand on;
 * `press(event)` is a click, which the click that ends a drop is not. While something is being
 * placed, or in a game, it is left alone. */
export function movable(view, { current, show, save, menu, remove, settle, allowed, press }) {
  const { button } = view;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || aiming || game || view.busy || !current()) return;
    // As a gift's press: the webview starts no drag or selection of its own under the pointer.
    event.preventDefault();
    event.stopPropagation();
    const f = field();
    view.drag = beginDrag(button, event, current(), {
      width: Math.max(1, f.width - EDGE * 2),
      height: Math.max(1, f.bottom - f.top),
      world: scene.world,
    });
  });
  button.addEventListener('pointermove', event => {
    const drag = view.drag;
    if (!drag || !current() || drag.world !== scene.world) return;
    const at = dragPoint(drag, event, drag.width, drag.height);
    if (!at) return;
    drag.at = at;
    button.classList.add('dragging');
    if (allowed) button.classList.toggle('invalid', !allowed(at));
    show(at);
  });
  const drop = async event => {
    const drag = endDrag(view, button, event);
    button.classList.remove('dragging', 'invalid');
    // Only a press let go is followed by a click; after a cancel the next click is a press.
    view.dragged = event.type === 'pointerup' && !!drag?.moved;
    if (!drag?.moved) return;
    if (view.dragged && drag.at && drag.world === scene.world && !aiming && !game) await save(drag.at);
    settle();
  };
  button.addEventListener('pointerup', drop);
  button.addEventListener('pointercancel', drop);
  button.addEventListener('dragstart', event => event.preventDefault());
  button.addEventListener('click', event => {
    if (view.dragged) {
      view.dragged = false;
      event.stopPropagation();
      return;
    }
    press?.(event);
  });
  button.addEventListener('contextmenu', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!aiming && !game) menu({ x: event.clientX, y: event.clientY });
  });
  button.addEventListener('keydown', event => {
    const item = current();
    if (!item || aiming || game) return;
    const step = FIELD_STEPS[event.key];
    if (step) {
      event.preventDefault();
      return save({ x: clamp(item.x + step[0]), y: clamp(item.y + step[1]) });
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      const r = button.getBoundingClientRect();
      return menu({ x: r.left, y: r.bottom });
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      return remove();
    }
  });
}
/** Ends `view`'s drag and lets the pointer go; returns the drag that was on, or null. */
export function endDrag(view, target, event) {
  const drag = view.drag;
  view.drag = null;
  try {
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  } catch {}
  return drag;
}
/** Moves a saved thing (`item`) to `at` at once and only then asks the backend (`send`), so it does
 * not jump back while it is saved; a refusal puts it back where it was, unless `current()` says the
 * backend's list has since replaced it. `show` draws the move, `settle` everything once answered. */
export async function moveSaved(view, item, at, { send, current, show, settle }) {
  const previous = { x: item.x, y: item.y };
  view.busy = true;
  Object.assign(item, at);
  show();
  try {
    await send();
  } catch (error) {
    if (current() === item) Object.assign(item, previous);
    throw error;
  } finally {
    view.busy = false;
    settle();
  }
}

/** Full rendered gift dimensions, shared by drawing, visiting and ground placement. */
export function giftSize(kind) {
  const gift = giftKind(kind),
    [w, h] = gift?.size || artSize(gift?.art);
  return { w: w * 1.05 * propScale(), h: h * 1.05 * propScale() };
}
