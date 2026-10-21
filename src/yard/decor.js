// Decorations friends bring as gifts, one a day: a bench, a lantern, a birdhouse, a little pond, a
// mailbox, a picnic blanket (what there is, how each is drawn and its effects: catalog.json). A friend sets the day's gift down beside it; the person drags it
// wherever they like, or puts it away from its menu (right-click, or Delete). Friends visit them
// on their own and say something that fits. The backend keeps them and decides which gift comes
// next (src-tauri/src/pets/garden.rs); when one is due is in growth.js. Drawn once, like plants:
// nothing here moves on its own, and the lantern's glow is a still layer the evening shows.

import { list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { clamp, pick } from '../core/math.js';
import { aiming, call, data, game, guard, name, recall, remember, views } from '../core/state.js';
import { artSvg } from './art.js';
import { befriend } from './bond.js';
import { showCard } from './card.js';
import { giftKind } from './catalog.js';
import { giftSvg } from './creatures.js';
import { effectLayers, effectsVisited } from './effects.js';
import { EDGE, field, fieldToYard, footTarget, petHeight, sizeOf, yardToField } from './field.js';
import { FIRST_GIFT, GIFT_WAIT, giftWait, localDay } from './growth.js';
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
    const label = t('decor.title', { kind: kindName(d.kind) });
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

// Put away at once with a moment to undo it (props.js); a friend may bring it again another day.
function putAway(id) {
  const d = data.garden?.decor.find(x => x.id === id),
    view = shown.get(id);
  if (!d || !view) return;
  removeWithUndo(id, view, t('decor.put_away_done', { kind: kindName(d.kind) }), () => call('putAway', id));
}

// The deadline follows this profile's last gift, so closing the app keeps its progress.
let progressKey = '',
  progress = null,
  bringing = false;
const GIFT_RETRY_MS = 60 * 1000;
function keepGiftProgress(key, value) {
  remember(key, JSON.stringify(value));
  if (key === progressKey) progress = value;
}
function giftDeadline(garden, now) {
  const folder = data.petFolders?.downloaded,
    key = `gift-progress:${typeof folder === 'string' && folder ? folder : 'default'}`,
    after = garden.giftDay || '';
  if (progressKey !== key || progress?.after !== after) {
    progressKey = key;
    progress = null;
    try {
      const saved = JSON.parse(recall(key));
      if (
        saved?.after === after &&
        Number.isSafeInteger(saved.dueAt) &&
        saved.dueAt >= 0 &&
        (saved.retry === undefined || typeof saved.retry === 'boolean')
      )
        progress = saved;
    } catch {
      // A malformed browser record cannot prevent a gift from being scheduled.
    }
  }
  const first = !garden.received?.length,
    maxWait = progress?.retry ? GIFT_RETRY_MS : first ? FIRST_GIFT : GIFT_WAIT[1];
  // A clock correction keeps the wait bounded instead of retaining a far-future deadline.
  if (!progress || progress.dueAt > now + maxWait) {
    const wait = progress?.retry ? GIFT_RETRY_MS : giftWait(Math.random, first);
    keepGiftProgress(key, { after, dueAt: Math.ceil(now + wait), retry: progress?.retry === true });
  }
  return progress;
}
/** Called by the frame loop while the yard is seen and no game is on; deadlines use wall time. */
export function giftTick() {
  const g = data.garden;
  if (!g || bringing) return;
  const now = Date.now(),
    today = localDay(new Date(now));
  if (g.giftDay >= today) return;
  const pending = giftDeadline(g, now);
  if ((g.decor?.length ?? 0) >= limit(data, 'decor') || now < pending.dueAt) return;
  const free = [...views.values()].filter(isFree);
  if (!free.length) return;
  const v = pick(free);
  rest(v);
  // Set down beside the friend, on the side with more room.
  const width = sizeOf(v.pet),
    right = v.px + width / 2 < field().width / 2,
    at = yardToField(v.px + width / 2 + (right ? 1 : -1) * width * 0.9, v.py + petHeight(v.pet));
  bringing = true;
  const key = progressKey,
    seen = new Set(g.received || []);
  // During a seasonal event, today's gift is its own the first time (the backend checks the dates).
  call('receiveGift', at.x, at.y, today, scene.event)
    .then(d => {
      cheer(v, 'decor.gift', { mark: '', say: 3500 });
      fresh.add(d.id);
      renderDecor();
      befriend(v.pet.id, 'gift');
      cue('gift');
      effect(v, '✦');
      const gift = giftKind(d.kind);
      if (gift)
        showCard(
          giftSvg(gift),
          kindName(d.kind),
          t('decor.brought', { name: name(v.pet), kind: kindName(d.kind) }),
          !seen.has(d.kind),
          'gift',
          v.button,
        );
    })
    .catch(() => {
      // A failed save must not replay the gift and its request on every frame.
      keepGiftProgress(key, { after: pending.after, dueAt: Date.now() + GIFT_RETRY_MS, retry: true });
    })
    .finally(() => {
      bringing = false;
    });
}
