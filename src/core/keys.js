// The page's keyboard shortcuts, in one table: the same keys the macOS menu bar shows
// (src-tauri/src/menu.rs; a test keeps the two alike). Each part of the page says what its key
// does with `onShortcut`. On a Mac the menu bar takes the keys of the switches (`menu: true`) before
// the page sees them, so the page answers those only elsewhere; the rest only open a panel, which
// is the same however many times it happens.

const onMac = /Mac/.test(globalThis.navigator?.platform || '');

/** `mod` is Cmd on a Mac and Ctrl elsewhere (either is taken, as the menu bar's CmdOrCtrl). */
export const SHORTCUTS = {
  controls: { keys: 'mod+shift+p', menu: true },
  friends: { keys: 'mod+1' },
  invite: { keys: 'mod+2' },
  settings: { keys: 'mod+,' },
  alwaysOnTop: { keys: 'mod+shift+m', menu: true },
  desktop: { keys: 'mod+shift+d', menu: true },
  sound: { keys: 'mod+shift+s', menu: true },
};

/** Whether a key press is `keys` ("mod+shift+s"): the modifiers named and no others. */
export function matches(e, keys) {
  const parts = keys.split('+'),
    key = parts.pop();
  return (
    (e.metaKey || e.ctrlKey) === parts.includes('mod') &&
    e.shiftKey === parts.includes('shift') &&
    !e.altKey &&
    e.key.toLowerCase() === key
  );
}

const handlers = new Map();
let listening = false;
/** Runs `run` when the shortcut `name` (a key of SHORTCUTS) is pressed. */
export function onShortcut(name, run) {
  const { menu } = SHORTCUTS[name];
  if (menu && onMac) return;
  handlers.set(name, run);
  if (listening) return;
  listening = true;
  document.addEventListener('keydown', e => {
    for (const [n, handler] of handlers) {
      if (!matches(e, SHORTCUTS[n].keys)) continue;
      e.preventDefault();
      handler();
      return;
    }
  });
}
