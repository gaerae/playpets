// Fishing at the lake and catching bugs over the yard. A click on the lake sends the nearest free
// friend to its shore to fish: the float bobs, and when it dips a click on it lands the fish (wait
// too long and it gets away). A click on a butterfly, a dragonfly or a firefly lets the nearest
// friend leap for it; a close friend (level 3, bond.js) also fishes alone now and then. What is
// caught goes in the album (the backend keeps it: src-tauri/src/pets/album.rs) and is shown on a
// small card. Which fish bite and which bugs fly is the catalogue's (catalog.js).

import { list, t } from '../core/i18n.js';
import { between, pick } from '../core/math.js';
import { $, aiming, call, data, game, guard, name, remember, toast, views } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { befriend, levelOf } from './bond.js';
import { showCard } from './card.js';
import { bite, kindOf } from './catalog.js';
import { bugSvg, fishSvg } from './creatures.js';
import { field, footTarget, petHeight, sizeOf } from './field.js';
import { composition, heightAt, trace } from './layout.js';
import { cue } from './sound.js';
import { bubble, cheer, hint, isFree, nearestFree, release, rest, sendTo } from './views.js';
import { scene, scenery } from './world.js';

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
    const { from, to, top, under } = composition.lake,
      ridge = trace(composition.curves[under], width, height);
    lakeArea = { x0: from * width, x1: to * width, top: top * height, ridge: x => heightAt(ridge, x) };
  }
  return lakeArea;
}
/** Whether a point in the yard is on the lake's water. */
export function onLake(x, y) {
  const l = lake();
  return x > l.x0 + 12 && x < l.x1 - 12 && y > l.top - 2 && y < l.ridge(x) + 4;
}

// Fishing: one friend at a time, at the place on the shore that was clicked. The walk there is the
// friend's trip and the fishing its task (views.js), so whatever takes the friend ends the fishing.
let fishing = null;
const atLake = { end: () => stopFishing() };
function stopFishing() {
  if (!fishing) return;
  const { v, timer, float, line } = fishing;
  fishing = null;
  clearTimeout(timer);
  float?.remove();
  line?.remove();
  if (v.trip?.arrive === fishArrived) release(v);
  if (v.doing === atLake) {
    v.doing = null;
    rest(v);
  }
}
function startFishing(x, friend) {
  if (fishing) return;
  const l = lake(),
    shore = l.ridge(x),
    v = friend || nearestFree(x, shore);
  if (!v) return toast(t('catch.busy'));
  if (!friend) {
    remember('fished', '1');
    hint();
  }
  // The friend stands on the near shore just left of where the float goes.
  sendTo(v, footTarget(v, x - sizeOf(v.pet) * 0.55, shore + 6), { arrive: fishArrived, cancel: stopFishing });
  fishing = { v, x, y: l.top + (shore - l.top) * 0.45, solo: !!friend };
}
// The friend reached the shore it was sent to.
function fishArrived(v) {
  if (fishing?.v !== v || game) return stopFishing();
  v.doing = atLake;
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
  fishing.timer = setTimeout(nibble, between(Math.random, BITE_AFTER));
}
function nibble() {
  if (!fishing || fishing.v.drag || game) return stopFishing();
  fishing.biting = true;
  fishing.float.classList.add('bite');
  cue('plip');
  fishing.float.setAttribute('aria-label', t('catch.album'));
  // Fishing alone, the friend reels in itself, and lands most of what bites.
  if (fishing.solo && Math.random() < SOLO_LANDS) {
    fishing.timer = setTimeout(land, 500 + Math.random() * 700);
    return;
  }
  fishing.timer = setTimeout(() => {
    if (!fishing) return;
    bubble(fishing.v, pick(list('catch.missed')), 2600);
    stopFishing();
  }, BITE_WINDOW);
}
const land = guard(async () => {
  if (!fishing?.biting) return;
  const { v, solo } = fishing,
    { fish, size } = bite(scene.season, scene.period, scene.weather, Math.random);
  stopFishing();
  befriend(v.pet.id, 'catch');
  cue('splash');
  cheer(v, 'catch.caught', { ms: 1200 });
  const { first } = await call('catch', 'fish', fish.id, size),
    title = solo
      ? t('bond.solo_catch', { name: name(v.pet), fish: t(`catch.fish_${fish.id}`) })
      : t(`catch.fish_${fish.id}`);
  showCard(fishSvg(fish), title, t('catch.size', { size: size.toFixed(1) }), first);
});
function reel() {
  if (!fishing) return;
  if (!fishing.biting) return toast(t('catch.too_soon'));
  land();
}

// A close friend fishes on its own now and then, while the yard is quiet: no game, no trip already
// at the lake, and the friend idle.
const SOLO_EVERY = [12 * 60 * 1000, 25 * 60 * 1000];
const SOLO_LANDS = 0.75;
const solo = cadence(() => between(Math.random, SOLO_EVERY));
/** Called by the frame loop while the yard is seen. */
export function soloFishing(now) {
  if (!solo.due(now) || fishing || game || aiming) return;
  const keen = [...views.values()].filter(v => isFree(v) && levelOf(v.pet.id) >= 3);
  if (!keen.length) return;
  const l = lake();
  startFishing(l.x0 + (l.x1 - l.x0) * (0.3 + Math.random() * 0.4), pick(keen));
}

// A bug caught in the air: the nearest friend leaps for it.
const catchBug = guard(async caught => {
  const bug = kindOf('bug', caught.species);
  if (!bug) return;
  const v = nearestFree(caught.x, caught.y) || [...views.values()].find(f => !f.drag);
  if (v) {
    befriend(v.pet.id, 'catch');
    cue('catch');
    cheer(v, 'catch.bug_caught', { say: 2600 });
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
/** The yard's size changing ends a fishing trip (the float would be left where the lake was). */
export function endFishing() {
  stopFishing();
}
