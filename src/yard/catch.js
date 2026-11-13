// Fishing at the lake and catching bugs over the yard. A click on the lake sends the nearest free
// friend to its shore to fish: the float bobs, and when it dips a click on it lands the fish (wait
// too long and it gets away). A click on a butterfly, a dragonfly or a firefly lets the nearest
// friend leap for it; a close friend (level 3, bond.js) also fishes alone now and then. What is
// caught goes in the album (the backend keeps it: src-tauri/src/pets/album.rs) and is shown on a
// small card. Which fish bite and which bugs fly is the catalogue's (catalog.js).

import {
  clearCompanionAction,
  companionAction,
  companionImage,
  playCompanionAction,
  prepareCompanionAction,
} from '../core/companion-actions.js';
import { put } from '../core/dom.js';
import { list, t } from '../core/i18n.js';
import { between, pick } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, call, data, game, guard, remember, selected, toast, views } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { befriend, levelOf } from './bond.js';
import { showCard } from './card.js';
import { setAimingMode } from './care.js';
import { bite, kindOf } from './catalog.js';
import { bugSvg, fishSvg } from './creatures.js';
import { environmentFishingSpot, environmentLake } from './environment.js';
import { drawnBox, field, footTarget, inYard, petHeight, sizeOf } from './field.js';
import { authoredRodTip, castGeometry, castLandingX, linePath, ROD, rodPlacement, rodUrl } from './fishing-rod.js';
import { hint } from './hint.js';
import { composition, lakeShape, trace } from './layout.js';
import { cue } from './sound.js';
import { forPerson, isFree, nearestFree, release, rest, sendTo, setDoing } from './trips.js';
import { bubble, cheer, place } from './views.js';
import { scene, scenery } from './world.js';
import { worldAllows } from './worlds.js';

// How long a fish takes to bite (ms), and how long the float stays down before it gets away.
const BITE_AFTER = [3000, 9000];
const BITE_WINDOW = 1700;
// A friend fishing alone has to catch the person's eye first.
const SOLO_BITE_WINDOW = 4000;

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
/** Whether a friend is fishing (or on its way to): nothing else should call it away then. */
export const fishingNow = () => !!fishing;
const atLake = { end: () => stopFishing() };
function removeTackle(tackle) {
  tackle?.float?.remove();
  tackle?.line?.remove();
  tackle?.rod?.remove();
  tackle?.grip?.remove();
}
function stopFishing(retainArtwork = false) {
  if (!fishing) return;
  const tackle = fishing;
  const { v, timer, poseTimer } = tackle;
  fishing = null;
  clearTimeout(timer);
  clearTimeout(poseTimer);
  clearCompanionAction(v);
  if (!retainArtwork) removeTackle(tackle);
  if (v.trip?.arrive === fishArrived) release(v);
  if (v.doing === atLake) {
    v.doing = null;
    rest(v);
  }
  return tackle;
}
// `friend` goes when it is free, else the nearest free one; the person's rod may also take a friend
// viewing the blossom (trips.js forPerson). `solo` is a friend fishing on its own (soloFishing),
// which calls the person when a fish bites: only the person reels it in.
function startFishing(x, friend, solo = false) {
  if (!worldAllows(scene.world, 'fishing')) return;
  if (fishing) return;
  const l = lake(),
    shore = l.ridgeAt(x),
    v = solo ? (friend && isFree(friend) ? friend : null) || nearestFree(x, shore) : forPerson(x, shore, friend);
  if (!v) return toast(t('catch.busy'));
  if (!solo) {
    remember('fished', '1');
    hint();
  }
  for (const name of ['cast', 'wait', 'reel', 'discover']) prepareCompanionAction(v.asset, name);
  sendTo(v, standAt(v, x), { arrive: fishArrived, cancel: stopFishing, own: solo });
  fishing = { v, x, y: floatY(l, x), width: field().width, solo, world: scene.world };
}
// Where a friend stands to fish at `x` along the lake: an authored stance keeps it on a dock or bank;
// otherwise it stands beside the visible shore.
function standAt(v, x) {
  const area = field();
  const stance =
    $('yard').dataset.environment === 'illustrated' ? environmentFishingSpot(area.width, area.height, scene) : null;
  return footTarget(v, stance?.x ?? x - sizeOf(v.pet) * 0.55, stance?.y ?? lake().ridgeAt(x) + 6);
}
// Where the float rests for a cast landing at `x`: a little out from the shore.
const floatY = (water, x) => water.shoreAt(x) + (water.ridgeAt(x) - water.shoreAt(x)) * 0.45;
// The friend reached the shore it was sent to.
function fishingAction(v, name) {
  const action = playCompanionAction(v, name);
  // A held rod must have a tip in every frame for the line to leave from.
  const missingTip =
    action?.clip.heldTool &&
    action.clip.frames.some(frame => !authoredRodTip({ ...action, frame }, { x: 0, y: 0, width: 192, height: 208 }));
  if (!missingTip) return action;
  clearCompanionAction(v);
  return null;
}
function fishArrived(v) {
  if (fishing?.v !== v || game) return stopFishing();
  setDoing(v, atLake);
  const castAction = fishingAction(v, 'cast');
  if (castAction) {
    const current = fishing;
    fishing.poseTimer = setTimeout(() => {
      if (fishing === current) fishingAction(v, 'wait');
    }, castAction.duration);
  } else fishingAction(v, 'wait');
  bubble(v, pick(list('catch.casting')), 2600);
  const layer = $('garden-layer'),
    float = document.createElement('button'),
    rod = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    line = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    water = lake();
  fishing.x = castLandingX(gripX(v), fishing.x, sizeOf(v.pet), water.ends);
  fishing.y = floatY(water, fishing.x);
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
  line.setAttribute('class', 'fishing-line');
  line.setAttribute('aria-hidden', 'true');
  line.setAttribute('fill', 'none');
  line.style.zIndex = String((v.z || 0) + 1);
  // The rod's shaft passes behind the friend; its grip end is drawn again in front, in the paws.
  const grip = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  grip.setAttribute('class', 'fishing-grip');
  grip.setAttribute('aria-hidden', 'true');
  grip.style.zIndex = String((v.z || 0) + 1);
  layer.append(rod, line, grip, float);
  Object.assign(fishing, { float, line, rod, grip });
  syncFishingArtwork(performance.now());
  fishing.timer = setTimeout(nibble, (castAction?.duration ?? 0) + between(Math.random, BITE_AFTER));
}
function nibble() {
  if (!fishing || fishing.v.drag || game) return stopFishing();
  fishing.biting = true;
  fishing.float.classList.add('bite');
  cue('plip');
  fishing.float.setAttribute('aria-label', t('catch.reel'));
  // Fishing alone, the friend calls the person over and waits longer: the album fills only with
  // what the person reels in, so a bite no one answers gets away.
  if (fishing.solo) bubble(fishing.v, pick(list('catch.solo_bite')), SOLO_BITE_WINDOW);
  fishing.timer = setTimeout(
    () => {
      if (!fishing) return;
      bubble(fishing.v, pick(list('catch.missed')), 2600);
      stopFishing();
    },
    fishing.solo ? SOLO_BITE_WINDOW : BITE_WINDOW,
  );
}
const reelingFriends = new Set();
const reelingArtwork = new Map();
const land = guard(async () => {
  if (!fishing?.biting) return;
  const world = scene.world,
    { v } = fishing,
    { fish, size } = bite(scene.season, scene.period, scene.weather, Math.random, scene.event);
  const tackle = stopFishing(true);
  let reelTimer;
  let finishReel = () => {};
  const reeling = {
    end: () => {
      clearCompanionAction(v);
      clearTimeout(reelTimer);
      finishReel();
      reelingFriends.delete(v);
      reelingArtwork.delete(v);
      removeTackle(tackle);
    },
  };
  reelingFriends.add(v);
  // Only the person reels in, a friend's own catch too.
  setDoing(v, reeling, false);
  const reelAction = fishingAction(v, 'reel');
  if (reelAction) {
    reelingArtwork.set(v, tackle);
  } else removeTackle(tackle);
  let first;
  try {
    [{ first }] = await Promise.all([
      call('catch', 'fish', fish.id, size),
      reelAction
        ? new Promise(resolve => {
            finishReel = resolve;
            reelTimer = setTimeout(resolve, reelAction.duration);
          })
        : Promise.resolve(),
    ]);
  } catch (error) {
    if (v.doing === reeling) release(v);
    throw error;
  }
  const active = v.doing === reeling;
  if (active) release(v);
  if (views.get(v.pet.id) === v) {
    // Every catch is reeled in by the person, a friend's own trip included.
    befriend(v.pet.id, 'catch');
    if (active && scene.world === world && !game) {
      cue('splash');
      cheer(v, 'catch.caught', { ms: 1200 });
      fishingAction(v, 'discover');
    }
  }
  showCard(fishSvg(fish), t(`catch.fish_${fish.id}`), t('catch.size', { size: size.toFixed(1) }), first, 'fish');
});
function reel() {
  if (!fishing) return;
  if (!fishing.biting) return toast(t('catch.too_soon'));
  land();
}

// Where a friend holds its rod: from the friend as drawn, shrunk by its depth, so the rod is in its
// paws and the line leaves the painted rod's tip.
const grip = body => ({ x: body.x + body.width * 0.6, y: body.y + body.height * 0.74 });
const gripX = v => grip(drawnBox(v)).x;
function paintFishingArtwork(tackle, now) {
  if (!tackle.line || !tackle.rod) return;
  const v = tackle.v;
  const body = drawnBox(v);
  const cast = castGeometry(grip(body), { x: tackle.x, y: tackle.y }, body.width, body.height);
  const action = companionAction(v, now);
  const paintedTip = companionImage(action) && authoredRodTip(action, body, reduced.matches);
  const rods = [tackle.rod, tackle.grip].filter(Boolean);
  if (paintedTip) {
    for (const r of rods) if (!r.hasAttribute('hidden')) r.setAttribute('hidden', '');
  } else {
    for (const r of rods) if (r.hasAttribute('hidden')) r.removeAttribute('hidden');
    const key = `${cast.grip.x}:${cast.grip.y}:${cast.tip.x}:${cast.tip.y}`;
    if (tackle.rodKey !== key) {
      const matrix = rodPlacement(cast.grip, cast.tip),
        image = `<image href="${rodUrl}" width="${ROD.width}" height="${ROD.height}" transform="matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})"/>`;
      for (const r of rods) r.innerHTML = image;
      // Only the handle and the reel, about a seventh of the friend's width round the grip.
      if (tackle.grip)
        tackle.grip.style.clipPath = `circle(${body.width * 0.14}px at ${cast.grip.x}px ${cast.grip.y}px)`;
      tackle.rodKey = key;
    }
  }
  const cord = linePath(paintedTip || cast.tip, cast.float);
  if (tackle.cord !== cord) {
    tackle.line.innerHTML = `<path d="${cord}" stroke="#243c42" stroke-width="2.5" opacity=".55"/><path d="${cord}" stroke="#f4efe0" stroke-width="1.1" opacity=".95"/>`;
    tackle.cord = cord;
  }
}
/** Reuses the yard tick: stationary frames keep both SVG paths and the decoded atlas untouched. */
export function syncFishingArtwork(now) {
  if (fishing) {
    const v = fishing.v;
    if (v.drag || game || views.get(v.pet.id) !== v || fishing.world !== scene.world) stopFishing();
    else paintFishingArtwork(fishing, now);
  }
  for (const [v, tackle] of reelingArtwork) {
    if (v.drag || game || views.get(v.pet.id) !== v || tackle.world !== scene.world) release(v);
    else paintFishingArtwork(tackle, now);
  }
}

// A close friend fishes on its own now and then, while the yard is quiet: no game, no trip already
// at the lake, and the friend idle.
const SOLO_EVERY = [12 * 60 * 1000, 25 * 60 * 1000];
const solo = cadence(() => between(Math.random, SOLO_EVERY));
/** Called by the frame loop while the yard is seen. */
export function soloFishing(now) {
  syncFishingArtwork(now);
  if (!worldAllows(scene.world, 'fishing') || !solo.due(now) || fishing || game || aiming) return;
  const keen = [...views.values()].filter(v => isFree(v) && levelOf(v.pet.id) >= 3);
  if (!keen.length) return;
  const l = lake();
  const [a, b] = l.ends,
    x = a + (b - a) * (0.3 + Math.random() * 0.4);
  // Only where the water shows (a lake drawn lower than the hill in front shows none).
  if (l.onWater(x, l.ridgeAt(x) - 1)) startFishing(x, pick(keen), true);
}

const nets = new Set();
// The net's handle from its end (12, 114) about a quarter of the way up, with the dark grip.
const NET_GRIP =
  '<path d="M12 114L24 93" stroke="#493e30" stroke-width="6" stroke-linecap="round"/><path d="M12 114L24 93" stroke="#cda56c" stroke-width="3.6" stroke-linecap="round"/><path d="M12 114L20 100" stroke="#765840" stroke-width="5" stroke-linecap="round"/>';
function sweepNet(v) {
  const net = document.createElement('span'),
    width = Math.max(36, sizeOf(v.pet) * 0.6),
    leftSide = v.px + sizeOf(v.pet) + width * 0.6 > field().width - 10;
  net.className = 'bug-net';
  net.setAttribute('aria-hidden', 'true');
  net.dataset.side = leftSide ? 'left' : 'right';
  net.style.width = `${width}px`;
  net.style.height = `${width * 1.4}px`;
  // The handle's end (12, 114 of the drawing) in the paws, about the middle of the friend and a
  // little below its chin; the net leans out from there (TILT), so the handle passes under the face.
  net.style.top = `${petHeight(v.pet) * 0.7 - (width * 1.4 * 114) / 126}px`;
  net.style[leftSide ? 'right' : 'left'] = `${sizeOf(v.pet) * 0.55 - (width * 12) / 90}px`;
  net.innerHTML =
    '<svg viewBox="0 0 90 126" fill="none"><g transform="rotate(30 12 114)"><g class="net-sweep"><path d="M12 114L53 44" stroke="#493e30" stroke-width="6" stroke-linecap="round"/><path d="M12 114L53 44" stroke="#cda56c" stroke-width="3.6" stroke-linecap="round"/><path d="M12 114L20 100" stroke="#765840" stroke-width="5" stroke-linecap="round"/><g transform="rotate(-22 65 29)"><path d="M42 25Q43 60 65 59Q87 58 88 25" fill="#e9f4dc33" stroke="#496158" stroke-width="1.8"/><path d="M47 34Q65 43 83 34M50 44Q65 52 80 44M55 52Q65 57 75 52M52 26Q51 47 60 57M65 29V59M78 26Q79 47 70 57" stroke="#f4f4dc" stroke-width="1.3"/><ellipse cx="65" cy="25" rx="23" ry="12" fill="#e9f4dc22" stroke="#3a544a" stroke-width="4"/><ellipse cx="65" cy="25" rx="23" ry="12" stroke="#dbe8c7" stroke-width="2"/></g></g></g></svg>';
  // The end of the handle again, over the body: the net sweeps behind the friend's painted face,
  // and the paws hold its grip in front instead of it starting from behind the hip.
  const grip = document.createElement('span');
  grip.className = 'bug-net bug-net-grip';
  grip.setAttribute('aria-hidden', 'true');
  grip.dataset.side = net.dataset.side;
  for (const side of ['width', 'height', 'top', 'left', 'right']) grip.style[side] = net.style[side];
  grip.innerHTML = `<svg viewBox="0 0 90 126" fill="none"><g transform="rotate(30 12 114)"><g class="net-sweep">${NET_GRIP}</g></g></svg>`;
  // Children of the friend follow its movement; the net stays behind its painted face.
  v.button.append(grip, net);
  const remove = () => {
    clearTimeout(entry.timer);
    net.remove();
    grip.remove();
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
  showCard(bugSvg(bug), t(`catch.bug_${bug.id}`), t('catch.count', { count: entry.count }), first, 'bug');
});

// What a point in the yard can be caught at: a creature in the air, a falling petal, or the lake.
function free(e) {
  return (
    !aiming && !game && data.pets.length && !e.target.closest('.yard-pet, .pet-tag, .plant, .decor, .bobber, button')
  );
}
// Creatures fly on the weather layer, in front of friends and of everything in the garden (plants,
// gifts, trees, snowballs, the float), yet a press on one there reaches what is underneath. With an
// empty hand, the creature takes a press on its body; one beside it, which in an open sky would
// still catch it, stays with the friend or thing behind. The yard's own controls are not under it.
const UNDER = '#pet-layer, #label-layer, #garden-layer';
const BODY = 14;
// `press`: a pointerdown, which only the main button makes a catch; a pointermove has no button.
function inFront(e, press = true) {
  if (aiming || game || !data.pets.length || (press && e.button !== 0) || !e.target.closest?.(UNDER)) return null;
  const [x, y] = inYard(e);
  return scenery?.near(x, y, BODY) ? [x, y] : null;
}
// The play tools that stay in hand (digging, a tree, a seed). Pressing the lake or a creature with one
// still fishes or catches: the press puts the tool away first, so nothing in the yard is hidden by it.
const TOOLS = ['dig', 'tree', 'seed'];
function toolGivesWay(e) {
  if (!TOOLS.includes(aiming) || game || e.target.closest('.yard-pet, .pet-tag, .plant, .decor, .bobber, button'))
    return false;
  const [x, y] = inYard(e);
  return !!scenery.near(x, y) || onLake(x, y);
}
export function syncFishingAction() {
  const tool = $('fish-tool');
  if (!tool) return;
  put(tool, 'hidden', false);
  put(tool, 'disabled', !data.pets.length || !!game || !worldAllows(scene.world, 'fishing'));
}
/** Wires catching to the yard's clicks and its pointer. Called once, by app.js, which hands over
 * `wish` (petals.js): it takes the point of a caught petal. */
export function setupCatch({ wish = () => {} } = {}) {
  const yard = $('yard');
  const tool = $('fish-tool');
  if (tool) {
    syncFishingAction();
    $('world')?.addEventListener('change', syncFishingAction);
    tool.addEventListener('click', () => {
      if (aiming || game || !worldAllows(scene.world, 'fishing')) return;
      if (fishing) {
        fishing.float?.focus();
        return;
      }
      const water = lake();
      const x = (water.ends[0] + water.ends[1]) / 2;
      const y = (water.shoreAt(x) + water.ridgeAt(x)) / 2;
      if (water.onWater(x, y)) {
        remember('fished', '1');
        hint();
        startFishing(x, views.get(selected));
      }
    });
  }
  // A creature in front of a friend, a plant or a gift is caught on the press, before what is under
  // it hears it (capture): the friend is not picked up, and the click that ends the press neither
  // pats it nor opens the plant or the gift.
  let caughtPress = false;
  yard.addEventListener(
    'pointerdown',
    e => {
      caughtPress = false;
      const point = inFront(e),
        caught = point && scenery.catchAt(...point, BODY);
      if (!caught) return;
      e.stopPropagation();
      e.preventDefault();
      caughtPress = true;
      catchBug(caught);
    },
    { capture: true },
  );
  yard.addEventListener(
    'click',
    e => {
      // A click from the keyboard (no press before it, detail 0) is never the end of that press,
      // even when the press ended away from the yard and made no click of its own.
      if (!caughtPress || e.detail === 0) return;
      caughtPress = false;
      e.stopPropagation();
      e.preventDefault();
    },
    { capture: true },
  );
  // Before the tools' own clicks (capture), so the dig or seed handlers never see this press.
  yard.addEventListener(
    'click',
    e => {
      if (toolGivesWay(e)) setAimingMode(false);
    },
    { capture: true },
  );
  yard.addEventListener('click', e => {
    if (!free(e)) return;
    const [x, y] = inYard(e),
      caught = scenery.catchAt(x, y);
    if (caught) catchBug(caught);
    else {
      const petal = scenery.catchPetal(x, y);
      if (petal) wish(petal);
      else if (onLake(x, y)) startFishing(x);
    }
  });
  // Something to catch under the pointer shows as a hand.
  yard.addEventListener('pointermove', e => {
    const [x, y] = inYard(e),
      // A petal is only for an empty hand: a tool in hand never gives way to one.
      can = free(e)
        ? scenery.near(x, y) || scenery.nearPetal(x, y) || onLake(x, y)
        : toolGivesWay(e) || !!inFront(e, false);
    yard.classList.toggle('can-catch', !!can);
  });
}
/** Another place, land or season ends a fishing trip: the lake it was at is gone. */
export function endFishing() {
  stopFishing();
  for (const v of reelingFriends) release(v);
  for (const net of nets) net.remove();
  $('yard').classList.remove('can-catch');
}
/** The yard changed size (the mini window, a drag on the window's edge): the lake is drawn again at
 * the new size, and a fishing trip goes on at the same place along it. The friend on its way is
 * sent there; the friend at the lake stands there again with its float on the water, its bite still
 * coming. Only where no water shows at that size does the trip end. A reel in progress ends as
 * before: the fish is kept. */
export function refitFishing() {
  for (const v of reelingFriends) release(v);
  $('yard').classList.remove('can-catch');
  if (!fishing) return;
  const water = lake(),
    { width } = field(),
    middle = (water.ends[0] + water.ends[1]) / 2;
  const x = [(fishing.x * width) / fishing.width, middle].find(spot => water.onWater(spot, floatY(water, spot)));
  if (x === undefined) return stopFishing();
  const v = fishing.v;
  fishing.width = width;
  if (!fishing.float) {
    fishing.x = x;
    fishing.y = floatY(water, x);
    if (v.trip?.arrive === fishArrived) v.target = standAt(v, x);
    return;
  }
  Object.assign(v, standAt(v, x));
  place(v);
  fishing.x = castLandingX(gripX(v), x, sizeOf(v.pet), water.ends);
  fishing.y = floatY(water, fishing.x);
  fishing.float.style.left = `${fishing.x}px`;
  fishing.float.style.top = `${fishing.y}px`;
  syncFishingArtwork(performance.now());
}
