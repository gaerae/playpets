// The garden: plants where they were put, at the stage the clock says, and the seeds friends find
// on their strolls. The rules (stages, flowers, how often) are in growth.js; the backend keeps the
// garden and its limits (src-tauri/src/pets/garden.rs). Plants are drawn once and looked at again
// once a minute; nothing here moves on its own.

import { list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { pick } from '../core/math.js';
import { $, aiming, call, data, game, guard, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { cadence, everyMinute } from '../core/ticker.js';
import { artHref, artSize, colorStyle } from './art.js';
import { befriend, levelOf } from './bond.js';
import { showCard } from './card.js';
import { setAimingMode } from './care.js';
import { flowerKind, STAGES } from './catalog.js';
import { flowerSvg } from './creatures.js';
import { field, fieldToYard, footTarget, petHeight, sizeOf, yardToField } from './field.js';
import { flowerFor, hoursMinutes, nextFind, stageOf, untilBloom } from './growth.js';
import { askToRemove, propButton, propScale, reconcile, setDown } from './props.js';
import { cue } from './sound.js';
import { isFree, nearestFree, release, rest, sendTo } from './trips.js';
import { bubble, cheer, effect } from './views.js';
import { scene } from './world.js';

// Yard pixels per unit of a plant's drawing at full size; it shrinks with the yard as friends do.
const UNIT = 1.25;
const shown = new Map();
const seedsFull = () => (data.garden?.seeds ?? 0) >= limit(data, 'seeds');

// What a plant is drawn with at a stage: the stage's drawing, or in bloom its flower's.
function artAt(plant, stage) {
  return STAGES.find(s => s.name === stage)?.art || flowerKind(plant.kind)?.art || '';
}
function wait(ms) {
  const { hours, minutes } = hoursMinutes(ms);
  return hours ? t('garden.hm', { hours, minutes }) : t('garden.m', { minutes });
}
function label(plant, now) {
  const stage = stageOf(plant.planted, now).name,
    left = untilBloom(plant.planted, now);
  const what = `${t(`garden.kind_${plant.kind}`)} · ${t(`garden.stage_${stage}`)}`;
  return left ? `${what} · ${t('garden.until', { time: wait(left) })}` : what;
}
function create(plant) {
  const button = propButton('plant', plant.kind);
  // The flower's colours, for the bud and the bloom.
  button.style.cssText = colorStyle(flowerKind(plant.kind)?.colors);
  button.innerHTML = '<svg aria-hidden="true"><use/></svg>';
  // A click waters it (the nearest friend walks over); placing a seed, the click plants there.
  button.addEventListener('click', e => {
    if (aiming) return;
    e.stopPropagation();
    water(plant.id);
  });
  button.addEventListener('contextmenu', e => {
    e.preventDefault();
    pull(plant.id);
  });
  button.addEventListener('keydown', e => {
    if (e.key === 'Delete' || e.key === 'Backspace') pull(plant.id);
  });
  return { button, svg: button.querySelector('svg'), use: button.querySelector('use'), art: '' };
}
/** Brings the field in line with the backend's garden, at the stage the clock says. */
export function renderGarden(now = Date.now()) {
  const scale = propScale();
  reconcile(shown, data.garden?.plants || [], create, (v, plant) => {
    const stage = stageOf(plant.planted, now).name,
      art = artAt(plant, stage);
    if (stage === 'bloom' && !plant.bloomed) bloomed(plant, now);
    if (v.art !== art) {
      v.art = art;
      v.use.setAttribute('href', artHref(art));
      v.svg.setAttribute('viewBox', `0 0 ${artSize(art).join(' ')}`);
      v.button.dataset.stage = stage;
    }
    // Some flowers stand taller than others once grown (catalog.json "stature").
    const [aw, ah] = artSize(art),
      { x, y } = fieldToYard(plant),
      tall = stage === 'bloom' || stage === 'bud' ? flowerKind(plant.kind)?.stature || 1 : 1,
      w = aw * UNIT * scale * tall,
      h = ah * UNIT * scale * tall;
    // Nearer the front, drawn over the ones behind it.
    setDown(v.button, x, y, w, h, 1 + Math.round(plant.y * 100));
    v.button.title = label(plant, now);
    v.button.setAttribute('aria-label', v.button.title);
  });
  syncTool();
}
// A flower is counted in the album once (the backend keeps which were); the first of its kind
// shows its card. Pending calls stay separate from successful counts so a failed save can retry.
const asked = new Set();
const bloomRetry = new Map();
const bloomFailed = new Set();
function bloomed(plant, now) {
  if (asked.has(plant.id) || now < (bloomRetry.get(plant.id) || 0)) return;
  bloomRetry.set(plant.id, Infinity);
  call('bloomed', plant.id)
    .then(r => {
      asked.add(plant.id);
      bloomRetry.delete(plant.id);
      if (r?.entry?.count === 1)
        showCard(flowerSvg(plant.kind), t(`garden.kind_${plant.kind}`), t('catch.bloomed'), true);
    })
    .catch(error => {
      // Retried quietly after the first message, so a backend that keeps refusing does not
      // repeat it every few seconds.
      if (!bloomFailed.has(plant.id)) toast(spoken(error, t('error.generic')));
      bloomFailed.add(plant.id);
      bloomRetry.set(plant.id, Date.now() + RETRY_MS);
    });
}
// The tool says how many seeds there are; with none it stays pressable and says how to get one.
function syncTool() {
  const seeds = data.garden?.seeds ?? 0;
  $('seed-count').textContent = seeds ? String(seeds) : '';
  $('plant-tool').setAttribute('aria-disabled', String(!seeds));
  if (!seeds && aiming === 'seed') setAimingMode(false);
}

// Sends a friend to stand just beside a plant (left or right of it, whichever is nearer).
function walkTo(v, plant, trip) {
  const { x, y } = fieldToYard(plant),
    side = v.px + sizeOf(v.pet) / 2 < x ? -1 : 1;
  sendTo(v, footTarget(v, x + side * sizeOf(v.pet) * 0.55, y), trip);
}
function water(id) {
  const plant = data.garden?.plants.find(p => p.id === id);
  if (!plant || game) return;
  const { x, y } = fieldToYard(plant);
  const v = nearestFree(x, y);
  if (v) walkTo(v, plant, { arrive: watered });
}
// A friend reached the plant it was sent to water.
function watered(v) {
  befriend(v.pet.id, 'water');
  cue('water');
  cheer(v, 'garden.water', { as: 'wave', ms: 1300 });
}
// A friend reached a flower it went to look at on its own.
function visited(v) {
  if (Math.random() < 0.5) bubble(v, pick(list('garden.visit')), 3000);
}
/** Now and then an idle friend goes to look at a flower instead of strolling: the target, or null. */
export function visitTarget(v) {
  const blooms = (data.garden?.plants || []).filter(p => stageOf(p.planted, Date.now()).name === 'bloom');
  if (!blooms.length || Math.random() > 0.3) return null;
  walkTo(v, pick(blooms), { arrive: visited, slow: true });
  return v.target;
}
const pull = guard(async id => {
  const plant = data.garden?.plants.find(p => p.id === id);
  if (!plant) return;
  const kind = t(`garden.kind_${plant.kind}`);
  if (await askToRemove(t('garden.pull_confirm', { kind }), t('garden.pull_body'), t('garden.pull')))
    await call('pullPlant', id);
});

// Finding seeds: an idle friend, now and then, leaves one at its feet. A click picks it up; left
// alone, the friend pockets it after a while, so nothing is missed by not watching.
const POCKET_AFTER = 90 * 1000;
const RETRY_MS = 15 * 1000;
let lying = null;
// The first find of a new yard comes soon (growth.js); the rest at the usual gaps.
let looked = false;
const finds = cadence(() => {
  const first = !looked && !(data.garden?.seeds || data.garden?.plants?.length);
  looked = true;
  return nextFind(Math.random, first);
});
// A pickup by hand always says when it fails; the friend's own retries say so only the first time.
async function collect(byHand = false) {
  if (!lying || lying.pending) return false;
  const seed = lying;
  const { node, timer } = seed;
  seed.pending = true;
  node.disabled = true;
  clearTimeout(timer);
  try {
    await call('findSeed');
    lying = null;
    node.remove();
    return true;
  } catch (error) {
    if (byHand || !seed.failed) toast(spoken(error, t('error.generic')));
    seed.failed = true;
    // The seed stays where it was found; clicks can retry, and pocketing gets a slower retry too.
    seed.timer = setTimeout(collect, RETRY_MS);
    return false;
  } finally {
    seed.pending = false;
    node.disabled = false;
  }
}
/** Called by the frame loop while the yard is seen and no game is on. */
export function gardenTick(now) {
  if (lying || !finds.due(now)) return;
  // Anyone strolling about can find one; with nobody free right now, look again shortly.
  const free = [...views.values()].filter(v => isFree(v) || v.trip?.slow);
  if (seedsFull() || !free.length) return finds.after(now, RETRY_MS);
  // A best friend (level 4) finds seeds more often, and is the one who finds them when it can.
  const keen = free.filter(f => levelOf(f.pet.id) >= 4);
  if (keen.length) finds.after(now, nextFind(Math.random) * 0.6);
  const v = pick(keen.length ? keen : free);
  // It stops where it found it, so the seed lies at its feet.
  release(v);
  rest(v);
  cue('find');
  cheer(v, 'garden.found', { mark: '', say: 3500 });
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'found-seed';
  node.setAttribute('aria-label', t('garden.pick_up'));
  node.title = t('garden.pick_up');
  // Placed by left and top: its glow uses transform.
  node.style.left = `${v.px + sizeOf(v.pet) * 0.75}px`;
  node.style.top = `${v.py + petHeight(v.pet) - 18}px`;
  node.addEventListener('click', async e => {
    e.stopPropagation();
    if (await collect(true)) effect(v, '✦');
  });
  $('garden-layer').append(node);
  lying = { node, timer: setTimeout(collect, POCKET_AFTER) };
}

// Planting: the tool, then a click on the field. It stays on while there are seeds; Esc or the
// tool again puts it away.
function plantAt(cx, cy) {
  if (cy < field().top - 10) return toast(t('garden.on_field'));
  const { x, y } = yardToField(cx, cy);
  return call('plant', flowerFor(scene.season), x, y);
}
/** Wires the planting tool and the field's click. Called once, by app.js. */
export function setupGarden() {
  $('plant-tool').onclick = () => {
    if (!data.garden?.seeds) return toast(t('garden.no_seeds'));
    setAimingMode(aiming === 'seed' ? false : 'seed');
  };
  $('yard').addEventListener(
    'click',
    guard(async e => {
      if (aiming !== 'seed') return;
      const r = $('yard').getBoundingClientRect();
      await plantAt(e.clientX - r.left, e.clientY - r.top);
    }),
  );
  // Stages change by the clock: a look once a minute is enough.
  everyMinute(() => renderGarden());
}
