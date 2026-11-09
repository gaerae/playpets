// What a built snowman wears: a hat, a scarf and a carrot nose, drawn over it in the yard from the
// catalogue's anchors (catalog.json "dress"), and the small tray that puts each on or takes it
// off. The tray opens from the snowman's menu (Dress up) or a press on it, stands above it inside
// the yard, and saves every change at once (garden.rs dress_decor); a refused one comes off again.
// It closes with Done, Escape, a press elsewhere, a change of place, or the snowman going. While it
// is open the friends' labels paint above it (garden.css), so a line said then is read whole.

import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { panelSpot } from '../core/menu.js';
import { $, call, data, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { artSize, artSvg } from './art.js';
import { giftKind } from './catalog.js';
import { fieldToYard, petHeight, sizeOf } from './field.js';
import { isFree } from './trips.js';
import { bubble } from './views.js';

// Spelled out, so the string tables' check finds each key.
const DRESS_KEYS = { hat: 'snowman.dress_hat', scarf: 'snowman.dress_scarf', nose: 'snowman.dress_nose' };
// A friend admires the snowman at most this often (ms), however fast things go on.
const SAY_EVERY = 4000;
// Room between the tray and the top of the hat, worn or not (px).
const ABOVE = 4;
// About where a friend's line shows, from its label's corner (yard px): views.js .yard-bubble is
// at most 190 px wide and sits on the head.
const BUBBLE_HALF = 95,
  BUBBLE_UP = 48;

const decorOf = id => data.garden?.decor.find(d => d.id === id) || null;
const kindOf = id => decorOf(id)?.kind;
const percent = n => +(n * 100).toFixed(2);
// A part's box over the snowman's drawing, as fractions of it: placed by its anchor's centre, its
// height from its own drawing's shape.
function partBox(gift, part) {
  const [boxW, boxH] = artSize(gift.art),
    [x, y, w] = part.at,
    [partW, partH] = artSize(part.art),
    h = (w * boxW * partH) / partW / boxH;
  return { left: x - w / 2, top: y - h / 2, width: w };
}

/** The parts a snowman of `kind` wears, as spans over its drawing, in the catalogue's (drawing)
 * order; each is placed by its anchor's centre, so a hat may rise above the box. */
export function dressLayers(kind, dress) {
  const gift = giftKind(kind),
    worn = new Set(dress || []);
  if (!gift?.dress || !worn.size) return '';
  return gift.dress
    .filter(part => worn.has(part.id))
    .map(part => {
      const box = partBox(gift, part);
      const style = `left:${percent(box.left)}%;top:${percent(box.top)}%;width:${percent(box.width)}%`;
      return `<span class="dress-part" data-part="${part.id}" style="${style}">${artSvg(part.art)}</span>`;
    })
    .join('');
}
/** What the snowman `d` wears as the yard shows it: while its changes are being saved, the last
 * one asked for, so a state event from an earlier save does not take a part off for a moment. */
export const wornDress = d => saving.get(d.id)?.want ?? d.dress ?? [];
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
  if (tray?.id === id) {
    place();
    return tray.node.querySelector('.dress-toggle')?.focus();
  }
  close('rescue');
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
  done.addEventListener('click', () => close('button'));
  node.append(done);
  // A press, a click or a right-click on the tray is the tray's: the yard would otherwise place a
  // treat, fish, catch a bug, dig or open its own menu under it.
  for (const type of ['pointerdown', 'click']) node.addEventListener(type, e => e.stopPropagation());
  node.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
  });
  node.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close('button');
  });
  yard.append(node);
  // A press elsewhere closes it as it closes a menu: focus goes where the press puts it.
  const outside = e => {
    if (!node.contains(e.target) && !tray?.button.contains(e.target)) close('none');
  };
  document.addEventListener('pointerdown', outside, true);
  tray = { id, node, button, outside };
  show();
  place();
  node.querySelector('.dress-toggle')?.focus();
}

/** Closes the tray. With `focus`, focus goes back to the snowman's button; without, it moves only
 * if it was in the tray, to the snowman or else the yard, so it is not lost with it. */
export function closeDress(focus = true) {
  close(focus ? 'button' : 'rescue');
}
function close(focus) {
  if (!tray) return;
  const { node, button, outside, id } = tray;
  tray = null;
  document.removeEventListener('pointerdown', outside, true);
  const inside = node.contains(document.activeElement);
  node.remove();
  if (focus === 'button' || (focus === 'rescue' && inside))
    (buttonOf(id) || (button.hidden ? null : button) || $('yard'))?.focus();
}

/** Follows the yard's drawing of the gifts: the tray closes when its snowman is no longer drawn
 * (put away, out of sight, replaced); otherwise its toggles show what it wears now and it stays
 * beside the snowman (moved, or the window resized). */
export function renderDress() {
  if (!tray) return;
  const button = buttonOf(tray.id);
  if (!button || button !== tray.button) return close('rescue');
  show();
  place();
}

// Each toggle pressed when its part is worn.
function show() {
  const d = decorOf(tray.id),
    worn = new Set(d ? wornDress(d) : []);
  for (const toggle of tray.node.querySelectorAll('.dress-toggle'))
    toggle.setAttribute('aria-pressed', String(worn.has(toggle.dataset.part)));
}

// Just above the snowman's hat (where it would be when not worn, so putting it on does not move
// the tray), and whole inside the yard.
function place() {
  const { node, button, id } = tray,
    gift = giftKind(kindOf(id));
  if (!gift?.dress) return;
  // Measured from the yard's corner, so its width is its own and not what is left beside it.
  node.style.left = '0px';
  node.style.top = '0px';
  const yard = $('yard').getBoundingClientRect(),
    r = button.getBoundingClientRect(),
    size = node.getBoundingClientRect(),
    top = Math.min(0, ...gift.dress.map(part => partBox(gift, part).top));
  const spot = panelSpot(
    { x: r.left + r.width / 2 - size.width / 2, y: r.top + top * r.height - size.height - ABOVE },
    size,
    yard,
  );
  node.style.left = `${spot.left}px`;
  node.style.top = `${spot.top}px`;
}

// Puts a part on or takes it off at once, then saves it. One save at a time per snowman: a change
// made while one is going is sent after it, so a refusal of the earlier list never puts back what
// was there over the later one, and the yard shows the last list asked for until all are saved.
function wear(id, part) {
  const d = decorOf(id),
    gift = giftKind(d?.kind);
  if (!d || !gift?.dress) return;
  const worn = new Set(wornDress(d)),
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
  let error = null;
  for (;;) {
    const sending = going.want;
    try {
      await call('dressDecor', id, sending);
      going.kept = sending;
      error = null;
    } catch (refused) {
      error = refused;
    }
    if (going.want === sending) break;
  }
  // Settled: the last saved list, which a state event may not have brought yet.
  saving.delete(id);
  const d = decorOf(id);
  if (d) d.dress = going.kept;
  redraw();
  if (tray?.id === id) show();
  if (error) toast(spoken(error, t('error.generic')), { error: true });
}

// A free friend likes it: the nearest whose line would not fall under the tray, else the nearest.
function admire(d) {
  const now = Date.now();
  // A clock set back does not silence them.
  if (now >= saidAt && now - saidAt < SAY_EVERY) return;
  const at = fieldToYard(d),
    away = v => Math.hypot(v.px + sizeOf(v.pet) / 2 - at.x, v.py + petHeight(v.pet) - at.y);
  const free = [...views.values()].filter(isFree).sort((a, b) => away(a) - away(b));
  const covered = trayBox(),
    clear = v => {
      const x = v.px + sizeOf(v.pet) / 2;
      return (
        !covered ||
        x + BUBBLE_HALF < covered.left ||
        x - BUBBLE_HALF > covered.right ||
        v.py - BUBBLE_UP > covered.bottom ||
        v.py + petHeight(v.pet) / 4 < covered.top
      );
    };
  const v = free.find(clear) || free[0];
  if (!v) return;
  saidAt = now;
  bubble(v, pick(list('snowman.dressed')), 3000);
}
// The open tray's box in yard pixels, or null.
function trayBox() {
  if (!tray) return null;
  const r = tray.node.getBoundingClientRect(),
    yard = $('yard').getBoundingClientRect();
  if (!r.width) return null;
  return { left: r.left - yard.left, right: r.right - yard.left, top: r.top - yard.top, bottom: r.bottom - yard.top };
}
