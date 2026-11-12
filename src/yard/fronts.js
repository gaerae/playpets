// An agent workspace's furniture fronts (workspace.js frontsIn): the picture's own pixels, as just
// painted and lit for the hour, cut out along each front's outline and set in the friends' layer, so a
// friend seated behind a desk is drawn under its front. Made again only when the land is painted
// again (easel.js), never per frame.
import { frontsIn } from './workspace.js';

const shown = [];

/** Takes the fronts away and, for a place that has them, cuts them again from `land` (the painted
 * land, a canvas covering the `w` by `h` yard) into `layer` (the friends' garden layer). `picture`
 * is the place's picture, for its size; without it (the painted fallback) none are cut. */
export function paintFronts(layer, land, w, h, picture) {
  for (const old of shown.splice(0)) old.remove();
  if (!picture || !layer || !w) return;
  const ratio = land.width / w;
  for (const front of frontsIn(w, h, picture.width, picture.height)) {
    const canvas = document.createElement('canvas');
    canvas.className = 'furniture-front';
    canvas.setAttribute('aria-hidden', 'true');
    const cw = (canvas.width = Math.max(1, Math.round(front.width * ratio))),
      ch = (canvas.height = Math.max(1, Math.round(front.height * ratio)));
    const ctx = canvas.getContext('2d');
    if (front.shape) {
      ctx.beginPath();
      front.shape.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * cw, y * ch));
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(land, front.x * ratio, front.y * ratio, cw, ch, 0, 0, cw, ch);
    canvas.style.width = `${front.width}px`;
    canvas.style.height = `${front.height}px`;
    canvas.style.transform = `translate(${front.x}px,${front.y}px)`;
    canvas.style.zIndex = String(front.z);
    layer.append(canvas);
    shown.push(canvas);
  }
}
