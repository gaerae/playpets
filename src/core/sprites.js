// Draws one 192×208 cell of a pet's sprite sheet onto a canvas. Shared by the yard and the desktop overlay.
import { frameAt, headroom, lookFrame } from './animation.js';

const cache = new Map();
const cacheKey = asset => `${asset.id}:${asset.spriteStyle || 'illustrated'}`;
// Whether the system asks for less motion (none asked where there is no page, as in a test).
export const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? { matches: false };
let season = '';
let revision = 0;
export function setSpriteSeason(value) {
  const next = ['spring', 'summer', 'autumn', 'winter'].includes(value) ? value : '';
  if (next === season) return false;
  season = next;
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
  if (ready(image)) entry.shown = null;
  return ready(image) ? image : (entry.shown ?? image);
}
// A decoded sheet takes about 14 MB, and the Invite tab shows every pet file on this computer:
// once it closes, the sheets no friend in the yard uses are let go (drawn again, they reload).
export function release(keep) {
  for (const [id, entry] of cache)
    if (!keep.has(entry.assetId)) {
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
export function drawSprite(canvas, asset, state = 'idle', elapsed = 0, look = null) {
  if (!asset) return;
  const image = drawable(asset);
  if (!ready(image)) {
    if (canvas._pk) {
      canvas.getContext('2d').clearRect(0, 0, 192, 208);
      canvas._pk = '';
    }
    return;
  }
  const frame = reduced.matches
    ? { row: 0, column: 0 }
    : look && asset.version === 2
      ? lookFrame(look.x, look.y)
      : frameAt(state, elapsed);
  // Animation cells change a few times a second and the loops run more often than that:
  // skip the clear+blit entirely when this canvas already shows the same cell.
  const key = `${asset.id}:${frame.row}:${frame.column}`;
  if (canvas._pk === key && canvas._sheet === image._spriteRevision) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 192, 208);
  ctx.drawImage(image, frame.column * 192, frame.row * 208, 192, 208, 0, 0, 192, 208);
  canvas._pk = key;
  canvas._sheet = image._spriteRevision;
}
export function canvas() {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 208;
  c.setAttribute('aria-hidden', 'true');
  return c;
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
