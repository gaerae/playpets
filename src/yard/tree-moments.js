// Tree moments in the yard (the rules are tree-moment-rules.js's): a grown tree whose kind names a
// visit moment has it in its own season, morning to evening, outdoors. A fruit tree's harvest is
// fallen-fruit.js's.
//
// - visit: now and then a free friend walks to the tree, faces it, looks up at the blossom and says
//   a line, then goes back to its own doings.
// - The trees whose moment is on are looked up when the scene is painted or the garden changes
//   (syncTreeMoments); the frame loop's tick does nothing while there are none. A tree's crown is
//   worked out when a visit starts; a new size or land ends a visit under way (cancelTreeVisit).
// - Nothing is saved: no counts, no rewards, as for flower viewing.

import { list } from '../core/i18n.js';
import { between, pick } from '../core/math.js';
import { data, game } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { footOf, footTarget, petHeight, sizeOf } from './field.js';
import { treeBox, treeFoot } from './planted-trees.js';
import { CROWN, momentTrees, treeStands, visitX } from './tree-moment-rules.js';
import { release, rest, sendTo, setDoing } from './trips.js';
import { freeFriends, viewing, yardBusy } from './viewing.js';
import { bubble, gaze } from './views.js';
import { scene } from './world.js';

// A friend now and then visits a tree with a visit line: looked at every few minutes, half the time.
const VISIT_EVERY = [3 * 60_000, 7 * 60_000];
const VISIT_CHANCE = 0.5;
// How long it stands at the tree, when it speaks, and for how long.
const VISIT_MS = 5000;
const LINE_AFTER = 800;
const LINE_MS = 3200;
const LINE_RETRY = 400;

// The trees whose visit moment is on (syncTreeMoments).
let live = [];
// When a friend next thinks of visiting a tree.
let visiting = cadence(() => between(Math.random, VISIT_EVERY));
// The friend visiting a tree, on its way or there, and the tree as it stood when the visit began:
// { v, timers, tree }, or null.
let visitor = null;
// Standing at the tree; what the person asks may take it (trips.js forPerson), as on its way there.
const VISIT = { end: v => leave(v), yields: true };

/** Wiring: a fresh wait. Called once, by app.js. */
export function setupTreeMoments() {
  live = [];
  visiting = cadence(() => between(Math.random, VISIT_EVERY));
  visitor = null;
}

// A grown tree's crown (its middle and width; tree-moment-rules.js CROWN), foot and size in yard
// pixels, as planted-trees.js draws it.
function crownOf(tree) {
  const foot = treeFoot(tree),
    { width, zoom } = treeBox(tree.kind, foot);
  return { x: foot.x, width: width * CROWN.wide, foot: foot.y, zoom };
}

/** Looks up the trees whose visit moment is on, with the scene's repaint and a garden change. A
 * friend visiting a tree that has gone or moved is let go, so it never stands looking up where the
 * tree no longer is; a visit whose hour or weather ends only finishes in its own time. */
export function syncTreeMoments() {
  live = momentTrees(data.garden?.trees, scene, Date.now(), data.limits).filter(tree => tree.moment.kind === 'visit');
  if (!visitor) return;
  const { v, tree } = visitor;
  if (!data.garden?.trees?.some(each => each.id === tree.id && treeStands(each, tree))) release(v);
}

/** Ends a visit on its way or at the tree (a new window size or land): its walk and look were worked
 * out in yard pixels. */
export function cancelTreeVisit() {
  if (visitor) release(visitor.v);
}

/** Called by the frame loop beside the other yard life: now and then a visit. */
export function treeMomentTick(now) {
  if (!live.length) return;
  if (visiting.due(now) && Math.random() < VISIT_CHANCE) visit();
}

// A tree's moment is still on.
const on = id => live.some(tree => tree.id === id);

// Nothing the person started that a visit would get in the way of, no gathering, no visit already on.
const busy = () => yardBusy() || viewing() || !!visitor;

// A free friend with nothing on walks to a tree with a visit line, to the side nearer it. One only
// strolling counts as free, as for flower viewing: friends stroll most of the time, and the visit
// takes the place of the stroll. The walk is the visit already: no second friend is sent while it
// is on its way, and whatever takes it there ends the visit (leave).
function visit() {
  if (!live.length || busy()) return;
  const free = freeFriends(true);
  if (!free.length) return;
  const tree = pick(live),
    v = pick(free),
    crown = crownOf(tree),
    side = footOf(v).x < crown.x ? -1 : 1,
    x = visitX(crown.x, crown.width, sizeOf(v.pet), side);
  sendTo(v, footTarget(v, x, crown.foot + 6 * crown.zoom), {
    slow: true,
    own: true,
    arrive: () => smell(v, tree, side),
    cancel: () => leave(v),
    // What the person asks of it comes first (trips.js forPerson).
    yields: true,
  });
  visitor = { v, timers: new Set(), tree };
}

// At the tree: it faces the blossom and looks up, says a line, and after a while goes on its way.
function smell(v, tree, side) {
  // Its hour or weather ended on the way, or a game began: nothing to look up at.
  if (visitor?.v !== v || !on(tree.id) || game) return leave(v);
  // The walk is over (motion.js lets go of the trip before it calls arrive), so setDoing ends nothing.
  setDoing(v, VISIT, true);
  const look = { x: crownOf(tree).x - footOf(v).x, y: -petHeight(v.pet) * 1.2 },
    { timers } = visitor;
  // The blossom is on the other side from where it stands.
  v.button.dataset.tilt = side < 0 ? 'right' : 'left';
  v.button.classList.add('looking-up');
  gaze(v, look, VISIT_MS);
  const later = (ms, fn) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (visitor?.v === v) fn();
    }, ms);
    timers.add(timer);
  };
  // Never over its own words: a friend still saying something says its line once that is done, while
  // it stands there.
  const say = at => {
    if (v.bubble.hidden) bubble(v, pick(list(tree.moment.lines.say)), LINE_MS);
    else if (at + LINE_RETRY < VISIT_MS - LINE_RETRY) later(LINE_RETRY, () => say(at + LINE_RETRY));
  };
  later(LINE_AFTER, () => say(LINE_AFTER));
  later(VISIT_MS, () => {
    release(v);
    rest(v);
  });
}

// Whatever ends the visit or the walk to it (its time, a press, a game, its agent, the person's
// errand): the friend's look up goes, whoever the visit is now, and the visit is over if it was this
// friend's.
function leave(v) {
  v.button.classList.remove('looking-up');
  delete v.button.dataset.tilt;
  if (visitor?.v !== v) return;
  for (const timer of visitor.timers) clearTimeout(timer);
  visitor = null;
}
