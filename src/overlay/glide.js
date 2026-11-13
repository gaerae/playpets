// How a desktop friend goes to each place the backend's layout gives it (core/ticker.js moveTo).

// A stroll's steps come every 40 ms (TICK in overlay.rs); a friend glides from one to the next over
// a little longer than that, so a step that comes late never shows a stop.
export const GLIDE_MS = 52;
/** How long the friend `view` takes to reach the place its layout `row` gives. Held, it follows the
 * pointer at once in every window that draws it: the one the drag began in has the press
 * (`view.drag`), and one on another screen, which pointer capture never reaches, hears it from the
 * row (`row.dragging`, overlay.rs). With reduced motion (`still`) nothing glides. */
export function glideMs(view, row, still) {
  return view.drag || row.dragging || still ? 0 : GLIDE_MS;
}
