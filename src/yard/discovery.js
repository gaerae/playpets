// Brief, friend-led tasks: choose ground, walk there, then commit one discovery.

import { closeControls, closeScene } from '../core/controls.js';
import { put } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { onEscape, typing } from '../core/keys.js';
import { limit } from '../core/limits.js';
import { dropdown, menuNavigation } from '../core/menu.js';
import { $, aiming, call, data, game, guard, selected, toast, views } from '../core/state.js';
import { artSvg } from './art.js';
import { befriend } from './bond.js';
import { rareKind, showCard } from './card.js';
import { onAimingChange, setAimingMode } from './care.js';
import { treeArt, TREES, treasureKind } from './catalog.js';
import { toolGivesWay } from './catch.js';
import { groundAllows } from './discovery-rules.js';
import { EDGE, field, fieldToYard, petHeight, sizeOf, topAt, yardToDecor, yardToField } from './field.js';
import { noRoomForSeed, seedLook, seedSpot, spareSeeds } from './garden.js';
import { groundProfile } from './ground.js';
import { saplingPreview } from './planted-trees.js';
import { atRainbowEnd, clearRainbowEnd } from './rainbow-end.js';
import { learn } from './show-how.js';
import { atTrailEnd, reservedForTrail } from './trails.js';
import { forPerson, isFree, release } from './trips.js';
import { bubble, clearAllOfDock } from './views.js';
import { doneDigging, sendToDig, startDig, stopWork } from './work.js';
import { scene } from './world.js';

/** The strip's lines that say what to do with the tool in hand: shown by the tools and the hand
 * tapping the ground (show-how.js), so read aloud rather than drawn. The rest, why a tool waits,
 * stays in sight. */
export const HOW_LINES = new Set(['discovery.choose_dig', 'discovery.choose_tree', 'hint.plant', 'hint.treat']);
function stripSays(key) {
  const label = $('discovery-target-label');
  label.textContent = t(key);
  label.classList.toggle('sr-only', HOW_LINES.has(key));
}

let intent = null;
// The menu of saplings, wired once by setupDiscovery; ending a choice closes it with the strip.
let treeMenu = null;
const tasks = new Map();
/** Whether a tool is in hand or a friend is digging or planting: nothing else should call it away then. */
export const digging = () => !!intent || tasks.size > 0;
// The tools the strip offers while one is in hand: digging, a tree, a seed (garden.js owns seeds).
const TOOLS = [
  ['dig', 'shovel', 'discovery.dig'],
  ['tree', 'tree', 'discovery.tree'],
  ['seed', 'sprout', 'garden.plant'],
];
const ownAim = () => intent && aiming === intent.action;
const stock = kind => data.garden?.saplings?.[kind] || 0;
// The saplings of a kind left to plant: one a friend is on its way to plant is already promised, as a
// seed is (garden.js spareSeeds).
const spare = kind => Math.max(0, stock(kind) - planting().filter(task => task.kind === kind).length);
const saplingArt = kind => treeArt(kind, 0, scene.season) || '';
/** The tool in hand that marks the ground: a dig or a tree chosen here, or a seed (garden.js). */
const inHand = () => (ownAim() ? intent.action : aiming === 'seed' ? 'seed' : null);
// The sapling in hand, here and in the menu: its picture, its name and how many.
// The picture is drawn again only when it changes, as the strip is updated on every state change.
function inHandRow(picture, name, art, { text }) {
  if (picture && picture.dataset.art !== art) {
    picture.dataset.art = art;
    picture.innerHTML = art ? artSvg(art) : '';
  }
  if (name) name.textContent = text;
}
// The seeds in hand, as the sapling picker shows a sapling; with none, where seeds come from and
// the dig that finds them, as for a sapling.
function seedHand() {
  const seeds = spareSeeds();
  $('discovery-seed-hand').hidden = !seeds;
  // No friend digs a floor (beginDiscovery), so a room offers no dig it would refuse.
  $('discovery-find').hidden = !!seeds || !groundProfile().soil;
  // Its picture is the seed packet (index.html), as a planted seed is a speck at that size.
  if (seeds) $('discovery-seed-current').textContent = t('garden.seeds_in_hand', { count: seeds });
  stripSays(seeds ? 'hint.plant' : 'garden.no_seeds');
}

function treeChoices() {
  const choices = $('discovery-tree-choices');
  if (intent?.action !== 'tree' || !choices) return;
  if (!spare(intent.kind)) intent.kind = TREES.find(tree => spare(tree.id))?.id || null;
  // Every state change comes here; the choices are made once and updated in place, so a keyboard
  // user keeps focus on one.
  if (choices.children.length !== TREES.length)
    choices.replaceChildren(
      ...TREES.map(tree => {
        const button = document.createElement('button'),
          picture = document.createElement('span'),
          name = document.createElement('span');
        button.type = 'button';
        button.setAttribute('role', 'menuitemradio');
        button.dataset.treeKind = tree.id;
        picture.className = 'hand-picture';
        picture.setAttribute('aria-hidden', 'true');
        name.className = 'hand-name';
        button.append(picture, name);
        return button;
      }),
    );
  // One button names the sapling in hand and opens the rest, so the strip keeps its size however
  // many kinds are found; the menu lists only the saplings in the pocket (the album lists every kind).
  for (const button of choices.children) {
    const kind = button.dataset.treeKind;
    button.disabled = !spare(kind);
    button.hidden = !spare(kind);
    inHandRow(button.querySelector('.hand-picture'), button.querySelector('.hand-name'), saplingArt(kind), {
      text: t('discovery.pocket', { kind: t(`tree.${kind}`), count: spare(kind) }),
    });
    button.title = t('discovery.sapling_source');
    button.setAttribute('aria-checked', String(kind === intent.kind));
  }
  if (intent.kind)
    inHandRow($('discovery-tree-picture'), $('discovery-tree-current'), saplingArt(intent.kind), {
      text: t('discovery.pocket', { kind: t(`tree.${intent.kind}`), count: spare(intent.kind) }),
    });
  $('discovery-tree-picker').hidden = !intent.kind;
  stripSays(intent.kind ? 'discovery.choose_tree' : 'discovery.no_saplings');
  $('discovery-find').hidden = !!intent.kind;
}

export function cancelDiscovery() {
  if (ownAim()) setAimingMode(false);
  intent = null;
  treeMenu?.close();
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
  syncSoilTools();
  syncHand();
}
// The dig and the tree, on the yard's tools and on the strip: no friend digs or plants a floor.
function syncSoilTools() {
  const soil = groundProfile().soil;
  for (const id of ['dig-tool', 'tree-tool']) {
    const button = $(id);
    if (!button) continue;
    put(button, 'disabled', !soil || !views.size || !!game);
    put(button, 'title', t(soil ? `discovery.${id === 'dig-tool' ? 'dig' : 'tree'}_hint` : 'discovery.indoors'));
  }
  for (const button of $('discovery-tools')?.children || []) {
    if (button.dataset.tool === 'seed') continue;
    put(button, 'disabled', !soil);
    put(button, 'title', soil ? '' : t('discovery.indoors'));
  }
}
// The hand row, again whenever what is in hand changes: the state, or a friend setting off to plant.
function syncHand() {
  if (intent?.action === 'tree') treeChoices();
  if (aiming === 'seed') seedHand();
}

// Trees friends are on their way to plant: not saved yet, or saved but not yet in the state the
// page was sent, which can come a moment after the answer.
const planting = () =>
  [...tasks.values()].filter(
    task => task.action === 'tree' && !data.garden?.trees?.some(tree => tree.id === task.saved),
  );
// Why no other tree fits, counting those on their way; nothing when one does. One yard of trees
// stands in every place, so wherever they were planted counts.
function noRoomForTree() {
  const count = (data.garden?.trees || []).length + planting().length;
  return count >= limit(data, 'trees') ? t('discovery.tree_total', { limit: limit(data, 'trees') }) : '';
}
// Why a sapling of `kind` cannot be planted now; nothing when it can. The marker and the press ask here.
const treeRefused = kind => noRoomForTree() || (spare(kind) > 0 ? '' : t('discovery.no_saplings'));

export function beginDiscovery(action) {
  const v = views.get(selected) || views.values().next().value;
  if (!v || game) return;
  if (!groundProfile().soil) return toast(t('discovery.indoors'));
  const full = action === 'tree' && noRoomForTree();
  if (full) return toast(full);
  cancelDiscovery();
  closeControls(false);
  closeScene();
  intent = { action, petId: v.pet.id, world: scene.world, kind: null };
  setAimingMode(action);
  stripSays(action === 'dig' ? 'discovery.choose_dig' : 'discovery.choose_tree');
  $('discovery-tree-picker').hidden = true;
  $('discovery-seed-hand').hidden = true;
  $('discovery-find').hidden = true;
  treeChoices();
  $('discovery-target').hidden = false;
  clearAllOfDock();
  $('yard').focus();
}

// A sapling may be planted as low as a gift may stand, below the friends' field; a dig stays on it.
const reach = action => ({ planting: action === 'tree' });
function positionAt(event) {
  const tree = intent?.action === 'tree';
  if (tree && !spare(intent.kind)) return null;
  const r = $('yard').getBoundingClientRect(),
    x = event.clientX - r.left,
    y = event.clientY - r.top,
    f = field();
  if (x < f.left + EDGE || x > f.right - EDGE || y < topAt(x)) return null;
  if (!tree && y > f.bottom) return null;
  const point = tree ? yardToDecor(x, y) : yardToField(x, y);
  // Below the floor, the click is not on the ground at all.
  if (tree && fieldToYard(point).y < y - 1) return null;
  return groundAllows(point, groundProfile(), reach(intent?.action)) ? point : null;
}

// Every tool that marks the ground marks it here, each by its own rule for where it may go: a dig and
// a sapling on soil (positionAt), a seed on the field, in a pot indoors too (garden.js seedSpot).
function showMarker(event) {
  const marker = $('discovery-marker'),
    tool = inHand();
  // Nor where the press would put the tool away to catch or fish instead (catch.js).
  if (!tool || toolGivesWay(event)) {
    marker.hidden = true;
    return;
  }
  const r = $('yard').getBoundingClientRect(),
    at = { x: event.clientX - r.left, y: event.clientY - r.top },
    valid =
      tool === 'seed'
        ? spareSeeds() > 0 && !noRoomForSeed() && !!seedSpot(at.x, at.y)
        : !!positionAt(event) && !(tool === 'tree' && treeRefused(intent.kind));
  marker.hidden = false;
  marker.classList.toggle('invalid', !valid);
  marker.style.left = `${at.x}px`;
  marker.style.top = `${at.y}px`;
  markSpot(marker, at, tool);
}
// The spot shows what will happen there: a patch of turned soil (the season's; none on a floor), and
// in it a see-through look of what goes in, the sapling in hand or a seed, at the size it starts at
// that depth (garden.css).
function markSpot(marker, at, tool) {
  marker.dataset.soil = !groundProfile().soil ? 'none' : scene.season === 'winter' ? 'winter' : 'base';
  if (!marker.parts) {
    const soil = document.createElement('span'),
      look = document.createElement('span');
    soil.className = 'marker-soil';
    look.className = 'marker-sapling';
    marker.replaceChildren(soil, look);
    marker.parts = { soil, look };
  }
  const sapling = marker.parts.look,
    look =
      tool === 'seed'
        ? seedLook(at)
        : tool === 'tree' && intent.kind
          ? saplingPreview(intent.kind, at, scene.season)
          : null;
  if (sapling.dataset.art !== (look?.art || '')) {
    sapling.dataset.art = look?.art || '';
    sapling.innerHTML = look ? artSvg(look.art) : '';
  }
  if (!look) return marker.style.removeProperty('--zoom');
  sapling.style.width = `${look.width}px`;
  sapling.style.height = `${look.height}px`;
  marker.style.setProperty('--zoom', String(look.zoom));
}

/** A task owns its timer and effect. Taking the friend away cancels only the presentation. `own` is
 * a spot the friend chose itself (autoDig). */
export function sendDiscovery(v, point, action, kind, own = false) {
  const world = scene.world,
    stroke = action === 'tree' ? 'plant' : 'dig',
    task = {
      world,
      action,
      kind,
      cancelled: false,
      dig: null,
      timer: null,
      contactTimer: null,
      resumeContact: null,
    };
  const cleanup = () => {
    task.cancelled = true;
    clearTimeout(task.timer);
    clearTimeout(task.contactTimer);
    task.resumeContact?.();
    task.dig?.stop();
    stopWork(v);
    if (tasks.get(v) === task) tasks.delete(v);
    task.reveal?.();
    syncHand();
  };
  release(v);
  tasks.set(v, task);
  syncHand();
  sendToDig(v, point, stroke, {
    own,
    cancel: cleanup,
    arrive: guard(async () => {
      if (task.cancelled || scene.world !== world || !views.has(v.pet.id)) return cleanup();
      let ground = groundProfile();
      if (!groundAllows(point, ground, reach(action))) return cleanup();
      const context = {
        season: scene.season,
        weather: scene.weather,
        rainbow: atRainbowEnd(point),
        trail: atTrailEnd(point),
      };
      task.dig = startDig(v, point, stroke, cleanup);
      const { authored, duration } = task.dig;
      const before = new Set(Object.keys(data.album?.treasures || {}));
      let result,
        finished = false,
        told = false;
      // What was found, said once: as the stroke ends, or at once when it was cut short after the
      // backend kept the find (a new window size cancels the yard's work), so a find is never
      // silent. Nothing found, or a patch dug before, is not worth a word then.
      const reveal = () => {
        if (!result || told) return;
        if (task.cancelled) {
          const found = action === 'tree' || (!result.repeated && !!result.outcome && result.outcome !== 'empty');
          if (!found || !views.has(v.pet.id)) return;
          told = true;
        } else {
          if (!finished) return;
          if (scene.world !== world || !views.has(v.pet.id)) return cleanup();
          // Told before the stroke ends: ending it lets the friend go (cleanup), which asks again.
          told = true;
          doneDigging(v, action === 'tree' || (!!result.outcome && result.outcome !== 'empty'));
        }
        // A dig the person asked for is done together (bond.rs `dig`); one the friend chose is its own.
        if (action === 'dig' && !own && !result.repeated) befriend(v.pet.id, 'dig');
        // However the person asked for it, the tool or Dig here from the yard's menu, it is learned:
        // the hand stops pointing at Dig (hint.js).
        if (action === 'dig' && !own) learn('dig');
        if (action === 'tree') return bubble(v, t('discovery.planted'), 2600);
        if (result.repeated) return bubble(v, t('discovery.repeated'), 2600);
        if (result.outcome === 'keepsake') {
          const found = treasureKind(result.kind);
          if (found)
            showCard(
              artSvg(found.art),
              t(`treasure.${found.id}`),
              // A first find says "new in the album" on its own line; saying "kept" too repeats it.
              before.has(found.id) ? t('discovery.kept') : '',
              !before.has(found.id),
              'treasure',
              null,
              { rare: rareKind('treasure', found) },
            );
        } else if (result.outcome === 'sapling') {
          bubble(v, t('discovery.sapling', { kind: t(`tree.${result.kind}`) }), 3000);
        } else if (result.outcome === 'full' && result.kind) {
          bubble(v, t('discovery.sapling_full', { kind: t(`tree.${result.kind}`) }), 3000);
        } else bubble(v, t(`discovery.${result.outcome}`), 2600);
      };
      task.reveal = reveal;
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
          if (!groundAllows(point, ground, reach(action))) {
            release(v);
            return;
          }
        }
        // The backend's cooldown starts with this request, so the friend's rest does too.
        if (action === 'dig') v.dugAt = performance.now();
        result =
          action === 'dig'
            ? await call('dig', v.pet.id, world, point.x, point.y, ground, context)
            : await call('plantTree', v.pet.id, world, kind, point.x, point.y, ground);
        // Saved: once the page's state holds this tree, it is no longer only on the way.
        task.saved = result?.id;
        // The backend now remembers that tile, so another dig there would only repeat this find.
        if (context.rainbow) clearRainbowEnd();
      } catch (error) {
        if (v.doing?.end === cleanup) release(v);
        else cleanup();
        throw error;
      }
      reveal();
    }),
  });
}

// A friend that has dug within the backend's cooldown sits out the next spot, so it goes to another.
// When it last dug is kept on the friend itself (`v.dugAt`, set as the dig is asked for); one on
// its way to a spot is busy anyway.
const rested = v => {
  const pause = limit(data, 'digCooldownMs');
  return performance.now() - (v.dugAt ?? -pause) >= pause;
};
/** Whether a friend may dig again yet (trails.js picks who follows a trail by it, through app.js). */
export const digRested = rested;
// The friend for the next spot: the selected one when it is free and rested, else the nearest such
// friend, else one viewing the blossom (trips.js forPerson).
function actorFor(point) {
  const ready = v => !tasks.has(v) && (intent.action !== 'dig' || rested(v)),
    spot = fieldToYard(point);
  return forPerson(spot.x, spot.y, views.get(selected) || views.get(intent.petId), ready);
}
// Sends a friend to the spot and keeps the tool in hand: the next spot sends the next free friend,
// until Esc, the strip's Close or another tool puts it away.
function order(point, v = actorFor(point)) {
  if (!v) return toast(t('catch.busy'));
  const { action, kind } = intent;
  const refused = action === 'tree' && treeRefused(kind);
  if (refused) return toast(refused);
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
    // A winter trail's end waits for its follow's dig, and the rainbow's end for the person's.
    if (!groundAllows(point, groundProfile()) || reservedForTrail(point) || atRainbowEnd(point)) continue;
    sendDiscovery(v, point, 'dig', undefined, true);
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
  if (x < f.left + EDGE || x > f.right - EDGE || y < topAt(x) || y > f.bottom) return false;
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
  if (kind !== 'seed') $('discovery-seed-hand').hidden = true;
  if (kind === 'seed' || kind === 'treat') {
    treeMenu?.close();
    $('discovery-tree-picker').hidden = true;
    if (kind === 'seed') seedHand();
    else {
      stripSays('hint.treat');
      $('discovery-find').hidden = true;
    }
    if ($('discovery-target').hidden) {
      $('discovery-target').hidden = false;
      clearAllOfDock();
    }
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
    if (aiming === 'seed' || aiming === 'treat') setAimingMode(false);
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
      button.onclick = () => useTool(tool);
      return button;
    }),
  );
  if ($('discovery-tools')) icons($('discovery-tools'));
  onAimingChange(syncTools);
  // Only while a tool is in hand (not the menu bar's shortcuts): 1, 2 and 3 pick a tool from the strip.
  document.addEventListener('keydown', event => {
    if (!TOOLS.some(([tool]) => tool === aiming) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (typing(event)) return;
    const tool = TOOLS[Number(event.key) - 1]?.[0];
    if (!tool || tool === aiming) return;
    event.preventDefault?.();
    useTool(tool);
  });
  $('discovery-find').onclick = () => beginDiscovery('dig');
  // A popup menu that opens on the sapling in hand rather than the first in the list.
  const saplings = menuNavigation($('discovery-tree-choices'));
  treeMenu = dropdown($('discovery-tree-button'), $('discovery-tree-choices'), () =>
    (saplings().find(item => item.getAttribute('aria-checked') === 'true') || saplings()[0])?.focus(),
  );
  $('discovery-tree-choices').addEventListener('click', event => {
    const button = event.target.closest('[data-tree-kind]');
    if (!intent || !button || button.disabled || !stock(button.dataset.treeKind)) return;
    intent.kind = button.dataset.treeKind;
    treeMenu.close();
    treeChoices();
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
    if (!groundAllows(point, groundProfile(), reach(intent.action))) return toast(t('discovery.invalid'));
    order(point, actorFor(point));
  });
  onEscape(event => {
    if (!intent) return;
    event.preventDefault();
    cancelDiscovery();
    $('yard').focus();
  });
  document.addEventListener('click', event => {
    if (intent && (!ownAim() || event.target.closest('[data-panel],#scene-button,#yard-controls-toggle')))
      cancelDiscovery();
  });
}
