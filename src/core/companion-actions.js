// Bundled companions can own extra game poses without changing the portable pet format.
const companions = new Set(['playpets-clover', 'playpets-daisy', 'playpets-pip', 'playpets-miso']);
let registry = { characters: {} };
let season = '';
let generation = 0;
const actions = new WeakMap();
const images = new Map();

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

export function useCompanionActions(value) {
  registry = value?.version === 1 ? value : { characters: {} };
  generation++;
  images.clear();
}
export async function setupCompanionActions() {
  try {
    const response = await fetch(new URL('../content/companion-actions.json', import.meta.url));
    if (response.ok) useCompanionActions(await response.json());
  } catch {
    // Missing optional artwork keeps the ordinary pet sheet available.
  }
}
export function setCompanionSeason(value) {
  if (value !== season) {
    generation++;
    images.clear();
  }
  season = value;
}
function clipFor(asset, name) {
  if (asset?.place !== 'builtin' || !companions.has(asset.sourceId)) return null;
  const clip = registry.characters?.[asset.sourceId]?.variants?.[season]?.[name];
  if (!clip?.frames?.length || !clip.url) return null;
  if (!clip.frames.every(frame => frame.rect?.length === 4 && frame.foot?.length === 2 && frame.duration > 0))
    return null;
  return clip;
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
  const url = new URL(`../${action.clip.url}`, import.meta.url).href;
  let image = images.get(url);
  if (!image) {
    image = new Image();
    image.src = url;
    images.set(url, image);
  }
  return image.complete && image.naturalWidth ? image : null;
}
