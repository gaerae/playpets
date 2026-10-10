// Decorations friends bring as gifts, one a day: a bench, a lantern, a birdhouse, a little pond, a
// mailbox, a picnic blanket (what there is, how each is drawn and its effects: catalog.json). A friend sets the day's gift down beside it; the person drags it
// wherever they like, or puts it away from its menu (right-click, or Delete). Friends visit them
// on their own and say something that fits. The backend keeps them and decides which gift comes
// next (src-tauri/src/pets/garden.rs); when one is due is in growth.js. Drawn once, like plants:
// nothing here moves on its own, and the lantern's glow is a still layer the evening shows.

import { list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { clamp, pick } from '../core/math.js';
import { $, aiming, call, data, game, guard, name, views } from '../core/state.js';
import { artSize, artSvg } from './art.js';
import { befriend } from './bond.js';
import { showCard } from './card.js';
import { giftKind } from './catalog.js';
import { giftSvg } from './creatures.js';
import { effectLayers, effectsVisited } from './effects.js';
import { field, fieldToYard, footTarget, petHeight, sizeOf, yardToField } from './field.js';
import { giftWait, localDay } from './growth.js';
import { askToRemove, propButton, propScale, reconcile, setDown } from './props.js';
import { cue } from './sound.js';
import { isFree, nearestFree, rest, sendTo } from './trips.js';
import { bubble, cheer, effect } from './views.js';
import { scene } from './world.js';

// How many yard pixels a unit of a decoration's drawing takes at full size (its view box is its
// size); it shrinks with the yard as friends do. Whether it lies flat on the ground, under the
// plants ("flat"), and whether friends stand on it or beside it ("stand": "on") is the catalogue's.
const UNIT = 1.05;
const flat = kind => !!giftKind(kind)?.flat;
const standOn = kind => giftKind(kind)?.stand === 'on';
const shown = new Map();
// Gifts that just came, shown with a little pop the first time they are drawn.
const fresh = new Set();
const kindName = kind => t(`decor.kind_${kind}`);

function size(kind) {
  const [w, h] = artSize(giftKind(kind)?.art);
  return { w: w * UNIT * propScale(), h: h * UNIT * propScale() };
}
function position(v, x, y) {
  const at = fieldToYard({ x, y }),
    { w, h } = size(v.kind);
  setDown(v.button, at.x, at.y, w, h, flat(v.kind) ? 0 : 1 + Math.round(y * 100));
}

function create(d) {
  const button = propButton('decor', d.kind),
    gift = giftKind(d.kind),
    effects = gift?.effects || [];
  if (effects.length) button.dataset.effects = effects.join(' ');
  button.innerHTML = `${effectLayers(effects)}${gift ? artSvg(gift.art) : ''}`;
  const v = { id: d.id, kind: d.kind, button, drag: null };
  // Dragging moves it; a press that does not move sends the nearest friend over to it.
  button.addEventListener('pointerdown', e => {
    // Placing a seed or a treat, the press goes through to the field.
    if (e.button !== 0 || aiming) return;
    const r = $('yard').getBoundingClientRect();
    v.drag = { startX: e.clientX, startY: e.clientY, moved: false, rect: r };
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
    drag.at = yardToField(e.clientX - drag.rect.left, e.clientY - drag.rect.top);
    position(v, drag.at.x, drag.at.y);
  });
  const drop = () => {
    const drag = v.drag;
    v.drag = null;
    button.classList.remove('dragging');
    if (!drag) return;
    if (!drag.moved) return visit(v.id);
    if (drag.at) save(v.id, drag.at);
  };
  button.addEventListener('pointerup', drop);
  button.addEventListener('pointercancel', () => {
    v.drag = null;
    button.classList.remove('dragging');
    renderDecor();
  });
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
  if (d) Object.assign(d, at);
  renderDecor();
  await call('moveDecor', id, at.x, at.y);
});

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
  const at = fieldToYard(d),
    { w: dw } = size(d.kind),
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

const putAway = guard(async id => {
  const d = data.garden?.decor.find(x => x.id === id);
  if (!d) return;
  const kind = kindName(d.kind);
  if (await askToRemove(t('decor.put_away_confirm', { kind }), t('decor.put_away_body'), t('decor.put_away')))
    await call('putAway', id);
});

// Today's gift: once the yard has been seen a while today, a friend that is free brings it.
let day = '',
  dueAt = 0,
  bringing = false;
/** Called by the frame loop while the yard is seen and no game is on. */
export function giftTick(now) {
  const g = data.garden;
  if (!g || bringing) return;
  const today = localDay(new Date());
  if (g.giftDay === today || (g.decor?.length ?? 0) >= limit(data, 'decor')) return;
  if (day !== today) {
    day = today;
    dueAt = now + giftWait(Math.random, !g.received?.length);
  }
  if (now < dueAt) return;
  const free = [...views.values()].filter(isFree);
  if (!free.length) return;
  const v = pick(free);
  rest(v);
  cheer(v, 'decor.gift', { mark: '', say: 3500 });
  // Set down beside the friend, on the side with more room.
  const width = sizeOf(v.pet),
    right = v.px + width / 2 < field().width / 2,
    at = yardToField(v.px + width / 2 + (right ? 1 : -1) * width * 0.9, v.py + petHeight(v.pet));
  bringing = true;
  const seen = new Set(g.received || []);
  // During a seasonal event, today's gift is its own the first time (the backend checks the dates).
  call('receiveGift', at.x, at.y, today, scene.event)
    .then(d => {
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
        );
    })
    .catch(() => {
      // Refused (a gift already came today, the yard is full): look again tomorrow.
    })
    .finally(() => {
      bringing = false;
    });
}
