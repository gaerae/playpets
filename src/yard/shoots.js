// Spring shoots in the yard (the rules are shoot-rules.js's): once the sky clears after rain, two or
// three poke up; on a fair spring morning, one does. At most three stand at a time, each for six
// hours, on free ground, and only while the yard shows spring outdoors.
//
// - Checked with the scene, once a minute (app.js seasonChanged), and drawn again with the garden
//   (render.js, and the yard's resize, land and place changes). Nothing runs in the frame loop.
// - The shoots out are kept in the webview's storage, not in state.json: they are a few short-lived
//   things, like the rainbow's end, and a restart the same morning brings back the same ones and no
//   second morning shoot. The backend keeps only what was found, as for bugs.
// - A shoot stands where nothing else does: one whose ground a gift, a plant or a tree takes is not
//   drawn, and goes from the record at the next minute. A yard with no ground to see (not measured
//   yet) drops none.
import { t } from '../core/i18n.js';
import { recall, remember } from '../core/state.js';
import { artHref } from './art.js';
import { shootKind } from './catalog.js';
import { behind, groundAllows } from './discovery-rules.js';
import { fieldToYard } from './field.js';
import { groundProfile } from './ground.js';
import { localDay } from './growth.js';
import { propButton, propScale, reconcile, setDown } from './props.js';
import { rainbowEnd } from './rainbow-end.js';
import { freshShoots, keptShoots, pickShoots, SHOOTS_OUT, shootSpot, shootTime, sprouting } from './shoot-rules.js';
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

/** Reads the shoots out back from the webview's storage (app.js, before the sky first paints). */
export function setupShoots() {
  for (const v of shown.values()) v.button.remove();
  shown.clear();
  made.clear();
  before = null;
  kept = keptShoots(recall('shoots'), Date.now());
}

// Whether a shoot's spot is still its own on this ground.
const free = (shoot, ground) => groundAllows(shoot, ground) && !behind(shoot, ground);

/** One look at the yard, at each repaint of the scene: shoots that are due come up, and those no
 * longer fresh, or whose ground is taken, go. */
export function shootsMinute(now = new Date()) {
  if (!kept) return;
  const ms = now.getTime(),
    ground = groundProfile(),
    seen = before;
  before = scene.weather;
  let next = { ...kept, out: freshShoots(kept.out, ms) };
  if (ground.soil) next.out = next.out.filter(s => s.world !== scene.world || free(s, ground));
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
      const spot = shootSpot(Math.random, ground, near);
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
  return { button };
}

function update(v, shoot) {
  const [w, h] = shootKind(shoot.kind).size,
    scale = propScale(),
    { x, y } = fieldToYard(shoot);
  setDown(v.button, x, y, w * scale, h * scale, 1 + Math.round(shoot.y * 100));
}

/** Draws the shoots out in this place, on ground still free; none while the yard is not spring
 * outdoors. */
export function renderShoots() {
  const ground = groundProfile(),
    out =
      kept && shootTime(scene, ground.soil)
        ? freshShoots(kept.out, Date.now()).filter(s => s.world === scene.world && free(s, ground))
        : [];
  reconcile(shown, out, create, update);
}
