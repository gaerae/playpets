import { worldAllows, worldFor } from './worlds.js';

const DAYLIGHT = { filter: 'none', tint: null };
const OUTDOOR_LIGHT = {
  morning: { filter: 'brightness(0.95) saturate(0.9)', tint: '#ffd6a52b' },
  day: DAYLIGHT,
  evening: { filter: 'brightness(0.78) saturate(0.85)', tint: '#eaa27845' },
  night: { filter: 'saturate(0.65)', tint: '#132c58b8' },
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

// Between `low` and `high`; when they cross (a safe rect too large for the window), halfway.
const within = (value, low, high) => (low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value)));
/** Where the picture is drawn in a window of w by h: its proportions kept, and its floor line,
 * outdoors, where the window's is. A place that names the part always seen (geometry.safe,
 * [x0, y0, x1, y1] of the picture) keeps it whole in every window from 4:3 to 16:9, the picture
 * covering the window. Wider, the picture shrinks to the safe height and its own edge, mirrored
 * and out of focus, fills the sides (paintSides); narrower, outdoors it shrinks to the safe width
 * and stands on the window's bottom with the yard's sky above (paintTop), while a room keeps
 * covering its height and crops its sides. A strip along the screen (wider than three times its
 * height) crops, as a place without a safe rect always does. */
export function environmentFrame(w, h, scene = {}, sourceWidth = 1536, sourceHeight = 1024) {
  const place = worldFor(scene.world),
    room = place.fit === 'cover-bottom',
    safe = w > h * 3 ? null : place.geometry?.safe,
    cover = Math.max(w / sourceWidth, h / sourceHeight);
  let scale = cover;
  if (safe) {
    scale = Math.min(cover, h / ((safe[3] - safe[1]) * sourceHeight), w / ((safe[2] - safe[0]) * sourceWidth));
    if (room) scale = Math.max(scale, h / sourceHeight);
  }
  const width = sourceWidth * scale,
    height = sourceHeight * scale,
    centered = (w - width) / 2,
    // A room framed from its foot shows its floor's front; outdoors the floor line stays put.
    anchored = room ? h - height : (h - height) * (place.geometry?.fieldTop ?? 0.6);
  if (!safe) return { x: centered, y: anchored, width, height };
  const x =
      width > w ? within(centered, Math.max(w - width, -safe[0] * width), Math.min(0, w - safe[2] * width)) : centered,
    y =
      height >= h
        ? within(anchored, Math.max(h - height, -safe[1] * height), Math.min(0, h - safe[3] * height))
        : h - height;
  return { x, y, width, height };
}
// A side the picture leaves is its own edge mirrored there, out of focus and shaded toward the
// window's edge, so it reads as the place going on into shadow; sharp, a vase at the edge showed
// twice, face to face. Each mirror reaches past the seam and the window's edge (SIDE_REACH), so
// its blur has pixels to sample there; cut at the seam, it faded into a light line. The shade falls
// only on what is painted, not on the sky behind the land.
const SIDE_SHADE = 'rgba(64, 40, 22, 0.5)';
const SIDE_BLUR = 'blur(10px)';
const SIDE_REACH = 24;
function paintSides(ctx, image, w, h, frame) {
  if (frame.x <= 0) return;
  const reach = frame.x + 2 * SIDE_REACH,
    strip = (reach / frame.width) * image.width,
    right = frame.x + frame.width,
    look = ctx.filter && ctx.filter !== 'none' ? `${ctx.filter} ${SIDE_BLUR}` : SIDE_BLUR;
  // [the mirror's axis, where its drawing starts from it, the source's left, the side's left]
  // Each side's clip ends on a whole pixel under the picture: at a seam halfway through a pixel,
  // the picture and the side each covered half of it, and the sky showed through as a line.
  const inner = Math.ceil(frame.x),
    outer = Math.floor(right);
  for (const [axis, from, source, left, wide] of [
    [frame.x + SIDE_REACH, 0, 0, 0, inner],
    [right - SIDE_REACH, -reach, image.width - strip, outer, w - outer],
  ]) {
    ctx.save();
    // Kept to its side: the blur would spread over the picture's own edge.
    ctx.beginPath?.();
    ctx.rect?.(left, 0, wide, h);
    ctx.clip?.();
    ctx.filter = look;
    ctx.translate(axis, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, source, 0, strip, image.height, from, frame.y, reach, frame.height);
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (const [from, to] of [
    [0, frame.x],
    [w, right],
  ]) {
    const shade = ctx.createLinearGradient(from, 0, to, 0);
    shade.addColorStop(0, SIDE_SHADE);
    shade.addColorStop(1, 'rgba(64, 40, 22, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(Math.min(from, to), 0, frame.x, h);
  }
  ctx.restore();
}
// The share of the picture's height over which its top edge fades into the sky above it, so a
// tree's crown that the picture cuts off thins out instead of ending in a straight line.
const TOP_FADE = 0.08;
function paintTop(ctx, frame) {
  if (frame.y <= 0) return;
  const band = frame.height * TOP_FADE,
    fade = ctx.createLinearGradient(0, frame.y, 0, frame.y + band);
  fade.addColorStop(0, '#000');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(frame.x, frame.y, frame.width, band);
  ctx.restore();
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
export function paintEnvironment(ctx, image, w, h, scene) {
  const { filter, tint } = environmentLook(scene);
  ctx.save();
  ctx.filter = filter;
  const frame = environmentFrame(w, h, scene, image.width, image.height);
  ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height);
  paintSides(ctx, image, w, h, frame);
  ctx.filter = 'none';
  paintTop(ctx, frame);
  if (tint) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  const panes = weatherPanes(w, h, frame, worldFor(scene.world).windowPanes);
  // A painted window gets the weather's grey; glass over the yard's own sky shows that sky's.
  if (
    panes?.length &&
    !worldAllows(scene.world, 'sky') &&
    worldAllows(scene.world, 'weather') &&
    ['rain', 'snow'].includes(scene.weather)
  ) {
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

/** The raster pond's water and shore, in the same cropped coordinates as the image; null where the
 * place has no water of its own (geometry.lake in worlds.json, or an imported background's water). */
export function environmentLake(w, h, scene = {}) {
  const lake = worldFor(scene.world).geometry?.lake;
  if (!lake || !worldAllows(scene.world, 'fishing')) return null;
  const frame = environmentFrame(w, h, scene);
  const x0 = frame.x + frame.width * lake.from,
    x1 = frame.x + frame.width * lake.to,
    center = frame.y + frame.height * lake.center,
    radius = frame.height * lake.radius;
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
