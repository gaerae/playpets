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
import { environmentFishingSpot, environmentLake } from './environment.js';
import { field, footTarget, petHeight, sizeOf } from './field.js';
import { castGeometry, castLandingX, linePath, ROD, rodPlacement, rodUrl } from './fishing-rod.js';
import { hint } from './hint.js';
import { composition, lakeShape, trace } from './layout.js';
import { cue } from './sound.js';
import { isFree, nearestFree, release, rest, sendTo, setDoing } from './trips.js';
import { bubble, cheer } from './views.js';
import { scene, scenery } from './world.js';
import { worldAllows } from './worlds.js';

// How long a fish takes to bite (ms), and how long the float stays down before it gets away.
const BITE_AFTER = [3000, 9000];
const BITE_WINDOW = 1700;

// The lake as it lies in the yard now: the same shape the painter draws (layout.js lakeShape),
// made again only when the yard changes size.
let lakeKey = '',
  lakeArea = null;
function lake() {
  const { width, height } = field(),
    illustrated = $('yard').dataset.environment === 'illustrated',
    key = `${width}x${height}:${illustrated}:${scene.world}`;
  if (key !== lakeKey) {
    lakeKey = key;
    lakeArea = illustrated
      ? environmentLake(width, height, scene)
      : lakeShape(width, height, trace(composition.curves[composition.lake.under], width, height));
  }
  return lakeArea;
}
/** Whether a point in the yard is on the lake's water (a few pixels in from where it shows). */
export function onLake(x, y) {
  if (!worldAllows(scene.world, 'fishing')) return false;
  const l = lake();
  return x > l.ends[0] + 6 && x < l.ends[1] - 6 && l.onWater(x, y + 2);
}

// Fishing: one friend at a time, at the place on the shore that was clicked. The walk there is the
// friend's trip and the fishing its task (views.js), so whatever takes the friend ends the fishing.
let fishing = null;
const atLake = { end: () => stopFishing() };
function stopFishing() {
  if (!fishing) return;
  const { v, timer, float, line, rod } = fishing;
  fishing = null;
  clearTimeout(timer);
  float?.remove();
  line?.remove();
  rod?.remove();
  if (v.trip?.arrive === fishArrived) release(v);
  if (v.doing === atLake) {
    v.doing = null;
    rest(v);
  }
}
function startFishing(x, friend) {
  if (!worldAllows(scene.world, 'fishing')) return;
  if (fishing) return;
  const l = lake(),
    shore = l.ridgeAt(x),
    v = friend || nearestFree(x, shore);
  if (!v) return toast(t('catch.busy'));
  if (!friend) {
    remember('fished', '1');
    hint();
  }
  const area = field();
  const stance =
    $('yard').dataset.environment === 'illustrated' ? environmentFishingSpot(area.width, area.height, scene) : null;
  // Authored stances keep pets on a dock or bank; otherwise stand beside the visible shore.
  sendTo(v, footTarget(v, stance?.x ?? x - sizeOf(v.pet) * 0.55, stance?.y ?? shore + 6), {
    arrive: fishArrived,
    cancel: stopFishing,
  });
  fishing = { v, x, y: l.shoreAt(x) + (shore - l.shoreAt(x)) * 0.45, solo: !!friend };
}
// The friend reached the shore it was sent to.
function fishArrived(v) {
  if (fishing?.v !== v || game) return stopFishing();
  setDoing(v, atLake);
  bubble(v, pick(list('catch.casting')), 2600);
  const layer = $('garden-layer'),
    float = document.createElement('button'),
    rod = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    line = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    rodX = v.px + sizeOf(v.pet) * 0.6,
    rodY = v.py + petHeight(v.pet) * 0.74;
  const water = lake();
  fishing.x = castLandingX(rodX, fishing.x, sizeOf(v.pet), water.ends);
  fishing.y = water.shoreAt(fishing.x) + (water.ridgeAt(fishing.x) - water.shoreAt(fishing.x)) * 0.45;
  const cast = castGeometry({ x: rodX, y: rodY }, { x: fishing.x, y: fishing.y }, sizeOf(v.pet), petHeight(v.pet));
  float.type = 'button';
  float.className = 'bobber';
  float.setAttribute('aria-label', t('catch.too_soon'));
  float.style.left = `${fishing.x}px`;
  float.style.top = `${fishing.y}px`;
  float.addEventListener('click', e => {
    e.stopPropagation();
    reel();
  });
  rod.setAttribute('class', 'fishing-rod');
  rod.setAttribute('aria-hidden', 'true');
  rod.style.zIndex = String(Math.max(0, (v.z || 0) - 1));
  const matrix = rodPlacement(cast.grip, cast.tip);
  rod.innerHTML = `<image href="${rodUrl}" width="${ROD.width}" height="${ROD.height}" transform="matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})"/>`;
  line.setAttribute('class', 'fishing-line');
  line.setAttribute('aria-hidden', 'true');
  line.setAttribute('fill', 'none');
  line.style.zIndex = String((v.z || 0) + 1);
  const cord = linePath(cast.tip, cast.float);
  line.innerHTML = `<path d="${cord}" stroke="#243c42" stroke-width="2.5" opacity=".55"/><path d="${cord}" stroke="#f4efe0" stroke-width="1.1" opacity=".95"/>`;
  layer.append(rod, line, float);
  Object.assign(fishing, { float, line, rod });
  fishing.timer = setTimeout(nibble, between(Math.random, BITE_AFTER));
}
function nibble() {
  if (!fishing || fishing.v.drag || game) return stopFishing();
  fishing.biting = true;
  fishing.float.classList.add('bite');
  cue('plip');
  fishing.float.setAttribute('aria-label', t('catch.reel'));
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
  const world = scene.world,
    { v, solo } = fishing,
    { fish, size } = bite(scene.season, scene.period, scene.weather, Math.random, scene.event);
  stopFishing();
  const { first } = await call('catch', 'fish', fish.id, size);
  if (views.get(v.pet.id) === v) {
    befriend(v.pet.id, 'catch');
    if (scene.world === world && !game) {
      cue('splash');
      cheer(v, 'catch.caught', { ms: 1200 });
    }
  }
  const title = solo
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
  if (!worldAllows(scene.world, 'fishing') || !solo.due(now) || fishing || game || aiming) return;
  const keen = [...views.values()].filter(v => isFree(v) && levelOf(v.pet.id) >= 3);
  if (!keen.length) return;
  const l = lake();
  const [a, b] = l.ends,
    x = a + (b - a) * (0.3 + Math.random() * 0.4);
  // Only where the water shows (a lake drawn lower than the hill in front shows none).
  if (l.onWater(x, l.ridgeAt(x) - 1)) startFishing(x, pick(keen));
}

const nets = new Set();
function sweepNet(v) {
  const net = document.createElement('span'),
    width = Math.max(36, sizeOf(v.pet) * 0.6),
    leftSide = v.px + sizeOf(v.pet) + width * 0.6 > field().width - 10;
  net.className = 'bug-net';
  net.setAttribute('aria-hidden', 'true');
  net.dataset.side = leftSide ? 'left' : 'right';
  net.style.width = `${width}px`;
  net.style.height = `${width * 1.4}px`;
  net.style.top = `${petHeight(v.pet) * 0.74 - width * 1.4 * 0.9}px`;
  net.style[leftSide ? 'right' : 'left'] = `${sizeOf(v.pet) * 0.58 - (width * 12) / 90}px`;
  net.innerHTML =
    '<svg viewBox="0 0 90 126" fill="none"><g class="net-sweep"><path d="M12 114L53 44" stroke="#493e30" stroke-width="6" stroke-linecap="round"/><path d="M12 114L53 44" stroke="#cda56c" stroke-width="3.6" stroke-linecap="round"/><path d="M12 114L20 100" stroke="#765840" stroke-width="5" stroke-linecap="round"/><g transform="rotate(-22 65 29)"><path d="M42 25Q43 60 65 59Q87 58 88 25" fill="#e9f4dc33" stroke="#496158" stroke-width="1.8"/><path d="M47 34Q65 43 83 34M50 44Q65 52 80 44M55 52Q65 57 75 52M52 26Q51 47 60 57M65 29V59M78 26Q79 47 70 57" stroke="#f4f4dc" stroke-width="1.3"/><ellipse cx="65" cy="25" rx="23" ry="12" fill="#e9f4dc22" stroke="#3a544a" stroke-width="4"/><ellipse cx="65" cy="25" rx="23" ry="12" stroke="#dbe8c7" stroke-width="2"/></g></g></svg>';
  // A child of the friend follows its movement and stays behind its painted face.
  v.button.append(net);
  const remove = () => {
    clearTimeout(entry.timer);
    net.remove();
    nets.delete(entry);
  };
  const entry = { remove, timer: setTimeout(remove, 850) };
  nets.add(entry);
}

// A bug caught in the air: the nearest friend leaps for it.
const catchBug = guard(async caught => {
  const bug = kindOf('bug', caught.species);
  if (!bug) return;
  const world = scene.world,
    v = nearestFree(caught.x, caught.y) || [...views.values()].find(f => !f.drag);
  const { first, entry } = await call('catch', 'bug', bug.id, 0);
  if (v && views.get(v.pet.id) === v) {
    befriend(v.pet.id, 'catch');
    if (scene.world === world && !game) {
      cue('catch');
      sweepNet(v);
      cheer(v, 'catch.bug_caught', { say: 2600 });
    }
  }
  showCard(bugSvg(bug), t(`catch.bug_${bug.id}`), t('catch.count', { count: entry.count }), first);
});

// What a point in the yard can be caught at: a creature in the air, or the lake.
function free(e) {
  return (
    !aiming &&
    !game &&
    data.pets.length &&
    !e.target.closest('.yard-pet, .pet-tag, .plant, .decor, .found-seed, .bobber, button')
  );
}
function at(e) {
  const r = $('yard').getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
/** Wires catching to the yard's clicks and its pointer. Called once, by app.js. */
export function setupCatch() {
  const yard = $('yard');
  const tool = $('fish-tool');
  if (tool) {
    const update = () => {
      tool.hidden = !worldAllows(scene.world, 'fishing');
    };
    update();
    $('world')?.addEventListener('change', update);
    tool.addEventListener('click', () => {
      if (aiming || game || !worldAllows(scene.world, 'fishing')) return;
      if (fishing) {
        fishing.float?.focus();
        return;
      }
      const water = lake();
      const x = (water.ends[0] + water.ends[1]) / 2;
      const y = (water.shoreAt(x) + water.ridgeAt(x)) / 2;
      if (water.onWater(x, y)) startFishing(x);
    });
  }
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
  for (const net of nets) net.remove();
  $('yard').classList.remove('can-catch');
}
