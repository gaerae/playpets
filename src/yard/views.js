// Friends as they stand in the yard: where they are, how big, what they say and show.

import { agentsOf } from '../core/agents.js';
import { lookAt, renewsClock } from '../core/animation.js';
import { joinList, list, t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { clamp, pick } from '../core/math.js';
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
import { hint } from './hint.js';
import { release, rest } from './trips.js';

// The yard's dot is about agent work; see core/status.js.
const agentState = p => agentStateOf(data, p.id);

// What a press on a friend means is decided above the yard (by a game, or the panel);
// setupViews hands it in, so the yard needs nothing from those modules.
let on = { gameTap() {}, select() {}, openChat() {}, openActions: null, patted() {}, resized() {} };
// A little burst above the friend: hearts for a pat, sparkles for a treat, one mark for a game.
// Each piece drifts its own way (--dx, --rot) and starts a beat after the last.
const BURST = { '♥': 3, '✦': 3 };
export function effect(view, text) {
  if (reduced.matches) return;
  const count = BURST[text] || 1;
  for (let i = 0; i < count; i++) {
    const node = document.createElement('span');
    node.className = 'particle';
    node.dataset.kind = text === '♥' ? 'heart' : text === '✦' ? 'spark' : text === '!' ? 'notice' : 'mark';
    node.textContent = node.dataset.kind === 'mark' ? text : '';
    node.setAttribute('aria-hidden', 'true');
    const origin = node.dataset.kind === 'notice' ? sizeOf(view.pet) + 10 : sizeOf(view.pet) / 2;
    node.style.left = `${view.px + origin + (i - (count - 1) / 2) * 14}px`;
    node.style.top = `${Math.max(4, view.py - 12)}px`;
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
function fit(v) {
  const size = sizeOf(v.pet);
  v.button.style.width = `${size}px`;
  v.canvas.style.width = `${size}px`;
  v.canvas.style.height = `${petHeight(v.pet)}px`;
  v.label.style.width = `${size}px`;
  v.body.style.height = `${petHeight(v.pet)}px`;
  place(v);
}
export function place(v) {
  const { w, h, top } = geometry(v.pet);
  v.px = EDGE + v.x * w;
  v.py = top + v.y * h;
  const at = `translate(${v.px}px,${v.py}px)`;
  v.button.style.transform = at;
  v.label.style.transform = at;
  // Nearer the bottom is nearer the viewer: drawn on top, in front of what stands behind it (the
  // garden's plants and gifts share the layer and the scale). Written only when it changes: this
  // runs every frame a friend moves.
  const z = 1 + Math.round(v.y * 100);
  if (v.z !== z) {
    v.z = z;
    v.button.style.zIndex = String(z);
  }
  stackLabel(v);
}
// Labels are a layer above everything on the field, in the same order, the selected friend's first.
function stackLabel(v) {
  const lz = v.z + (v.button.classList.contains('selected') ? 200 : 0);
  if (v.lz !== lz) {
    v.lz = lz;
    v.label.style.zIndex = String(lz);
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
// A friend is two elements moved together: its body (a button among the garden's things, so what
// stands in front of it covers it) and its label (bubble, tag and the agent's dot, in the layer
// above, so nothing covers them). The label wears the body's state classes, mirrored as they
// change; `pointing` and `focused` stand for the body's :hover and :focus-visible.
function mirror(v) {
  const marks = v.button.className.replace('yard-pet', '').trim();
  v.label.className = `pet-label${marks ? ` ${marks}` : ''}`;
  // A friend picked from the Friend tab's list stands still: its label comes first here, not in place().
  if (v.z !== undefined) stackLabel(v);
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
  const talkMark = document.createElement('span'),
    tagName = document.createElement('span'),
    tagBond = document.createElement('span'),
    agents = document.createElement('small');
  talkMark.className = 'tag-talk';
  talkMark.innerHTML = '<span data-icon="spark"></span>';
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
  const label = document.createElement('div'),
    body = document.createElement('i');
  label.dataset.id = p.id;
  // The body button already says the name and state; the label is what the eye reads.
  label.setAttribute('aria-hidden', 'true');
  body.className = 'label-body';
  label.append(bubble, thinking, body, tag, dot);
  button.append(c);
  $('pet-layer').append(button);
  $('label-layer').append(label);
  const v = {
    button,
    label,
    body,
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
    nextWander: 0,
    // Set by the features that use them: a game (away, speed, frozen, frozenUntil; play.js) and
    // closeness (bondLevel, the hearts last drawn; bond.js).
    away: false,
    speed: 0,
    frozen: false,
    frozenUntil: 0,
    bondLevel: 0,
  };
  rest(v);
  v.mirror = new MutationObserver(() => mirror(v));
  v.mirror.observe(button, { attributes: true, attributeFilter: ['class'] });
  mirror(v);
  button.addEventListener('pointerenter', () => button.classList.add('pointing'));
  button.addEventListener('pointerleave', () => button.classList.remove('pointing'));
  button.addEventListener('focus', () => button.classList.toggle('focused', button.matches(':focus-visible')));
  button.addEventListener('blur', () => button.classList.remove('focused'));
  // The body gives a little under a press and springs back (the canvas, not the tag or bubble).
  // A press, drag or click on the tag is one on the friend, as when the tag hung under the body.
  const unpress = () => button.classList.remove('pressed');
  const both = (type, handler) => {
    button.addEventListener(type, handler);
    tag.addEventListener(type, handler);
  };
  both('pointerup', unpress);
  both('pointercancel', unpress);
  both('pointerdown', e => {
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
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    e.stopPropagation();
  });
  both('pointermove', e => {
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
  both('pointerleave', () => (v.look = null));
  // A pat, by pointer or keyboard. Once someone has patted a friend, the line above the yard stops
  // saying how.
  const pat = async () => {
    if (!recall('patted')) {
      remember('patted', '1');
      hint();
    }
    on.patted(p.id);
    await call('play', 'pet', p.id);
  };
  const end = guard(async e => {
    if (!v.drag) return;
    const { moved, talk, x, y } = v.drag;
    v.drag = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (e.type === 'pointercancel') {
      v.x = x;
      v.y = y;
      place(v);
      return;
    }
    if (moved) {
      await call('updatePet', p.id, { x: v.x, y: v.y });
    } else if (talk && e.type === 'pointerup') {
      // The tag says "Talk to …", so it opens the conversation; play is the friend's right-click.
      on.openChat(p.id);
    } else await pat();
  });
  both('pointerup', end);
  both('pointercancel', end);
  both('dblclick', () => {
    if (!game) on.openChat(p.id);
  });
  // Play stays beside the friend; conversation remains an explicit destination.
  both('contextmenu', e => {
    e.preventDefault();
    on.select(p.id);
    (on.openActions || on.openChat)(p.id);
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
        await pat();
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        // Moved by hand, it stops where it was headed (a trip would put it back where it was going).
        release(v);
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
      v.mirror.disconnect();
      v.button.remove();
      v.label.remove();
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
    v.agents.title = agents.length > 1 ? joinList(agents) : '';
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
