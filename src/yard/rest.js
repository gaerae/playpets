// A yard that cannot be seen for a while lets go of what it can paint again: the backdrop's and the
// weather's canvases, and its whole drawing (content-visibility), about 45 MB in WebKit. It paints
// them again when the page is seen, before WebKit draws it, so nothing shows unpainted.
// The page's own `document.hidden` wakes it: the backend's word that the window shows again comes
// after the window does, too late to paint first. That word still counts for resting, since WebView2
// may never report a hidden window's page hidden (docs/standards/performance.md).

/** How long the page is hidden before the yard rests. */
export const REST_MS = 30_000;

/**
 * Rests the yard (`rest()`) once the page has been hidden, or its window unseen (`seen()`, the
 * backend's word), for REST_MS, and wakes it (`wake()`) as it is seen again. `check()` looks again
 * (the backend reported the window). Called once, by app.js.
 */
export function setupRest({ rest, wake, seen = () => true, doc = globalThis.document }) {
  let timer = null,
    resting = false;
  const unseen = () => doc.hidden || !seen();
  function check() {
    if (unseen()) {
      if (resting || timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (!unseen()) return;
        resting = true;
        rest();
      }, REST_MS);
      return;
    }
    awake();
  }
  function awake() {
    clearTimeout(timer);
    timer = null;
    if (!resting) return;
    resting = false;
    wake();
  }
  // Seen by WebKit itself: painted now, before it draws, whatever the backend says after.
  doc.addEventListener('visibilitychange', () => (doc.hidden ? check() : awake()));
  check();
  return { check, resting: () => resting };
}
