// An agent workspace's furniture fronts (workspace.js frontsIn): the picture's own pixels, as just
// painted and lit for the hour, cut out by each front's mask and set in the friends' layer, so a
// friend seated behind a desk is drawn under its front. Made again only when the land is painted
// again (easel.js), never per frame.
import { frontsIn } from './workspace.js';

const shown = [];

/** Takes the fronts away and, for a place that has them, cuts them again from `land` (the painted
 * land, a canvas covering the `w` by `h` yard) with each front's mask from `masks` (by art name),
 * into `layer` (the friends' garden layer). `picture` is the place's picture, for its size; without
 * it (the painted fallback) none are cut. */
export function paintFronts(layer, land, w, h, picture, masks) {
  for (const old of shown.splice(0)) old.remove();
  if (!picture || !layer || !w) return;
  const ratio = land.width / w;
  for (const front of frontsIn(w, h, picture.width, picture.height)) {
    const mask = masks.get(front.art);
    if (!mask) continue;
    const canvas = document.createElement('canvas');
    canvas.className = 'furniture-front';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.max(1, Math.round(front.width * ratio));
    canvas.height = Math.max(1, Math.round(front.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      land,
      front.x * ratio,
      front.y * ratio,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
    canvas.style.width = `${front.width}px`;
    canvas.style.height = `${front.height}px`;
    canvas.style.transform = `translate(${front.x}px,${front.y}px)`;
    canvas.style.zIndex = String(front.z);
    layer.append(canvas);
    shown.push(canvas);
  }
}
