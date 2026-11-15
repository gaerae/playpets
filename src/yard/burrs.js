// Burrs under a grown chestnut in autumn (the rules are tree-moment-rules.js's): now and then, in
// fair hours, a tree with a harvest moment drops a burr at its foot. At most two lie under a tree
// and three in the yard, each for six hours, until it is picked, or the season or the place changes.
//
// - Checked with the scene, once a minute (app.js seasonChanged), and drawn again with the garden
//   (render.js, and the yard's resize, land and place changes). Nothing runs in the frame loop.
// - Kept in the webview's storage, not in state.json, as the spring shoots are: a few short-lived
//   things, and the day's first pick. Nothing is counted and nothing is rewarded.
// - A burr drops with a short fall and one bounce (garden.css); with reduced motion it is simply
//   there, and can be picked all the same.
// - A click on one sends a friend to pick it up, with the walk and the stroke of a spring shoot's
//   gathering (work.js); the friend says a happy line, the day's first pick a line of its own, and
//   the burr leaves the yard.
import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { aiming, data, game, recall, remember, selected, toast, views } from '../core/state.js';
import { artHref } from './art.js';
import { depthAt, depthScaleAt, fieldToYard } from './field.js';
import { groundProfile } from './ground.js';
import { localDay } from './growth.js';
import { propButton, propScale, reconcile, setDown } from './props.js';
import { shootScale } from './shoot-rules.js';
import { burrDue, burrSpot, burrsStay, keptBurrs, momentOf, momentTrees, pickLine } from './tree-moment-rules.js';
import { forPerson, release } from './trips.js';
import { thingGone } from './veil.js';
import { bubble } from './views.js';
import { doneDigging, sendToDig, startDig, stopWork } from './work.js';
import { scene } from './world.js';

const NS = 'http://www.w3.org/2000/svg';
// The record: { next, picked, out }; null until setupBurrs has read it, so a look at the yard before
// that (the sky's first paint) cannot write over the stored one.
let kept = null;
// The burrs dropped in this run and not drawn yet: only these fall as they come.
const made = new Set();
// The buttons on the yard, by burr id.
const shown = new Map();
// The burrs friends are on their way to or picking up: burr id → the task ({ v, end }).
const picks = new Map();

/** Whether a friend is going for a burr or picking one up (a flower viewing or a visit waits). */
export const burrPicking = () => picks.size > 0;

/** Reads the burrs back from the webview's storage (app.js, before the sky first paints). */
export function setupBurrs() {
  for (const v of shown.values()) {
    v.button.remove();
    thingGone(v.button);
  }
  shown.clear();
  made.clear();
  kept = keptBurrs(recall('burrs'), Date.now());
}

// The kind of tree a burr lies under, and its moment.
const kindUnder = burr => data.garden?.trees?.find(tree => tree.id === burr.tree)?.kind;
const momentUnder = burr => momentOf(kindUnder(burr));
// The burrs lying in the yard as it is now.
const lying = now => (kept ? burrsStay(kept.out, { trees: data.garden?.trees, scene, now, limits: data.limits }) : []);

/** One look at the yard, at each repaint of the scene: burrs whose time, season, place or tree is
 * gone go, and one that is due drops. */
export function burrsMinute(now = new Date()) {
  if (!kept) return;
  const ms = now.getTime();
  let next = { ...kept, out: lying(ms) },
    changed = next.out.length !== kept.out.length;
  const trees = momentTrees(data.garden?.trees, scene, ms, data.limits).filter(tree => tree.moment.kind === 'harvest'),
    due = burrDue(next, trees, ms, Math.random);
  if (due.kept !== next) [next, changed] = [due.kept, true];
  if (due.tree) {
    const ground = groundProfile(),
      spot = burrSpot(Math.random, ground, due.tree, next.out, due.tree.moment.size[0]);
    if (spot) {
      const burr = { id: String(ms), tree: due.tree.id, world: scene.world, x: spot.x, y: spot.y, at: ms };
      next = { ...next, out: [...next.out, burr] };
      made.add(burr.id);
    }
  }
  kept = next;
  if (changed) remember('burrs', JSON.stringify(kept));
  for (const id of made) if (!kept.out.some(b => b.id === id)) made.delete(id);
  renderBurrs();
}

function create(burr) {
  const moment = momentUnder(burr),
    button = propButton('burr', kindUnder(burr)),
    svg = document.createElementNS(NS, 'svg'),
    use = document.createElementNS(NS, 'use');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${moment.size.join(' ')}`);
  use.setAttribute('href', artHref(moment.art));
  svg.append(use);
  button.append(svg);
  button.title = t('moment.burr_title');
  button.setAttribute('aria-label', button.title);
  if (made.delete(burr.id)) button.classList.add('dropped');
  // With a tool in hand or in a game the press is the yard's (garden.css lets it through).
  button.addEventListener('click', event => {
    if (aiming || game) return;
    event.stopPropagation();
    pickBurr(burr.id);
  });
  return { button };
}

function update(v, burr) {
  const [w, h] = momentUnder(burr).size,
    { x, y } = fieldToYard(burr),
    // Smaller farther back, as a friend there is, and no smaller than a spring shoot in a small yard.
    scale = shootScale(propScale()) * depthScaleAt(x, y);
  setDown(v.button, x, y, w * scale, h * scale, depthAt(y));
  v.button.classList.toggle('picking', picks.has(burr.id));
}

/** Draws the burrs lying in this place. */
export function renderBurrs() {
  reconcile(shown, lying(Date.now()), create, update);
}

// Whether a burr still lies where it was.
const stillOut = (id, world) => scene.world === world && lying(Date.now()).some(b => b.id === id);
// The button of a burr, marked while a friend goes for it.
const mark = (id, on) => shown.get(id)?.button.classList.toggle('picking', on);

/** Ends every pick a friend is on its way to or at (a new window size or land): the friend is let go
 * and the burr stays. */
export function cancelBurrPicks() {
  for (const { v, end } of picks.values()) if (v.doing?.end === end || v.trip?.cancel === end) release(v);
}

/** Sends a friend to pick up the burr `id`: the selected friend when it is free, else the nearest
 * free one, else one viewing the blossom. Returns whether a friend set off. */
export function pickBurr(id) {
  const burr = kept?.out.find(b => b.id === id);
  if (game || aiming || !burr || picks.has(id)) return false;
  if (!views.size) {
    toast(t('moment.burr_no_friend'));
    return false;
  }
  const spot = fieldToYard(burr),
    v = forPerson(spot.x, spot.y, views.get(selected));
  if (!v) {
    toast(t('catch.busy'));
    return false;
  }
  const world = scene.world;
  let dig = null,
    timer = null;
  const task = { v, end: null };
  // The task's one end, however it comes (taken away, another place, a game, done): the stroke and
  // its timer stop, and the burr is free to be clicked again.
  const end = () => {
    clearTimeout(timer);
    if (dig) {
      dig.stop();
      stopWork(v);
      dig = null;
    }
    if (picks.get(id) === task) {
      picks.delete(id);
      mark(id, false);
    }
  };
  task.end = end;
  const ours = () => picks.get(id) === task && views.get(v.pet.id) === v;
  sendToDig(v, burr, 'dig', {
    cancel: end,
    arrive: () => {
      if (!ours() || !stillOut(id, world)) return end();
      dig = startDig(v, burr, 'dig', end);
      timer = setTimeout(() => {
        if (!ours() || !stillOut(id, world)) return release(v);
        const said = pickLine(kept, momentUnder(burr), localDay(new Date()));
        kept = { ...said.kept, out: said.kept.out.filter(b => b.id !== id) };
        remember('burrs', JSON.stringify(kept));
        doneDigging(v, true);
        bubble(v, pick(list(said.key)), 2600);
        renderBurrs();
      }, dig.duration);
    },
  });
  picks.set(id, task);
  mark(id, true);
  return true;
}
