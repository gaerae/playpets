// Decorations friends bring as gifts, one a day: a bench, a lantern, a birdhouse, a little pond, a
// mailbox, a picnic blanket. A friend sets the day's gift down beside it; the person drags it
// wherever they like, or puts it away from its menu (right-click, or Delete). Friends visit them
// on their own and say something that fits. The backend keeps them and decides which gift comes
// next (src-tauri/src/pets/garden.rs); when one is due is in growth.js. Drawn once, like plants:
// nothing here moves on its own, and the lantern's glow is a still layer the evening shows.

import { confirmAction } from '../core/confirm.js';
import { list, t } from '../core/i18n.js';
import { clamp, pick } from '../core/math.js';
import { $, aiming, call, data, game, guard, name, views } from '../core/state.js';
import { befriend } from './bond.js';
import { showCard } from './card.js';
import { GIFTS } from './catalog.js';
import { giftSvg } from './creatures.js';
import { giftWait, localDay } from './growth.js';
import { cue } from './sound.js';
import {
  bubble,
  effect,
  field,
  fieldToYard,
  footTarget,
  nearestFree,
  petHeight,
  pose,
  rest,
  sizeOf,
  yardToField,
} from './views.js';

// How many yard pixels a unit of a decoration's drawing (catalog.js GIFTS) takes at full size; it
// shrinks with the yard as friends do.
const VIEW = Object.fromEntries(GIFTS.map(g => [g.id, g.view]));
const UNIT = 1.05;
// Flat things lie on the ground, under the plants; friends stand on the bench and the blanket.
const FLAT = new Set(['pond', 'picnic']);
const ON = new Set(['bench', 'picnic']);
const shown = new Map();
// Gifts that just came, shown with a little pop the first time they are drawn.
const fresh = new Set();
let scale = 1;
const kindName = kind => t(`decor.kind_${kind}`);

function size(kind) {
  const [w, h] = VIEW[kind] || [40, 40];
  return { w: w * UNIT * scale, h: h * UNIT * scale };
}
function position(v, x, y) {
  const at = fieldToYard({ x, y }),
    { w, h } = size(v.kind);
  v.button.style.width = `${w}px`;
  v.button.style.height = `${h}px`;
  v.button.style.transform = `translate(${at.x - w / 2}px,${at.y - h}px)`;
  v.button.style.zIndex = String(FLAT.has(v.kind) ? 0 : 1 + Math.round(y * 100));
}

function create(d) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'decor';
  button.dataset.kind = d.kind;
  const [w, h] = VIEW[d.kind] || [40, 40];
  button.innerHTML = `${d.kind === 'lantern' ? '<span class="glow"></span>' : ''}<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><use href="#decor-${d.kind}"/></svg>`;
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
  $('garden-layer').append(button);
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
  const decor = data.garden?.decor || [];
  for (const [id, v] of shown)
    if (!decor.some(d => d.id === id)) {
      v.button.remove();
      shown.delete(id);
    }
  scale = clamp(field().height / 560, 0.5, 1);
  for (const d of decor) {
    let v = shown.get(d.id);
    if (!v) {
      v = create(d);
      shown.set(d.id, v);
      if (fresh.delete(d.id)) v.button.classList.add('arrive');
    }
    if (!v.drag?.moved) position(v, d.x, d.y);
    const label = t('decor.title', { kind: kindName(d.kind) });
    v.button.title = label;
    v.button.setAttribute('aria-label', label);
  }
}

// Sends a friend to a decoration: onto the bench or the blanket, beside the others.
function walkTo(v, d, kind) {
  const at = fieldToYard(d),
    { w: dw } = size(d.kind),
    width = sizeOf(v.pet),
    side = v.px + width / 2 < at.x ? -1 : 1,
    x = ON.has(d.kind) ? at.x + (Math.random() - 0.5) * dw * 0.4 : at.x + side * (dw / 2 + width * 0.3),
    y = at.y + (ON.has(d.kind) ? 3 : 0);
  v.target = footTarget(v, x, y);
  v.targetKind = kind;
  v.visiting = d.kind;
}
function visit(id) {
  const d = data.garden?.decor.find(x => x.id === id);
  if (!d || game) return;
  const at = fieldToYard(d),
    v = nearestFree(at.x, at.y);
  if (v) walkTo(v, d, 'decor');
}
/** Now and then an idle friend goes to a decoration instead of strolling: the target, or null. */
export function decorTarget(v) {
  const decor = data.garden?.decor || [];
  if (!decor.length || Math.random() > 0.25) return null;
  walkTo(v, pick(decor), 'decor');
  return v.target;
}
/** Called when a friend reaches the decoration it went to. */
export function decorVisited(v) {
  const kind = v.visiting;
  v.visiting = null;
  if (kind && Math.random() < 0.6) bubble(v, pick(list(`decor.visit_${kind}`)), 3000);
}

const putAway = guard(async id => {
  const d = data.garden?.decor.find(x => x.id === id);
  if (!d) return;
  const kind = kindName(d.kind);
  const sure = await confirmAction({
    title: t('decor.put_away_confirm', { kind }),
    body: t('decor.put_away_body'),
    action: t('decor.put_away'),
  });
  if (sure) await call('putAway', id);
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
  if (g.giftDay === today || (g.decor?.length ?? 0) >= (data.limits?.decor ?? 8)) return;
  if (day !== today) {
    day = today;
    dueAt = now + giftWait(Math.random, !g.received?.length);
  }
  if (now < dueAt) return;
  const free = [...views.values()].filter(v => !v.drag && !v.away && !v.target);
  if (!free.length) return;
  const v = pick(free);
  rest(v);
  pose(v, 'jump', 1100);
  bubble(v, pick(list('decor.gift')), 3500);
  // Set down beside the friend, on the side with more room.
  const width = sizeOf(v.pet),
    right = v.px + width / 2 < field().width / 2,
    at = yardToField(v.px + width / 2 + (right ? 1 : -1) * width * 0.9, v.py + petHeight(v.pet));
  bringing = true;
  const seen = new Set(g.received || []);
  call('receiveGift', at.x, at.y, today)
    .then(d => {
      fresh.add(d.id);
      renderDecor();
      befriend(v.pet.id, 'gift');
      cue('gift');
      effect(v, '✦');
      const gift = GIFTS.find(g => g.id === d.kind);
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
