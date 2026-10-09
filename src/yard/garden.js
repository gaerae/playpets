// The garden: plants where they were put, at the stage the clock says, and the seeds friends find
// on their strolls. The rules (stages, flowers, how often) are in growth.js; the backend keeps the
// garden and its limits (src-tauri/src/pets/garden.rs). Plants are drawn once and looked at again
// once a minute; nothing here moves on its own.

import { confirmAction } from '../core/confirm.js';
import { list, t } from '../core/i18n.js';
import { clamp } from '../core/math.js';
import { $, aiming, call, data, game, guard, toast, views } from '../core/state.js';
import { setAimingMode } from './care.js';
import { flowerFor, hoursMinutes, nextFind, stageOf, untilBloom } from './growth.js';
import { scene } from './sky.js';
import { bubble, effect, field, geometry, petHeight, pose, rest, sizeOf } from './views.js';

const pick = lines => lines[Math.floor(Math.random() * lines.length)];
// A plant's box at full size; it shrinks with the yard as friends do.
const PLANT_W = 50,
  PLANT_H = 75;
// Some flowers stand taller than others once grown.
const STATURE = { sunflower: 1.4, camellia: 1.15 };
const shown = new Map();
let scale = 1;
const seedsFull = () => (data.garden?.seeds ?? 0) >= (data.limits?.seeds ?? 20);

/** Where a plant (or a decoration) stands on the field, in yard pixels (its foot). */
export function spot(plant) {
  const f = field();
  return { x: 14 + plant.x * Math.max(1, f.width - 28), y: f.top + plant.y * Math.max(1, f.bottom - f.top) };
}
function symbolOf(plant, stage) {
  return stage === 'bloom' ? `bloom-${plant.kind}` : stage;
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
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'plant';
  button.dataset.kind = plant.kind;
  button.innerHTML = '<svg viewBox="0 0 40 60" aria-hidden="true"><use/></svg>';
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
  $('garden-layer').append(button);
  return { button, use: button.querySelector('use'), symbol: '' };
}
/** Brings the field in line with the backend's garden, at the stage the clock says. */
export function renderGarden(now = Date.now()) {
  const plants = data.garden?.plants || [];
  for (const [id, v] of shown)
    if (!plants.some(p => p.id === id)) {
      v.button.remove();
      shown.delete(id);
    }
  scale = clamp(field().height / 560, 0.5, 1);
  for (const plant of plants) {
    let v = shown.get(plant.id);
    if (!v) {
      v = create(plant);
      shown.set(plant.id, v);
    }
    const stage = stageOf(plant.planted, now).name,
      symbol = symbolOf(plant, stage);
    if (v.symbol !== symbol) {
      v.symbol = symbol;
      v.use.setAttribute('href', `#plant-${symbol}`);
      v.button.dataset.stage = stage;
    }
    const { x, y } = spot(plant),
      tall = stage === 'bloom' || stage === 'bud' ? STATURE[plant.kind] || 1 : 1,
      w = PLANT_W * scale * tall,
      h = PLANT_H * scale * tall;
    v.button.style.width = `${w}px`;
    v.button.style.height = `${h}px`;
    v.button.style.transform = `translate(${x - w / 2}px,${y - h}px)`;
    // Nearer the front, drawn over the ones behind it.
    v.button.style.zIndex = String(1 + Math.round(plant.y * 100));
    v.button.title = label(plant, now);
    v.button.setAttribute('aria-label', v.button.title);
  }
  syncTool();
}
// The tool says how many seeds there are; with none it stays pressable and says how to get one.
function syncTool() {
  const seeds = data.garden?.seeds ?? 0;
  $('seed-count').textContent = seeds ? String(seeds) : '';
  $('plant-tool').setAttribute('aria-disabled', String(!seeds));
  if (!seeds && aiming === 'seed') setAimingMode(false);
}

// The friend nearest a spot that is free to walk over (not dragged, not on its way somewhere).
function nearestFree(x, y) {
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    if (v.drag || v.target || v.away) continue;
    const d = Math.hypot(v.px + sizeOf(v.pet) / 2 - x, v.py + petHeight(v.pet) - y);
    if (d < bestD) [best, bestD] = [v, d];
  }
  return best;
}
// Sends a friend to stand just beside a plant (left or right of it, whichever is nearer).
function walkTo(v, plant, kind) {
  const { x, y } = spot(plant),
    { w, h, top } = geometry(v.pet),
    side = v.px + sizeOf(v.pet) / 2 < x ? -1 : 1;
  v.target = {
    x: clamp((x + side * (sizeOf(v.pet) * 0.55) - 14 - sizeOf(v.pet) / 2) / w),
    y: clamp((y - top - petHeight(v.pet) + 4) / h),
  };
  v.targetKind = kind;
}
function water(id) {
  const plant = data.garden?.plants.find(p => p.id === id);
  if (!plant || game) return;
  const { x, y } = spot(plant);
  const v = nearestFree(x, y);
  if (v) walkTo(v, plant, 'water');
}
/** Called by the frame loop when a friend reaches the plant it was sent to water. */
export function watered(v) {
  pose(v, 'wave', 1300);
  effect(v, '✦');
  bubble(v, pick(list('garden.water')), 3000);
}
/** Called when a friend reaches a flower it went to look at on its own. */
export function visited(v) {
  if (Math.random() < 0.5) bubble(v, pick(list('garden.visit')), 3000);
}
/** Now and then an idle friend goes to look at a flower instead of strolling: the target, or null. */
export function visitTarget(v) {
  const blooms = (data.garden?.plants || []).filter(p => stageOf(p.planted, Date.now()).name === 'bloom');
  if (!blooms.length || Math.random() > 0.3) return null;
  walkTo(v, pick(blooms), 'visit');
  return v.target;
}
const pull = guard(async id => {
  const plant = data.garden?.plants.find(p => p.id === id);
  if (!plant) return;
  const kind = t(`garden.kind_${plant.kind}`);
  const sure = await confirmAction({
    title: t('garden.pull_confirm', { kind }),
    body: t('garden.pull_body'),
    action: t('garden.pull'),
  });
  if (sure) await call('pullPlant', id);
});

// Finding seeds: an idle friend, now and then, leaves one at its feet. A click picks it up; left
// alone, the friend pockets it after a while, so nothing is missed by not watching.
const POCKET_AFTER = 90 * 1000;
const RETRY_MS = 15 * 1000;
let nextFindAt = 0,
  lying = null;
function collect(how) {
  if (!lying) return;
  const { node, timer } = lying;
  lying = null;
  clearTimeout(timer);
  node.remove();
  call('findSeed').catch(() => {});
  return how;
}
/** Called by the frame loop while the yard is seen and no game is on. */
export function gardenTick(now) {
  const first = !(data.garden?.seeds || data.garden?.plants?.length);
  if (!nextFindAt) nextFindAt = now + nextFind(Math.random, first);
  if (now < nextFindAt || lying) return;
  // Anyone strolling about can find one; with nobody free right now, look again shortly.
  const free = [...views.values()].filter(v => !v.drag && !v.away);
  if (seedsFull() || !free.length) {
    nextFindAt = now + RETRY_MS;
    return;
  }
  nextFindAt = now + nextFind(Math.random);
  const v = pick(free);
  // It stops where it found it, so the seed lies at its feet.
  v.target = null;
  v.targetKind = null;
  rest(v);
  pose(v, 'jump', 1100);
  bubble(v, pick(list('garden.found')), 3500);
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'found-seed';
  node.setAttribute('aria-label', t('garden.pick_up'));
  node.title = t('garden.pick_up');
  // Placed by left and top: its glow uses transform.
  node.style.left = `${v.px + sizeOf(v.pet) * 0.75}px`;
  node.style.top = `${v.py + petHeight(v.pet) - 18}px`;
  node.addEventListener('click', e => {
    e.stopPropagation();
    collect('click');
    effect(v, '✦');
  });
  $('garden-layer').append(node);
  lying = { node, timer: setTimeout(() => collect('pocket'), POCKET_AFTER) };
}

// Planting: the tool, then a click on the field. It stays on while there are seeds; Esc or the
// tool again puts it away.
function plantAt(cx, cy) {
  const f = field();
  if (cy < f.top - 10) return toast(t('garden.on_field'));
  const x = clamp((cx - 14) / Math.max(1, f.width - 28)),
    y = clamp((cy - f.top) / Math.max(1, f.bottom - f.top));
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
  setInterval(() => renderGarden(), 60 * 1000);
}
