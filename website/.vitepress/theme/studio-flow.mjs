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
