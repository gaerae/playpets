// Draws one 192×208 cell of a pet's sprite sheet onto a canvas. Shared by the yard and the desktop overlay.
import { frameAt, headroom, lookFrame } from './animation.js';

const cache = new Map();
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// The sheet is asked for with CORS so its pixels may be read (for the headroom under a bubble);
// should the answer lack the header, a plain load still draws.
function load(asset, cors) {
  const image = new Image();
  if (cors) {
    image.crossOrigin = 'anonymous';
    image.onerror = () => cache.set(asset.id, load(asset, false));
  }
  image.src = asset.spriteUrl;
  return image;
}
function imageFor(asset) {
  if (!cache.has(asset.id)) cache.set(asset.id, load(asset, true));
  return cache.get(asset.id);
}
// A decoded sheet takes about 14 MB, and the Invite tab shows every pet file on this computer:
// once it closes, the sheets no friend in the yard uses are let go (drawn again, they reload).
export function release(keep) {
  for (const id of cache.keys()) if (!keep.has(id)) cache.delete(id);
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
  if (heads.has(asset.id)) return heads.get(asset.id);
  const image = imageFor(asset);
  if (!image.complete || !image.naturalWidth) return null;
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
  heads.set(asset.id, value);
  return value;
}
export function drawSprite(canvas, asset, state = 'idle', elapsed = 0, look = null) {
  if (!asset) return;
  const image = imageFor(asset);
  if (!image.complete || !image.naturalWidth) {
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
  if (canvas._pk === key) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 192, 208);
  ctx.drawImage(image, frame.column * 192, frame.row * 208, 192, 208, 0, 0, 192, 208);
  canvas._pk = key;
}
export function canvas() {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 208;
  c.setAttribute('aria-hidden', 'true');
  return c;
}
/** Draws a friend's resting cell once (a chat avatar), as soon as its sheet is in. */
export function drawStill(canvas, asset) {
  if (!asset) return;
  const image = imageFor(asset);
  if (image.complete && image.naturalWidth) return drawSprite(canvas, asset);
  image.addEventListener('load', () => drawSprite(canvas, asset), { once: true });
  // A sheet that refused CORS is loaded again plainly (load): draw from that one.
  image.addEventListener('error', () => setTimeout(() => drawStill(canvas, asset)), { once: true });
}
