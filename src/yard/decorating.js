// Decorating the Christmas tree (docs/design/2026-11-09-a-winter-to-share.md, "Decorating the
// tree"): a press on the tree in the yard opens this view, where a person picks a find from the
// album, lights the free hooks, and hangs it on one as a bauble holding the item's drawing. A card
// says what each bauble is and takes it down again. The friend standing nearest the tree says a
// line after each hang.
//
// The backend keeps the ornaments, the day's count and every rule (garden.rs hang_ornament and
// take_down_ornament: three a day, a free hook, once a season); the view shows what they allow and
// asks, and a refusal is said as the backend words it. The view keeps the drawing the yard showed
// when it opened (small, or grand on Christmas night): hook i is the same place on both, and a tree
// that changed under the pointer would move every hook at once.
//
// Bauble nodes are kept by hook across renders: a hang marks its hook at the press and the bauble
// is made then (`hanging`), so a render while the backend answers leaves it alone, and the answer
// only confirms it.

import { closeOnBackdrop } from '../core/confirm.js';
import { list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { clamp, pick } from '../core/math.js';
import { canvas, drawStill } from '../core/sprites.js';
import { $, call, data, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { artSize, artSvg } from './art.js';
import { giftKind } from './catalog.js';
import { percent } from './christmas-night.js';
import { shownDecor } from './decor.js';
import { petHeight, sizeOf } from './field.js';
import { localDay } from './growth.js';
import {
  bauble,
  bookName,
  hangable,
  leftToday,
  ORNAMENT_BOOKS,
  ornamentLook,
  ornamentSeason,
  treeOrnaments,
} from './ornaments.js';
import { bubble } from './views.js';

// A pointer resting on a bauble shows its card after a moment; one leaving it hides the card after
// a shorter one, so the pointer can cross the gap to the card's button.
const CARD_DELAY_MS = 300,
  CARD_LEAVE_MS = 150;
// How long the friend's line stays in the view (the yard's bubble keeps at least its reading time).
const CHEER_MS = 2600;
// Room kept between the card and the stage's edge or its bauble, in pixels.
const CARD_GAP = 6;

const keyOf = o => `${o.book}:${o.id}`;
const same = (a, b) => !!a && !!b && keyOf(a) === keyOf(b);

// The open view, or null: the tree's button and hooks as opened, the friend who reacts, the book
// chosen in the tray, the item picked, a hang on its way (`hanging`) or one taken down that the
// garden still lists (`gone`), and the nodes kept between renders.
let view = null;
// The bauble whose card shows, its timer, and the friend's line's timer.
let cardFor = null,
  cardTimer = null,
  cheerTimer = null;
// Set while Escape hands focus back to a bauble whose card it just hid, so focus does not show it.
let quiet = false;

// The friend whose foot is nearest the tree's foot, busy or not; null with no friends out.
function nearest(at) {
  let best = null,
    far = Infinity;
  for (const v of views.values()) {
    const d = Math.hypot(v.px + sizeOf(v.pet) / 2 - at.x, v.py + petHeight(v.pet) - at.y);
    if (d < far) [best, far] = [v, d];
  }
  return best;
}

/** Opens the decorating view on the Christmas tree the yard shows now. */
export function openDecorating() {
  const dialog = $('decorating-dialog'),
    found = shownDecor('xmas_tree');
  if (!found || dialog.open) return;
  const grand = found.button.classList.contains('xmas-grand'),
    gift = giftKind('xmas_tree'),
    art = grand ? gift.night.art : gift.art,
    [w, h] = artSize(art),
    tree = $('decorating-tree');
  tree.replaceChildren();
  tree.innerHTML = artSvg(art);
  tree.className = `decorating-tree ${grand ? 'grand' : 'small'}`;
  tree.style.aspectRatio = `${w} / ${h}`;
  view = {
    button: found.button,
    hooks: grand ? gift.night.hooks : gift.hooks,
    friend: nearest(found.at),
    chosen: 'all',
    picked: null,
    hanging: null,
    gone: null,
    note: '',
    busy: false,
    baubles: new Map(),
    spots: [],
    spotsKey: null,
    chips: new Map(),
    trayKey: null,
    kindsKey: null,
    statusKey: null,
  };
  const friend = $('decorating-friend');
  friend.replaceChildren();
  friend.hidden = !view.friend;
  if (view.friend) {
    const cell = canvas();
    drawStill(cell, view.friend.asset);
    friend.append(cell);
  }
  $('decorating-bubble').hidden = true;
  hideCard();
  dialog.showModal();
  renderDecorating();
}

/** Brings the open view in line with the garden: closes it when the tree has left the yard, and
 * otherwise draws the dots, the books, the tray and the baubles. Does nothing while it is closed. */
export function renderDecorating() {
  const dialog = $('decorating-dialog');
  if (!view || !dialog.open) return;
  if (!shownDecor('xmas_tree')) return dialog.close();
  const now = new Date(),
    garden = data.garden || {},
    saved = treeOrnaments(garden, now),
    listed = o => saved.some(s => same(s, o));
  // The garden catches up with what the backend answered: a confirmed hang once it lists it, one
  // taken down once it no longer does.
  if (view.hanging?.done && listed(view.hanging)) view.hanging = null;
  if (view.gone && !listed(view.gone)) view.gone = null;
  const coming = view.hanging && !listed(view.hanging) ? [view.hanging] : [],
    hanging = [...saved.filter(o => !same(o, view.gone)), ...coming],
    count = limit(data, 'ornamentHooks'),
    taken = new Set(hanging.map(o => o.hook)),
    free = Array.from({ length: count }, (_, i) => i).filter(i => !taken.has(i)),
    left = Math.max(0, leftToday(garden, now, limit(data, 'ornamentsPerDay')) - coming.length),
    // What could hang, with the hang on its way off the list and the one taken down back on it.
    items = hangable({ ...data, garden: { ...garden, ornaments: hanging, ornamentYear: ornamentSeason(now) } }, now);
  if (view.picked && !items.some(i => same(i, view.picked))) view.picked = null;
  const picking = !!view.picked && !view.busy && free.length > 0 && left > 0;
  if (!picking) view.picked = null;
  $('decorating-tree').classList.toggle('placing', picking);
  drawBaubles(hanging);
  drawSpots(picking ? free : []);
  drawStatus({ left, free, items, picking });
  drawKinds(items);
  drawTray(items, left > 0 && free.length > 0);
}

// The baubles on the tree, one node per hook kept between renders; what the catalogue no longer
// has, or a hook past the tree, is not drawn.
function drawBaubles(hanging) {
  const tree = $('decorating-tree'),
    shown = new Set();
  for (const o of hanging) {
    if (!Number.isInteger(o.hook) || !view.hooks[o.hook]) continue;
    const look = ornamentLook(o.book, o.id);
    if (!look) continue;
    let node = view.baubles.get(o.hook);
    if (node && node.dataset.key !== keyOf(o)) {
      if (cardFor === node) hideCard();
      node.remove();
      node = null;
    }
    if (!node) {
      node = makeBauble(o, look);
      view.baubles.set(o.hook, node);
      tree.append(node);
    }
    // A hang on its way: the bauble stands where the arc begins until the backend answers.
    node.classList.toggle('hanging', !!view.hanging && view.hanging.hook === o.hook && !view.hanging.done);
    shown.add(o.hook);
  }
  for (const [hook, node] of view.baubles) {
    if (shown.has(hook)) continue;
    if (cardFor === node) hideCard();
    node.remove();
    view.baubles.delete(hook);
  }
}
function makeBauble(o, look) {
  const node = bauble(o, { tag: 'button', art: true }),
    [x, y] = view.hooks[o.hook];
  node.type = 'button';
  node.dataset.hook = String(o.hook);
  node.dataset.key = keyOf(o);
  node.style.left = percent(x);
  node.style.top = percent(y);
  node.setAttribute('aria-label', t('decorating.ornament', { name: look.name }));
  node.setAttribute('aria-controls', 'ornament-card');
  node.setAttribute('aria-expanded', 'false');
  let pressing = false;
  node.addEventListener('pointerenter', e => {
    if (e.pointerType === 'touch') return;
    clearTimeout(cardTimer);
    if (cardFor !== node) cardTimer = setTimeout(() => showCard(node, o), CARD_DELAY_MS);
  });
  node.addEventListener('pointerleave', () => {
    pressing = false;
    leaveCard();
  });
  // A press focuses the button before its click: the click decides, so it does not show and hide.
  node.addEventListener('pointerdown', () => {
    pressing = true;
  });
  node.addEventListener('focus', () => {
    if (!pressing && !quiet) showCard(node, o);
  });
  node.addEventListener('blur', e => {
    if (!$('ornament-card').contains(e.relatedTarget)) leaveCard(0);
  });
  node.addEventListener('click', () => {
    pressing = false;
    if (cardFor === node) hideCard();
    else showCard(node, o);
  });
  return node;
}

// The hook points on the free hooks while an item is picked.
function drawSpots(free) {
  const key = free.join();
  if (key === view.spotsKey) return;
  view.spotsKey = key;
  for (const spot of view.spots) spot.remove();
  view.spots = free.map(hook => {
    const spot = document.createElement('button'),
      [x, y] = view.hooks[hook];
    spot.type = 'button';
    spot.className = 'ornament-hook';
    spot.dataset.hook = String(hook);
    spot.style.left = percent(x);
    spot.style.top = percent(y);
    spot.setAttribute('aria-label', t('decorating.hook'));
    spot.addEventListener('click', () => hang(hook));
    $('decorating-tree').append(spot);
    return spot;
  });
}

// What can be done today, in words, and the day's hangs as dots (spent ones dimmed).
function drawStatus({ left, free, items, picking }) {
  const perDay = limit(data, 'ornamentsPerDay'),
    empty = !items.length && left > 0 && free.length > 0,
    text =
      view.note ||
      (picking && t('decorating.pick')) ||
      (!free.length && t('decorating.full')) ||
      (!left && t('decorating.done_today')) ||
      (empty && t('decorating.empty')) ||
      t('decorating.left', { count: left }),
    dots = free.length && !empty ? perDay : 0,
    key = `${text}|${dots}|${left}`;
  if (key === view.statusKey) return;
  view.statusKey = key;
  $('decorating-status').replaceChildren(
    text,
    ...Array.from({ length: dots }, (_, i) => {
      const dot = document.createElement('i');
      dot.className = i < perDay - left ? 'dot used' : 'dot';
      dot.setAttribute('aria-hidden', 'true');
      return dot;
    }),
  );
}

// The books to choose from: all, then each book with something to hang.
function drawKinds(items) {
  const books = ORNAMENT_BOOKS.filter(book => items.some(i => i.book === book));
  if (view.chosen !== 'all' && !books.includes(view.chosen)) view.chosen = 'all';
  const kinds = $('decorating-kinds'),
    key = items.length ? books.join() : '';
  if (key !== view.kindsKey) {
    view.kindsKey = key;
    kinds.replaceChildren(
      ...(items.length ? ['all', ...books] : []).map(book => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `decorating-kind ${book}`;
        chip.dataset.book = book;
        if (book !== 'all') {
          const swatch = document.createElement('span');
          swatch.className = 'swatch';
          swatch.setAttribute('aria-hidden', 'true');
          chip.append(swatch);
        }
        chip.append(book === 'all' ? t('decorating.all') : bookName(book));
        chip.addEventListener('click', () => {
          view.chosen = book;
          renderDecorating();
        });
        return chip;
      }),
    );
  }
  for (const chip of kinds.children)
    if (typeof chip === 'object') chip.setAttribute('aria-pressed', String(chip.dataset.book === view.chosen));
}

// One chip per item of the chosen book that can hang, its node kept between renders.
function drawTray(items, open) {
  const shown = view.chosen === 'all' ? items : items.filter(i => i.book === view.chosen),
    key = shown.map(keyOf).join();
  if (key !== view.trayKey) {
    view.trayKey = key;
    const chips = new Map();
    for (const item of shown) chips.set(keyOf(item), view.chips.get(keyOf(item)) || makeChip(item));
    view.chips = chips;
    $('decorating-tray').replaceChildren(...chips.values());
  }
  for (const [key, chip] of view.chips) {
    chip.disabled = !open;
    chip.setAttribute('aria-pressed', String(!!view.picked && keyOf(view.picked) === key));
  }
}
function makeChip(item) {
  const look = ornamentLook(item.book, item.id),
    chip = document.createElement('button'),
    art = document.createElement('span'),
    label = document.createElement('span');
  chip.type = 'button';
  chip.className = `ornament-chip ${item.book}`;
  chip.dataset.key = keyOf(item);
  chip.title = look.name;
  art.className = 'ornament-chip-art';
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = look.art;
  label.className = 'ornament-chip-name';
  label.textContent = look.name;
  chip.append(art, label);
  chip.addEventListener('click', () => choose(item));
  return chip;
}

// A chip picks its item, or puts it back; picking lights the free hooks and moves to the first.
function choose(item) {
  if (!view || view.busy) return;
  view.note = '';
  view.picked = same(view.picked, item) ? null : item;
  renderDecorating();
  if (view.picked) view.spots[0]?.focus();
}
function unpick() {
  const item = view.picked;
  view.picked = null;
  renderDecorating();
  view.chips.get(keyOf(item))?.focus();
}

// Hangs the picked item on `hook`: the bauble is made at once, and the backend is asked once; a
// refusal takes it away again and says why.
function hang(hook) {
  const item = view?.picked;
  if (!item || view.busy) return;
  const v = view,
    chip = v.chips.get(keyOf(item));
  v.busy = true;
  v.note = '';
  v.hanging = { ...item, hook, done: false, chip, from: chip?.getBoundingClientRect?.() ?? null };
  v.picked = null;
  renderDecorating();
  settleFocus();
  call('hangOrnament', item.book, item.id, hook, localDay(new Date()))
    .then(() => {
      v.busy = false;
      if (view !== v) return;
      v.hanging.done = true;
      renderDecorating();
      cheer();
    })
    .catch(error => {
      v.busy = false;
      toast(spoken(error, t('error.generic')), { error: true });
      if (view !== v) return;
      v.hanging = null;
      renderDecorating();
    });
}

// Takes an ornament down from its card: its hook is free again and it goes back to the tray; the
// day's count stays as it was (the backend's rule).
function takeDown(o) {
  if (!view || view.busy) return;
  const v = view,
    name = ornamentLook(o.book, o.id)?.name || '';
  v.busy = true;
  call('takeDownOrnament', o.book, o.id, localDay(new Date()))
    .then(() => {
      v.busy = false;
      if (view !== v) return;
      v.gone = { book: o.book, id: o.id, hook: o.hook };
      v.note = t('decorating.taken_down', { name });
      hideCard();
      renderDecorating();
      settleFocus(o);
    })
    .catch(error => {
      v.busy = false;
      toast(spoken(error, t('error.generic')), { error: true });
    });
}
// Focus after a hang or a take-down, whose button has gone: the item's chip back in the tray, the
// first chip that can be pressed, or the close button.
function settleFocus(item = null) {
  const chips = [...view.chips.values()];
  const next = (item && view.chips.get(keyOf(item))) || chips.find(chip => !chip.disabled);
  (next && !next.disabled ? next : $('close-decorating')).focus();
}

// The nearest friend's line after a hang: in the yard (shown and read aloud as its own) and in
// the view's bubble beside its picture. A friend that has left says nothing.
function cheer() {
  const friend = view.friend;
  if (!friend || ![...views.values()].includes(friend)) return;
  const line = pick(list('decorating.cheer')),
    said = $('decorating-bubble');
  bubble(friend, line, CHEER_MS);
  said.textContent = line;
  said.hidden = false;
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => {
    said.hidden = true;
  }, CHEER_MS);
}

// The card: the bauble's drawing, name and book, and a button to take it down. It sits above its
// bauble (below one too near the top), inside the stage's width, and stays while the pointer is
// on it or focus is in it.
function showCard(node, o) {
  clearTimeout(cardTimer);
  const look = ornamentLook(o.book, o.id),
    card = $('ornament-card');
  if (!look || !view) return;
  if (cardFor !== node) {
    cardFor?.setAttribute('aria-expanded', 'false');
    const art = document.createElement('div'),
      title = document.createElement('strong'),
      book = document.createElement('small'),
      down = document.createElement('button');
    art.className = 'ornament-card-art';
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = look.art;
    title.id = 'ornament-card-name';
    title.textContent = look.name;
    book.textContent = t('decorating.book', { book: look.book });
    down.type = 'button';
    down.className = 'button secondary ornament-take-down';
    down.textContent = t('decorating.take_down');
    down.addEventListener('click', () => takeDown(o));
    card.replaceChildren(art, title, book, down);
    card.dataset.hook = String(o.hook);
    cardFor = node;
  }
  node.setAttribute('aria-expanded', 'true');
  card.hidden = false;
  placeCard(card, node);
}
// Above the bauble where there is room; else beside it, on the side away from the trunk first, so
// the card covers sky rather than other baubles; else below it.
function placeCard(card, node) {
  const stage = $('decorating-stage').getBoundingClientRect(),
    at = node.getBoundingClientRect(),
    w = card.offsetWidth || 0,
    h = card.offsetHeight || 0,
    x = at.left - stage.left,
    y = at.top - stage.top,
    across = (from, size, room) => clamp(from, CARD_GAP, Math.max(CARD_GAP, room - size - CARD_GAP)),
    right = x + at.width + CARD_GAP,
    left = x - w - CARD_GAP,
    fitsRight = right + w + CARD_GAP <= stage.width,
    fitsLeft = left >= CARD_GAP,
    outward = x + at.width / 2 >= stage.width / 2;
  let place;
  if (y - h - CARD_GAP >= CARD_GAP) place = [across(x + at.width / 2 - w / 2, w, stage.width), y - h - CARD_GAP];
  else if (fitsRight && (outward || !fitsLeft)) place = [right, across(y + at.height / 2 - h / 2, h, stage.height)];
  else if (fitsLeft) place = [left, across(y + at.height / 2 - h / 2, h, stage.height)];
  else place = [across(x + at.width / 2 - w / 2, w, stage.width), y + at.height + CARD_GAP];
  card.style.left = `${Math.round(place[0])}px`;
  card.style.top = `${Math.round(place[1])}px`;
}
function hideCard() {
  clearTimeout(cardTimer);
  $('ornament-card').hidden = true;
  cardFor?.setAttribute('aria-expanded', 'false');
  cardFor = null;
}
// Hides the card after `ms` unless by then the pointer is on it, or focus is in it or on its
// bauble (a card a click or the keyboard opened stays until focus goes).
function leaveCard(ms = CARD_LEAVE_MS) {
  clearTimeout(cardTimer);
  if (!cardFor) return;
  const card = $('ornament-card'),
    node = cardFor;
  cardTimer = setTimeout(() => {
    const focused = document.activeElement;
    if (card.matches(':hover') || card.contains(focused) || (ms && focused === node)) return;
    hideCard();
  }, ms);
}

/** Wires the view: its close button, the backdrop, Escape (which first puts a picked item back or
 * hides the card), and the card that stays while it is pointed at. */
export function setupDecorating() {
  const dialog = $('decorating-dialog'),
    card = $('ornament-card');
  $('close-decorating').addEventListener('click', () => dialog.close());
  closeOnBackdrop(dialog);
  dialog.addEventListener('cancel', e => {
    if (!view) return;
    e.preventDefault();
    if (cardFor) {
      const node = cardFor;
      hideCard();
      quiet = true;
      node.focus();
      quiet = false;
      return;
    }
    if (view.picked) return unpick();
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    const button = view?.button;
    hideCard();
    clearTimeout(cheerTimer);
    $('decorating-bubble').hidden = true;
    view = null;
    (button && !button.hidden && button.isConnected !== false ? button : $('yard'))?.focus();
  });
  card.addEventListener('pointerenter', () => clearTimeout(cardTimer));
  card.addEventListener('pointerleave', () => leaveCard());
  card.addEventListener('focusout', e => {
    if (!card.contains(e.relatedTarget) && e.relatedTarget !== cardFor) leaveCard(0);
  });
}
