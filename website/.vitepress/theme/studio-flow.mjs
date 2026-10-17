// Old guide anchors remain useful when their tools live in separate workspace panels.
export function studioPanelForHash(hash, kind) {
  if (kind === 'background') {
    if (hash === '#studio-images') return 'images';
    if (hash === '#studio-export') return 'export';
    return 'layout';
  }
  if (hash === '#pet-package-title') return 'package';
  if (hash === '#custom-prompts') return 'custom';
  return 'sample';
}

export function petIdFromName(name, suffix) {
  const stem =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'pet';
  return `${stem}-${suffix}`;
}

export function replaceStudioHash(hash, { history, location } = window) {
  history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
}

// Each request gets fresh geometry; editing one draft never mutates another starter.
export function backgroundStarter(id) {
  const common = { floor: 0.67, water: null, fishingSpot: null, windows: [], sky: true, weather: true, ambient: true };
  if (id === 'garden') return common;
  if (id === 'lakeside')
    return {
      ...common,
      water: { from: 0.4, to: 0.68, center: 0.6, radius: 0.025 },
      fishingSpot: { x: 0.43, y: 0.74 },
    };
  if (id === 'interior')
    return {
      ...common,
      sky: false,
      ambient: false,
      windows: [{ x: 0.26, y: 0.12, width: 0.52, height: 0.36 }],
    };
  throw new Error('Unknown background starter');
}

export function backgroundReadiness({ name, base, geometryError, bytes, maxBytes }) {
  return [
    { key: 'name', phase: 'layout', ok: !!name.trim() },
    { key: 'image', phase: 'images', ok: !!base },
    { key: 'geometry', phase: 'layout', ok: !geometryError },
    { key: 'budget', phase: 'images', ok: bytes <= maxBytes },
  ];
}
