// Draws one 192×208 cell of a pet's sprite sheet onto a canvas. Shared by the yard and the desktop overlay.
import {
  bodyBox,
  cellsIn,
  directionFrame,
  frameAt,
  headroom,
  idleCell,
  LOOK_HOLD,
  lookDirection,
  TURN_MS,
  turnStep,
} from './animation.js';
import { companionImage, sameCompanionAppearance, setCompanionSeason } from './companion-actions.js';
import { cellTops, DRAWN_GAIT, feetSpread, ownBob, rowGait } from './gait.js';
import { letGo, pixels } from './pixels.js';
import { isSeason } from './season.js';

const cache = new Map();
const cacheKey = asset => `${asset.id}:${asset.spriteStyle || 'illustrated'}`;
// Whether the system asks for less motion (none asked where there is no page, as in a test).
/** How tall a friend drawn `size` pixels wide stands: a cell is 192×208. */
export const cellHeight = size => (size * 208) / 192;
export const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? { matches: false };
let season = '';
let revision = 0;
export function setSpriteSeason(value) {
  const next = isSeason(value) ? value : '';
  if (next === season) return false;
  season = next;
  setCompanionSeason(next);
  return true;
}
// Each visible appearance keeps only its selected season in decoded-image memory.
function load(asset, entry, url, cors) {
  const image = new Image();
  image._spriteRevision = ++revision;
  if (cors) image.crossOrigin = 'anonymous';
  image.onerror = () => {
    if (cache.get(cacheKey(asset)) !== entry || entry.image !== image || spriteSource(asset) !== entry.url) return;
    if (cors) entry.image = load(asset, entry, url, false);
    else if (url !== asset.spriteUrl) entry.image = load(asset, entry, asset.spriteUrl, true);
  };
  image.src = url;
  return image;
}
export function spriteSource(asset) {
  return asset?.seasonalSpriteUrls?.[season] || asset?.spriteUrl || '';
}
const ready = image => !!image?.complete && !!image.naturalWidth;
function imageFor(asset) {
  const url = spriteSource(asset);
  const key = cacheKey(asset);
  let entry = cache.get(key);
  if (!entry || entry.url !== url) {
    // A new season's sheet takes a moment to decode; the one on screen stays until then.
    const shown = ready(entry?.image) ? entry.image : entry?.shown;
    if (entry) for (const old of [entry.image, entry.shown]) if (old !== shown) letGo(old);
    entry = { url, assetId: asset.id, shown };
    cache.set(key, entry);
    heads.delete(key);
    entry.image = load(asset, entry, url, true);
  }
  return entry.image;
}
// The sheet to draw now: the current one once it is in, until then the one it replaces.
function drawable(asset) {
  const image = imageFor(asset);
  const entry = cache.get(cacheKey(asset));
  if (ready(image) && entry.shown) {
    letGo(entry.shown);
    entry.shown = null;
  }
  return ready(image) ? image : (entry.shown ?? image);
}
/** Resolves once the sheet `asset` is drawn from is decoded (at once when it is), so a loop resting
 * until then can draw the first cell as soon as there is one. */
export function sheetReady(asset) {
  const image = imageFor(asset);
  if (ready(image) || !image.decode) return Promise.resolve();
  return image.decode().catch(() => {});
}
// A decoded sheet takes about 14 MB, and the Invite tab shows every pet file on this computer:
// once it closes, the sheets no friend in the yard uses are let go (drawn again, they reload).
export function release(keep) {
  for (const [id, entry] of cache)
    if (!keep.has(entry.assetId)) {
      letGo(entry.image);
      letGo(entry.shown);
      cache.delete(id);
      heads.delete(id);
    }
}
const heads = new Map();
// A speech bubble hangs just above the head, not above the cell: `--head` on the element is the
// empty top of the cell at the height the sprite is drawn. Nothing is set until the sheet is in.
export function crown(element, asset, height) {
  const head = headroomOf(asset);
  if (head === null) return;
  const px = `${Math.round(head * height)}px`;
  if (element.dataset.head !== px) {
    element.dataset.head = px;
    element.style.setProperty('--head', px);
  }
}
// The share of a cell that is empty above this pet's head, measured once from its resting cell;
// null until the sheet is in, 0 when its pixels cannot be read.
function headroomOf(asset) {
  if (!asset) return null;
  const image = imageFor(asset);
  const key = cacheKey(asset);
  if (heads.get(key)?.image === image) return heads.get(key).value;
  if (!ready(image)) return null;
  let value = 0;
  try {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 208;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, 192, 208, 0, 0, 192, 208);
    value = headroom(ctx.getImageData(0, 0, 192, 208).data, 192, 208);
  } catch {
    value = 0;
  }
  heads.set(key, { image, value });
  return value;
}
// A press counts on a friend's drawing and this much (cell pixels) around it, not on the empty rest
// of its cell: the yard's hit area (views.js fitHit) and the desktop's hovered() (overlay.rs).
const HIT_PAD = 6;
const bodies = new WeakMap();
const padded = (box, clamp) =>
  box && [
    clamp(box[0] - HIT_PAD / 192),
    clamp(box[1] - HIT_PAD / 208),
    clamp(box[2] + HIT_PAD / 192),
    clamp(box[3] + HIT_PAD / 208),
  ];
// The pixels of row `row` of `image`, its cells side by side; throws when they cannot be read (a
// tainted or broken sheet). Each caller measures a row once and keeps what it found.
function rowPixels(image, row) {
  const cells = cellsIn(row),
    c = document.createElement('canvas');
  c.width = cells * 192;
  c.height = 208;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(pixels(image), 0, row * 208, cells * 192, 208, 0, 0, cells * 192, 208);
  return { rgba: ctx.getImageData(0, 0, cells * 192, 208).data, cells };
}
// Where row `row` of `image` is drawn in its cell (animation.js bodyBox), measured the first time it
// is asked and kept with the sheet; null when its pixels cannot be read.
function rowBody(image, row) {
  let rows = bodies.get(image);
  if (!rows) bodies.set(image, (rows = []));
  if (rows[row] !== undefined) return rows[row];
  let box = null;
  try {
    const { rgba, cells } = rowPixels(image, row);
    box = padded(bodyBox(rgba, cells, 192, 208), v => Math.min(1, Math.max(0, v)));
  } catch {
    box = null;
  }
  rows[row] = box;
  return box;
}
const gaits = new WeakMap();
/** How row `row` of `asset`'s sheet walks (core/gait.js), measured once a sheet and row from its
 * cells; null until the sheet is in. */
export function gaitOf(asset, row) {
  if (!asset) return null;
  const image = drawable(asset);
  if (!ready(image)) return null;
  let rows = gaits.get(image);
  if (!rows) gaits.set(image, (rows = []));
  if (rows[row]) return rows[row];
  let gait = DRAWN_GAIT;
  try {
    const { rgba, cells } = rowPixels(image, row),
      tops = cellTops(rgba, cells, 192, 208);
    gait = { ...rowGait(feetSpread(rgba, cells, 192, 208)), ownBob: ownBob(tops, 208 - Math.min(...tops)) };
  } catch {
    gait = DRAWN_GAIT;
  }
  rows[row] = gait;
  return gait;
}
/** Where a companion's own action is drawn, as shares of the cell: around every frame of `clip` as
 * drawSprite places it, which may reach outside the cell (a rod held out). Measured once a clip. */
export function actionBox(clip) {
  if (bodies.has(clip)) return bodies.get(clip);
  const scale = clip.scale ?? 1,
    anchor = clip.anchor ?? [96, 200],
    offset = clip.offset ?? [0, 0];
  let box = null;
  for (const frame of clip.frames) {
    const x = offset[0] + anchor[0] - frame.foot[0] * scale,
      y = offset[1] + anchor[1] - frame.foot[1] * scale,
      edges = [x / 192, y / 208, (x + frame.rect[2] * scale) / 192, (y + frame.rect[3] * scale) / 208];
    box = box
      ? [Math.min(box[0], edges[0]), Math.min(box[1], edges[1]), Math.max(box[2], edges[2]), Math.max(box[3], edges[3])]
      : edges;
  }
  box = padded(box, v => v);
  bodies.set(clip, box);
  return box;
}
/** Where on `canvas` the friend drawSprite last drew is, as shares of its cell [left, top, right,
 * bottom]: around its pose's row, or its own action's frames. Null until it is known. */
export function bodyOf(canvas) {
  const drawn = canvas?._drawn;
  if (!drawn) return null;
  return drawn.frames ? actionBox(drawn) : rowBody(drawn, canvas._row);
}
function actionSurface(canvas, clip) {
  const [width, height] = clip?.canvas ?? [192, 208];
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas._pk = '';
  }
  if (canvas.style) {
    const offset = clip?.offset ?? [0, 0];
    const extended = width !== 192 || height !== 208 || offset.some(Boolean);
    const values = {
      scale: extended ? `${width / 192} ${height / 208}` : '',
      translate: extended ? `${(offset[0] / 192) * 100}% ${(offset[1] / 208) * 100}%` : '',
      transformOrigin: extended ? '0 0' : '',
    };
    for (const [key, value] of Object.entries(values)) if (canvas.style[key] !== value) canvas.style[key] = value;
  }
}
// The first sprite drawn on a page is marked, so a run can say how long the first friend took to
// show from the page's start (the e2e's perf lines read it).
let firstMarked = false;
function markFirst(canvas) {
  if (firstMarked || !canvas.isConnected) return;
  firstMarked = true;
  globalThis.performance?.mark?.('first-friend');
}
// Each canvas gets its own seed for the idle rhythm (animation.js idleCell), in the order canvases
// are first drawn.
let seeds = 0;
const nextSeed = () => Math.imul(++seeds, 0x9e3779b1) >>> 0;
// The direction a canvas shows while its friend looks (`look`, pixels from its middle) at `now`, as a
// cell, or null once it stands: one turn a TURN_MS toward the look, and a moment's hold
// (LOOK_HOLD) when the look ends; a friend that does anything but stand stops looking at once.
// `canvas._turning` says the loop should draw it again soon.
function facing(canvas, look, now, standing) {
  if (!standing) {
    canvas._facing = canvas._lookEnded = null;
    canvas._turning = false;
  } else if (look) {
    const want = lookDirection(look.x, look.y);
    canvas._lookEnded = null;
    if (canvas._facing == null || now - canvas._turnedAt >= TURN_MS) {
      const next = turnStep(canvas._facing, want);
      if (next !== canvas._facing) canvas._turnedAt = now;
      canvas._facing = next;
    }
    canvas._turning = canvas._facing !== want;
  } else if (canvas._facing != null) {
    canvas._lookEnded ??= now;
    if (now - canvas._lookEnded >= LOOK_HOLD) canvas._facing = canvas._lookEnded = null;
    canvas._turning = canvas._facing != null;
  }
  return canvas._facing == null ? null : directionFrame(canvas._facing);
}
/** Draws `state` at `elapsed` on `canvas`: a standing friend by the idle rhythm, a look (v2 sheets)
 * turned toward `look`, or a companion's own `action`. `now` is the clock a turn is timed by. A
 * `walk` ({ cell, lift }) draws that cell of the state's row, raised `lift` cell pixels. */
export function drawSprite(
  canvas,
  asset,
  state = 'idle',
  elapsed = 0,
  look = null,
  action = null,
  now = globalThis.performance?.now() ?? 0,
  walk = null,
) {
  if (!asset) return;
  const authored = action && sameCompanionAppearance(action.asset, asset) ? companionImage(action) : null;
  // Kept up on every draw, so a turn that can no longer be drawn (reduced motion, a companion's own
  // action, a sheet without look rows) ends here and leaves no loop busy on `_turning`.
  const looking = facing(canvas, look, now, state === 'idle' && asset.version === 2 && !authored && !reduced.matches);
  actionSurface(canvas, authored ? action.clip : null);
  if (authored) {
    const frame = reduced.matches ? action.clip.frames[0] : action.frame;
    const key = `${asset.id}:action:${action.clip.url}:${frame.rect.join(',')}`;
    if (canvas._pk === key && canvas._sheet === authored) return;
    const ctx = canvas.getContext('2d');
    const scale = action.clip.scale ?? 1;
    const anchor = action.clip.anchor ?? [96, 200];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      pixels(authored),
      ...frame.rect,
      anchor[0] - frame.foot[0] * scale,
      anchor[1] - frame.foot[1] * scale,
      frame.rect[2] * scale,
      frame.rect[3] * scale,
    );
    canvas._pk = key;
    canvas._sheet = authored;
    canvas._drawn = action.clip;
    markFirst(canvas);
    return;
  }
  const image = drawable(asset);
  if (!ready(image)) {
    if (canvas._pk) {
      canvas.getContext('2d').clearRect(0, 0, 192, 208);
      canvas._pk = '';
    }
    canvas._drawn = null;
    return;
  }
  const stepping = walk && !reduced.matches;
  const frame = reduced.matches
    ? { row: 0, column: 0 }
    : stepping
      ? { row: frameAt(state, 0).row, column: walk.cell }
      : looking ||
        (state === 'idle' ? idleCell(elapsed, (canvas._seed ??= nextSeed()), canvas._rhythm) : frameAt(state, elapsed));
  const lift = stepping ? walk.lift : 0;
  // Animation cells change a few times a second and the loops run more often than that:
  // skip the clear+blit entirely when this canvas already shows the same cell.
  const key = `${asset.id}:${frame.row}:${frame.column}:${lift}`;
  if (canvas._pk === key && canvas._sheet === image._spriteRevision) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 192, 208);
  ctx.drawImage(pixels(image), frame.column * 192, frame.row * 208, 192, 208, 0, 0 - lift, 192, 208);
  canvas._pk = key;
  canvas._sheet = image._spriteRevision;
  canvas._drawn = image;
  canvas._row = frame.row;
  markFirst(canvas);
}
export function canvas() {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 208;
  c.setAttribute('aria-hidden', 'true');
  return c;
}
/**
 * A friend's photo (a realistic portrait) over its sprite: the sprite holds the place until the photo
 * has loaded, and comes back if the photo cannot be read or there is none. A photo asked for earlier
 * that loads late does not cover the one asked for now.
 */
export function photoOver(photo, sprite, url) {
  photo.dataset.source = url || '';
  photo.hidden = true;
  sprite.hidden = false;
  const current = () => photo.dataset.source === (url || '');
  photo.onload = () => {
    if (!current()) return;
    photo.hidden = false;
    sprite.hidden = true;
  };
  photo.onerror = () => {
    if (!current()) return;
    photo.hidden = true;
    sprite.hidden = false;
  };
  if (url) photo.src = url;
  else photo.removeAttribute('src');
}
const stillRequests = new WeakMap();
/** Draws a friend's resting cell once (a chat avatar), as soon as its sheet is in. */
export function drawStill(canvas, asset) {
  const request = {};
  stillRequests.set(canvas, request);
  if (!asset) return;
  const current = () => stillRequests.get(canvas) === request;
  const wait = () => {
    if (!current()) return;
    const image = imageFor(asset);
    const entry = cache.get(cacheKey(asset));
    const retained = () => cache.get(cacheKey(asset)) === entry && spriteSource(asset) === entry.url;
    if (ready(image)) return drawSprite(canvas, asset);
    // The previous season's sheet holds the place meanwhile.
    if (entry.shown) drawSprite(canvas, asset);
    image.addEventListener(
      'load',
      () => {
        if (current() && retained() && entry.image === image) drawSprite(canvas, asset);
      },
      { once: true },
    );
    // Follow this request's CORS and baseline retries, unless the canvas changed friends.
    image.addEventListener(
      'error',
      () => {
        if (current() && retained() && entry.image !== image) wait();
      },
      { once: true },
    );
  };
  wait();
}
