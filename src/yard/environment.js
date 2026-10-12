import { weatherPanes } from './window-weather.js';
import { worldAllows, worldFor } from './worlds.js';

// Raster land shares the live sky's time and weather. Loading stays inside easel setup.
export function environmentLook({ season, weather, period, world }) {
  const place = worldFor(world);
  if (place.art) {
    const light = {
      morning: { filter: 'brightness(0.98)', tint: '#ffe3b811' },
      day: { filter: 'none', tint: null },
      evening: { filter: 'brightness(0.9) saturate(0.95)', tint: '#eeb47222' },
      night: { filter: 'brightness(0.82) saturate(0.9)', tint: '#eeb47222' },
    }[period] || { filter: 'none', tint: null };
    return {
      art: place.art[period] || place.art[period === 'night' ? 'night' : 'day'],
      ...(place.authoredLighting ? { filter: 'none', tint: null } : light),
    };
  }
  const art =
    weather === 'snow' || season === 'winter'
      ? 'winter'
      : season === 'autumn'
        ? 'autumn'
        : season === 'spring'
          ? 'spring'
          : 'green';
  const light = {
    morning: { filter: 'brightness(0.95) saturate(0.9)', tint: '#ffd6a52b' },
    day: { filter: 'none', tint: null },
    evening: { filter: 'brightness(0.78) saturate(0.85)', tint: '#eaa27845' },
    night: { filter: 'saturate(0.65)', tint: '#132c58b8' },
  }[period] || { filter: 'none', tint: null };
  return {
    art,
    filter:
      weather === 'rain'
        ? `${light.filter === 'none' ? '' : `${light.filter} `}saturate(0.7) brightness(0.82)`
        : light.filter,
    tint: light.tint || (weather === 'rain' ? '#526d8555' : null),
  };
}

/** Keeps the source's proportions while aligning its walkable floor with the yard's. */
export function environmentFrame(w, h, scene = {}, sourceWidth = 1536, sourceHeight = 1024) {
  const place = worldFor(scene.world),
    scale = Math.max(w / sourceWidth, h / sourceHeight),
    width = sourceWidth * scale,
    height = sourceHeight * scale,
    floor = place.fit === 'cover-bottom' ? 1 : (place.geometry?.fieldTop ?? 0.6);
  return { x: (w - width) / 2, y: (h - height) * floor, width, height };
}

/** Paints a loaded transparent land layer without touching the sky behind it. */
export function paintEnvironment(ctx, image, w, h, scene) {
  const { filter, tint } = environmentLook(scene);
  ctx.save();
  ctx.filter = filter;
  const frame = environmentFrame(w, h, scene, image.width, image.height);
  ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height);
  ctx.filter = 'none';
  if (tint) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  const panes = weatherPanes(w, h, frame, worldFor(scene.world).windowPanes);
  if (panes?.length && worldAllows(scene.world, 'weather') && ['rain', 'snow'].includes(scene.weather)) {
    ctx.save();
    ctx.beginPath();
    for (const pane of panes) ctx.rect(pane.x, pane.y, pane.width, pane.height);
    ctx.clip();
    ctx.fillStyle =
      scene.weather === 'rain'
        ? scene.period === 'night'
          ? '#24364b44'
          : '#647b9240'
        : scene.period === 'night'
          ? '#a2b4c826'
          : '#dce7ee36';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (worldAllows(scene.world, 'seasonalEffects') && scene.event === 'lights') {
    ctx.save();
    const colors = ['#ffe9a8', '#ff9a85', '#a6e3a8', '#a8d8ff'];
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = frame.x + frame.width * (0.79 + i * 0.018),
          y = frame.y + frame.height * (0.08 + row * 0.09 + Math.sin((i / 12) * Math.PI) * 0.045);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = '#364d4266';
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let i = 0; i <= 12; i++) {
        const x = frame.x + frame.width * (0.79 + i * 0.018),
          y = frame.y + frame.height * (0.08 + row * 0.09 + Math.sin((i / 12) * Math.PI) * 0.045);
        ctx.fillStyle = colors[(row + i) % colors.length];
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = scene.period === 'night' || scene.period === 'evening' ? 9 : 0;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.4, h * 0.003), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/** The raster pond's water and shore, in the same cropped coordinates as the image. */
export function environmentLake(w, h, scene = {}) {
  if (!worldAllows(scene.world, 'fishing')) return null;
  const lake = worldFor(scene.world).geometry?.lake,
    frame = environmentFrame(w, h, scene);
  const x0 = frame.x + frame.width * (lake?.from ?? 0.34),
    x1 = frame.x + frame.width * (lake?.to ?? 0.79),
    center = frame.y + frame.height * (lake?.center ?? 0.595),
    radius = frame.height * (lake?.radius ?? 0.03);
  const arc = x => Math.sqrt(Math.max(0, 1 - ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2));
  const shoreAt = x => (x <= x0 || x >= x1 ? Infinity : center - radius * arc(x));
  const ridgeAt = x => center + radius * arc(x);
  return {
    x0,
    x1,
    top: center - radius,
    ends: [Math.max(0, x0), Math.min(w, x1)],
    shoreAt,
    ridgeAt,
    onWater: (x, y) => x >= 0 && x <= w && y >= 0 && y <= h && x > x0 && x < x1 && y > shoreAt(x) && y < ridgeAt(x),
  };
}
