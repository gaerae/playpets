// The garden: plants where they were put, at the stage the clock says, and seeds found by digging.
// The rules for stages and seasonal flowers are in growth.js; the backend keeps the
// garden and its limits (src-tauri/src/pets/garden.rs). Plants are drawn once and looked at again
// once a minute; nothing here moves on its own. The person drags one to move it, and its menu sends
// it out to the desktop or pulls it up.

import { companionImage, playCompanionAction, prepareCompanionAction } from '../core/companion-actions.js';
import { openPlantMenu } from '../core/controls.js';
import { joinList, list, t } from '../core/i18n.js';
import { onEscape } from '../core/keys.js';
import { pick } from '../core/math.js';
import { $, aiming, call, data, game, guard, selected, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { everyMinute } from '../core/ticker.js';
import { artHref, artSize, colorStyle } from './art.js';
import { befriend } from './bond.js';
import { showCard } from './card.js';
import { setAimingMode } from './care.js';
import { flowerKind } from './catalog.js';
import { flowerSvg } from './creatures.js';
import { field, fieldToYard, footTarget, petHeight, sizeOf, yardToField } from './field.js';
import { flowerFor, hoursMinutes, plantArt, plantStature, stageOf, untilBloom } from './growth.js';
import { shapeHits } from './hit-shape.js';
import { movable, moveSaved, propButton, propScale, reconcile, removeWithUndo, setDown } from './props.js';
import { cue } from './sound.js';
import { forPerson, release, rest, sendTo } from './trips.js';
import { bubble, cheer } from './views.js';
import { holdAtWork, sendToWork, stopWork } from './work.js';
import { scene } from './world.js';

// Yard pixels per unit of a plant's drawing at full size; it shrinks with the yard as friends do.
const UNIT = 1.25;
const shown = new Map();
const RETRY_MS = 15 * 1000;

function wait(ms) {
  const { hours, minutes } = hoursMinutes(ms);
  return hours ? t('garden.hm', { hours, minutes }) : t('garden.m', { minutes });
}
// The season a seed goes in picks its flower, and the flower is the surprise: it keeps its name
// until the bud shows its colours.
const YOUNG = new Set(['seed', 'sprout', 'leaves']);
const young = (plant, now = Date.now()) => YOUNG.has(stageOf(plant.planted, now).name);
function label(plant, now) {
  const stage = stageOf(plant.planted, now).name,
    left = untilBloom(plant.planted, now);
  const name = young(plant, now) ? t('garden.young') : t(`garden.kind_${plant.kind}`);
  const what = joinList([name, t(`garden.stage_${stage}`)]);
  return left ? joinList([what, t('garden.until', { time: wait(left) })]) : what;
}
const current = id => data.garden?.plants?.find(p => p.id === id);
// Where a plant stands, drawn at the stage the clock says (a drag shows it at `point` first).
function position(v, plant, now = Date.now(), point = plant) {
  const stage = stageOf(plant.planted, now).name,
    art = plantArt(plant, stage);
  if (v.art !== art) {
    v.art = art;
    v.use.setAttribute('href', artHref(art));
    v.svg.setAttribute('viewBox', `0 0 ${artSize(art).join(' ')}`);
    v.button.dataset.stage = stage;
    shapeHits(v.button, art);
  }
  // Some flowers stand taller than others once grown (catalog.json "stature").
  const [aw, ah] = artSize(art),
    { x, y } = fieldToYard(point),
    scale = propScale(),
    tall = plantStature(plant, stage),
    w = aw * UNIT * scale * tall,
    h = ah * UNIT * scale * tall;
  // Nearer the front, drawn over the ones behind it.
  setDown(v.button, x, y, w, h, 1 + Math.round(point.y * 100));
}
// Moved at once and saved after, as a tree is (props.js moveSaved); refused, it goes back.
const save = guard(async (v, point) => {
  const plant = current(v.id);
  if (!plant || v.busy) return;
  await moveSaved(v, plant, point, {
    send: () => call('movePlant', plant.id, point.x, point.y),
    current: () => current(plant.id),
    show: () => position(v, plant),
    settle: () => renderGarden(),
  });
});
function create(plant) {
  const button = propButton('plant', plant.kind, plant.id);
  // The flower's colours, for the bud and the bloom.
  button.style.cssText = colorStyle(flowerKind(plant.kind)?.colors);
  button.innerHTML = '<svg aria-hidden="true"><use/></svg>';
  const v = {
    id: plant.id,
    button,
    svg: button.querySelector('svg'),
    use: button.querySelector('use'),
    art: '',
    drag: null,
    busy: false,
  };
  // Moved as a planted tree is; its menu sends it out to the desktop or pulls it up, and Delete pulls
  // it up at once (with Undo). A click waters it (the nearest friend walks over); placing a seed, the
  // click plants there.
  movable(v, {
    current: () => current(v.id),
    show: at => position(v, current(v.id), Date.now(), at),
    save: at => save(v, at),
    menu: at => openPlantMenu(v.id, at),
    remove: () => pullPlant(v.id),
    settle: () => renderGarden(),
    press: e => {
      if (aiming) return;
      e.stopPropagation();
      water(v.id);
    },
  });
  return v;
}
/** Brings the field in line with the backend's garden, at the stage the clock says. */
export function renderGarden(now = Date.now()) {
  reconcile(shown, data.garden?.plants || [], create, (v, plant) => {
    if (stageOf(plant.planted, now).name === 'bloom' && !plant.bloomed) bloomed(plant, now);
    // A plant being dragged stays under the pointer.
    if (!v.drag?.moved) position(v, plant, now);
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
        showCard(flowerSvg(plant.kind), t(`garden.kind_${plant.kind}`), t('catch.bloomed'), true, 'flower');
    })
    .catch(error => {
      // Retried quietly after the first message, so a backend that keeps refusing does not
      // repeat it every few seconds.
      if (!bloomFailed.has(plant.id)) toast(spoken(error, t('error.generic')), { error: true });
      bloomFailed.add(plant.id);
      bloomRetry.set(plant.id, Date.now() + RETRY_MS);
    });
}
// The tool says how many seeds there are; with none it stays pressable and says how to get one.
function syncTool() {
  const seeds = data.garden?.seeds ?? 0;
  $('seed-count').textContent = seeds ? String(seeds) : '';
  $('plant-tool').setAttribute('aria-disabled', String(!seeds));
  if (!spareSeeds() && aiming === 'seed') setAimingMode(false);
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
  const v = forPerson(x, y);
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
  walkTo(v, pick(blooms), { arrive: visited, slow: true, own: true });
  return v.target;
}
/** Pulls a plant up at once, with a moment to undo it (props.js); the backend removes it only after
 * that. Its menu (core/controls.js) and Delete come here. */
export function pullPlant(id) {
  const plant = data.garden?.plants.find(p => p.id === id),
    view = shown.get(id);
  if (!plant || !view) return;
  const message = young(plant)
    ? t('garden.pulled_young')
    : t('garden.pulled', { kind: t(`garden.kind_${plant.kind}`) });
  removeWithUndo(id, view, message, () => call('pullPlant', id));
}

const planting = new Map();
// A friend on the way to plant spends its seed only on arrival, so that seed is already promised.
const spareSeeds = () => Math.max(0, (data.garden?.seeds ?? 0) - planting.size);
function cancelPlanting() {
  for (const v of planting.keys()) release(v);
}
function sendPlanting(v, point, kind, clip) {
  const world = scene.world;
  const season = scene.season;
  let cancelled = false;
  let timer;
  const cleanup = () => {
    cancelled = true;
    clearTimeout(timer);
    stopWork(v);
    if (planting.get(v) === cleanup) planting.delete(v);
  };
  const valid = () =>
    !cancelled && scene.world === world && scene.season === season && views.get(v.pet.id) === v && !game && !v.drag;
  sendToWork(v, fieldToYard(point), clip, {
    cancel: cleanup,
    arrive: guard(() => {
      if (!valid()) return cleanup();
      holdAtWork(v, cleanup);
      const action = playCompanionAction(v, 'plant');
      if (action?.clip !== clip) return release(v);
      timer = setTimeout(
        guard(async () => {
          if (!valid()) return release(v);
          try {
            // The existing atomic command spends the seed only after the placement completes.
            await call('plant', kind, point.x, point.y);
          } finally {
            if (planting.get(v) === cleanup) {
              release(v);
              rest(v);
            }
          }
        }),
        action.duration,
      );
    }),
  });
  planting.set(v, cleanup);
  if (!spareSeeds() && aiming === 'seed') setAimingMode(false);
}

// Planting: the tool, then a click on the field. It stays on while there are seeds; Esc or the
// tool again puts it away.
function plantAt(cx, cy) {
  if (cy < field().top - 10) return toast(t('garden.on_field'));
  if (!spareSeeds()) return;
  const point = yardToField(cx, cy);
  const kind = flowerFor(scene.season);
  const v = forPerson(cx, cy, views.get(selected));
  const clip = v ? prepareCompanionAction(v.asset, 'plant') : null;
  if (clip && companionImage({ clip })) return sendPlanting(v, point, kind, clip);
  return call('plant', kind, point.x, point.y);
}
function plantNearby() {
  const r = $('yard').getBoundingClientRect(),
    v = views.get(selected);
  if (v) return plantAt(v.px + sizeOf(v.pet) + 30, v.py + petHeight(v.pet));
  return plantAt(r.width / 2, (field().top + r.height) / 2);
}
/** Wires the planting tool and the field's click. Called once, by app.js. */
export function setupGarden() {
  $('world')?.addEventListener('change', cancelPlanting);
  onEscape(cancelPlanting);
  // With the mouse the next click in the yard chooses the spot; from the keyboard a second press
  // plants beside the selected friend (or mid-field), as the picnic treat does.
  $('plant-tool').onclick = guard(async e => {
    if (!spareSeeds()) return toast(t('garden.no_seeds'));
    if (aiming === 'seed' && e?.detail === 0) return plantNearby();
    setAimingMode(aiming === 'seed' ? false : 'seed');
  });
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
