// A menu that opens from a button: a click outside or Esc closes it, the arrow keys move between its
// items, and choosing one closes it. The items keep their own handlers.

/** Wires `button` to open and close `menu` (role="menu" with role="menuitem" items). */
export function popup(button, menu) {
  const items = () => [...menu.querySelectorAll('[role="menuitem"]:not(:disabled):not([hidden])')];
  const show = open => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) items()[0]?.focus();
  };
  button.addEventListener('click', e => {
    e.stopPropagation();
    show(menu.hidden);
  });
  menu.addEventListener('click', e => {
    if (e.target.closest('[role="menuitem"]')) show(false);
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) show(false);
  });
  menu.addEventListener('keydown', e => {
    const list = items(),
      at = list.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      show(false);
      button.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list[(at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    }
  });
  return { close: () => show(false) };
}
