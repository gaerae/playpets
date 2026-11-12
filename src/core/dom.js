// Small helpers for the page's own elements. Each touches `document` only when called, so a module
// that imports them still imports in Node.

/** A span with `className`; a `hidden` one is decoration a screen reader passes over. */
export function span(className, hidden = false) {
  const node = document.createElement('span');
  node.className = className;
  if (hidden) node.setAttribute('aria-hidden', 'true');
  return node;
}
