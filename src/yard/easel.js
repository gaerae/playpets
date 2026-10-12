// Puts the painted backdrop on the yard: the sky behind the sun, moon and clouds, the land in
// front of them, and each drifting cloud. They are painted once and stand still; they are painted
// again only when the light changes (the time of day, the weather, the season) or the yard
// changes size, and the new painting fades in over the old one. Nothing here runs in between
// (docs/standards/performance.md). The colours come from the stylesheet (scenery.css and the
// season's), read off the yard after sky.js has set them.
import { paintLand } from './backdrop.js';
import { seeded } from './brush.js';
import { paintCloud, paintSky } from './clouds.js';
import { environmentLook, paintEnvironment } from './environment.js';
import { lightFor, readPalette } from './palette.js';
import { worldAllows } from './worlds.js';

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

export function createEasel(yard, reduced, geometryChanged = () => {}) {
  const sky = yard.querySelector('.paint-sky'),
    land = yard.querySelector('.paint-land'),
    clouds = [...yard.querySelectorAll('.cloud-lane .cloud')];
  let last = '',
    scene = null,
    timer = null,
    paintedWorld = null;
  // Only the picture on the wall is kept decoded (about 6 MB each); another is loaded when shown.
  const images = new Map();
  const loading = new Set(),
    failed = new Set();
  const skyImages = new Map();
  let skyRequested = false;
  // The sky's cloud pictures, only for a place with a sky, and one repaint once all are in.
  function loadSky() {
    if (skyRequested) return;
    skyRequested = true;
    const names = ['cumulus', 'wisps', 'small', 'overcast'];
    let pending = names.length;
    for (const name of names) {
      const image = new Image();
      image.onload = image.onerror = () => {
        if (image.naturalWidth) skyImages.set(name, image);
        if (--pending) return;
        last = '';
        paint();
      };
      image.src = new URL(`../art/sky/${name}.png`, import.meta.url).href;
    }
  }
  function loadEnvironment(name) {
    if (images.has(name) || loading.has(name) || failed.has(name)) return;
    loading.add(name);
    const image = new Image();
    const settle = ok => () => {
      loading.delete(name);
      if (ok) images.set(name, image);
      else failed.add(name);
      if (scene && environmentLook(scene).art === name) {
        last = '';
        paint();
      }
    };
    image.onload = settle(true);
    image.onerror = settle(false);
    image.src = new URL(`../art/environments/${name}.png`, import.meta.url).href;
  }
  function paint() {
    const w = yard.clientWidth,
      h = yard.clientHeight;
    if (!scene || !w || !h) return;
    const style = getComputedStyle(yard),
      pal = readPalette(name => style.getPropertyValue(`--${name}`).trim()),
      key = JSON.stringify([w, h, scene, pal]);
    if (key === last) return;
    const art = environmentLook(scene).art;
    // The picture on the wall stays until the next has decoded: no flash of the painted
    // fallback, and fishing is not ended by a switch there and back.
    if (loading.has(art)) return;
    const fade = !!last && paintedWorld === scene.world && !reduced.matches && last.startsWith(`[${w},${h},`);
    paintedWorld = scene.world;
    last = key;
    const density = Math.min(2, window.devicePixelRatio || 1);
    const skyCanvas = document.createElement('canvas');
    const skyContext = sized(skyCanvas, w, h, Math.min(1, density));
    if (worldAllows(scene.world, 'sky')) paintSky(skyContext, w, h, pal, scene, skyImages);
    hang(sky, skyCanvas, fade);
    const landCanvas = document.createElement('canvas');
    const landContext = sized(landCanvas, w, h, density),
      image = images.get(art);
    const illustrated = !!image;
    for (const name of images.keys()) if (name !== art) images.delete(name);
    const mode = illustrated ? 'illustrated' : 'painted',
      previousMode = yard.dataset.environment;
    yard.dataset.environment = mode;
    if (previousMode && previousMode !== mode) geometryChanged();
    if (illustrated) paintEnvironment(landContext, image, w, h, scene);
    else if (worldAllows(scene.world, 'sky')) paintLand(landContext, w, h, pal, scene);
    else {
      landContext.fillStyle = '#9a7754';
      landContext.fillRect(0, 0, w, h);
    }
    hang(land, landCanvas, fade);
    // Each drifting cloud, at the size it is shown.
    const lit = lightFor(scene.period, scene.weather);
    clouds.forEach((cloud, i) => {
      const cw = cloud.clientWidth,
        ch = cloud.clientHeight;
      if (!worldAllows(scene.world, 'sky') || !cw || !ch) return;
      const ctx = sized(cloud, cw, ch, density);
      ctx.clearRect(0, 0, cw, ch);
      const layer = skyImages.get(scene.weather === 'clear' ? (i % 2 ? 'wisps' : 'small') : 'overcast');
      if (layer) {
        ctx.globalAlpha = scene.period === 'night' ? 0.22 : scene.period === 'evening' ? 0.65 : 0.9;
        ctx.drawImage(layer, 0, 0, cw, ch);
      } else paintCloud(ctx, cw / 2, ch * 0.95, cw * 0.9, ch * 0.72, pal, seeded(61 + i * 7), lit);
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
      scene = {
        world: next.world ?? 'woodland',
        period: next.period,
        weather: next.weather,
        season: next.season,
        event: next.event ?? null,
      };
      yard.dataset.world = scene.world;
      yard.dataset.sky = String(worldAllows(scene.world, 'sky'));
      yard.dataset.scenery = String(
        ['sky', 'weather', 'wildlife', 'seasonalEffects'].some(capability => worldAllows(scene.world, capability)),
      );
      if (worldAllows(scene.world, 'sky')) loadSky();
      loadEnvironment(environmentLook(scene).art);
      paint();
    },
  };
}
