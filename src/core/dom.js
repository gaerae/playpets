// Small helpers for the page's own elements. Each touches `document` only when called, so a module
// that imports them still imports in Node.

/** A span with `className`; a `hidden` one is decoration a screen reader passes over. */
export function span(className, hidden = false) {
  const node = document.createElement('span');
  node.className = className;
  if (hidden) node.setAttribute('aria-hidden', 'true');
  return node;
}

/** A picture with its one word under it (base.css .clue), as a how-to notice shows a gesture and
 * the album a way to find a kind: `icon` names a painted picture ([data-clue]), `svg` is a drawing
 * and `image` a thumbnail's url, both made by the page itself, never text from outside. */
export function clue({ icon, svg, image, text }) {
  const el = document.createElement('span'),
    picture = document.createElement('i'),
    words = document.createElement('span');
  el.className = 'clue';
  if (svg) {
    picture.className = 'clue-art';
    picture.innerHTML = svg;
  } else if (icon) picture.dataset.clue = icon;
  else {
    picture.className = 'clue-place';
    picture.style.backgroundImage = `url("${image}")`;
  }
  words.textContent = text;
  el.append(picture, words);
  return el;
}

/** Sets `node[key]` (its text, a title, `hidden`, a dataset entry) only when it differs. The same
 * value written again still counts as a change: the page works out its styles again, and an
 * observer hears of it. The backend pushes its whole state often with little changed. */
export function put(node, key, value) {
  if (node[key] !== value) node[key] = value;
}
/** Sets an attribute only when it differs, for the same reason as put. */
export function putAttribute(node, name, value) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

// The timer that takes each replayed class off again, by node, so a replay restarts it.
const replays = new WeakMap();
/** Plays the short CSS animation that `className` starts on `node` again from its start, and takes
 * the class off after `ms` (a wrong guess's shake, a float reeled too soon). */
export function replay(node, className, ms) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  clearTimeout(replays.get(node));
  replays.set(
    node,
    setTimeout(() => node.classList.remove(className), ms),
  );
}

/** Calls `fn` each time the screen's density (devicePixelRatio) changes: the window moved to another
 * screen, or the page was zoomed. The window keeps its size, so no resize says so, and a canvas
 * sized for the old density shows blurred. Each query names one density, so it is asked again at
 * the new one. */
export function onDensityChange(fn) {
  const listen = () =>
    globalThis.matchMedia?.(`(resolution: ${globalThis.window?.devicePixelRatio || 1}dppx)`)?.addEventListener?.(
      'change',
      () => {
        listen();
        fn();
      },
      { once: true },
    );
  listen();
}
