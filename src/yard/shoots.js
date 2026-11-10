// Spring shoots in the yard (the rules are shoot-rules.js's): once the sky clears after rain, two or
// three poke up; on a fair spring morning, one does. At most three stand at a time, each for six
// hours, on free ground, and only while the yard shows spring outdoors.
//
// - Checked with the scene, once a minute (app.js seasonChanged), and drawn again with the garden
//   (render.js, and the yard's resize, land and place changes). Nothing runs in the frame loop.
// - The shoots out are kept in the webview's storage, not in state.json: they are a few short-lived
//   things, like the rainbow's end, and a restart the same morning brings back the same ones and no
//   second morning shoot. The backend keeps only what was found, as for bugs.
// - A click on one sends a friend to dig it up (gatherShoot); the album keeps it and it leaves the
//   yard. It is not a dig for treasure (no roll, no cooldown); only the walk and the stroke are shared.
// - A shoot stands where nothing else does, and where nothing tall stands in front of it: one this
//   window shows covered is not drawn. It goes from the record only when the garden changes and the
//   change takes its ground: a smaller window draws the same garden bigger on the field, and hides a
//   shoot without losing it. A yard with no ground to see (not measured yet) drops none.
import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { aiming, call, data, game, guard, recall, remember, selected, toast, views } from '../core/state.js';
import { artHref, artSvg } from './art.js';
import { showCard } from './card.js';
import { shootKind } from './catalog.js';
import { behind, groundAllows, treeStage } from './discovery-rules.js';
import { fieldToYard } from './field.js';
import { groundProfile } from './ground.js';
import { localDay } from './growth.js';
import { propButton, propScale, reconcile, setDown } from './props.js';
import { rainbowEnd } from './rainbow-end.js';
import {
  freshShoots,
  keptShoots,
  pickShoots,
  SHOOTS_OUT,
  shootSpot,
  shootTime,
  sprouting,
  underBody,
} from './shoot-rules.js';
import { forPerson, release } from './trips.js';
import { bubble } from './views.js';
import { doneDigging, sendToDig, startDig, stopWork } from './work.js';
import { scene } from './world.js';

const NS = 'http://www.w3.org/2000/svg';
// The record: { morning, rainAt, out }; null until setupShoots has read it, so a look at the yard
// before that (the sky's first paint) cannot write over the stored one.
let kept = null;
// The weather the last look at the yard saw, whatever the season or place (null at first).
let before = null;
// The shoots made in this run and not drawn yet: only these rise as they come.
const made = new Set();
// The buttons on the yard, by shoot id.
const shown = new Map();
// The shoots friends are on their way to or digging up, or the album is keeping: shoot id → the
// task ({ v, end, pending }).
const digs = new Map();
// What stood in the garden at the last look on soil ({ garden, key, at }); null until the first one
// after setupShoots, which only notes it (the app may start in the mini window).
let standing = null;

/** Whether a friend is going for a shoot or digging one up (a flower viewing waits for it). */
export const shootDigging = () => digs.size > 0;

/** Reads the shoots out back from the webview's storage (app.js, before the sky first paints). */
export function setupShoots() {
  for (const v of shown.values()) v.button.remove();
  shown.clear();
  made.clear();
  before = null;
  standing = null;
  kept = keptShoots(recall('shoots'), Date.now());
}

// A shoot's drawing's width, before the yard's zoom.
const widthOf = kind => shootKind(kind).size[0];
// Whether a shoot's spot is still its own on this ground, with nothing tall drawn in front of it.
const free = (shoot, ground) =>
  groundAllows(shoot, ground) && !behind(shoot, ground) && !underBody(shoot, widthOf(shoot.kind), ground);
// What stands in the garden now, as much of it as takes ground: the gifts, the plants and every
// place's trees at the stage they have now (a growing tree takes more). No time goes in, so the
// garden reads the same each minute until something in it changes or a tree grows.
function standingNow(now) {
  const garden = data.garden || {};
  return {
    decor: (garden.decor || []).map(({ id, kind, x, y }) => ({ id, kind, x, y })),
    plants: (garden.plants || []).map(({ id, x, y }) => ({ id, x, y })),
    trees: (garden.trees || []).map(tree => ({
      id: tree.id,
      kind: tree.kind,
      world: tree.world,
      x: tree.x,
      y: tree.y,
      stage: treeStage({ ...tree, planted: tree.planted ?? now }, now),
    })),
  };
}

/** One look at the yard, at each repaint of the scene: shoots that are due come up, and those no
 * longer fresh, or whose ground a change in the garden took, go. */
export function shootsMinute(now = new Date()) {
  if (!kept) return;
  const ms = now.getTime(),
    ground = groundProfile(),
    seen = before;
  before = scene.weather;
  let next = { ...kept, out: freshShoots(kept.out, ms) };
  if (ground.soil) {
    const garden = standingNow(ms),
      key = JSON.stringify(garden),
      was = standing;
    standing = { garden, key, at: ms };
    // The garden before and after the change, both as this window draws them: only a shoot the
    // change took goes, not one this window already showed covered.
    if (was && was.key !== key) {
      const earlier = groundProfile({ garden: was.garden, now: was.at });
      next.out = next.out.filter(s => s.world !== scene.world || free(s, ground) || !free(s, earlier));
    }
  }
  let changed = next.out.length !== kept.out.length;
  if (shootTime(scene, ground.soil)) {
    const due = sprouting(
      next,
      { before: seen, weather: scene.weather, period: scene.period, day: localDay(now), now: ms },
      Math.random,
    );
    if (due.kept !== next) [next, changed] = [due.kept, true];
    const kinds = pickShoots(Math.min(due.count, SHOOTS_OUT - next.out.length), next.out, Math.random),
      end = rainbowEnd(ms),
      near = [...next.out.filter(s => s.world === scene.world), ...(end ? [end] : [])].map(({ x, y }) => ({ x, y }));
    for (const [i, kind] of kinds.entries()) {
      const spot = shootSpot(Math.random, ground, near, widthOf(kind));
      if (!spot) break;
      const shoot = { id: `${ms}-${i}`, kind, world: scene.world, x: spot.x, y: spot.y, at: ms };
      next = { ...next, out: [...next.out, shoot] };
      near.push(spot);
      made.add(shoot.id);
      changed = true;
    }
  }
  kept = next;
  if (changed) remember('shoots', JSON.stringify(kept));
  for (const id of made) if (!kept.out.some(s => s.id === id)) made.delete(id);
  renderShoots();
}

function create(shoot) {
  const button = propButton('shoot', shoot.kind),
    svg = document.createElementNS(NS, 'svg'),
    use = document.createElementNS(NS, 'use');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(use);
  button.append(svg);
  button.title = t('shoot.title');
  button.setAttribute('aria-label', button.title);
  const kind = shootKind(shoot.kind);
  use.setAttribute('href', artHref(kind.art));
  svg.setAttribute('viewBox', `0 0 ${kind.size.join(' ')}`);
  if (made.delete(shoot.id)) button.classList.add('sprouted');
  // With a tool in hand or in a game the press is the yard's (garden.css lets it through).
  button.addEventListener('click', event => {
    if (aiming || game) return;
    event.stopPropagation();
    gatherShoot(shoot.id);
  });
  return { button };
}

function update(v, shoot) {
  const [w, h] = shootKind(shoot.kind).size,
    scale = propScale(),
    { x, y } = fieldToYard(shoot);
  setDown(v.button, x, y, w * scale, h * scale, 1 + Math.round(shoot.y * 100));
  v.button.classList.toggle('picking', digs.has(shoot.id));
}

/** Draws the shoots out in this place, on ground still free; none while the yard is not spring
 * outdoors. */
export function renderShoots() {
  // Out of shoot time nothing is drawn, so no ground is measured for it.
  const ground = kept && shootTime(scene, true) ? groundProfile() : null,
    out =
      ground && shootTime(scene, ground.soil)
        ? freshShoots(kept.out, Date.now()).filter(s => s.world === scene.world && free(s, ground))
        : [];
  reconcile(shown, out, create, update);
}

// Whether a shoot is still out where it was, in a yard that shows spring outdoors.
const stillOut = (id, world) =>
  scene.world === world && shootTime(scene, groundProfile().soil) && !!kept?.out.some(s => s.id === id);
// The button of a shoot, marked while a friend goes for it.
const mark = (id, on) => shown.get(id)?.button.classList.toggle('picking', on);

/** Ends every shoot dig a friend is on its way to or at (a new window size or land): the friend is
 * let go and the shoot stays, as when the friend is taken away. */
export function cancelShootDigs() {
  for (const { v, end } of digs.values()) if (v.doing?.end === end || v.trip?.cancel === end) release(v);
}

/** Sends a friend to dig up the shoot `id` for the album: the selected friend when it is free, else
 * the nearest free one, else one viewing the blossom. Returns whether a friend set off. */
export function gatherShoot(id) {
  const shoot = kept?.out.find(s => s.id === id);
  if (game || aiming || !shoot || digs.has(id)) return false;
  if (!views.size) {
    toast(t('shoot.no_friend'));
    return false;
  }
  const spot = fieldToYard(shoot),
    v = forPerson(spot.x, spot.y, views.get(selected));
  if (!v) {
    toast(t('catch.busy'));
    return false;
  }
  const kind = shootKind(shoot.kind),
    world = scene.world;
  let dig = null,
    timer = null;
  const task = { v, end: null, pending: false };
  // The task's one end, however it comes (taken away, another place, a game, done): the stroke and
  // its timer stop, and the shoot is free to be clicked again, unless the album is keeping it.
  const end = () => {
    clearTimeout(timer);
    // Only a stroke under way is this task's to stop: a late end leaves the friend's next work alone.
    if (dig) {
      dig.stop();
      stopWork(v);
      dig = null;
    }
    if (digs.get(id) === task && !task.pending) {
      digs.delete(id);
      mark(id, false);
    }
  };
  task.end = end;
  const ours = () => digs.get(id) === task && views.get(v.pet.id) === v;
  sendToDig(v, shoot, 'dig', {
    cancel: end,
    arrive: () => {
      if (!ours() || !stillOut(id, world)) return end();
      dig = startDig(v, shoot, 'dig', end);
      timer = setTimeout(
        guard(async () => {
          if (!ours() || !stillOut(id, world)) return release(v);
          // Until the album answers, the shoot stays taken, so no second click or friend counts it again.
          task.pending = true;
          try {
            let found;
            try {
              found = await call('gatherShoot', kind.id);
            } catch (error) {
              // A friend taken meanwhile has had its end already.
              if (v.doing?.end === end) release(v);
              throw error;
            }
            // Kept in the album: it leaves the yard even if the friend was taken meanwhile.
            kept = { ...kept, out: kept.out.filter(s => s.id !== id) };
            remember('shoots', JSON.stringify(kept));
            if (v.doing?.end === end) {
              doneDigging(v, true);
              bubble(v, pick(list('shoot.found')), 2600);
            }
            renderShoots();
            showCard(
              artSvg(kind.art),
              t(`shoot.${kind.id}`),
              found.first ? '' : t('discovery.kept'),
              found.first,
              'shoot',
            );
          } finally {
            task.pending = false;
            if (digs.get(id) === task) {
              digs.delete(id);
              mark(id, false);
            }
          }
        }),
        dig.duration,
      );
    },
  });
  digs.set(id, task);
  mark(id, true);
  return true;
}
