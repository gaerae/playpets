// What the garden (garden.js) and the gifts (decor.js) share: things kept on the field, drawn as
// buttons in the garden layer, kept in line with the backend's list, sized with the yard as the
// friends are, set down by their foot, and taken away gently, with a moment to undo it.
import { t } from '../core/i18n.js';
import { $, dropLine, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { artSize } from './art.js';
import { giftKind } from './catalog.js';
import { yardZoom } from './field.js';

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
 * seconds, and only then is it removed for good (`commit`). Closing the app before then keeps it. */
export function removeWithUndo(id, view, message, commit) {
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
      },
    },
  });
}

/** Full rendered gift dimensions, shared by drawing, visiting and ground placement. */
export function giftSize(kind) {
  const gift = giftKind(kind),
    [w, h] = gift?.size || artSize(gift?.art);
  return { w: w * 1.05 * propScale(), h: h * 1.05 * propScale() };
}
