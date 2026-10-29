// Decorations friends bring as gifts: a bench, a lantern, a birdhouse, a little pond, a mailbox,
// a picnic blanket (what there is, how each is drawn and its effects: catalog.json). A friend sets
// its gift down beside it; the person drags it wherever they like, or puts it away from its menu
// (right-click, or Delete). Friends visit them on their own and say something that fits. The
// backend keeps them and decides which gift comes next (src-tauri/src/pets/garden.rs); when one is
// due is in growth.js. Drawn once, like plants: nothing here moves on its own, and the lantern's
// glow is a still layer the evening shows.

import { list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { between, clamp, pick } from '../core/math.js';
import { aiming, call, data, game, guard, name, views } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { artSvg } from './art.js';
import { befriend, levelOf } from './bond.js';
import { showCard } from './card.js';
import { giftKind } from './catalog.js';
import { giftSvg } from './creatures.js';
import { effectLayers, effectsVisited } from './effects.js';
import { EDGE, field, fieldToYard, footTarget, petHeight, sizeOf, yardToField } from './field.js';
import { FIRST_GIFT, GIFT_WAIT, giftDue, giftWait, localDay } from './growth.js';
import { propButton, reconcile, removeWithUndo, setDown, giftSize as size } from './props.js';
import { cue } from './sound.js';
import { isFree, nearestFree, rest, sendTo } from './trips.js';
import { bubble, cheer, effect } from './views.js';
import { scene } from './world.js';

const flat = kind => !!giftKind(kind)?.flat;
const standOn = kind => giftKind(kind)?.stand === 'on';
const shown = new Map();
// Gifts that just came, shown with a little pop the first time they are drawn.
const fresh = new Set();
const kindName = kind => t(`decor.kind_${kind}`);

function placement(kind, point) {
  const at = fieldToYard(point),
    { w, h } = size(kind);
  // Saved coordinates locate the foot; wide furniture still needs room at either edge.
  at.x = clamp(at.x, w / 2 + 4, field().width - w / 2 - 4);
  return { ...at, w, h };
}
function position(v, x, y) {
  const at = placement(v.kind, { x, y });
  setDown(v.button, at.x, at.y, at.w, at.h, flat(v.kind) ? 0 : 1 + Math.round(y * 100));
}

function create(d) {
  const button = propButton('decor', d.kind),
    gift = giftKind(d.kind),
    effects = gift?.effects || [];
  if (effects.length) button.dataset.effects = effects.join(' ');
  button.innerHTML = `${effectLayers(effects)}${gift ? artSvg(gift.art) : ''}`;
  const v = { id: d.id, kind: d.kind, button, drag: null, busy: false };
  // Dragging moves it; a press that does not move sends the nearest friend over to it.
  button.addEventListener('pointerdown', e => {
    // Placing a seed or a treat, the press goes through to the field.
    if (e.button !== 0 || aiming || game || v.busy) return;
    e.preventDefault();
    e.stopPropagation();
    const current = data.garden?.decor.find(item => item.id === v.id),
      f = field();
    if (!current) return;
    v.drag = {
      startX: e.clientX,
      startY: e.clientY,
      x: current.x,
      y: current.y,
      width: Math.max(1, f.width - EDGE * 2),
      height: Math.max(1, f.bottom - f.top),
      moved: false,
    };
    try {
      button.setPointerCapture(e.pointerId);
    } catch {}
  });
  button.addEventListener('pointermove', e => {
    const drag = v.drag;
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.moved = true;
    button.classList.add('dragging');
    drag.at = {
      x: clamp(drag.x + (e.clientX - drag.startX) / drag.width),
      y: clamp(drag.y + (e.clientY - drag.startY) / drag.height),
    };
    position(v, drag.at.x, drag.at.y);
  });
  const drop = event => {
    const drag = v.drag;
    v.drag = null;
    button.classList.remove('dragging');
    try {
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    } catch {}
    if (!drag) return;
    if (!drag.moved) return visit(v.id);
    if (drag.at) return save(v.id, drag.at);
  };
  button.addEventListener('pointerup', drop);
  button.addEventListener('pointercancel', () => {
    v.drag = null;
    button.classList.remove('dragging');
    renderDecor();
  });
  button.addEventListener('dragstart', event => event.preventDefault());
  button.addEventListener('contextmenu', e => {
    e.preventDefault();
    putAway(v.id);
  });
  // By keyboard: arrows move it a little, Delete puts it away.
  button.addEventListener('keydown', e => {
    const step = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (step) {
      e.preventDefault();
      const d = data.garden?.decor.find(x => x.id === v.id);
      if (d) save(v.id, { x: clamp(d.x + step[0]), y: clamp(d.y + step[1]) });
    } else if (e.key === 'Delete' || e.key === 'Backspace') putAway(v.id);
  });
  return v;
}
// Kept here at once so it does not jump back while the backend saves it.
const save = guard(async (id, at) => {
  const d = data.garden?.decor.find(x => x.id === id);
  const view = shown.get(id);
  if (!d || !view || view.busy) return;
  const previous = { x: d.x, y: d.y };
  view.busy = true;
  Object.assign(d, at);
  renderDecor();
  try {
    await call('moveDecor', id, at.x, at.y);
  } catch (error) {
    if (data.garden?.decor.find(item => item.id === id) === d) Object.assign(d, previous);
    throw error;
  } finally {
    view.busy = false;
    renderDecor();
  }
});

export function setupDecor() {
  globalThis.window?.addEventListener('resize', () => {
    for (const view of shown.values()) {
      view.drag = null;
      view.button.classList.remove('dragging');
    }
    renderDecor();
  });
}

/** Brings the yard's decorations in line with the backend's garden. */
export function renderDecor() {
  const make = d => {
    const v = create(d);
    if (fresh.delete(d.id)) v.button.classList.add('arrive');
    return v;
  };
  reconcile(shown, data.garden?.decor || [], make, (v, d) => {
    if (!v.drag?.moved) position(v, d.x, d.y);
    const from = d.memento && data.pets.find(p => p.id === d.from);
    const label = from
      ? t('decor.memento_title', { name: name(from), kind: kindName(d.kind) })
      : t('decor.title', { kind: kindName(d.kind) });
    v.button.classList.toggle('memento', !!d.memento);
    v.button.title = label;
    v.button.setAttribute('aria-label', label);
  });
}

// Sends a friend to a decoration: onto the bench or the blanket, beside the others.
function walkTo(v, d) {
  const at = placement(d.kind, d),
    dw = at.w,
    width = sizeOf(v.pet),
    side = v.px + width / 2 < at.x ? -1 : 1,
    on = standOn(d.kind),
    x = on ? at.x + (Math.random() - 0.5) * dw * 0.4 : at.x + side * (dw / 2 + width * 0.3),
    y = at.y + (on ? 3 : 0);
  sendTo(v, footTarget(v, x, y), { slow: true, arrive: () => visited(v, d.kind) });
}
function visit(id) {
  const d = data.garden?.decor.find(x => x.id === id);
  if (!d || game) return;
  const at = fieldToYard(d),
    v = nearestFree(at.x, at.y);
  if (v) walkTo(v, d);
}
/** Now and then an idle friend goes to a decoration instead of strolling: the target, or null. */
export function decorTarget(v) {
  const decor = data.garden?.decor || [];
  if (!decor.length || Math.random() > 0.25) return null;
  walkTo(v, pick(decor));
  return v.target;
}
// A friend reached the decoration it went to.
function visited(v, kind) {
  effectsVisited(giftKind(kind)?.effects, { cue });
  if (kind && Math.random() < 0.6) bubble(v, pick(list(`decor.visit_${kind}`)), 3000);
}

// Put away at once with a moment to undo it (props.js); a friend may bring it again another day,
// and a memento goes back into the gift box instead.
function putAway(id) {
  const d = data.garden?.decor.find(x => x.id === id),
    view = shown.get(id);
  if (!d || !view) return;
  // With the box full a memento goes as any gift does (garden.rs put_away).
  const boxed = d.memento && (data.garden.boxed?.length ?? 0) < limit(data, 'giftBox');
  const done = t(boxed ? 'decor.memento_put_away' : 'decor.put_away_done', { kind: kindName(d.kind) });
  removeWithUndo(id, view, done, () => call('putAway', id));
}

// A friend brings a gift on its own: an everyday one every other day, from a friend the person
// did something with that day, and one for each level it grows closer (its memento at 4). A gift
// that finds the yard full waits in the gift box (album.js). The wait for the next everyday gift
// is the backend's (garden giftWait), so a restart keeps it.
const GIFT_RETRY_MS = 60 * 1000;
// A thanks gift comes a little after the level it is for, and never two at once.
const THANKS_AFTER = [60 * 1000, 3 * 60 * 1000];
const thanking = cadence(() => between(Math.random, THANKS_AFTER));
let bringing = false,
  retryAt = 0;
// A thanks gift the backend refused (friend id:level) is not asked for again until the page reloads.
const refused = new Set();
const togetherToday = (id, day) => data.bonds?.[id]?.day === day && data.bonds[id].today > 0;
const full = g => (g.decor?.length ?? 0) >= limit(data, 'decor') && (g.boxed?.length ?? 0) >= limit(data, 'giftBox');
// The level a friend brings its next thanks gift for: the one after the last it brought, so a
// level reached while the yard and the box were full still comes. A friend with none brought yet
// brings one for where it is (it may have been close before thanks gifts began).
function thanksLevel(g, id) {
  const level = levelOf(id),
    had = g.thanked?.[id];
  return had === undefined ? level : Math.min(level, had + 1);
}

/** When the next everyday gift may come: the saved wait, or a new one saved now. */
function giftDueAt(g, now, today) {
  const after = g.giftDay || '',
    first = !g.received?.length,
    saved = g.giftWait;
  // A clock correction keeps the wait bounded instead of retaining a far-future deadline, and a
  // wait from an earlier day starts again, so a gift never comes the moment someone plays.
  const longest = first ? FIRST_GIFT : GIFT_WAIT[1];
  if (
    saved?.after === after &&
    Number.isSafeInteger(saved.dueAt) &&
    saved.dueAt <= now + longest &&
    localDay(new Date(saved.dueAt)) >= today
  )
    return saved.dueAt;
  const dueAt = Math.ceil(now + giftWait(Math.random, first));
  // Kept here at once so the next frame does not ask again before the backend's state comes back.
  g.giftWait = { after, dueAt };
  call('waitForGift', after, dueAt).catch(() => {});
  return dueAt;
}

/** Called by the frame loop while the yard is seen and no game is on; deadlines use wall time. */
export function giftTick() {
  const g = data.garden;
  if (!g || bringing || full(g)) return;
  const now = Date.now(),
    today = localDay(new Date(now));
  if (now < retryAt || !giftDue(g.giftDay, today, limit(data, 'giftEveryDays'))) return;
  // The wait starts once the person has done something with a friend that day.
  const together = [...views.values()].filter(v => togetherToday(v.pet.id, today));
  if (!together.length || now < giftDueAt(g, now, today)) return;
  const free = together.filter(isFree);
  if (!free.length) return;
  const v = pick(free);
  // During a seasonal event, the gift is its own the first time (the backend checks the dates).
  const ask = at => call('receiveGift', at.x, at.y, today, scene.event, v.pet.id);
  bring(v, ask, { say: 'decor.gift', detail: 'decor.brought' }).then(ok => {
    if (ok) befriend(v.pet.id, 'gift');
    // A failed save must not replay the gift and its request on every frame.
    else retryAt = Date.now() + GIFT_RETRY_MS;
  });
}

/** Called by the frame loop beside giftTick: a friend that grew closer brings a gift for its level. */
export function thanksTick(now) {
  const g = data.garden;
  if (!g || bringing || full(g) || !thanking.due(now)) return;
  const v = [...views.values()].find(v => {
    const level = thanksLevel(g, v.pet.id);
    return isFree(v) && level > (g.thanked?.[v.pet.id] ?? 1) && !refused.has(`${v.pet.id}:${level}`);
  });
  if (!v) return;
  const level = thanksLevel(g, v.pet.id);
  const ask = at => call('thanksGift', v.pet.id, level, at.x, at.y);
  bring(v, ask, { say: 'decor.gift_thanks', detail: 'decor.brought_thanks' }).then(ok => {
    if (!ok) refused.add(`${v.pet.id}:${level}`);
  });
}

// A friend sets a gift down beside it (`ask` gets the spot and asks the backend) and says `say`;
// the card says `detail`, or where it went. Resolves to whether it came.
function bring(v, ask, { say, detail }) {
  rest(v);
  // Set down beside the friend, on the side with more room.
  const width = sizeOf(v.pet),
    right = v.px + width / 2 < field().width / 2,
    at = yardToField(v.px + width / 2 + (right ? 1 : -1) * width * 0.9, v.py + petHeight(v.pet));
  bringing = true;
  const seen = new Set(data.garden?.received || []);
  return ask(at)
    .then(d => {
      cheer(v, d.memento ? 'decor.gift_memento' : say, { mark: '', say: 3500 });
      if (!d.boxed) {
        fresh.add(d.id);
        renderDecor();
      }
      cue('gift');
      effect(v, d.memento ? '♥' : '✦');
      const gift = giftKind(d.kind),
        said = { name: name(v.pet), kind: kindName(d.kind) };
      const card = d.boxed ? 'decor.brought_boxed' : d.memento ? 'decor.brought_memento' : detail;
      if (gift) showCard(giftSvg(gift), kindName(d.kind), t(card, said), !seen.has(d.kind), 'gift');
      return true;
    })
    .catch(() => false)
    .finally(() => {
      bringing = false;
    });
}
