import { worldAllows, worldFor } from './worlds.js';

const DAYLIGHT = { filter: 'none', tint: null };
const AUTHORED_LIGHT = {
  morning: { filter: 'brightness(0.98)', tint: '#ffe3b811' },
  day: DAYLIGHT,
  evening: { filter: 'brightness(0.9) saturate(0.95)', tint: '#eeb47222' },
  night: { filter: 'brightness(0.82) saturate(0.9)', tint: '#eeb47222' },
};
const OUTDOOR_LIGHT = {
  morning: { filter: 'brightness(0.95) saturate(0.9)', tint: '#ffd6a52b' },
  day: DAYLIGHT,
  evening: { filter: 'brightness(0.78) saturate(0.85)', tint: '#eaa27845' },
  night: { filter: 'saturate(0.65)', tint: '#132c58b8' },
};
const WINDOW_LIGHT = {
  morning: OUTDOOR_LIGHT.morning,
  day: DAYLIGHT,
  evening: { filter: 'brightness(0.7) saturate(0.85)', tint: '#eaa27845' },
  night: { filter: 'brightness(0.45) saturate(0.65)', tint: '#132c5888' },
};

// Raster land shares the live sky's time and weather. Loading stays inside easel setup.
export function environmentLook({ season, weather, period, world }) {
  const place = worldFor(world);
  if (place.imageSources) {
    const chosenSeason = season;
    const key = place.imageSources[chosenSeason] ? chosenSeason : 'base';
    return {
      art: `${place.id}:${key}`,
      filter: weather === 'rain' ? 'brightness(0.82) saturate(0.8)' : 'none',
      tint:
        period === 'night'
          ? '#132c58b8'
          : period === 'evening'
            ? '#eaa27845'
            : period === 'morning'
              ? '#ffd6a52b'
              : null,
    };
  }
  if (place.art) {
    const light = AUTHORED_LIGHT[period] || DAYLIGHT;
    return {
      art: place.art[period] || place.art[period === 'night' ? 'night' : 'day'],
      ...(place.authoredLighting ? { filter: 'none', tint: null } : light),
    };
  }
  const art =
    season === 'winter' ? 'winter' : season === 'autumn' ? 'autumn' : season === 'spring' ? 'spring' : 'green';
  const light = OUTDOOR_LIGHT[period] || DAYLIGHT;
  return {
    art: place.seasonArt?.[art] || art,
    filter:
      weather === 'rain'
        ? `${light.filter === 'none' ? '' : `${light.filter} `}saturate(0.7) brightness(0.82)`
        : light.filter,
    tint: light.tint || (weather === 'rain' ? '#526d8555' : null),
  };
}

/** Seasonal outdoor views are independently lit and clipped to a room's glass. */
export function environmentWindowLook(scene) {
  const place = worldFor(scene.world);
  const season = scene.season;
  const art = place.windowArt?.[season];
  if (!art) return null;
  const light = WINDOW_LIGHT[scene.period] || DAYLIGHT;
  return { art, ...light };
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

/** Visible window glass in the same cropped coordinates as the painted room; null means outdoors. */
export function weatherPanes(w, h, frame, panes) {
  if (!panes) return null;
  return panes
    .map(pane => {
      const x = Math.max(0, frame.x + pane.x * frame.width),
        y = Math.max(0, frame.y + pane.y * frame.height),
        right = Math.min(w, frame.x + (pane.x + pane.width) * frame.width),
        bottom = Math.min(h, frame.y + (pane.y + pane.height) * frame.height);
      return { x, y, width: right - x, height: bottom - y };
    })
    .filter(pane => pane.width > 0 && pane.height > 0);
}

/** Paints a loaded transparent land layer without touching the sky behind it. */
export function paintEnvironment(ctx, image, w, h, scene, windowImage = null) {
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
  const windowLook = environmentWindowLook(scene);
  if (windowImage && windowLook && panes?.length) {
    ctx.save();
    ctx.beginPath();
    for (const pane of panes) ctx.rect(pane.x, pane.y, pane.width, pane.height);
    ctx.clip();
    ctx.filter = windowLook.filter;
    ctx.drawImage(windowImage, frame.x, frame.y, frame.width, frame.height);
    ctx.filter = 'none';
    if (windowLook.tint) {
      ctx.fillStyle = windowLook.tint;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
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
    for (const [row, strand] of environmentLightStrands(w, h, scene).entries()) {
      ctx.beginPath();
      strand.forEach(({ x, y }, i) => {
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#364d4266';
      ctx.lineWidth = 1;
      ctx.stroke();
      for (const [i, { x, y }] of strand.entries()) {
        if (x < 0 || x > w || y < 0 || y > h) continue;
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

/** Optional authored fishing stance, transformed with the image; cropped stances use the visible shore. */
export function environmentFishingSpot(w, h, scene) {
  const point = worldFor(scene.world).geometry?.fishingSpot;
  if (!point || !worldAllows(scene.world, 'fishing')) return null;
  const frame = environmentFrame(w, h, scene);
  const x = frame.x + point.x * frame.width,
    y = frame.y + point.y * frame.height;
  return x >= 0 && x <= w && y >= 0 && y <= h ? { x, y } : null;
}

/** Strands stay attached to their authored tree branches when the scene is cropped. */
export function environmentLightStrands(w, h, scene) {
  const frame = environmentFrame(w, h, scene);
  return (worldFor(scene.world).lightAnchors || []).map(anchor =>
    Array.from({ length: 13 }, (_, i) => {
      const fraction = i / 12;
      return {
        x: frame.x + frame.width * (anchor.from + (anchor.to - anchor.from) * fraction),
        y: frame.y + frame.height * (anchor.y + Math.sin(fraction * Math.PI) * anchor.sag),
      };
    }),
  );
}
