// What a built snowman wears: a hat, a scarf and a carrot nose, drawn over it in the yard from the
// catalogue's anchors (catalog.json "dress"), and the small tray that puts each on or takes it
// off. The tray opens from the snowman's menu (Dress up) or a press on it, stands above it inside
// the yard, and saves every change at once (garden.rs dress_decor); a refused one comes off again.
// It closes with Done, Escape, a press elsewhere, a change of place, or the snowman going.

import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { panelSpot } from '../core/menu.js';
import { $, call, data, toast } from '../core/state.js';
import { spoken } from '../core/text.js';
import { artSize, artSvg } from './art.js';
import { giftKind } from './catalog.js';
import { fieldToYard } from './field.js';
import { nearestFree } from './trips.js';
import { bubble } from './views.js';

// Spelled out, so the string tables' check finds each key.
const DRESS_KEYS = { hat: 'snowman.dress_hat', scarf: 'snowman.dress_scarf', nose: 'snowman.dress_nose' };
// A friend admires the snowman at most this often (ms), however fast things go on.
const SAY_EVERY = 4000;
// Room between the tray and the snowman's box: the hat rises a little above it (px).
const ABOVE = 12;

const decorOf = id => data.garden?.decor.find(d => d.id === id) || null;
const kindOf = id => decorOf(id)?.kind;
const percent = n => +(n * 100).toFixed(2);

/** The parts a snowman of `kind` wears, as spans over its drawing, in the catalogue's (drawing)
 * order; each is placed by its anchor's centre, so a hat may rise above the box. */
export function dressLayers(kind, dress) {
  const gift = giftKind(kind),
    worn = new Set(dress || []);
  if (!gift?.dress || !worn.size) return '';
  const [boxW, boxH] = artSize(gift.art);
  return gift.dress
    .filter(part => worn.has(part.id))
    .map(part => {
      const [x, y, w] = part.at,
        [partW, partH] = artSize(part.art),
        h = (w * boxW * partH) / partW / boxH;
      const style = `left:${percent(x - w / 2)}%;top:${percent(y - h / 2)}%;width:${percent(w)}%`;
      return `<span class="dress-part" data-part="${part.id}" style="${style}">${artSvg(part.art)}</span>`;
    })
    .join('');
}
/** Whether the gift `id` has things to wear. */
export const canDress = id => !!giftKind(kindOf(id))?.dress;
/** Whether the gift `id` may go out on the desktop: a built one stays in the yard. */
export const canGoOut = id => !giftKind(kindOf(id))?.built;

let redraw = () => {};
let buttonOf = () => null;
// The tray open now: { id, node, button, outside }, or null.
let tray = null;
// Saves still going, by snowman: { want, kept }, the list last asked for and the one last saved.
const saving = new Map();
let saidAt = -Infinity;

/** `redraw` draws the yard's gifts again (decor.js renderDecor); `button(id)` is the gift's button
 * the yard draws now, or null (decor.js decorButton). Nothing happens on import. */
export function setupDress({ redraw: draw, button }) {
  redraw = draw;
  buttonOf = button;
}

/** Opens the tray over the snowman `id`, one at a time; focus goes to its first toggle. */
export function openDress(id) {
  const gift = giftKind(kindOf(id)),
    button = buttonOf(id),
    yard = $('yard');
  if (!gift?.dress || !button || !yard) return;
  if (tray?.id === id) return tray.node.querySelector('.dress-toggle')?.focus();
  closeDress(false);
  const node = document.createElement('div');
  node.className = 'dress-tray';
  node.setAttribute('role', 'group');
  node.setAttribute('aria-label', t('snowman.dress_title'));
  for (const part of gift.dress) {
    const toggle = document.createElement('button'),
      label = document.createElement('span');
    toggle.type = 'button';
    toggle.className = 'dress-toggle';
    toggle.dataset.part = part.id;
    toggle.innerHTML = artSvg(part.art);
    label.textContent = t(DRESS_KEYS[part.id]);
    toggle.append(label);
    toggle.addEventListener('click', () => wear(id, part.id));
    node.append(toggle);
  }
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'dress-done';
  done.textContent = t('snowman.dress_done');
  done.addEventListener('click', () => closeDress());
  node.append(done);
  // The yard's own presses (placing, digging) stay outside it.
  node.addEventListener('pointerdown', e => e.stopPropagation());
  node.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    closeDress();
  });
  yard.append(node);
  const outside = e => {
    if (!node.contains(e.target) && !tray?.button.contains(e.target)) closeDress(false);
  };
  document.addEventListener('pointerdown', outside, true);
  tray = { id, node, button, outside };
  show();
  place();
  node.querySelector('.dress-toggle')?.focus();
}

/** Closes the tray; focus goes back to the snowman's button when it was in the tray (or `focus`). */
export function closeDress(focus = true) {
  if (!tray) return;
  const { node, button, outside, id } = tray;
  tray = null;
  document.removeEventListener('pointerdown', outside, true);
  const inside = node.contains(document.activeElement);
  node.remove();
  if (focus || inside) (buttonOf(id) || (button.hidden ? null : button) || $('yard'))?.focus();
}

/** Follows the yard's drawing of the gifts: the tray closes when its snowman is no longer drawn
 * (put away, out of sight, replaced), and its toggles show what it wears now. */
export function renderDress() {
  if (!tray) return;
  const button = buttonOf(tray.id);
  if (!button || button !== tray.button) return closeDress(false);
  show();
}

// Each toggle pressed when its part is worn.
function show() {
  const worn = new Set(decorOf(tray.id)?.dress || []);
  for (const toggle of tray.node.querySelectorAll('.dress-toggle'))
    toggle.setAttribute('aria-pressed', String(worn.has(toggle.dataset.part)));
}

// Above the snowman, and whole inside the yard.
function place() {
  const { node, button } = tray,
    yard = $('yard').getBoundingClientRect(),
    r = button.getBoundingClientRect(),
    size = node.getBoundingClientRect();
  const spot = panelSpot({ x: r.left + r.width / 2 - size.width / 2, y: r.top - size.height - ABOVE }, size, yard);
  node.style.left = `${spot.left}px`;
  node.style.top = `${spot.top}px`;
}

// Puts a part on or takes it off at once, then saves it. One save at a time per snowman: a change
// made while one is going is sent after it, so a refusal of the earlier list never puts back what
// was there over the later one.
function wear(id, part) {
  const d = decorOf(id),
    gift = giftKind(d?.kind);
  if (!d || !gift?.dress) return;
  const worn = new Set(d.dress || []),
    on = !worn.has(part);
  if (on) worn.add(part);
  else worn.delete(part);
  const dress = gift.dress.map(p => p.id).filter(p => worn.has(p));
  const going = saving.get(id);
  if (going) going.want = dress;
  else saving.set(id, { want: dress, kept: d.dress || [] });
  d.dress = dress;
  redraw();
  if (tray?.id === id) show();
  if (on) admire(d);
  if (!going) save(id);
}
async function save(id) {
  const going = saving.get(id);
  for (;;) {
    const sending = going.want;
    try {
      await call('dressDecor', id, sending);
      going.kept = sending;
    } catch (error) {
      if (going.want === sending) {
        saving.delete(id);
        const d = decorOf(id);
        if (d) d.dress = going.kept;
        redraw();
        if (tray?.id === id) show();
        toast(spoken(error, t('error.generic')), { error: true });
        return;
      }
    }
    if (going.want === sending) break;
  }
  saving.delete(id);
}

// The nearest free friend likes it.
function admire(d) {
  const now = Date.now();
  if (now - saidAt < SAY_EVERY) return;
  const at = fieldToYard(d),
    v = nearestFree(at.x, at.y);
  if (!v) return;
  saidAt = now;
  bubble(v, pick(list('snowman.dressed')), 3000);
}
