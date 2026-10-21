// Brief, friend-led tasks: choose ground, walk there, then commit one discovery.
import {
  actionGroundOffset,
  beginCompanionAction,
  clearCompanionAction,
  companionImage,
  prepareCompanionAction,
} from '../core/companion-actions.js';
import { closeControls, closeScene } from '../core/controls.js';
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { limit } from '../core/limits.js';
import { $, aiming, call, data, game, guard, selected, toast, views } from '../core/state.js';
import { artSvg } from './art.js';
import { showCard } from './card.js';
import { onAimingChange, setAimingMode } from './care.js';
import { TREES, treasureKind } from './catalog.js';
import { groundAllows } from './discovery-rules.js';
import { field, fieldToYard, footTarget, petHeight, sizeOf, yardToField, yardZoom } from './field.js';
import { groundProfile } from './ground.js';
import { isFree, release, rest, sendTo, setDoing } from './trips.js';
import { bubble, pose } from './views.js';
import { scene } from './world.js';

let intent = null;
const tasks = new Map();
// A friend that has just dug rests a moment (the backend's cooldown), so the next spot goes to another.
const lastDig = new Map();
// The tools the strip offers while one is in hand: digging, a tree, a seed (garden.js owns seeds).
const TOOLS = [
  ['dig', 'shovel', 'discovery.dig'],
  ['tree', 'tree', 'discovery.tree'],
  ['seed', 'sprout', 'garden.plant'],
];
const ownAim = () => intent && aiming === intent.action;
const stock = kind => data.garden?.saplings?.[kind] || 0;

function treeChoices() {
  const choices = $('discovery-tree-choices');
  if (intent?.action !== 'tree' || !choices) return;
  if (!stock(intent.kind)) intent.kind = TREES.find(tree => stock(tree.id))?.id || null;
  // Every state change comes here; the buttons are made once and updated in place, so a keyboard
  // user keeps focus on a choice.
  if (choices.children.length !== TREES.length)
    choices.replaceChildren(
      ...TREES.map(tree => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'discovery-tree-choice';
        button.dataset.treeKind = tree.id;
        return button;
      }),
    );
  for (const button of choices.children) {
    const kind = button.dataset.treeKind;
    button.disabled = !stock(kind);
    button.textContent = t('discovery.pocket', { kind: t(`tree.${kind}`), count: stock(kind) });
    button.title = t('discovery.sapling_source');
    button.setAttribute('aria-pressed', String(kind === intent.kind));
  }
  $('discovery-target-label').textContent = t(intent.kind ? 'discovery.choose_tree' : 'discovery.no_saplings');
  $('discovery-find-saplings').hidden = !!intent.kind;
}

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
  if (intent?.action === 'tree') treeChoices();
}

export function beginDiscovery(action) {
  const v = views.get(selected) || views.values().next().value;
  if (!v || game) return;
  if (!groundProfile().soil) return toast(t('discovery.indoors'));
  if (action === 'tree' && (data.garden?.trees || []).length >= limit(data, 'trees'))
    return toast(t('discovery.tree_total', { limit: limit(data, 'trees') }));
  if (
    action === 'tree' &&
    (data.garden?.trees || []).filter(tree => tree.world === scene.world).length >= limit(data, 'treesPerWorld')
  )
    return toast(t('discovery.tree_full', { limit: limit(data, 'treesPerWorld') }));
  cancelDiscovery();
  closeControls(false);
  closeScene();
  intent = { action, petId: v.pet.id, world: scene.world, kind: null };
  setAimingMode(action);
  $('discovery-target-label').textContent = t(action === 'dig' ? 'discovery.choose_dig' : 'discovery.choose_tree');
  $('discovery-tree-choices').hidden = action !== 'tree';
  $('discovery-find-saplings').hidden = true;
  treeChoices();
  $('discovery-target').hidden = false;
  $('yard').focus();
}

function positionAt(event) {
  if (intent?.action === 'tree' && !stock(intent.kind)) return null;
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
    task = {
      world,
      action,
      kind,
      cancelled: false,
      effect: null,
      timer: null,
      soilTimer: null,
      contactTimer: null,
      resumeContact: null,
    };
  const cleanup = () => {
    task.cancelled = true;
    clearTimeout(task.timer);
    clearTimeout(task.contactTimer);
    clearTimeout(task.soilTimer);
    task.resumeContact?.();
    task.effect?.remove();
    clearCompanionAction(v);
    if (v.pose === 'idle' && v.until === Infinity) v.until = 0;
    if (tasks.get(v) === task) tasks.delete(v);
  };
  release(v);
  tasks.set(v, task);
  const prepared = prepareCompanionAction(v.asset, action === 'tree' ? 'plant' : 'dig');
  prepareCompanionAction(v.asset, 'discover');
  const offset = actionGroundOffset(prepared, sizeOf(v.pet), petHeight(v.pet));
  sendTo(v, footTarget(v, pixel.x - offset.x, pixel.y - offset.y), {
    cancel: cleanup,
    arrive: guard(async () => {
      if (task.cancelled || scene.world !== world || !views.has(v.pet.id)) return cleanup();
      let ground = groundProfile();
      if (!groundAllows(point, ground)) return cleanup();
      const context = { season: scene.season, weather: scene.weather };
      setDoing(v, { end: cleanup });
      pose(v, 'idle', Infinity);
      let authored = beginCompanionAction(v, action === 'tree' ? 'plant' : 'dig');
      if (authored && !companionImage(authored)) {
        clearCompanionAction(v);
        authored = null;
      }
      const duration = authored?.duration ?? 1950;
      const effect = document.createElement('span');
      effect.className = `dig-effect${authored ? ' authored' : ''}`;
      effect.setAttribute('aria-hidden', 'true');
      effect.dataset.soil = scene.season === 'winter' ? 'winter' : 'base';
      effect.classList.toggle('planting', action === 'tree');
      effect.style.zIndex = String(
        Math.max(0, Math.min(1 + Math.round(point.y * 100), v.z ?? 1 + Math.round(v.y * 100)) - 1),
      );
      effect.innerHTML = `<span class="dig-soil"></span><span class="dig-dirt"></span>${authored?.clip.heldTool ? '' : artSvg('discovery/shovel.svg')}`;
      effect.style.left = `${pixel.x}px`;
      effect.style.top = `${pixel.y}px`;
      effect.style.setProperty('--dig-scale', String(yardZoom()));
      effect.style.setProperty('--dig-duration', `${duration}ms`);
      if (authored) {
        effect.style.setProperty('--dig-contact', `${authored.clip.contactAt ?? duration * 0.3}ms`);
        effect.style.setProperty('--dig-toss', `${authored.clip.tossAt ?? duration * 0.65}ms`);
      }
      $('garden-layer').append(effect);
      task.soilTimer = setTimeout(() => {
        if (!task.cancelled) effect.classList.add('contact');
      }, authored?.clip.contactAt ?? 300);
      task.effect = effect;
      const before = new Set(Object.keys(data.album?.treasures || {}));
      let result,
        finished = false;
      const reveal = () => {
        if (!finished || !result || task.cancelled) return;
        if (task.cancelled || scene.world !== world || !views.has(v.pet.id)) return cleanup();
        release(v);
        rest(v);
        if (action === 'tree' || (result.outcome && result.outcome !== 'empty')) beginCompanionAction(v, 'discover');
        if (action === 'tree') return bubble(v, t('discovery.planted'), 2600);
        if (result.repeated) return bubble(v, t('discovery.repeated'), 2600);
        if (result.outcome === 'keepsake') {
          const found = treasureKind(result.kind);
          if (found)
            showCard(
              artSvg(found.art),
              t(`treasure.${found.id}`),
              t('discovery.kept'),
              !before.has(found.id),
              'treasure',
            );
        } else if (result.outcome === 'sapling') {
          bubble(v, t('discovery.sapling', { kind: t(`tree.${result.kind}`) }), 3000);
        } else if (result.outcome === 'full' && result.kind) {
          bubble(v, t('discovery.sapling_full', { kind: t(`tree.${result.kind}`) }), 3000);
        } else bubble(v, t(`discovery.${result.outcome}`), 2600);
      };
      // Body/tool effects and the request start together; reveal waits for both, once.
      task.timer = setTimeout(() => {
        finished = true;
        reveal();
      }, duration);

      try {
        if (action === 'tree' && authored?.clip.commitAt > 0 && authored.clip.commitAt < duration) {
          await new Promise(resolve => {
            task.resumeContact = resolve;
            task.contactTimer = setTimeout(resolve, authored.clip.commitAt);
          });
          task.resumeContact = null;
          if (task.cancelled) return;
        }
        if (task.cancelled || scene.world !== world || !views.has(v.pet.id)) {
          if (v.doing?.end === cleanup) release(v);
          else cleanup();
          return;
        }
        if (action === 'tree') {
          // The planting stroke waits before contact; another prop may now occupy its target.
          ground = groundProfile();
          if (!groundAllows(point, ground)) {
            release(v);
            return;
          }
        }
        result =
          action === 'dig'
            ? await call('dig', v.pet.id, world, point.x, point.y, ground, context)
            : await call('plantTree', v.pet.id, world, kind, point.x, point.y, ground);
      } catch (error) {
        if (v.doing?.end === cleanup) release(v);
        else cleanup();
        throw error;
      }
      reveal();
    }),
  });
}

// A friend that has dug within the backend's cooldown sits out the next spot.
const rested = v => {
  const pause = limit(data, 'digCooldownMs');
  return performance.now() - (lastDig.get(v.pet.id) ?? -pause) >= pause;
};
// The friend for the next spot: the selected one when it is free and rested, else the nearest such friend.
function actorFor(point) {
  const ready = v => isFree(v) && !tasks.has(v) && (intent.action !== 'dig' || rested(v));
  const first = views.get(selected) || views.get(intent.petId);
  if (first && ready(first)) return first;
  const spot = fieldToYard(point);
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    if (!ready(v)) continue;
    const d = Math.hypot(v.px + sizeOf(v.pet) / 2 - spot.x, v.py + petHeight(v.pet) - spot.y);
    if (d < bestD) [best, bestD] = [v, d];
  }
  return best;
}
// Sends a friend to the spot and keeps the tool in hand: the next spot sends the next free friend,
// until Esc, the strip's Close or another tool puts it away.
function order(point, v = actorFor(point)) {
  if (!v) return toast(t('catch.busy'));
  const { action, kind } = intent;
  if (action === 'tree') {
    const pending = [...tasks.values()].filter(task => task.action === 'tree' && task.kind === kind).length;
    if (stock(kind) - pending <= 0) return toast(t('discovery.no_saplings'));
  }
  if (action === 'dig') lastDig.set(v.pet.id, performance.now());
  sendDiscovery(v, point, action, kind);
}
/** With Let them dig on (Settings → Friends & AI): an idle friend digs a spot of its own choosing.
 * Never during a game or while the person holds a tool; returns whether a friend set off. */
export function autoDig(rng = Math.random) {
  if (game || aiming || intent || !groundProfile().soil) return false;
  const idle = [...views.values()].filter(v => isFree(v) && !tasks.has(v) && rested(v));
  if (!idle.length) return false;
  const v = idle[Math.floor(rng() * idle.length)];
  for (let tries = 0; tries < 12; tries++) {
    const point = { x: 0.1 + rng() * 0.8, y: 0.15 + rng() * 0.75 };
    if (!groundAllows(point, groundProfile())) continue;
    lastDig.set(v.pet.id, performance.now());
    sendDiscovery(v, point, 'dig');
    return true;
  }
  return false;
}
/** Whether a right-click at this point of the window lands on ground a friend could dig. */
export function canDigAt(clientX, clientY) {
  if (game || !views.size || !groundProfile().soil) return false;
  const r = $('yard').getBoundingClientRect(),
    x = clientX - r.left,
    y = clientY - r.top,
    f = field();
  if (x < 14 || x > f.width - 14 || y < f.top || y > f.bottom) return false;
  return groundAllows(yardToField(x, y), groundProfile());
}
/** Digs at a right-clicked point at once, leaving the dig tool in hand for the next spot. */
export function digAt(clientX, clientY) {
  if (!canDigAt(clientX, clientY)) return;
  if (!ownAim() || intent.action !== 'dig') beginDiscovery('dig');
  const r = $('yard').getBoundingClientRect();
  if (intent) order(yardToField(clientX - r.left, clientY - r.top));
}
// The strip under the target line: which tool is in hand, and one press to switch or put it away.
function syncTools(kind = aiming) {
  const strip = $('discovery-tools');
  if (!strip) return;
  for (const button of strip.children) button.setAttribute('aria-pressed', String(button.dataset.tool === kind));
  const count = strip.querySelector('.tool-count');
  if (count) count.textContent = data.garden?.seeds ? String(data.garden.seeds) : '';
  if (kind === 'seed') {
    $('discovery-target-label').textContent = t('hint.plant');
    $('discovery-tree-choices').hidden = true;
    $('discovery-find-saplings').hidden = true;
    $('discovery-target').hidden = false;
  } else if (!kind && intent) {
    // Put away from elsewhere (a press on the lake or a creature): the dig or tree choice ends too.
    intent = null;
    $('discovery-target').hidden = true;
    if ($('discovery-marker')) $('discovery-marker').hidden = true;
  } else if (!kind) $('discovery-target').hidden = true;
}
function useTool(tool) {
  if (tool === 'seed') {
    cancelDiscovery();
    if (aiming !== 'seed') $('plant-tool').click();
    return;
  }
  beginDiscovery(tool);
}
export function setupDiscovery() {
  $('dig-tool').onclick = () => beginDiscovery('dig');
  $('tree-tool').onclick = () => beginDiscovery('tree');
  $('discovery-cancel').onclick = () => {
    if (aiming === 'seed') setAimingMode(false);
    cancelDiscovery();
  };
  $('discovery-tools')?.replaceChildren(
    ...TOOLS.map(([tool, icon, key]) => {
      const button = document.createElement('button'),
        mark = document.createElement('span'),
        label = document.createElement('span');
      button.type = 'button';
      button.className = 'discovery-tool';
      button.dataset.tool = tool;
      button.setAttribute('aria-keyshortcuts', String(TOOLS.findIndex(([name]) => name === tool) + 1));
      mark.dataset.icon = icon;
      label.textContent = t(key);
      button.append(mark, label);
      if (tool === 'seed') {
        const count = document.createElement('span');
        count.className = 'tool-count';
        button.append(count);
      }
      button.onclick = () => useTool(tool);
      return button;
    }),
  );
  if ($('discovery-tools')) icons($('discovery-tools'));
  onAimingChange(syncTools);
  // Only while a tool is in hand (not the menu bar's shortcuts): 1, 2 and 3 pick a tool from the strip.
  document.addEventListener('keydown', event => {
    if (!TOOLS.some(([tool]) => tool === aiming) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const tool = TOOLS[Number(event.key) - 1]?.[0];
    if (!tool || tool === aiming) return;
    event.preventDefault?.();
    useTool(tool);
  });
  $('discovery-find-saplings').onclick = () => beginDiscovery('dig');
  $('discovery-tree-choices').addEventListener('click', event => {
    const button = event.target.closest('[data-tree-kind]');
    if (!intent || !button || button.disabled || !stock(button.dataset.treeKind)) return;
    intent.kind = button.dataset.treeKind;
    for (const choice of $('discovery-tree-choices').querySelectorAll('[data-tree-kind]'))
      choice.setAttribute('aria-pressed', String(choice === button));
    $('yard').focus();
  });
  $('yard').addEventListener('pointermove', showMarker);
  $('yard').addEventListener('pointerleave', () => ($('discovery-marker').hidden = true));
  $('yard').addEventListener('click', event => {
    if (!ownAim() || event.target.closest('button,a,input,select,textarea')) return;
    const point = positionAt(event);
    if (point) order(point);
  });
  $('yard').addEventListener('keydown', event => {
    if (!ownAim() || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    const v = views.get(intent.petId);
    if (!v) return;
    const point = yardToField(v.px + sizeOf(v.pet) / 2, v.py + petHeight(v.pet));
    if (!groundAllows(point, groundProfile())) return toast(t('discovery.invalid'));
    order(point, actorFor(point));
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
