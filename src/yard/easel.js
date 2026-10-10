// Puts the painted backdrop on the yard: the sky behind the sun, moon and clouds, the land in
// front of them, and each drifting cloud. They are painted once and stand still; they are painted
// again only when the light changes (the time of day, the weather, the season) or the yard
// changes size, and the new painting fades in over the old one. Nothing here runs in between
// (docs/standards/performance.md). The colours come from the stylesheet (scenery.css and the
// season's), read off the yard after sky.js has set them.
import { paintLand } from './backdrop.js';
import { seeded } from './brush.js';
import { paintCloud, paintSky } from './clouds.js';
import { lightFor, readPalette } from './palette.js';

// Canvas pixels per yard pixel: sharp on a dense screen, but never more than this many in all,
// so a large window does not hold a huge picture. The sky is soft and needs fewer.
const MAX_PIXELS = 4.2e6;
const FADE_MS = 2400;

function sized(canvas, w, h, density) {
  const ratio = Math.min(density, Math.sqrt(MAX_PIXELS / (w * h)));
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/** A new painting laid over the one before, fading in; the one before goes once it is covered. */
function hang(slot, canvas, fade) {
  const before = [...slot.querySelectorAll('canvas')];
  slot.append(canvas);
  if (!fade || !before.length) {
    for (const old of before) old.remove();
    canvas.classList.add('shown');
    return;
  }
  // Painted while hidden, shown on the next frame, so the fade runs.
  requestAnimationFrame(() => canvas.classList.add('shown'));
  setTimeout(() => {
    for (const old of before) old.remove();
  }, FADE_MS + 100);
}

export function createEasel(yard, reduced) {
  const sky = yard.querySelector('.paint-sky'),
    land = yard.querySelector('.paint-land'),
    clouds = [...yard.querySelectorAll('.cloud-lane .cloud')];
  let last = '',
    scene = null,
    timer = null;
  function paint() {
    const w = yard.clientWidth,
      h = yard.clientHeight;
    if (!scene || !w || !h) return;
    const style = getComputedStyle(yard),
      pal = readPalette(name => style.getPropertyValue(`--${name}`).trim()),
      key = JSON.stringify([w, h, scene, pal]);
    if (key === last) return;
    const fade = !!last && !reduced.matches && last.startsWith(`[${w},${h},`);
    last = key;
    const density = Math.min(2, window.devicePixelRatio || 1);
    const skyCanvas = document.createElement('canvas');
    paintSky(sized(skyCanvas, w, h, Math.min(1, density)), w, h, pal, scene);
    hang(sky, skyCanvas, fade);
    const landCanvas = document.createElement('canvas');
    paintLand(sized(landCanvas, w, h, density), w, h, pal, scene);
    hang(land, landCanvas, fade);
    // Each drifting cloud, at the size it is shown.
    const lit = lightFor(scene.period, scene.weather);
    clouds.forEach((cloud, i) => {
      const cw = cloud.clientWidth,
        ch = cloud.clientHeight;
      if (!cw || !ch) return;
      const ctx = sized(cloud, cw, ch, density);
      ctx.clearRect(0, 0, cw, ch);
      paintCloud(ctx, cw / 2, ch * 0.95, cw * 0.9, ch * 0.72, pal, seeded(61 + i * 7), lit);
    });
  }
  // A yard being resized is painted again once it has settled.
  new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(paint, last ? 250 : 0);
  }).observe(yard);
  return {
    /** The light changed (or may have): paints again if what it shows is different. */
    set(next) {
      scene = { period: next.period, weather: next.weather, season: next.season, event: next.event ?? null };
      paint();
    },
  };
}
