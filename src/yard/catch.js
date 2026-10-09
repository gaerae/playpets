// Fishing at the lake and catching bugs over the yard. A click on the lake sends the nearest free
// friend to its shore to fish: the float bobs, and when it dips a click on it lands the fish (wait
// too long and it gets away). A click on a butterfly, a dragonfly or a firefly lets the nearest
// friend leap for it. What is caught goes in the album (the backend keeps it:
// src-tauri/src/pets/album.rs) and is shown on a small card. Which fish bite and which bugs fly
// is the catalogue's (catalog.js). Nothing here runs between catches.

import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { $, aiming, call, data, game, guard, remember, toast, views } from '../core/state.js';
import { showCard } from './card.js';
import { bite, kindOf } from './catalog.js';
import { bugSvg, fishSvg } from './creatures.js';
import { BACK, heightAt, LAKE, trace } from './layout.js';
import { scene, scenery } from './sky.js';
import { bubble, effect, field, footTarget, hint, nearestFree, petHeight, pose, rest, sizeOf } from './views.js';

// How long a fish takes to bite (ms), and how long the float stays down before it gets away.
const BITE_AFTER = [3000, 9000];
const BITE_WINDOW = 1700;

// The lake as it lies in the yard now: its two ends, the height of its far shore, and the near
// hill's ridge that hides its near edge (the same shapes the painter uses, layout.js).
let lakeKey = '',
  lakeArea = null;
function lake() {
  const { width, height } = field(),
    key = `${width}x${height}`;
  if (key !== lakeKey) {
    lakeKey = key;
    const ridge = trace(BACK, width, height);
    lakeArea = { x0: LAKE.from * width, x1: LAKE.to * width, top: LAKE.top * height, ridge: x => heightAt(ridge, x) };
  }
  return lakeArea;
}
/** Whether a point in the yard is on the lake's water. */
export function onLake(x, y) {
  const l = lake();
  return x > l.x0 + 12 && x < l.x1 - 12 && y > l.top - 2 && y < l.ridge(x) + 4;
}

// Fishing: one friend at a time, at the place on the shore that was clicked.
let fishing = null;
function stopFishing() {
  if (!fishing) return;
  clearTimeout(fishing.timer);
  fishing.float?.remove();
  fishing.line?.remove();
  if (fishing.v.fishing) {
    fishing.v.fishing = false;
    rest(fishing.v);
  }
  fishing = null;
}
function startFishing(x) {
  if (fishing) return;
  const l = lake(),
    shore = l.ridge(x),
    v = nearestFree(x, shore);
  if (!v) return toast(t('catch.busy'));
  remember('fished', '1');
  hint();
  // The friend stands on the near shore just left of where the float goes.
  v.target = footTarget(v, x - sizeOf(v.pet) * 0.55, shore + 6);
  v.targetKind = 'fish';
  fishing = { v, x, y: l.top + (shore - l.top) * 0.45 };
}
/** Called by the frame loop when a friend reaches the shore it was sent to. */
export function fishArrived(v) {
  if (fishing?.v !== v || game) return stopFishing();
  v.fishing = true;
  v.nextWander = Infinity;
  bubble(v, pick(list('catch.casting')), 2600);
  const layer = $('garden-layer'),
    float = document.createElement('button'),
    line = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    rodX = v.px + sizeOf(v.pet) * 0.78,
    rodY = v.py + petHeight(v.pet) * 0.55,
    tipX = rodX + sizeOf(v.pet) * 0.35,
    tipY = rodY - petHeight(v.pet) * 0.55;
  float.type = 'button';
  float.className = 'bobber';
  float.setAttribute('aria-label', t('catch.too_soon'));
  float.style.left = `${fishing.x}px`;
  float.style.top = `${fishing.y}px`;
  float.addEventListener('click', e => {
    e.stopPropagation();
    reel();
  });
  line.setAttribute('class', 'fishing-line');
  line.innerHTML = `<path d="M${rodX} ${rodY}L${tipX} ${tipY}" stroke="#7a5a3a" stroke-width="2.4" stroke-linecap="round"/><path d="M${tipX} ${tipY}Q${(tipX + fishing.x) / 2} ${Math.max(tipY, fishing.y) + 6} ${fishing.x} ${fishing.y - 6}" fill="none" stroke="#f4f1e8" stroke-width="1" opacity=".9"/>`;
  layer.append(line, float);
  Object.assign(fishing, { float, line });
  fishing.timer = setTimeout(nibble, BITE_AFTER[0] + Math.random() * (BITE_AFTER[1] - BITE_AFTER[0]));
}
function nibble() {
  if (!fishing || fishing.v.drag || game) return stopFishing();
  fishing.biting = true;
  fishing.float.classList.add('bite');
  fishing.float.setAttribute('aria-label', t('catch.album'));
  fishing.timer = setTimeout(() => {
    if (!fishing) return;
    bubble(fishing.v, pick(list('catch.missed')), 2600);
    stopFishing();
  }, BITE_WINDOW);
}
const reel = guard(async () => {
  if (!fishing) return;
  if (!fishing.biting) return toast(t('catch.too_soon'));
  const { v } = fishing,
    { fish, size } = bite(scene.season, scene.period, scene.weather, Math.random);
  stopFishing();
  pose(v, 'jump', 1200);
  effect(v, '✦');
  bubble(v, pick(list('catch.caught')), 3000);
  const { first } = await call('catch', 'fish', fish.id, size);
  showCard(fishSvg(fish.look), t(`catch.fish_${fish.id}`), t('catch.size', { size: size.toFixed(1) }), first);
});

// A bug caught in the air: the nearest friend leaps for it.
const catchBug = guard(async caught => {
  const bug = kindOf('bug', caught.species);
  if (!bug) return;
  const v = nearestFree(caught.x, caught.y) || [...views.values()].find(f => !f.drag);
  if (v) {
    pose(v, 'jump', 1100);
    effect(v, '✦');
    bubble(v, pick(list('catch.bug_caught')), 2600);
  }
  const { first, entry } = await call('catch', 'bug', bug.id, 0);
  showCard(bugSvg(bug), t(`catch.bug_${bug.id}`), t('catch.count', { count: entry.count }), first);
});

// What a point in the yard can be caught at: a creature in the air, or the lake.
function free(e) {
  return (
    !aiming && !game && data.pets.length && !e.target.closest('.yard-pet, .plant, .decor, .found-seed, .bobber, button')
  );
}
function at(e) {
  const r = $('yard').getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
/** Wires catching to the yard's clicks and its pointer. Called once, by app.js. */
export function setupCatch() {
  const yard = $('yard');
  yard.addEventListener('click', e => {
    if (!free(e)) return;
    const [x, y] = at(e),
      caught = scenery.catchAt(x, y);
    if (caught) catchBug(caught);
    else if (onLake(x, y)) startFishing(x);
  });
  // Something to catch under the pointer shows as a hand.
  yard.addEventListener('pointermove', e => {
    const [x, y] = at(e),
      can = free(e) && (scenery.near(x, y) || onLake(x, y));
    yard.classList.toggle('can-catch', !!can);
  });
}
/** A game, a drag or the yard's size changing ends a fishing trip. */
export function endFishing() {
  stopFishing();
}
