// Fruit under a grown fruit tree in its harvest season (the rules are tree-moment-rules.js's): now
// and then, in fair hours, a tree with a harvest moment drops its fruit at its foot: a chestnut its
// burr, a persimmon or a fig its fruit. At most two lie under a tree and three in a place, each for
// six hours, until it is picked, its tree is pulled up or moved, or the season changes.
//
// - Each fruit keeps its place: only the shown place's fruit is drawn, and the others wait, so
//   going away and coming back finds the same fruit where it was.
//
// - Checked with the scene, once a minute (app.js seasonChanged), and drawn again with the garden
//   (render.js, and the yard's resize, land and place changes). Nothing runs in the frame loop.
// - Fruit drops only while the yard is seen (app.js `visible`), so its fall is seen; unseen, fruit
//   whose time is over still goes.
// - Kept in the webview's storage, not in state.json, as the spring shoots are: a few short-lived
//   things, and the day's first pick of each fruit. Nothing is counted and nothing is rewarded.
// - What falls, its title and the friend's lines are the tree's harvest moment's (catalog.json):
//   `art`, `size`, `title` and `lines`.
// - It falls from the lower edge of the tree's crown, faster as it goes, bounces once a little and
//   settles (garden.css); with reduced motion it is simply there, and can be picked all the same.
// - A click on one sends a friend to pick it up, with no digging: it walks to stand beside the fruit,
//   which rises toward its paws and fades while the friend shows its "found it" pose (or a little
//   jump); then it says a happy line, the day's first pick of that fruit a line of its own. With
//   reduced motion the fruit simply goes.
import { animationSpec } from '../core/animation.js';
import { playCompanionAction, prepareCompanionAction } from '../core/companion-actions.js';
import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { aiming, data, game, recall, remember, views } from '../core/state.js';
import { artHref } from './art.js';
import { errands, friendFor } from './errands.js';
import { depthAt, depthScaleAt, fieldToYard, footOf, footTarget, petHeight, sizeOf, yardToDecor } from './field.js';
import { groundProfile } from './ground.js';
import { localDay } from './growth.js';
import { treeBox, treeFoot } from './planted-trees.js';
import { propButton, propScale, reconcile, setDown } from './props.js';
import { shootScale } from './shoot-rules.js';
import {
  fruitDue,
  fruitFall,
  fruitHere,
  fruitSpot,
  fruitStays,
  harvestOf,
  keptFruit,
  momentTrees,
  pickLine,
} from './tree-moment-rules.js';
import { release, rest, sendTo } from './trips.js';
import { thingGone } from './veil.js';
import { bubble, pose } from './views.js';
import { holdAtWork, stopWork } from './work.js';
import { scene } from './world.js';

const NS = 'http://www.w3.org/2000/svg';
// The webview's storage key. Only `picked` and `out` are stored: the wait starts again with each
// start.
const KEY = 'fallen-fruit';
// The record: { next, picked, out }; null until setupFruit has read it, so a look at the yard before
// that (the sky's first paint) cannot write over the stored one.
let kept = null;
// The fruit just dropped, until the look that dropped it draws it: only these fall as they come.
const made = new Set();
// The buttons on the yard, by fruit id.
const shown = new Map();
// The fruit friends are on their way to or picking up: fruit id → the task ({ v, end }).
const picks = errands(shown);
// Whether the yard is seen (setupFruit).
let seen = () => true;
/** How long picked fruit takes to rise toward the friend's paws and fade (garden.css fruit-lift). */
export const FRUIT_LIFT_MS = 600;
// A friend picking fruit up stands this share of its width beside it; the fruit rises this share of
// the way across to the friend's middle and up to its paws, this share of its height above its feet.
const BESIDE = 0.55;
const TOWARD = 0.45;
const PAWS = 0.42;
// The little jump of a friend with no "found it" pose of its own.
const JUMP_MS = Math.round(animationSpec('jump').seconds * 1000);

/** Whether a friend is going for fallen fruit or picking it up (a flower viewing or a visit waits). */
export const fruitPicking = () => picks.busy();

/** Reads the fallen fruit back from the webview's storage (app.js, before the sky first paints).
 * `visible` says whether the yard is seen: the window shown and not minimized. */
export function setupFruit({ visible = () => true } = {}) {
  seen = visible;
  for (const v of shown.values()) {
    v.button.remove();
    thingGone(v.button);
  }
  shown.clear();
  made.clear();
  kept = keptFruit(recall(KEY), Date.now());
}

// The record as stored.
const save = ({ picked, out }) => remember(KEY, JSON.stringify({ picked, out }));
// The tree fruit lies under, its kind and that kind's harvest.
const treeOf = fruit => data.garden?.trees?.find(tree => tree.id === fruit.tree);
const kindUnder = fruit => treeOf(fruit)?.kind;
// The fruit lying in every place as it is now, and in the place shown.
const lying = now =>
  kept ? fruitStays(kept.out, { trees: data.garden?.trees, season: scene.season, now, limits: data.limits }) : [];
const here = now => fruitHere(lying(now), scene.world);

/** One look at the yard, at each repaint of the scene: fruit whose time, season or tree is gone
 * goes, and, while the yard is seen, fruit that is due drops in the place shown. */
export function fruitMinute(now = new Date()) {
  if (!kept) return;
  const ms = now.getTime(),
    still = lying(ms);
  let next = { ...kept, out: still.length === kept.out.length ? kept.out : still };
  // Unseen, nothing drops: no fall goes unwatched, and the wait and the room are left for when the
  // yard is seen again.
  if (seen()) next = drop(next, ms);
  if (next.out !== kept.out) save(next);
  kept = next;
  renderFruit(fruitHere(next.out, scene.world));
}

// The record after fruit that is due drops under a harvest tree in the place shown, if any is.
function drop(record, ms) {
  const trees = momentTrees(data.garden?.trees, scene, ms, data.limits).filter(tree => tree.moment.kind === 'harvest'),
    due = fruitDue(record, trees, ms, Math.random, scene.world);
  if (!due.tree) return due.kept;
  // Under the tree as it is drawn, which stays whole at the yard's sides.
  const drawn = treeFoot(due.tree),
    spot = fruitSpot(
      Math.random,
      groundProfile(),
      { ...due.tree, ...yardToDecor(drawn.x, drawn.y) },
      fruitHere(due.kept.out, scene.world),
      due.tree.moment.size[0],
    );
  if (!spot) return due.kept;
  // Where the tree stands, so moving it takes its fruit along (fruitStays).
  const fruit = {
    id: String(ms),
    tree: due.tree.id,
    world: scene.world,
    x: spot.x,
    y: spot.y,
    treeX: due.tree.x,
    treeY: due.tree.y,
    at: ms,
  };
  made.add(fruit.id);
  return { ...due.kept, out: [...due.kept.out, fruit] };
}

function create(fruit) {
  const kind = kindUnder(fruit),
    harvest = harvestOf(kind),
    button = propButton('fallen-fruit', kind),
    svg = document.createElementNS(NS, 'svg'),
    use = document.createElementNS(NS, 'use');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${harvest.size.join(' ')}`);
  use.setAttribute('href', artHref(harvest.art));
  svg.append(use);
  button.append(svg);
  button.title = t(harvest.title);
  button.setAttribute('aria-label', button.title);
  // Fruit dropped in this run falls as it comes (with reduced motion it is simply there); landed, it
  // lies like any other, so nothing holds the fall's last frame over a pick's dimming or lift, and
  // nothing starts the fall again.
  if (made.delete(fruit.id) && !reduced.matches) {
    button.classList.add('dropped');
    button.addEventListener('animationend', event => {
      if (event.animationName === 'fruit-drop') button.classList.remove('dropped');
    });
  }
  // With a tool in hand or in a game the press is the yard's (garden.css lets it through).
  button.addEventListener('click', event => {
    if (aiming || game) return;
    event.stopPropagation();
    pickFruit(fruit.id);
  });
  return { button };
}

function update(v, fruit) {
  const tree = treeOf(fruit),
    [w, h] = harvestOf(tree?.kind).size,
    { x, y } = fieldToYard(fruit),
    // Smaller farther back, as a friend there is, and no smaller than a spring shoot in a small yard.
    scale = shootScale(propScale()) * depthScaleAt(x, y);
  setDown(v.button, x, y, w * scale, h * scale, depthAt(y));
  // Fruit still falling falls from where the tree's leaves end, as planted-trees.js draws the tree.
  if (tree && v.button.classList.contains('dropped')) {
    const foot = treeFoot(tree);
    v.button.style.setProperty('--fall', `${fruitFall(y, foot.y, treeBox(tree.kind, foot).height)}px`);
  }
  v.button.classList.toggle('picking', picks.has(fruit.id));
}

/** Draws the fallen fruit lying in this place (`list`, when the caller has just worked it out), and
 * lets go of a friend going for fruit that is no longer there (its tree moved or pulled up, its time
 * over), rather than on its arrival. */
export function renderFruit(list = here(Date.now())) {
  reconcile(shown, list, create, update);
  picks.cancelAll(id => !list.some(f => f.id === id));
}

/** Ends every pick a friend is on its way to or at (a new window size or land): the friend is let go
 * and the fruit stays. */
export function cancelFruitPicks() {
  picks.cancelAll();
}

/** Sends a friend to pick up the fallen fruit `id`: the selected friend when it is free, else the
 * nearest free one, else one viewing the blossom or visiting a tree. Returns whether a friend set
 * off. */
export function pickFruit(id) {
  const fruit = kept?.out.find(f => f.id === id);
  if (game || aiming || !fruit || picks.has(id)) return false;
  const spot = fieldToYard(fruit),
    v = friendFor(spot, 'moment.fruit_no_friend');
  if (!v) return false;
  const world = scene.world,
    task = { v, end: null };
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  // The task's one end, however it comes (taken away, another place, a game, done): its timers and
  // pose stop, fruit still rising settles back, and fruit still lying is free to be clicked again.
  const end = () => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    stopWork(v);
    shown.get(id)?.button.classList.remove('lifting');
    picks.finish(id, task);
  };
  task.end = end;
  // Still this pick, by this friend, and the fruit still lying where it was.
  const live = () =>
    picks.get(id) === task &&
    views.get(v.pet.id) === v &&
    scene.world === world &&
    here(Date.now()).some(f => f.id === id);
  prepareCompanionAction(v.asset, 'discover');
  // Beside the fruit, on the side it comes from, so the fruit is at its paws and not under it.
  const side = footOf(v).x < spot.x ? -1 : 1;
  sendTo(v, footTarget(v, spot.x + side * sizeOf(v.pet) * BESIDE, spot.y), {
    cancel: end,
    arrive: () => {
      if (!live()) return end();
      holdAtWork(v, end);
      // Its own "found it" pose (as after a treasure or a catch), else a little jump every pet has.
      const authored = playCompanionAction(v, 'discover');
      if (!authored) pose(v, 'jump', JUMP_MS);
      const lift = reduced.matches ? 0 : FRUIT_LIFT_MS,
        button = shown.get(id)?.button;
      if (lift && button) {
        const feet = footOf(v),
          tall = Number.parseFloat(button.style.height) || 0;
        button.style.setProperty('--lift-x', `${Math.round((feet.x - spot.x) * TOWARD)}px`);
        button.style.setProperty('--lift-y', `${Math.min(-4, Math.round(tall / 2 - petHeight(v.pet) * PAWS))}px`);
        // The lift takes over from a fall not yet over, which must not start again if the pick is
        // called off.
        button.classList.remove('dropped');
        button.classList.add('lifting');
      }
      later(lift, () => {
        if (!live()) return release(v);
        const said = pickLine(kept, kindUnder(fruit), localDay(new Date()));
        kept = { ...said.kept, out: said.kept.out.filter(f => f.id !== id) };
        save(kept);
        picks.finish(id, task);
        renderFruit();
        bubble(v, pick(list(said.key)), 2600);
        later(Math.max(0, (authored?.duration ?? JUMP_MS) - lift), () => {
          release(v);
          rest(v);
        });
      });
    },
  });
  picks.start(id, task);
  return true;
}
