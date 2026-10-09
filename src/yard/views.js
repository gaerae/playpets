// Friends as they stand in the yard: where they are, how big, what they say and show.

import { agentsOf } from '../core/agents.js';
import { lookAt, renewsClock } from '../core/animation.js';
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { clamp } from '../core/math.js';
import { canvas, reduced } from '../core/sprites.js';
import {
  $,
  aiming,
  asset,
  call,
  data,
  game,
  guard,
  labels,
  name,
  recall,
  remember,
  selected,
  views,
} from '../core/state.js';
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
// How much friends shrink in a yard of this size. By the height, so a small window still reads as a
// whole scene; a strip (much wider than tall, like a bar along the screen's edge) gives the sky
// away and keeps the friends larger, and a narrow column keeps them from crowding each other.
export function zoomFor(width, height) {
  const strip = width > height * 3;
  return clamp(Math.min(height / (strip ? 380 : 560), width / 640), 0.35, 1);
}
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
// Room kept at each side of the yard, so a friend at the edge is still whole.
const EDGE = 14;
// Room kept at the foot of the yard for a friend's name tag, and for the tools floating over the
// scene (in the mini view they only rise under the pointer, so the tag's room is enough).
const footRoom = () => (document.body.classList.contains('mini') ? 42 : 76);
/** The field friends and plants stand on, in yard pixels: its width, the ridge (top) and the
 * front edge (bottom) a foot can reach. */
export function field() {
  if (!yardSize.width) measure();
  const { width, height } = yardSize;
  return { width, height, top: height * FIELD_TOP, bottom: height - footRoom() };
}
export function geometry(p) {
  if (!yardSize.width) measure();
  const r = yardSize,
    top = Math.max(12, r.height * FIELD_TOP - petHeight(p));
  return {
    w: Math.max(1, r.width - sizeOf(p) - EDGE * 2),
    top,
    h: Math.max(1, r.height - petHeight(p) - footRoom() - top),
  };
}
/** A place on the field (0 to 1 each way, as plants and decorations keep it) in yard pixels. */
export function fieldToYard({ x, y }) {
  const f = field();
  return { x: EDGE + x * Math.max(1, f.width - EDGE * 2), y: f.top + y * Math.max(1, f.bottom - f.top) };
}
/** A point in the yard, in pixels, as a place on the field. */
export function yardToField(px, py) {
  const f = field();
  return {
    x: clamp((px - EDGE) / Math.max(1, f.width - EDGE * 2)),
    y: clamp((py - f.top) / Math.max(1, f.bottom - f.top)),
  };
}
/** Where a friend heads (its place, 0 to 1 each way) so that its feet come to (px, py) in the yard. */
export function footTarget(v, px, py, lift = 4) {
  const { w, h, top } = geometry(v.pet);
  return { x: clamp((px - EDGE - sizeOf(v.pet) / 2) / w), y: clamp((py - top - petHeight(v.pet) + lift) / h) };
}
/** The friend nearest a point in the yard that is free to walk over (not held, not on its way somewhere). */
export function nearestFree(px, py) {
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    if (v.drag || v.target || v.away) continue;
    const d = Math.hypot(v.px + sizeOf(v.pet) / 2 - px, v.py + petHeight(v.pet) - py);
    if (d < bestD) [best, bestD] = [v, d];
  }
  return best;
}
export function place(v) {
  const { w, h, top } = geometry(v.pet);
  v.px = EDGE + v.x * w;
  v.py = top + v.y * h;
  v.button.style.transform = `translate(${v.px}px,${v.py}px)`;
  // Nearer the bottom is nearer the viewer: drawn on top, so its tag and its clicks are not covered.
  // The selected friend stays above the rest. Written only when it changes: this runs every frame.
  const z = 1 + Math.round(v.y * 100) + (v.button.classList.contains('selected') ? 200 : 0);
  if (v.z !== z) {
    v.z = z;
    v.button.style.zIndex = String(z);
  }
}
// The name on the tag, which says so when the friend is the tagger in a game.
const tagName = (v, p) => (v.button.classList.contains('tagger') ? t('game.tagger_name', { name: name(p) }) : name(p));
/** Rewords the tag after the tagger changed; the rest of the tag (agents) stays. */
export function labelTag(v) {
  v.tagName.textContent = tagName(v, v.pet);
}
// The tag is also the way to talk: under the pointer it shows a speech mark, and a click on it
// (not a drag) opens the conversation, as the name button does on the desktop.
const onTag = e => !!e.target.closest?.('.pet-tag');
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
  const talkMark = document.createElement('span'),
    tagName = document.createElement('span'),
    agents = document.createElement('small');
  talkMark.className = 'tag-talk';
  talkMark.innerHTML = '<span data-icon="chat"></span>';
  icons(talkMark);
  tagName.className = 'tag-name';
  agents.hidden = true;
  tag.append(talkMark, tagName, agents);
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
    tagName,
    agents,
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
    v.drag = { startX: e.clientX, startY: e.clientY, x: v.x, y: v.y, moved: false, talk: onTag(e) };
    // A press that is not a live pointer (a script's) has nothing to capture.
    try {
      button.setPointerCapture(e.pointerId);
    } catch {}
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
    const { moved, talk } = v.drag;
    v.drag = null;
    if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
    if (moved) {
      await call('updatePet', p.id, { x: v.x, y: v.y });
    } else if (talk && e.type === 'pointerup') {
      on.openChat(p.id);
    } else {
      // Once someone has patted a friend, the line above the yard stops saying how.
      if (!recall('patted')) {
        remember('patted', '1');
        hint();
      }
      await call('play', 'pet', p.id);
    }
  });
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('dblclick', () => {
    if (!game) on.openChat(p.id);
  });
  // Right-click chats too, as on the desktop, so one gesture works in both places.
  button.addEventListener('contextmenu', e => {
    e.preventDefault();
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
    labelTag(v);
    v.agents.textContent = agents.length > 1 ? `${agents[0]} +${agents.length - 1}` : agents[0] || '';
    v.agents.hidden = !agents.length;
    v.agents.title = agents.length > 1 ? agents.join(' · ') : '';
    v.tag.title = t('friend.talk', { name: name(p) });
    const state = agentState(p);
    // The dot's colour is said in words too, for anyone who cannot see it.
    v.button.setAttribute(
      'aria-label',
      state === 'idle'
        ? t('yard.pat_name', { name: name(p) })
        : t('yard.pat_name_state', { name: name(p), state: labels[state] }),
    );
    v.button.classList.toggle('selected', p.id === selected);
    v.button.classList.toggle('thinking', data.busy.includes(p.id));
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
  agentSummary();
  if (game) {
    $('yard-hint').textContent = game.hint;
    return;
  }
  if (aiming) {
    $('yard-hint').textContent = t(aiming === 'seed' ? 'hint.plant' : 'hint.treat');
    return;
  }
  // What a click or a drag does, until the first pat; agent work has its own place.
  $('yard-hint').textContent = data.pets.length && !recall('patted') ? t('hint.pat') : '';
}
// Agent work beside the friend count: one busy friend is named, several are counted, like a
// status board.
function agentSummary() {
  const states = data.pets.map(agentState);
  const working = states.filter(s => s === 'working').length;
  const waiting = states.filter(s => s === 'waiting').length;
  const busyPet = data.pets.find(p => ['working', 'waiting'].includes(agentState(p)));
  const text =
    working + waiting > 1
      ? t('yard.busy_summary', { working, waiting })
      : busyPet
        ? `${name(busyPet)} · ${labels[agentState(busyPet)]}`
        : '';
  $('agent-summary').textContent = text ? ` · ${text}` : '';
}
// `handlers`: gameTap(view), select(id), openChat(id), and resized() once the yard changes size.
// Called once, by app.js.
export function setupViews(handlers) {
  on = handlers;
  new ResizeObserver(() => {
    measure();
    zoom = zoomFor(yardSize.width, yardSize.height);
    on.resized();
    for (const v of views.values()) fit(v);
  }).observe($('yard'));
}
