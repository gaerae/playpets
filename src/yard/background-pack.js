// Portable backgrounds are inert data. The same validator is used by the app and creator page.
export const MAX_BACKGROUND_BYTES = 32 * 1024 * 1024;

import { SEASONS as seasons } from '../core/season.js';

const fail = () => {
  throw new Error('background.invalid');
};
const fraction = (n, min = 0, max = 1) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
function image(value) {
  if (
    typeof value !== 'string' ||
    value.length > 8 * 1024 * 1024 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return fail();
  let bytes;
  try {
    bytes = atob(value.slice(22, 66));
  } catch {
    return fail();
  }
  const at = i => bytes.charCodeAt(i);
  const word = i => at(i) * 16777216 + at(i + 1) * 65536 + at(i + 2) * 256 + at(i + 3);
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].some((b, i) => at(i) !== b) ||
    bytes.slice(12, 16) !== 'IHDR' ||
    word(16) !== 1536 ||
    word(20) !== 1024
  )
    return fail();
  return value;
}
export function validateBackgroundGeometry(input) {
  const invalid = field => {
    throw new Error(field);
  };
  if (!fraction(input.floor, 0.5, 0.8)) return invalid('floor');
  let water = null;
  if (input.water) {
    const { from, to, center, radius } = input.water;
    if (
      ![from, to, center, radius].every(n => fraction(n)) ||
      from >= to ||
      radius <= 0 ||
      center - radius < 0 ||
      center + radius > input.floor
    )
      return invalid('water');
    water = { from, to, center, radius };
  }
  let fishingSpot = null;
  if (input.fishingSpot) {
    const { x, y } = input.fishingSpot;
    if (!water || !fraction(x, 0.02, 0.98) || !fraction(y, input.floor, 0.94)) return invalid('fishingSpot');
    fishingSpot = { x, y };
  }
  const windows = [];
  if (input.windows !== undefined && (!Array.isArray(input.windows) || input.windows.length > 12))
    return invalid('windows');
  for (const pane of input.windows || []) {
    if (!pane) return invalid('windows');
    const { x, y, width, height } = pane;
    if (
      ![x, y, width, height].every(n => fraction(n)) ||
      !width ||
      !height ||
      x + width > 1 ||
      y + height > input.floor
    )
      return invalid('windows');
    windows.push({ x, y, width, height });
  }
  return { floor: input.floor, water, fishingSpot, windows };
}

export function validateBackgroundPack(input) {
  if (
    input?.format !== 'playpets-background' ||
    input.version !== 1 ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 60 ||
    !fraction(input.floor, 0.5, 0.8)
  )
    return fail();
  if (JSON.stringify(input).length > MAX_BACKGROUND_BYTES) return fail();
  if (
    input.capabilities !== undefined &&
    (!input.capabilities ||
      typeof input.capabilities !== 'object' ||
      Array.isArray(input.capabilities) ||
      (input.capabilities.soil !== undefined && typeof input.capabilities.soil !== 'boolean'))
  )
    return fail();
  const name = [...input.name]
    .map(c => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
    .join('')
    .trim();
  if (!name) return fail();
  const images = { base: image(input.images?.base) };
  for (const season of seasons) if (input.images[season]) images[season] = image(input.images[season]);
  let geometry;
  try {
    geometry = validateBackgroundGeometry(input);
  } catch {
    return fail();
  }
  return {
    format: 'playpets-background',
    version: 1,
    name,
    images,
    ...geometry,
    capabilities: { soil: input.capabilities?.soil ?? input.sky === true },
    sky: input.sky === true,
    weather: input.weather === true,
    ambient: input.ambient === true,
  };
}
export function backgroundWorld(pack, id) {
  const seasonal = seasons.every(s => pack.images[s]);
  return {
    id,
    custom: true,
    name: pack.name,
    label: 'background.custom',
    about: seasonal ? 'background.seasonal' : 'background.static',
    fit: 'cover-floor',
    imageSources: pack.images,
    eventLights: false,
    geometry: { fieldTop: pack.floor, lake: pack.water, fishingSpot: pack.fishingSpot },
    windowPanes: pack.sky ? undefined : pack.windows,
    capabilities: {
      sky: pack.sky,
      soil: pack.capabilities?.soil ?? pack.sky !== false,
      weather: pack.weather && (pack.sky || pack.windows.length > 0),
      wildlife: pack.sky,
      fishing: !!pack.water,
      seasonalEffects: seasonal && pack.sky,
      ambient: pack.ambient && pack.sky,
    },
  };
}
