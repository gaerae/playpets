// What the garden (garden.js) and the gifts (decor.js) share: things kept on the field, drawn as
// buttons in the garden layer, kept in line with the backend's list, sized with the yard as the
// friends are, set down by their foot, and taken away only once the person says so.
import { confirmAction } from '../core/confirm.js';
import { $ } from '../core/state.js';
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
/** Asks before taking a prop away; true once the person agrees. */
export const askToRemove = (title, body, action) => confirmAction({ title, body, action });
