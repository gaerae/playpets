// Friends as they stand in the yard: where they are, how big, what they say and show.

import { agentsOf } from '../core/agents.js';
import { lookAt, renewsClock } from '../core/animation.js';
import { t } from '../core/i18n.js';
import { clamp } from '../core/math.js';
import { canvas, reduced } from '../core/sprites.js';
import { $, aiming, asset, call, data, game, guard, labels, name, selected, views } from '../core/state.js';
import { agentStateOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { delay, WANDER_DELAY } from './wander.js';

// What a press on a friend means is decided above the yard (by a game, or the panel);
// setupViews hands it in, so the yard needs nothing from those modules.
let on = { gameTap() {}, select() {}, openChat() {}, resized() {} };
// A little burst above the friend: hearts for a pat, sparkles for a treat, one mark for a game.
// Each piece drifts its own way (--dx, --rot) and starts a beat after the last.
const BURST = { '♥': 3, '✦': 3 };
export function effect(view, text) {
  if (reduced.matches) return;
  const count = BURST[text] || 1;
  for (let i = 0; i < count; i++) {
    const node = document.createElement('span');
    node.className = 'particle';
    node.dataset.kind = text === '♥' ? 'heart' : text === '✦' ? 'spark' : 'mark';
    node.textContent = text;
    node.style.left = `${view.px + sizeOf(view.pet) / 2 + (i - (count - 1) / 2) * 14}px`;
    node.style.top = `${view.py + sizeOf(view.pet) / 3}px`;
    node.style.setProperty('--dx', `${(Math.random() - 0.5) * 36}px`);
    node.style.setProperty('--rot', `${(Math.random() - 0.5) * 40}deg`);
    node.style.animationDelay = `${i * 90}ms`;
    node.style.fontSize = `${i === 0 ? 23 : 15 + Math.random() * 6}px`;
    $('yard').append(node);
    setTimeout(() => node.remove(), 1400 + i * 90);
  }
}
// Renewing the pose a friend is already in (every step of a walk) must not restart its animation.
export function pose(view, state, duration = 1200) {
  const now = performance.now();
  if (renewsClock(view.pose, state, view.until, now)) view.since = now;
  view.pose = state;
  view.until = now + duration;
}
// Bubbles show plain words: an answer's Markdown marks are taken out.
export function bubble(v, message, duration = 6000) {
  if (!message) return;
  v.bubble.textContent = plain(message);
  v.bubble.hidden = false;
  clearTimeout(v.bubbleTimer);
  v.bubbleTimer = setTimeout(() => (v.bubble.hidden = true), duration);
}
export const rest = v => {
  v.nextWander = performance.now() + delay(Math.random, WANDER_DELAY);
};
// Friends stand on the field: y=0 is the ridge, y=1 the front edge of the yard.
// They shrink with the yard, so a small window still reads as a whole scene.
export const FIELD_TOP = 0.6;
let zoom = 1;
export const sizeOf = p => p.size * zoom;
export const petHeight = p => (sizeOf(p) * 208) / 192;
function fit(v) {
  const size = sizeOf(v.pet);
  v.button.style.width = `${size}px`;
  v.canvas.style.width = `${size}px`;
  v.canvas.style.height = `${petHeight(v.pet)}px`;
  place(v);
}
// The yard's size is measured when it changes, not every time a friend takes a step.
const yardSize = { width: 0, height: 0 };
function measure() {
  const r = $('yard').getBoundingClientRect();
  yardSize.width = r.width;
  yardSize.height = r.height;
}
export function geometry(p) {
  if (!yardSize.width) measure();
  const r = yardSize,
    top = Math.max(12, r.height * FIELD_TOP - petHeight(p));
  return { w: Math.max(1, r.width - sizeOf(p) - 28), top, h: Math.max(1, r.height - petHeight(p) - 42 - top) };
}
export function place(v) {
  const { w, h, top } = geometry(v.pet);
  v.px = 14 + v.x * w;
  v.py = top + v.y * h;
  v.button.style.transform = `translate(${v.px}px,${v.py}px)`;
}
// The name on the tag, which says so when the friend is the tagger in a game.
const tagName = (v, p) => (v.button.classList.contains('tagger') ? t('game.tagger_name', { name: name(p) }) : name(p));
/** Rewords the tag after the tagger changed; the rest of the tag (agents) stays. */
export function labelTag(v) {
  const first = v.tag.firstChild;
  if (first && first.nodeType === Node.TEXT_NODE) first.textContent = tagName(v, v.pet);
  else v.tag.prepend(tagName(v, v.pet));
}
function createView(p) {
  const button = document.createElement('button');
  button.className = 'yard-pet';
  button.dataset.id = p.id;
  const c = canvas(),
    tag = document.createElement('span'),
    dot = document.createElement('span'),
    bubble = document.createElement('span'),
    thinking = document.createElement('span');
  tag.className = 'pet-tag';
  dot.className = 'pet-state-dot';
  bubble.className = 'yard-bubble';
  bubble.hidden = true;
  thinking.className = 'yard-thinking';
  thinking.setAttribute('aria-hidden', 'true');
  thinking.append(...[0, 1, 2].map(() => document.createElement('i')));
  button.append(bubble, thinking, c, tag, dot);
  $('pet-layer').append(button);
  const v = {
    button,
    canvas: c,
    tag,
    dot,
    bubble,
    bubbleTimer: null,
    pet: p,
    x: p.x,
    y: p.y,
    px: 0,
    py: 0,
    pose: 'idle',
    since: performance.now(),
    until: 0,
    target: null,
    targetKind: null,
    drag: null,
    look: null,
    nextWander: performance.now() + delay(Math.random, WANDER_DELAY),
  };
  // The body gives a little under a press and springs back (the canvas, not the tag or bubble).
  const unpress = () => button.classList.remove('pressed');
  button.addEventListener('pointerup', unpress);
  button.addEventListener('pointercancel', unpress);
  button.addEventListener('pointerdown', e => {
    if (e.button !== 0 || aiming) return;
    button.classList.add('pressed');
    if (game) {
      e.stopPropagation();
      on.gameTap(v);
      return;
    }
    on.select(p.id);
    v.target = null;
    v.targetKind = null;
    rest(v);
    v.drag = { startX: e.clientX, startY: e.clientY, x: v.x, y: v.y, moved: false };
    button.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });
  button.addEventListener('pointermove', e => {
    if (v.drag) {
      const dx = e.clientX - v.drag.startX,
        dy = e.clientY - v.drag.startY;
      if (Math.hypot(dx, dy) > 5) v.drag.moved = true;
      if (v.drag.moved) {
        const { w, h } = geometry(v.pet);
        v.x = clamp(v.drag.x + dx / w);
        v.y = clamp(v.drag.y + dy / h);
        pose(v, dx >= 0 ? 'right' : 'left', 200);
        place(v);
      }
    } else {
      v.look = lookAt(button.getBoundingClientRect(), e.clientX, e.clientY);
    }
  });
  button.addEventListener('pointerleave', () => (v.look = null));
  const end = guard(async e => {
    if (!v.drag) return;
    const moved = v.drag.moved;
    v.drag = null;
    if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
    if (moved) {
      await call('updatePet', p.id, { x: v.x, y: v.y });
    } else {
      await call('play', 'pet', p.id);
    }
  });
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('dblclick', () => {
    if (!game) on.openChat(p.id);
  });
  button.addEventListener(
    'keydown',
    guard(async e => {
      if (game) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          on.gameTap(v);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        on.select(p.id);
        await call('play', 'pet', p.id);
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const patch = {
          x: clamp(v.x + (e.key === 'ArrowRight' ? 0.04 : e.key === 'ArrowLeft' ? -0.04 : 0)),
          y: clamp(v.y + (e.key === 'ArrowDown' ? 0.04 : e.key === 'ArrowUp' ? -0.04 : 0)),
        };
        await call('updatePet', p.id, patch);
      }
    }),
  );
  return v;
}
// Brings the yard in line with the backend: friends that left go, new ones appear, the rest update.
export function syncViews() {
  for (const [id, v] of views)
    if (!data.pets.some(p => p.id === id)) {
      v.button.remove();
      views.delete(id);
    }
  for (const p of data.pets) {
    let v = views.get(p.id);
    if (!v) {
      v = createView(p);
      views.set(p.id, v);
    }
    v.pet = p;
    v.asset = asset(p);
    if (!v.drag && !v.target && !v.away) {
      v.x = p.x;
      v.y = p.y;
    }
    // One agent is named on the tag; more are counted, and the full list is the tooltip.
    const agents = agentsOf(data, p.id);
    const agentLabel = agents.length > 1 ? `${agents[0]} +${agents.length - 1}` : agents[0];
    v.tag.replaceChildren(
      tagName(v, p),
      ...(agentLabel ? [Object.assign(document.createElement('small'), { textContent: agentLabel })] : []),
    );
    v.tag.title = agents.length > 1 ? agents.join(' · ') : '';
    v.button.setAttribute('aria-label', t('yard.pat_name', { name: name(p) }));
    v.button.classList.toggle('selected', p.id === selected);
    v.button.classList.toggle('thinking', data.busy.includes(p.id));
    const state = agentState(p);
    if (state === 'done' && v.dot.dataset.state && v.dot.dataset.state !== 'done') effect(v, '✦');
    v.dot.hidden = state === 'idle';
    v.dot.dataset.state = state;
    v.dot.title = state === 'idle' ? '' : labels[state] || '';
    fit(v);
  }
}
// The yard's dot and summary are about agent work; see core/status.js.
const agentState = p => agentStateOf(data, p.id);
// The one line above the yard that says what is going on, or what a press will do.
export function hint() {
  if (game) {
    $('yard-hint').textContent = game.hint;
    return;
  }
  if (aiming) {
    $('yard-hint').textContent = t('hint.treat');
    return;
  }
  // With nobody in the yard there is nothing to press; the card in the middle says what to do.
  if (!data.pets.length) {
    $('yard-hint').textContent = '';
    return;
  }
  const states = data.pets.map(agentState);
  const working = states.filter(s => s === 'working').length;
  const waiting = states.filter(s => s === 'waiting').length;
  const busyPet = data.pets.find(p => ['working', 'waiting'].includes(agentState(p)));
  // One busy friend is named; several are counted, like a status board.
  $('yard-hint').textContent =
    working + waiting > 1
      ? t('yard.busy_summary', { working, waiting })
      : busyPet
        ? `${name(busyPet)} · ${labels[agentState(busyPet)]}`
        : t('hint.pat');
}
// `handlers`: gameTap(view), select(id), openChat(id), and resized() once the yard changes size.
// Called once, by app.js.
export function setupViews(handlers) {
  on = handlers;
  new ResizeObserver(() => {
    measure();
    zoom = clamp(yardSize.height / 560, 0.35, 1);
    on.resized();
    for (const v of views.values()) fit(v);
  }).observe($('yard'));
}
