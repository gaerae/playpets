// Things that open from a button. A dropdown opens and closes a panel (a click on the button, a
// click outside or Esc closes it). A popup menu is a dropdown whose items are a menu: the arrow
// keys move between them and choosing one closes it; the items keep their own handlers.

/** Wires `button` to open and close `panel`; `opened` runs each time it opens (to move the focus). */
export function dropdown(
  button,
  panel,
  opened = () => {},
  closed = () => {},
  { toggleOnClick = true, dismissOnTrigger = !toggleOnClick } = {},
) {
  const show = open => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) opened();
    else return closed();
  };
  if (toggleOnClick)
    button.addEventListener('click', e => {
      e.stopPropagation();
      show(panel.hidden);
    });
  document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !panel.contains(e.target) && !(!dismissOnTrigger && button.contains(e.target))) show(false);
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

/** Where a panel of `size` starts at `point`, measured from `bounds` and kept whole inside them. */
export function panelSpot(point, size, bounds) {
  const inside = (at, room, own) => Math.max(8, Math.min(at, room - own - 8));
  return {
    left: inside(point.x - bounds.left, bounds.width, size.width),
    top: inside(point.y - bounds.top, bounds.height, size.height),
  };
}

/** Shared keyboard navigation for ordinary and checked menu actions. */
export function menuNavigation(menu) {
  const items = () =>
    [...menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')].filter(
      item => !item.disabled && !item.hidden,
    );
  menu.addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const list = items();
    if (!list.length) return;
    const at = list.indexOf(document.activeElement);
    const index =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? list.length - 1
          : (at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    list[index]?.focus();
  });
  return items;
}

/** Wires a button to a menu; selecting an action retains the action's own handler. */
export function popup(button, menu) {
  const items = menuNavigation(menu);
  const box = dropdown(button, menu, () => items()[0]?.focus());
  menu.addEventListener('click', e => {
    if (e.target.closest('[role="menuitem"], [role="menuitemcheckbox"]')) box.close();
  });
  return box;
}
