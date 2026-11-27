// A pet's own game poses (`actionsPath` in its pet file, docs/standards/pet-files.md): digging,
// planting, showing a find and fishing, drawn for each outfit. The backend checks them and hands
// them over (petActions) once a friend with poses comes into the yard or asks for one, never before
// the yard is first drawn. Until they come, and for every pet without them, the ordinary sheet plays.
import { letGo } from './pixels.js';
import { call } from './state.js';

// The poses are drawn for the illustrated sheets; a friend shown realistic keeps its ordinary rows.
const posed = asset => !!asset?.hasActions && asset?.spriteStyle !== 'realistic';
/** Each asset id's request for its poses and, once they come, the poses (null when none pass). */
const entries = new Map();
let season = '';
let generation = 0;
const actions = new WeakMap();
const images = new Map();
// The atlases decoded so far are let go, their bitmaps with them (pixels.js).
function forget() {
  for (const image of images.values()) letGo(image);
  images.clear();
}

/** Saving a task refreshes catalog objects without replacing the friend's appearance. */
export function sameCompanionAppearance(a, b) {
  if (a === b) return true;
  return (
    !!a &&
    !!b &&
    a.id === b.id &&
    a.place === b.place &&
    a.sourceId === b.sourceId &&
    a.version === b.version &&
    a.hasActions === b.hasActions &&
    a.spriteStyle === b.spriteStyle &&
    a.spriteUrl === b.spriteUrl &&
    a.seasonalSpriteUrls?.[season] === b.seasonalSpriteUrls?.[season]
  );
}

/** Ground targets follow the held tool, while the character's feet stay beside it. */
export function actionGroundOffset(clip, width, height) {
  const ground = clip?.ground;
  if (!ground?.every(Number.isFinite) || ground.length !== 2) return { x: 0, y: 0 };
  return { x: ((ground[0] - 96) * width) / 192, y: ((ground[1] - 199) * height) / 208 };
}

/** Keeps `value` as the poses of asset `id` (a test seeds them here instead of asking). */
export function useCompanionActions(id, value) {
  // Poses replaced under a friend end what it is playing and the atlases decoded for them; a
  // pet's first poses end nothing, since nothing could play before they came.
  const entry = entries.get(id);
  if (entry?.poses !== undefined) {
    generation++;
    forget();
  }
  entries.set(id, {
    poses: value?.version === 1 && value.outfits?.base ? value : null,
    ready: entry?.ready ?? Promise.resolve(),
  });
}
/** Asks once for the poses of each of `assets` that has them; resolves when they have come. */
export function loadCompanionActionsFor(assets) {
  const waits = [];
  for (const asset of assets) {
    if (!posed(asset)) continue;
    if (!entries.has(asset.id))
      entries.set(asset.id, {
        // call() opens the bridge's { ok, data } envelope and turns a refusal into a rejection.
        ready: call('petActions', asset.id)
          .then(value => useCompanionActions(asset.id, value))
          // A pet whose poses cannot be read keeps its ordinary sheet.
          .catch(() => useCompanionActions(asset.id, null)),
      });
    waits.push(entries.get(asset.id).ready);
  }
  return Promise.all(waits);
}
export function setCompanionSeason(value) {
  if (value !== season) {
    generation++;
    forget();
  }
  season = value;
}
function clipFor(asset, name) {
  if (!posed(asset)) return null;
  // A friend that asks before its poses are there plays the ordinary sheet this time, and the
  // asks after it find them.
  if (!entries.has(asset.id)) loadCompanionActionsFor([asset]);
  const outfits = entries.get(asset.id).poses?.outfits;
  // A season's own outfit, else the base one, as with the seasonal sheets; a clip that outfit
  // lacks plays the ordinary rows rather than another outfit's clothes.
  const clip = (outfits?.[season] ?? outfits?.base)?.[name];
  if (!clip?.frames?.length || !clip.url) return null;
  return wellFormed(clip) ? clip : null;
}
// Clips whose frames were found whole: a walk asks for its clip every frame it walks, and a clip
// does not change once read (a new outfit or season is a new object).
const whole = new WeakSet();
function wellFormed(clip) {
  if (whole.has(clip)) return true;
  if (!clip.frames.every(frame => frame.rect?.length === 4 && frame.foot?.length === 2 && frame.duration > 0))
    return false;
  whole.add(clip);
  return true;
}
/** A walk or run of `asset` (`walk-front`, `walk-back`, `run-right`, `run-left`) to draw now: one
 * cycle of eight cells, stepped by the legs (core/gait.js) rather than its frames' durations. Null
 * when the pet has none, or until its atlas has decoded, so the sheet's side walk plays meanwhile. */
export function gaitClip(asset, name) {
  const clip = clipFor(asset, name);
  return clip?.frames.length === 8 && companionImage({ clip }) ? clip : null;
}
/** Each action owns its clock; a new trip or a changed outfit invalidates it. */
export function beginCompanionAction(view, name, now = performance.now()) {
  clearCompanionAction(view);
  const clip = clipFor(view.asset, name);
  if (!clip) return null;
  const duration = clip.frames.reduce((sum, frame) => sum + frame.duration, 0);
  const action = { clip, duration, since: now, generation, asset: view.asset, pose: view.pose, poseSince: view.since };
  actions.set(view, action);
  return action;
}
/** Starts an action only once its atlas has decoded, so the ordinary sheet never blinks out. */
export function playCompanionAction(view, name, now) {
  const action = beginCompanionAction(view, name, now);
  if (action && companionImage(action)) return action;
  clearCompanionAction(view);
  return null;
}
export function prepareCompanionAction(asset, name) {
  const clip = clipFor(asset, name);
  if (clip && typeof Image !== 'undefined') companionImage({ clip });
  return clip;
}
export function clearCompanionAction(view) {
  actions.delete(view);
}
export function companionAction(view, now) {
  const action = actions.get(view);
  if (!action) return null;
  if (
    action.generation !== generation ||
    !sameCompanionAppearance(view.asset, action.asset) ||
    view.pose !== action.pose ||
    view.since !== action.poseSince ||
    view.drag ||
    view.target ||
    view.away
  ) {
    clearCompanionAction(view);
    return null;
  }
  let elapsed = Math.max(0, now - action.since);
  if (elapsed >= action.duration && !action.clip.loop) {
    clearCompanionAction(view);
    return null;
  }
  elapsed %= action.duration;
  let index = 0;
  while (index < action.clip.frames.length - 1 && elapsed >= action.clip.frames[index].duration) {
    elapsed -= action.clip.frames[index++].duration;
  }
  return { ...action, index, frame: action.clip.frames[index] };
}
/** A failed or undecoded optional atlas always leaves the standard sheet on screen. */
export function companionImage(action) {
  if (!action || typeof Image === 'undefined') return null;
  const url = action.clip.url;
  let image = images.get(url);
  if (!image) {
    image = new Image();
    // The atlas comes from the pet-asset protocol; CORS keeps the friend canvas readable.
    image.crossOrigin = 'anonymous';
    image.src = url;
    images.set(url, image);
  }
  return image.complete && image.naturalWidth ? image : null;
}
