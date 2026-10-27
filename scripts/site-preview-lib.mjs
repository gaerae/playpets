import { jumpLifts, rowScales } from './companion-batches-lib.mjs';
import { LANDING_PETS } from './site-content.mjs';

export const PREVIEW_STATES = Object.freeze(['idle', 'wave', 'jump']);
// Rows the landing's moving scenes play from the runtime atlas: walking, the coding-agent states
// and the two gaze rows (eight directions each). Each one is published as its own small strip.
export const MOTION_ROWS = Object.freeze({
  right: 1,
  left: 2,
  waiting: 6,
  working: 7,
  done: 8,
  'look-0': 9,
  'look-1': 10,
});

export function validatePreview(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value))
    throw new Error('Invalid PNG header');
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = header.getUint32(16),
    height = header.getUint32(20);
  if (width !== 3072 || height !== 416) throw new Error('Site preview needs eight 384×416 cells (3072×416 PNG)');
}

// Optional high-resolution artwork never changes the app's canonical sprite contract.
export function previewSource(pet, state, available, season = 'base', seasonalAvailable, motion) {
  const seasonal = LANDING_PETS.some(entry => entry.id === pet) && ['summer', 'winter'].includes(season);
  const sheet = seasonal ? season : 'base';
  if (motion?.[pet]?.[sheet]?.includes(state)) return `/pets/motion/${pet}/${sheet}/${state}.webp`;
  if (seasonal)
    return seasonalAvailable?.[pet]?.[season]?.includes(state)
      ? `/pets/previews/${pet}/${season}/${state}.png`
      : `/creator-kit/${pet}/${season}.png`;
  return available?.[pet]?.includes(state) ? `/pets/previews/${pet}/${state}.png` : null;
}

export function previewPacking(state, config = {}) {
  const row = { idle: 0, wave: 3, jump: 4 }[state];
  if (row === undefined) throw new Error(`Unknown preview state: ${state}`);
  const scales = rowScales(config),
    lifts = jumpLifts(config);
  return { scale: scales[row], lifts: state === 'jump' ? lifts : null };
}
