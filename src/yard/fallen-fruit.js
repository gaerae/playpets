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
import { aiming, data, game, recall, remember, selected, toast, views } from '../core/state.js';
import { artHref } from './art.js';
import { treeSize } from './catalog.js';
import { depthAt, depthScaleAt, fieldToYard, footOf, footTarget, petHeight, sizeOf } from './field.js';
import { groundProfile } from './ground.js';
import { localDay } from './growth.js';
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
import { forPerson, release, rest, sendTo } from './trips.js';
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
// The fruit dropped in this run and not drawn yet: only these fall as they come.
const made = new Set();
// The buttons on the yard, by fruit id.
const shown = new Map();
// The fruit friends are on their way to or picking up: fruit id → the task ({ v, end }).
const picks = new Map();
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
export const fruitPicking = () => picks.size > 0;

/** Reads the fallen fruit back from the webview's storage (app.js, before the sky first paints). */
export function setupFruit() {
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
// The kind of tree fruit lies under, and its harvest.
const kindUnder = fruit => data.garden?.trees?.find(tree => tree.id === fruit.tree)?.kind;
const harvestUnder = fruit => harvestOf(kindUnder(fruit));
// The fruit lying in every place as it is now, and in the place shown.
const lying = now =>
  kept ? fruitStays(kept.out, { trees: data.garden?.trees, season: scene.season, now, limits: data.limits }) : [];
const here = now => fruitHere(lying(now), scene.world);

/** One look at the yard, at each repaint of the scene: fruit whose time, season or tree is gone
 * goes, and fruit that is due drops in the place shown. */
export function fruitMinute(now = new Date()) {
  if (!kept) return;
  const ms = now.getTime(),
    still = lying(ms);
  let next = { ...kept, out: still.length === kept.out.length ? kept.out : still };
  const trees = momentTrees(data.garden?.trees, scene, ms, data.limits).filter(tree => tree.moment.kind === 'harvest'),
    due = fruitDue(next, trees, ms, Math.random, scene.world);
  next = due.kept;
  if (due.tree) {
    const ground = groundProfile(),
      spot = fruitSpot(Math.random, ground, due.tree, fruitHere(next.out, scene.world), due.tree.moment.size[0]);
    if (spot) {
      const fruit = { id: String(ms), tree: due.tree.id, world: scene.world, x: spot.x, y: spot.y, at: ms };
      next = { ...next, out: [...next.out, fruit] };
      made.add(fruit.id);
    }
  }
  if (next.out !== kept.out) save(next);
  kept = next;
  for (const id of made) if (!kept.out.some(f => f.id === id)) made.delete(id);
  renderFruit();
}

function create(fruit) {
  const harvest = harvestUnder(fruit),
    button = propButton('fallen-fruit', kindUnder(fruit)),
    svg = document.createElementNS(NS, 'svg'),
    use = document.createElementNS(NS, 'use');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${harvest.size.join(' ')}`);
  use.setAttribute('href', artHref(harvest.art));
  svg.append(use);
  button.append(svg);
  button.title = t(harvest.title);
  button.setAttribute('aria-label', button.title);
  if (made.delete(fruit.id)) button.classList.add('dropped');
  // With a tool in hand or in a game the press is the yard's (garden.css lets it through).
  button.addEventListener('click', event => {
    if (aiming || game) return;
    event.stopPropagation();
    pickFruit(fruit.id);
  });
  return { button };
}

function update(v, fruit) {
  const [w, h] = harvestUnder(fruit).size,
    { x, y } = fieldToYard(fruit),
    // Smaller farther back, as a friend there is, and no smaller than a spring shoot in a small yard.
    scale = shootScale(propScale()) * depthScaleAt(x, y);
  setDown(v.button, x, y, w * scale, h * scale, depthAt(y));
  // Fruit coming now falls from where the tree's leaves end, as planted-trees.js draws the tree.
  const tree = data.garden?.trees?.find(each => each.id === fruit.tree);
  if (tree && v.button.classList.contains('dropped')) {
    const foot = fieldToYard(tree);
    v.button.style.setProperty('--fall', `${fruitFall(y, foot.y, treeSize(tree.kind, 2)[1] * propScale(foot))}px`);
  }
  v.button.classList.toggle('picking', picks.has(fruit.id));
}

/** Draws the fallen fruit lying in this place. */
export function renderFruit() {
  reconcile(shown, here(Date.now()), create, update);
}

// Whether fruit still lies where it was.
const stillOut = (id, world) => scene.world === world && here(Date.now()).some(f => f.id === id);
// The button of fallen fruit, marked while a friend goes for it.
const mark = (id, on) => shown.get(id)?.button.classList.toggle('picking', on);

/** Ends every pick a friend is on its way to or at (a new window size or land): the friend is let go
 * and the fruit stays. */
export function cancelFruitPicks() {
  for (const { v, end } of picks.values()) if (v.doing?.end === end || v.trip?.cancel === end) release(v);
}

/** Sends a friend to pick up the fallen fruit `id`: the selected friend when it is free, else the
 * nearest free one, else one viewing the blossom or visiting a tree. Returns whether a friend set
 * off. */
export function pickFruit(id) {
  const fruit = kept?.out.find(f => f.id === id);
  if (game || aiming || !fruit || picks.has(id)) return false;
  if (!views.size) {
    toast(t('moment.fruit_no_friend'));
    return false;
  }
  const spot = fieldToYard(fruit),
    v = forPerson(spot.x, spot.y, views.get(selected));
  if (!v) {
    toast(t('catch.busy'));
    return false;
  }
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
    if (picks.get(id) === task) {
      picks.delete(id);
      mark(id, false);
    }
  };
  task.end = end;
  const ours = () => picks.get(id) === task && views.get(v.pet.id) === v;
  prepareCompanionAction(v.asset, 'discover');
  // Beside the fruit, on the side it comes from, so the fruit is at its paws and not under it.
  const side = footOf(v).x < spot.x ? -1 : 1;
  sendTo(v, footTarget(v, spot.x + side * sizeOf(v.pet) * BESIDE, spot.y), {
    cancel: end,
    arrive: () => {
      if (!ours() || !stillOut(id, world)) return end();
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
        button.classList.add('lifting');
      }
      later(lift, () => {
        if (!ours() || !stillOut(id, world)) return release(v);
        const said = pickLine(kept, kindUnder(fruit), localDay(new Date()));
        kept = { ...said.kept, out: said.kept.out.filter(f => f.id !== id) };
        save(kept);
        picks.delete(id);
        renderFruit();
        bubble(v, pick(list(said.key)), 2600);
        later(Math.max(0, (authored?.duration ?? JUMP_MS) - lift), () => {
          release(v);
          rest(v);
        });
      });
    },
  });
  picks.set(id, task);
  mark(id, true);
  return true;
}
