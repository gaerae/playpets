// Brief, friend-led tasks: choose ground, walk there, then commit one discovery.
import { closeControls, closeScene } from '../core/controls.js';
import { t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { $, aiming, call, data, game, guard, selected, toast, views } from '../core/state.js';
import { artSvg } from './art.js';
import { showCard } from './card.js';
import { setAimingMode } from './care.js';
import { TREES, treasureKind } from './catalog.js';
import { groundAllows } from './discovery-rules.js';
import { field, fieldToYard, footTarget, petHeight, sizeOf, yardToField, yardZoom } from './field.js';
import { groundProfile } from './ground.js';
import { release, rest, sendTo, setDoing } from './trips.js';
import { bubble, pose } from './views.js';
import { scene } from './world.js';

let intent = null;
const tasks = new Map();
const ownAim = () => intent && aiming === intent.action;

export function cancelDiscovery() {
  if (ownAim()) setAimingMode(false);
  intent = null;
  if ($('discovery-target')) $('discovery-target').hidden = true;
  if ($('discovery-marker')) $('discovery-marker').hidden = true;
}

export function cancelDiscoveryWork() {
  cancelDiscovery();
  for (const v of tasks.keys()) release(v);
}

export function syncDiscovery() {
  if (intent && (!ownAim() || !views.has(intent.petId) || intent.world !== scene.world || game)) cancelDiscovery();
  for (const [v, task] of tasks) if (!views.has(v.pet.id) || task.world !== scene.world) release(v);
  const soil = groundProfile().soil;
  for (const id of ['dig-tool', 'tree-tool']) {
    const button = $(id);
    if (!button) continue;
    button.disabled = !soil || !views.size || !!game;
    button.title = t(soil ? `discovery.${id === 'dig-tool' ? 'dig' : 'tree'}_hint` : 'discovery.indoors');
  }
}

export function beginDiscovery(action) {
  const v = views.get(selected) || views.values().next().value;
  if (!v || game) return;
  if (!groundProfile().soil) return toast(t('discovery.indoors'));
  if (action === 'tree' && (data.garden?.trees || []).length >= limit(data, 'trees'))
    return toast(t('discovery.tree_total'));
  if (
    action === 'tree' &&
    (data.garden?.trees || []).filter(tree => tree.world === scene.world).length >= limit(data, 'treesPerWorld')
  )
    return toast(t('discovery.tree_full'));
  cancelDiscovery();
  closeControls(false);
  closeScene();
  intent = { action, petId: v.pet.id, world: scene.world, kind: TREES[0]?.id };
  setAimingMode(action);
  $('discovery-target-label').textContent = t(action === 'dig' ? 'discovery.choose_dig' : 'discovery.choose_tree');
  $('discovery-tree-choices').hidden = action !== 'tree';
  for (const button of $('discovery-tree-choices').querySelectorAll('[data-tree-kind]'))
    button.setAttribute('aria-pressed', String(button.dataset.treeKind === intent.kind));
  $('discovery-target').hidden = false;
  $('yard').focus();
}

function positionAt(event) {
  const r = $('yard').getBoundingClientRect(),
    x = event.clientX - r.left,
    y = event.clientY - r.top,
    f = field();
  if (x < 14 || x > f.width - 14 || y < f.top || y > f.bottom) return null;
  const point = yardToField(x, y);
  return groundAllows(point, groundProfile()) ? point : null;
}

function showMarker(event) {
  const marker = $('discovery-marker');
  if (!ownAim()) {
    marker.hidden = true;
    return;
  }
  const r = $('yard').getBoundingClientRect(),
    valid = !!positionAt(event);
  marker.hidden = false;
  marker.classList.toggle('invalid', !valid);
  marker.style.left = `${event.clientX - r.left}px`;
  marker.style.top = `${event.clientY - r.top}px`;
}

/** A task owns its timer and effect. Taking the friend away cancels only the presentation. */
export function sendDiscovery(v, point, action, kind) {
  const world = scene.world,
    pixel = fieldToYard(point),
    task = { world, cancelled: false, effect: null, timer: null };
  const cleanup = () => {
    task.cancelled = true;
    clearTimeout(task.timer);
    task.effect?.remove();
    if (tasks.get(v) === task) tasks.delete(v);
  };
  release(v);
  tasks.set(v, task);
  sendTo(v, footTarget(v, pixel.x, pixel.y), {
    cancel: cleanup,
    arrive: guard(async () => {
      if (task.cancelled || scene.world !== world || !views.has(v.pet.id)) return cleanup();
      const ground = groundProfile();
      if (!groundAllows(point, ground)) return cleanup();
      setDoing(v, { end: cleanup });
      pose(v, 'working', 2200);
      const effect = document.createElement('span');
      effect.className = 'dig-effect';
      effect.setAttribute('aria-hidden', 'true');
      effect.innerHTML = artSvg('discovery/shovel.svg');
      effect.style.left = `${pixel.x}px`;
      effect.style.top = `${pixel.y}px`;
      effect.style.setProperty('--dig-scale', String(yardZoom()));
      $('yard').append(effect);
      task.effect = effect;
      const before = new Set(Object.keys(data.album?.treasures || {}));
      let result;
      try {
        result =
          action === 'dig'
            ? await call('dig', v.pet.id, world, point.x, point.y, ground)
            : await call('plantTree', v.pet.id, world, kind, point.x, point.y, ground);
      } catch (error) {
        if (v.doing?.end === cleanup) release(v);
        else cleanup();
        throw error;
      }
      if (task.cancelled) return;
      task.timer = setTimeout(() => {
        if (task.cancelled || scene.world !== world || !views.has(v.pet.id)) return cleanup();
        release(v);
        rest(v);
        if (action === 'tree') return bubble(v, t('discovery.planted'), 2600);
        if (result.repeated) return bubble(v, t('discovery.repeated'), 2600);
        if (result.outcome === 'keepsake') {
          const found = treasureKind(result.kind);
          if (found) showCard(artSvg(found.art), t(`treasure.${found.id}`), t('discovery.kept'), !before.has(found.id));
        } else bubble(v, t(`discovery.${result.outcome}`), 2600);
      }, 1600);
    }),
  });
}

export function setupDiscovery() {
  $('dig-tool').onclick = () => beginDiscovery('dig');
  $('tree-tool').onclick = () => beginDiscovery('tree');
  $('discovery-cancel').onclick = cancelDiscovery;
  $('discovery-tree-choices').addEventListener('click', event => {
    const button = event.target.closest('[data-tree-kind]');
    if (!intent || !button) return;
    intent.kind = button.dataset.treeKind;
    for (const choice of $('discovery-tree-choices').querySelectorAll('[data-tree-kind]'))
      choice.setAttribute('aria-pressed', String(choice === button));
    $('yard').focus();
  });
  $('yard').addEventListener('pointermove', showMarker);
  $('yard').addEventListener('pointerleave', () => ($('discovery-marker').hidden = true));
  $('yard').addEventListener('click', event => {
    if (!ownAim() || event.target.closest('button,a,input,select,textarea')) return;
    const point = positionAt(event),
      v = views.get(intent.petId);
    if (!point || !v) return;
    const { action, kind } = intent;
    cancelDiscovery();
    sendDiscovery(v, point, action, kind);
  });
  $('yard').addEventListener('keydown', event => {
    if (!ownAim() || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    const v = views.get(intent.petId);
    if (!v) return;
    const point = yardToField(v.px + sizeOf(v.pet) / 2, v.py + petHeight(v.pet));
    if (!groundAllows(point, groundProfile())) return toast(t('discovery.invalid'));
    const { action, kind } = intent;
    cancelDiscovery();
    sendDiscovery(v, point, action, kind);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && intent && !event.defaultPrevented) {
      event.preventDefault();
      cancelDiscovery();
      $('yard').focus();
    }
  });
  document.addEventListener('click', event => {
    if (intent && (!ownAim() || event.target.closest('[data-panel],#scene-button,#yard-controls-toggle')))
      cancelDiscovery();
  });
}
