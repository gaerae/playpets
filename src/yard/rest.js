// A yard that cannot be seen for a while lets go of what it can paint again: the backdrop's and the
// weather's canvases, and its whole drawing (content-visibility), about 45 MB in WebKit. It paints
// them again when the page is seen, before WebKit draws it, so nothing shows unpainted.
// Only the page's own `document.hidden` counts: the backend's word that the window is hidden comes
// after the window shows again, too late to paint first (docs/standards/performance.md).

/** How long the page is hidden before the yard rests. */
export const REST_MS = 30_000;

/**
 * Rests the yard (`rest()`) once the page has been hidden for REST_MS and wakes it (`wake()`) as it
 * is seen again. `check()` looks again (the backend reported the window). Called once, by app.js.
 */
export function setupRest({ rest, wake, doc = globalThis.document }) {
  let timer = null,
    resting = false;
  function check() {
    if (doc.hidden) {
      if (resting || timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (!doc.hidden) return;
        resting = true;
        rest();
      }, REST_MS);
      return;
    }
    clearTimeout(timer);
    timer = null;
    if (!resting) return;
    resting = false;
    wake();
  }
  doc.addEventListener('visibilitychange', check);
  check();
  return { check, resting: () => resting };
}
