// What to try next, shown rather than written (hint.js and the tool strip say it aloud for a screen
// reader): a painted hand taps the first friend until it has been patted, then the water until it
// has been fished, and the open ground while a tool is in hand until that tool has been used once.
// After that it teaches the dock: Dig, then Plant a seed once there is one, then the Album once
// something is in it, each by way of Play while the panel is shut. On a friend it rides in the
// friend's label, so it walks with the friend with nothing run per frame; on a button it rides in
// the button; and CSS alone moves it (friends.css .show-how).
import { distance } from '../core/math.js';
import { $, aiming, data, recall, remember, views } from '../core/state.js';
import { field, lakeNow, petHeight, sizeOf, topAt } from './field.js';

// The tools used on the ground (care.js setAimingMode, discovery.js).
const TOOLS = new Set(['dig', 'tree', 'seed', 'treat']);
// What `shown-<tool>` in storage remembers: that tool (or the album) has been used once.
const learnedKey = tool => `shown-${tool}`;
/** Whether `tool` (or the album) has been used once (hint.js asks; the hand stops pointing at it). */
export const learned = tool => recall(learnedKey(tool)) === '1';
/** Remembers that `tool` (or the album) has been used: its hand goes for good. */
export const learn = tool => remember(learnedKey(tool), '1');
// The dock's tiles the hand teaches after the lake (hint.js hintKey), all in the Play panel.
const TILES = { 'hint.dig': 'dig-tool', 'hint.sow': 'plant-tool', 'hint.album': 'album-button' };

/** Where the hand taps: on the open `ground` while a tool is `aiming` that is not yet `learned`;
 * else, for the hint `line` (hint.js hintKey), `{ friend }` for the first pat, a point on the
 * `lake` (yard pixels) for the first fishing, or a dock `tile` reached `via` Play; or null. */
export function showHowSpot(line, { friend = null, lake = null, aiming = false, ground = null, learned = () => true }) {
  if (aiming) return TOOLS.has(aiming) && ground && !learned(aiming) ? { ...ground, ground: true } : null;
  if (line?.key === 'hint.pat') return friend ? { friend } : null;
  if (TILES[line?.key]) return { tile: TILES[line.key], via: 'play-button' };
  if (line?.key !== 'hint.fish' || !lake) return null;
  const x = (lake.ends[0] + lake.ends[1]) / 2,
    y = (lake.shoreAt(x) + lake.ridgeAt(x)) / 2;
  return Number.isFinite(y) ? { x: Math.round(x), y: Math.round(y) } : null;
}

let hand = null;
function made() {
  if (hand) return hand;
  hand = document.createElement('i');
  hand.className = 'show-how';
  hand.setAttribute('aria-hidden', 'true');
  hand.append(document.createElement('i'));
  return hand;
}
/** The first of `patches` (yard pixels) with no friend within `room` of it, from the middles of
 * the friends in sight (`friends`); with someone near each, the one farthest from them all. */
export function clearPatch(patches, friends, room) {
  const nearest = p => Math.min(Infinity, ...friends.map(f => distance(f, p)));
  let best = null;
  for (const p of patches) {
    const gap = nearest(p);
    if (gap >= room) return p;
    if (!best || gap > best.gap) best = { p, gap };
  }
  return best?.p ?? null;
}
// The hand's picture around its fingertip (friends.css .show-how: drawn from 10px left of it, 46px
// square, nudged by its tap), with a little room, in yard pixels.
const HAND = { left: 10, top: 10, right: 64, bottom: 64 };
const DEPTHS = [0.35, 0.2, 0.1, 0.5, 0.65],
  ACROSS = [0.42, 0.34, 0.5, 0.26, 0.58];
/** Patches of open field (yard pixels) for the hand, best first: a little left of the middle and
 * nearer the ridge than the front edge, clear of the tool strip at the bottom right. One the hand
 * would put any of itself over the lane of news (`lane`, its box in yard pixels, or null) is left
 * out, for the same spots nearer the ridge, then nearer the front. */
export function groundPatches({ left = 0, width, bottom, topAt, lane = null }) {
  const covered = p =>
    !!lane &&
    p.x - HAND.left < lane.right &&
    p.x + HAND.right > lane.left &&
    p.y - HAND.top < lane.bottom &&
    p.y + HAND.bottom > lane.top;
  const patches = [];
  for (const depth of DEPTHS)
    for (const share of ACROSS) {
      const x = left + (width - left) * share,
        top = topAt(x),
        y = top + (bottom - top) * depth,
        p = { x: Math.round(x), y: Math.round(y) };
      if (Number.isFinite(y) && y > top && y < bottom && !covered(p)) patches.push(p);
    }
  return patches;
}
// The lane of news (shell.css .yard-feedback) in yard pixels, as it is drawn now: it moves while a
// tool is in hand, and is empty (no height) with nothing in it.
function newsLane(box) {
  const lane = document.querySelector?.('.yard-feedback')?.getBoundingClientRect?.();
  if (!lane?.height || !box) return null;
  return {
    left: lane.left - box.left,
    right: lane.right - box.left,
    top: lane.top - box.top,
    bottom: lane.bottom - box.top,
  };
}
// The first open patch with no friend on it, so the hand never taps someone it is not about.
function openGround(friends, box) {
  const f = field(),
    patches = groundPatches({ left: f.left, width: f.right, bottom: f.bottom, topAt, lane: newsLane(box) });
  const middles = friends.map(v => ({ x: v.px + sizeOf(v.pet) / 2, y: v.py + petHeight(v.pet) / 2 })),
    room = Math.max(0, ...friends.map(v => sizeOf(v.pet)));
  return clearPatch(patches, middles, room);
}
// The line the hand last showed, so it can be placed again when the Play panel or the news change.
let said = null;
/** Puts the hand where the hint `line` and the tool in hand say, or away. Called by hint.js
 * whenever either changes and when the yard is resized. */
export function showHow(line) {
  said = line;
  // Nothing to teach, the usual case once everything has been tried: no layout is read.
  if (!line && !aiming) return hand?.remove();
  const box = aiming ? $('yard')?.getBoundingClientRect?.() : null,
    shown = data.pets.map(p => views.get(p.id)).filter(v => v && !v.away && v.body),
    first = shown[0],
    spot = showHowSpot(line, {
      friend: first?.button.dataset.id ?? null,
      lake: line?.key === 'hint.fish' ? lakeNow() : null,
      aiming,
      ground: box?.width ? openGround(shown, box) : null,
      learned,
    });
  if (!spot) {
    if (hand) hand.remove();
    return;
  }
  const el = made();
  if (spot.tile) {
    // In the open panel the tile itself; with the panel shut, Play, which leads to it.
    const open = $('play-panel') && !$('play-panel').hidden,
      button = $(open ? spot.tile : spot.via);
    if (!button || button.disabled || button.hidden) return el.remove();
    if (el.parentElement !== button) button.append(el);
    el.style.translate = '';
    el.dataset.on = open ? 'tile' : 'play';
    return;
  }
  if (spot.friend) {
    if (el.parentElement !== first.body) first.body.append(el);
    el.style.translate = '';
  } else {
    const layer = $('label-layer');
    if (!layer) return;
    if (el.parentElement !== layer) layer.append(el);
    el.style.translate = `${spot.x}px ${spot.y}px`;
  }
  el.dataset.on = spot.friend ? 'friend' : spot.ground ? 'ground' : 'water';
}
/** The first press in the yard with a tool in hand teaches it: its hand goes for good. The hand
 * moves between Play and its tile as the Play panel opens and shuts, and off the ground a card of
 * news has just covered. Called once, by app.js. */
export function setupShowHow() {
  const again = () => showHow(said);
  if (globalThis.MutationObserver) {
    const watch = new MutationObserver(again);
    if ($('play-panel')) watch.observe($('play-panel'), { attributes: true, attributeFilter: ['hidden'] });
    const lane = document.querySelector('.yard-feedback');
    if (lane) watch.observe(lane, { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true });
  }
  $('yard').addEventListener(
    'pointerdown',
    () => {
      if (!aiming || hand?.dataset.on !== 'ground' || !hand.isConnected) return;
      learn(aiming);
      hand.remove();
    },
    true,
  );
}
