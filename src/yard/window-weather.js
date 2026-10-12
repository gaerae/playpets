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
