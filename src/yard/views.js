// Friends as they stand in the yard: where they are, how big, what they say and show.

import { agentsOf } from '../core/agents.js';
import { lookAt, renewsClock } from '../core/animation.js';
import { list, t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { between, clamp, pick } from '../core/math.js';
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
import { EDGE, geometry, measureYard, petHeight, sizeOf } from './field.js';
import { WANDER_DELAY } from './wander.js';

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
/** A friend's reaction to something it did: a pose, a mark above it (✦, ♥ or none) and one of the
 * lines under `lines` in the string tables. */
export function cheer(v, lines, { as = 'jump', ms = 1100, mark = '✦', say = 3000 } = {}) {
  pose(v, as, ms);
  if (mark) effect(v, mark);
  bubble(v, pick(list(lines)), say);
}
export const rest = v => {
  v.nextWander = performance.now() + between(Math.random, WANDER_DELAY);
};
function fit(v) {
  const size = sizeOf(v.pet);
  v.button.style.width = `${size}px`;
  v.canvas.style.width = `${size}px`;
  v.canvas.style.height = `${petHeight(v.pet)}px`;
  place(v);
}
// A friend's trip: where it is headed (`v.target`, its place 0 to 1 each way) and `v.trip`, what
// happens there: { arrive(v, now), cancel(v), save, slow }. While it does something where it stands
// (fishing), `v.doing` is { end(v) }. Whatever takes a friend (a press, a game, another trip, the
// friend leaving) lets go of both first, so the owner of a trip or a task always hears it ended.
/** Sends a friend to `target`: `arrive(v, now)` runs when it gets there and `cancel(v)` if something
 * else takes it first; the place it ends at is kept unless `save` is false; `slow` strolls, and a
 * game gives its own `speed`. */
export function sendTo(v, target, { arrive, cancel, save = true, slow = false, speed = 0 } = {}) {
  release(v);
  v.target = target;
  v.trip = { arrive, cancel, save, slow };
  v.speed = speed;
}
/** Lets go of whatever a friend was on its way to or doing, telling their owners. */
export function release(v) {
  const { trip, doing } = v;
  v.target = null;
  v.trip = null;
  v.doing = null;
  trip?.cancel?.(v);
  doing?.end?.(v);
}
/** Free to be sent somewhere: not held, not on its way, not in a game, not busy where it stands. */
export const isFree = v => !v.drag && !v.target && !v.away && !v.doing;
/** The free friend nearest a point in the yard. */
export function nearestFree(px, py) {
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    if (!isFree(v)) continue;
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
    tagBond = document.createElement('span'),
    agents = document.createElement('small');
  talkMark.className = 'tag-talk';
  talkMark.innerHTML = '<span data-icon="chat"></span>';
  icons(talkMark);
  tagName.className = 'tag-name';
  // Hearts for how close this friend is (yard/bond.js fills them in; the Friend panel says it in words).
  tagBond.className = 'tag-bond';
  tagBond.setAttribute('aria-hidden', 'true');
  agents.hidden = true;
  tag.append(talkMark, tagName, tagBond, agents);
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
    tagBond,
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
    trip: null,
    doing: null,
    drag: null,
    look: null,
    nextWander: performance.now() + between(Math.random, WANDER_DELAY),
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
    release(v);
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
      on.patted?.(p.id);
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
        on.patted?.(p.id);
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
      release(v);
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
  // What a click or a drag does, until the first pat; then that the lake can be fished, until it
  // has been (yard/catch.js). Agent work has its own place.
  const first = !data.pets.length ? '' : !recall('patted') ? 'hint.pat' : recall('fished') !== '1' ? 'hint.fish' : '';
  $('yard-hint').textContent = first ? t(first) : '';
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
// `handlers`: gameTap(view), select(id), openChat(id), patted(id) after a pat, and resized() once
// the yard changes size.
// Called once, by app.js.
export function setupViews(handlers) {
  on = handlers;
  new ResizeObserver(() => {
    measureYard();
    on.resized();
    for (const v of views.values()) fit(v);
  }).observe($('yard'));
}
