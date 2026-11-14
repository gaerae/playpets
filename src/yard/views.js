// Friends as they stand in the yard: where they are, how big, what they say and show.

import { agentsOf } from '../core/agents.js';
import { lookAt, renewsClock } from '../core/animation.js';
import { put, putAttribute } from '../core/dom.js';
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
  readingTime,
  recall,
  remember,
  selected,
  views,
} from '../core/state.js';
import { agentStateOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { halt, moveTo } from '../core/ticker.js';
import {
  depthAt,
  depthScale,
  dockBox,
  EDGE,
  field,
  footOf,
  footTarget,
  geometry,
  measureYard,
  petHeight,
  sizeOf,
  TAG_ROOM,
  underDock,
} from './field.js';
import { hint } from './hint.js';
import { beginDrag, dragPoint, endDrag } from './props.js';
import { release, rest } from './trips.js';

// The yard's dot is about agent work; see core/status.js.
const agentState = p => agentStateOf(data, p.id);

// What a press on a friend means is decided above the yard (by a game, or the panel);
// setupViews hands it in, so the yard needs nothing from those modules.
let on = { gameTap() {}, select() {}, openChat() {}, friendMenu: null, patted() {}, resized() {} };
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
/** A friend looks toward `look` (pixels from its middle, as a pointer's lookAt) for `ms`: drawn while
 * it stands idle, on a sheet with look rows. A look set meanwhile (the pointer's) is left alone. */
export function gaze(v, look, ms) {
  v.look = look;
  setTimeout(() => {
    if (v.look === look) v.look = null;
  }, ms);
}
// Bubbles show plain words: an answer's Markdown marks are taken out.
// Space kept between two bubbles when one rises above the other.
const BUBBLE_GAP = 4;
// A bubble that would cover a friend's bubble already showing rises just above it (--bubble-lift,
// friends.css), so two friends talking at once both stay readable. Where there is no room above (a
// small window, friends near its top) the newer line takes the place of the ones it would cover,
// and no bubble starts above the window, where nobody could read it.
function clearOthers(v) {
  if (!v.bubble.getBoundingClientRect) return;
  const mine = v.bubble.getBoundingClientRect();
  const top = ((globalThis.document && $('yard'))?.getBoundingClientRect?.().top || 0) + BUBBLE_EDGE;
  const covered = [];
  let lift = 0;
  for (const other of views.values()) {
    if (other === v || other.bubble?.hidden !== false || !other.bubble.getBoundingClientRect) continue;
    const theirs = other.bubble.getBoundingClientRect();
    if (theirs.right <= mine.left || theirs.left >= mine.right) continue;
    if (mine.bottom - lift <= theirs.top || mine.top - lift >= theirs.bottom) continue;
    covered.push(other);
    lift = mine.bottom - theirs.top + BUBBLE_GAP;
  }
  if (covered.length && mine.top - lift < top) {
    for (const other of covered) hush(other);
    lift = 0;
  }
  if (mine.top - lift < top) lift = mine.top - top;
  if (lift) v.bubble.style?.setProperty('--bubble-lift', `${Math.round(lift)}px`);
}
function hush(v) {
  clearTimeout(v.bubbleTimer);
  v.bubble.hidden = true;
  v.bubble.style?.removeProperty('--bubble-lift');
  v.bubble.style?.removeProperty('--bubble-shift');
}
// Room kept between a bubble and either side of the yard.
const BUBBLE_EDGE = 6;
/** How far a bubble `width` pixels wide, centred over a friend at `center`, moves sideways to stay
 * inside a yard `yardWidth` wide, `edge` clear of each side: by the least it can, or onto the yard's
 * middle when it is wider than the room. 0 for a bubble or a yard not laid out yet. */
export function bubbleShift(center, width, yardWidth, edge = BUBBLE_EDGE) {
  if (!(width > 0) || !(yardWidth > 0)) return 0;
  if (width >= yardWidth - edge * 2) return Math.round(yardWidth / 2 - center);
  const left = center - width / 2,
    right = center + width / 2;
  if (left < edge) return Math.round(edge - left);
  if (right > yardWidth - edge) return Math.round(yardWidth - edge - right);
  return 0;
}
// Keeps a bubble that shows inside the yard (--bubble-shift, friends.css). Measured when it is shown
// and when the yard's size changes, not as the friend walks: a line lasts a few seconds.
function keepInside(v) {
  // Hidden, or not laid out (no yard to measure it in): nothing to keep inside. A hidden bubble is
  // ruled out before its width is read, so a resize does not lay out every friend's empty bubble.
  if (v.bubble.hidden || !v.pet) return;
  const width = v.bubble.offsetWidth;
  if (!(width > 0)) return;
  const shift = bubbleShift(v.px + sizeOf(v.pet) / 2, width, field().width);
  if (shift) v.bubble.style?.setProperty('--bubble-shift', `${shift}px`);
  else v.bubble.style?.removeProperty('--bubble-shift');
}
/** A friend says something above its head for its reading time (or `duration`, if longer); the
 * line is also read aloud, with the friend's name, from one quiet region. With `onPress` the bubble
 * can be pressed (the letter it brought); every other bubble cannot, so none is by accident. */
export function bubble(v, message, duration = 0, onPress = null) {
  if (!message) return;
  const words = plain(message);
  v.bubble.textContent = words;
  // Its own press: the lake or a creature under it is not caught as well.
  v.bubble.onclick = onPress
    ? event => {
        event.stopPropagation();
        onPress();
      }
    : null;
  v.bubble.classList?.toggle('acts', !!onPress);
  v.bubble.hidden = false;
  v.bubble.style?.removeProperty('--bubble-lift');
  keepInside(v);
  clearOthers(v);
  const said = globalThis.document && $('friend-speech');
  if (said && v.pet) said.textContent = `${name(v.pet)}: ${words}`;
  clearTimeout(v.bubbleTimer);
  v.bubbleTimer = setTimeout(() => hush(v), Math.max(duration, readingTime(words)));
}
/** A friend's reaction to something it did: a pose, a mark above it (✦, ♥ or none) and one of the
 * lines under `lines` in the string tables. */
export function cheer(v, lines, { as = 'jump', ms = 1100, mark = '✦', say = 3000 } = {}) {
  pose(v, as, ms);
  if (mark) effect(v, mark);
  bubble(v, pick(list(lines)), say);
}
// Sizes a friend's body, canvas and label for its size, and stands it where it is. The sizes are
// written only when the size changed or the yard was resized (`resized`): a push that leaves them
// as they were writes nothing, and keeps the depth place() last wrote. `box` is the dock (dockBox),
// measured once for every friend.
function fit(v, box, resized = false) {
  const size = sizeOf(v.pet),
    height = petHeight(v.pet);
  const sized = resized || v.fitted !== `${size}|${height}`;
  if (sized) {
    v.fitted = `${size}|${height}`;
    v.button.style.width = `${size}px`;
    v.canvas.style.width = `${size}px`;
    v.canvas.style.height = `${height}px`;
    v.label.style.width = `${size}px`;
    // The body's room in the label follows the friend's depth (place).
    v.depth = null;
  }
  place(v);
  clearOfDock(v, box);
  if (sized) keepInside(v);
}
/** Lifts a friend standing behind the dock to stand just above it, with its name tag, in view: one
 * saved at the front edge before friends walked past the field's foot, one dropped there, or one the
 * dock grew over. `box` is the dock (dockBox), when the caller has measured it for many friends. */
export function clearOfDock(v, box = dockBox()) {
  if (!box) return;
  const foot = footOf(v);
  if (!underDock(foot.x, foot.y, sizeOf(v.pet) / 2, box)) return;
  v.y = footTarget(v, foot.x, box.top - TAG_ROOM, 0).y;
  place(v);
}
/** Sets the friend's body and label where it stands (v.x, v.y). With `glide`, the frame loop's own
 * step of a walk or a parade, it glides there (GLIDE_MS); anything else puts it there at once. */
export function place(v, { glide = false } = {}) {
  const { w, h, top } = geometry(v.pet, v.x);
  v.px = EDGE + v.x * w;
  v.py = top + v.y * h;
  // The body goes by translate, so its depth (scale, below) shrinks it about its feet and not its
  // place; the canvas inside keeps transform for a press, a tilt or a step. A held friend follows
  // the pointer, and with reduced motion nothing glides.
  const ms = glide && !v.drag && !reduced.matches ? GLIDE_MS : 0;
  moveTo(v.button, 'translate', [v.px, v.py], ms);
  // Nearer the bottom is nearer the viewer: drawn on top, in front of what stands behind it. By
  // its feet, as the garden's plants and gifts in the same layer are (depthAt). Written only when
  // it changes: this runs every frame a friend moves.
  const height = petHeight(v.pet),
    z = depthAt(v.py + height);
  if (v.z !== z) {
    v.z = z;
    v.button.style.zIndex = String(z);
  }
  // Farther back is smaller, about the feet, and so is where it is pressed. The tag stays its size
  // under the feet: the label starts where the shrunk body does, its body room shrinks with it, and
  // what sits on the head (the line, a petal) goes by the head shrunk the same
  // way (--depth, friends.css). Rounded, so a step does not write it again.
  const depth = Math.round(depthScale(v.y) * 100) / 100;
  if (v.depth !== depth) {
    v.depth = depth;
    v.button.style.scale = String(depth);
    v.label.style.setProperty('--depth', String(depth));
    if (v.body) v.body.style.height = `${height * depth}px`;
  }
  moveTo(v.label, 'transform', [v.px, v.py + height * (1 - depth)], ms);
  stackLabel(v);
}
// A friend the frame loop moves (a walk, a parade) glides from one step to the next (core/ticker.js
// moveTo), over a little longer than the loop's 50 ms step, and longer after a step that came late
// (glideFor), so a late step never shows a stop. Each step asks for it (place's `glide`): a choice left on the friend would carry over to a
// place from anything between two steps, which would then slide instead of jump.
export const GLIDE_MS = 64;
/** Turns a friend toward the pointer that last moved over it (`v.pointer`), called by the frame
 * loop before it draws the friend. Its box is read here, once a frame at most: a pointer moves far
 * more often than the yard draws, and each read lays the page out. */
export function followPointer(v) {
  if (!v.pointer) return;
  v.look = lookAt(v.button.getBoundingClientRect(), v.pointer.x, v.pointer.y);
  v.pointer = null;
}
/** Stops a friend's glide at once where it was going, as a press takes it. */
export function unglide(v) {
  halt(v.button);
  halt(v.label);
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
  put(v.tagName, 'textContent', tagName(v, v.pet));
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
  tag.append(talkMark, tagName, dot, tagBond, agents);
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
  label.append(bubble, thinking, body, tag);
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
    // Set by the features that use them: a game (away, speed, frozen, frozenUntil; play.js), flower
    // viewing (away too, seat, the place it walks to, and viewing, { side, look } while it stands
    // there; viewing.js), a petal on its head (petal, the node, and petalTimer, its notice; petals.js,
    // taken off by trips.js brushPetal) and closeness (bondLevel, the hearts last drawn; bond.js).
    away: false,
    speed: 0,
    frozen: false,
    frozenUntil: 0,
    seat: null,
    viewing: null,
    petal: null,
    petalTimer: null,
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
    unglide(v);
    v.drag = beginDrag(e.currentTarget, e, v, {
      talk: onTag(e),
      foot: footOf(v),
      toField: (px, py) => footTarget(v, px, py, 0),
    });
    e.stopPropagation();
  });
  both('pointermove', e => {
    if (v.drag) {
      const { w, h } = geometry(v.pet),
        at = dragPoint(v.drag, e, w, h);
      if (at) {
        v.x = at.x;
        v.y = at.y;
        pose(v, e.clientX >= v.drag.startX ? 'right' : 'left', 200);
        place(v);
      }
    } else v.pointer = { x: e.clientX, y: e.clientY };
  });
  both('pointerleave', () => {
    v.pointer = null;
    v.look = null;
  });
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
    const { moved, talk, x, y } = endDrag(v, e.currentTarget, e);
    if (e.type === 'pointercancel') {
      v.x = x;
      v.y = y;
      place(v);
      return;
    }
    if (moved) {
      clearOfDock(v);
      await call('updatePet', p.id, { x: v.x, y: v.y });
    } else if (talk && e.type === 'pointerup') {
      // The tag says "Talk to …", so it opens the conversation; play is the friend's right-click.
      on.openChat(p.id);
    } else await pat();
  });
  both('pointerup', end);
  both('pointercancel', end);
  // A double-click is two pats: the yard is for being together, and talking is a choice made on
  // the friend's menu or its tag, not something a quick second click opens.
  // A friend's right-click offers what can be done with it: talk, or play.
  both('contextmenu', e => {
    e.preventDefault();
    on.select(p.id);
    (on.friendMenu || ((id, _point) => on.openChat(id)))(p.id, { x: e.clientX, y: e.clientY });
  });
  button.addEventListener(
    'keydown',
    guard(async e => {
      // A held key repeats; a pat, a game tap or the menu is one press.
      if (e.repeat && !e.key.startsWith('Arrow')) return;
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
      // A Mac keyboard has no menu key, and this is every platform's other way to the same menu.
      if (e.key === 'F10' && e.shiftKey && on.friendMenu) {
        e.preventDefault();
        on.select(p.id);
        const { left, bottom } = button.getBoundingClientRect();
        on.friendMenu(p.id, { x: left, y: bottom });
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        // Moved by hand, it stops where it was headed (a trip would put it back where it was going).
        release(v);
        v.x = clamp(v.x + (e.key === 'ArrowRight' ? 0.04 : e.key === 'ArrowLeft' ? -0.04 : 0));
        v.y = clamp(v.y + (e.key === 'ArrowDown' ? 0.04 : e.key === 'ArrowUp' ? -0.04 : 0));
        // As after a drag: the yard draws it there now, and the backend only hears where (no state
        // comes back for a move).
        place(v);
        await call('updatePet', p.id, { x: v.x, y: v.y });
      }
    }),
  );
  return v;
}
// What a friend's body and label say: its name, its agents, its agent's state, whether it is the one
// talked with or answering. Written only where it differs.
function labelView(v, p) {
  // One agent is named on the tag; more are counted. The full list is the tooltip, also for one
  // agent whose name the tag cuts.
  const agents = agentsOf(data, p.id);
  labelTag(v);
  put(v.agents, 'textContent', agents.length > 1 ? `${agents[0]} +${agents.length - 1}` : agents[0] || '');
  put(v.agents, 'hidden', !agents.length);
  put(v.agents, 'title', joinList(agents));
  put(v.tag, 'title', t('friend.talk', { name: name(p) }));
  const state = agentState(p);
  // The dot's colour is said in words too, for anyone who cannot see it.
  putAttribute(
    v.button,
    'aria-label',
    state === 'idle'
      ? t('yard.pat_name', { name: name(p) })
      : t('yard.pat_name_state', { name: name(p), state: labels[state] }),
  );
  v.button.classList.toggle('selected', p.id === selected);
  v.button.classList.toggle('thinking', data.busy.includes(p.id));
  if (state === 'done' && v.dot.dataset.state && v.dot.dataset.state !== 'done') effect(v, '✦');
  put(v.dot, 'hidden', state === 'idle');
  put(v.dot.dataset, 'state', state);
  put(v.dot, 'title', state === 'idle' ? '' : labels[state] || '');
}
// Brings the yard in line with the backend: friends that left go, new ones appear, the rest update.
// It runs on every push, mostly with nothing changed: what is written is written only when it differs.
export function syncViews() {
  // The dock, measured once for every friend and before anything here is written: a read after a
  // write lays the page out again.
  const box = dockBox();
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
    // A friend at a spot for its agent (the front, a desk) stands away from its own place (duty.js).
    if (!v.drag && !v.target && !v.away && !v.spot) {
      v.x = p.x;
      v.y = p.y;
    }
    labelView(v, p);
    fit(v, box);
  }
}
/** Draws one friend's label again, as its agent's status changed: a hook sends one on every tool the
 * agent uses, and the rest of the yard is as it was. */
export function syncView(id) {
  const v = views.get(id),
    p = data.pets.find(q => q.id === id);
  if (v && p) labelView(v, p);
}
// `handlers`: gameTap(view), select(id), openChat(id), patted(id) after a pat, and resized() once
// the yard changes size.
// Called once, by app.js.
export function setupViews(handlers) {
  on = handlers;
  new ResizeObserver(() => {
    measureYard();
    on.resized();
    const box = dockBox();
    for (const v of views.values()) fit(v, box, true);
  }).observe($('yard'));
}
