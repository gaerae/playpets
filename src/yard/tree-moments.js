// Tree moments in the yard (the rules are tree-moment-rules.js's): a grown tree whose kind names a
// drift moment has it in its own season, morning to evening, outdoors. A chestnut's harvest is
// burrs.js's.
//
// - Now and then a breeze lifts a gust of petals off the crown (stepGusts): the scenery paints them
//   falling to the foot, lying there and fading (scenery.drift). At most two trees gust at once,
//   each for about ten seconds, so the canvas rests between gusts.
// - With `lines.head`, a friend standing under the crown may get a petal on its head (petals.js
//   landPetal), kept until it moves or the tree's moment is over, and may say so.
// - With `lines.visit`, now and then a free friend walks to the tree, faces it, looks up at the
//   blossom and says a line, then goes back to its own doings.
// - The trees whose moment is on are looked up when the scene is painted, the garden drawn or the
//   yard laid out again (syncTreeMoments); the frame loop's tick does nothing while there are none.
// - Nothing is saved: no counts, no rewards, as for flower viewing.

import { list } from '../core/i18n.js';
import { between, pick } from '../core/math.js';
import { aiming, data, game, views } from '../core/state.js';
import { stateOf } from '../core/status.js';
import { cadence } from '../core/ticker.js';
import { burrPicking } from './burrs.js';
import { treeSize } from './catalog.js';
import { fishingNow } from './catch.js';
import { digging } from './discovery.js';
import { fieldToYard, footOf, footTarget, petHeight, sizeOf } from './field.js';
import { landPetal } from './petals.js';
import { propScale } from './props.js';
import { shootDigging } from './shoots.js';
import { gustPetals, momentTrees, stepGusts, visitX } from './tree-moment-rules.js';
import { isFree, release, rest, sendTo, setDoing, strolling } from './trips.js';
import { viewing } from './viewing.js';
import { bubble, gaze } from './views.js';
import { scene, scenery } from './world.js';

// The gusts are looked at about once a second; a longer gap between two looks means the yard was
// not running (hidden, or a game), and each tree waits its first wait again.
const CHECK_MS = 1000;
const AWAY_MS = 5 * CHECK_MS;
// A breeze this many yard pixels a millisecond sideways, either way.
const WIND = [0.003, 0.007];
// Now and then a petal of a gust lands on a friend under the crown, as the first petals reach it.
const HEAD_CHANCE = 0.6;
const HEAD_AFTER = [2500, 5000];
// A friend now and then visits a tree with a visit line: looked at every few minutes, half the time.
const VISIT_EVERY = [3 * 60_000, 7 * 60_000];
const VISIT_CHANCE = 0.5;
// How long it stands at the tree, when it speaks, and for how long.
const VISIT_MS = 5000;
const LINE_AFTER = 800;
const LINE_MS = 3200;
const LINE_RETRY = 400;

// The drift trees whose moment is on, each with its crown in yard pixels (syncTreeMoments).
let live = [];
// Each tree's gusts (tree-moment-rules.js stepGusts), and when they are next looked at.
let plan = {};
let checkAt = 0;
let lookedAt = 0;
// When a friend next thinks of visiting a tree.
let visiting = cadence(() => between(Math.random, VISIT_EVERY));
// The friend visiting a tree, on its way or there: { v, timers }, or null; and the waiting petal
// timer.
let visitor = null;
let falling = null;
const VISIT = { end: v => leave(v) };

/** Wiring: a fresh plan and wait. Called once, by app.js. */
export function setupTreeMoments() {
  live = [];
  plan = {};
  checkAt = 0;
  lookedAt = 0;
  visiting = cadence(() => between(Math.random, VISIT_EVERY));
  clearTimeout(falling);
  falling = null;
  visitor = null;
}

// A grown tree's crown, foot and size in yard pixels, as planted-trees.js draws it.
function crownOf(tree) {
  const foot = fieldToYard(tree),
    zoom = propScale(foot),
    [w, h] = treeSize(tree.kind, 2);
  return {
    x: foot.x,
    top: foot.y - h * zoom * 0.9,
    bottom: foot.y - h * zoom * 0.45,
    width: w * zoom * 0.8,
    foot: foot.y,
    zoom,
  };
}

/** Looks up the drift trees whose moment is on, with the scene's repaint, a garden change and a new
 * layout. A tree whose moment went (night, rain, another season) leaves the plan, so it waits its
 * first wait again when the moment comes back. */
export function syncTreeMoments() {
  live = momentTrees(data.garden?.trees, scene, Date.now(), data.limits)
    .filter(tree => tree.moment.kind === 'drift')
    .map(tree => ({ ...tree, crown: crownOf(tree) }));
  plan = Object.fromEntries(Object.entries(plan).filter(([id]) => on(id)));
}

/** Called by the frame loop beside the other yard life: the gusts, and now and then a visit. */
export function treeMomentTick(now) {
  if (!live.length) return;
  if (now >= checkAt) {
    if (now - lookedAt > AWAY_MS) plan = {};
    checkAt = now + CHECK_MS;
    lookedAt = now;
    blow(now);
  }
  if (visiting.due(now) && Math.random() < VISIT_CHANCE) visit();
}

function blow(now) {
  const step = stepGusts(
    plan,
    live.map(tree => tree.id),
    now,
    Math.random,
  );
  plan = step.plan;
  for (const id of step.started) {
    const tree = live.find(t => t.id === id),
      { moment, crown } = tree;
    scenery?.drift({
      ...crown,
      colors: moment.colors,
      petals: gustPetals(moment),
      pace: moment.pace,
      petal: moment.petal,
      wind: (Math.random() < 0.5 ? -1 : 1) * between(Math.random, WIND),
      ms: plan[id].until - now,
    });
    if (moment.lines?.head) headPetal(tree);
  }
}

// A tree's moment is still on.
const on = id => live.some(tree => tree.id === id);

// As the first petals reach them, one may land on a friend standing under the crown.
function headPetal(tree) {
  if (falling || Math.random() >= HEAD_CHANCE) return;
  falling = setTimeout(
    () => {
      falling = null;
      if (!on(tree.id)) return;
      const { crown, moment } = tree,
        under = [...views.values()].filter(v => {
          const foot = footOf(v);
          return (
            (isFree(v) || v.viewing) &&
            !v.drag &&
            !v.petal &&
            Math.abs(foot.x - crown.x) <= crown.width / 2 &&
            foot.y >= crown.foot - 30 * crown.zoom &&
            foot.y <= crown.foot + 60 * crown.zoom
          );
        });
      if (under.length)
        landPetal(pick(under), { colors: moment.colors, notice: moment.lines.head, keep: () => on(tree.id) });
    },
    between(Math.random, HEAD_AFTER),
  );
}

// Nothing the person started that a visit would get in the way of.
const busy = () =>
  !!game || !!aiming || fishingNow() || digging() || shootDigging() || burrPicking() || viewing() || !!visitor;

// A free friend with nothing on walks to a tree with a visit line, to the side nearer it. One only
// strolling counts as free, as for flower viewing: friends stroll most of the time, and the visit
// takes the place of the stroll. The walk is the visit already: no second friend is sent while it
// is on its way, and whatever takes it there ends the visit (leave).
function visit() {
  const trees = live.filter(tree => tree.moment.lines?.visit);
  if (!trees.length || busy()) return;
  const free = [...views.values()].filter(v => (isFree(v) || strolling(v)) && stateOf(data, v.pet.id) === 'idle');
  if (!free.length) return;
  const tree = pick(trees),
    v = pick(free),
    { crown } = tree,
    side = footOf(v).x < crown.x ? -1 : 1,
    x = visitX(crown.x, crown.width, sizeOf(v.pet), side);
  sendTo(v, footTarget(v, x, crown.foot + 6 * crown.zoom), {
    slow: true,
    own: true,
    arrive: () => smell(v, tree, side),
    cancel: () => leave(v),
  });
  visitor = { v, timers: new Set() };
  // What the person asks of it comes first (trips.js forPerson).
  v.visiting = true;
}

// At the tree: it faces the blossom and looks up, says a line, and after a while goes on its way.
function smell(v, tree, side) {
  if (visitor?.v !== v || !on(tree.id) || game) return leave(v);
  setDoing(v, VISIT, true);
  // setDoing lets go of the walk without a word to it, so the visit is still this friend's.
  v.visiting = true;
  const look = { x: tree.crown.x - footOf(v).x, y: -petHeight(v.pet) * 1.2 },
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
    if (v.bubble.hidden) bubble(v, pick(list(tree.moment.lines.visit)), LINE_MS);
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
  v.visiting = false;
  v.button.classList.remove('looking-up');
  delete v.button.dataset.tilt;
  if (visitor?.v !== v) return;
  for (const timer of visitor.timers) clearTimeout(timer);
  visitor = null;
}
