// Things that open from a button. A dropdown opens and closes a panel (a click on the button, a
// click outside or Esc closes it). A popup menu is a dropdown whose items are a menu: the arrow
// keys move between them and choosing one closes it; the items keep their own handlers.

/** Wires `button` to open and close `panel`; `opened` runs each time it opens (to move the focus). */
export function dropdown(button, panel, opened = () => {}, closed = () => {}) {
  const show = open => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) opened();
    else return closed();
  };
  button.addEventListener('click', e => {
    e.stopPropagation();
    show(panel.hidden);
  });
  document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) show(false);
  });
  // Esc closes it from inside, or from the button that opened it (focus can stay there).
  const onEscape = e => {
    if (e.key !== 'Escape' || panel.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    const focus = show(false);
    (focus || button).focus();
  };
  panel.addEventListener('keydown', onEscape);
  button.addEventListener('keydown', onEscape);
  return { open: () => show(true), close: () => show(false) };
}

/** Wires `button` to open and close `menu` (role="menu" with role="menuitem" items). */
export function popup(button, menu) {
  const items = () => [...menu.querySelectorAll('[role="menuitem"]:not(:disabled):not([hidden])')];
  const box = dropdown(button, menu, () => items()[0]?.focus());
  menu.addEventListener('click', e => {
    if (e.target.closest('[role="menuitem"]')) box.close();
  });
  menu.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = items(),
      at = list.indexOf(document.activeElement);
    list[(at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  });
  return box;
}
