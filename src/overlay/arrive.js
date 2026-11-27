// A thing that comes out on the desktop while the app runs arrives (overlay.rs marks it `arriving`
// for a few seconds): a friend drops in from above, lands in a puff of dust and waves; a gift, a
// flower or a tree pops up from its foot. Each is one CSS animation (overlay.css) that ends by
// itself, once per coming out; with reduced motion it is just there.

/** How a layout entry `position` arrives: 'drop' for a friend, 'pop' for a thing, or null when it is
 * not arriving or already did. `seen` holds the ids that arrived; an entry no longer arriving leaves
 * it, so the next time it comes out it arrives again. */
export function arrivalOf(position, seen) {
  if (!position.arriving) {
    seen.delete(position.id);
    return null;
  }
  if (seen.has(position.id)) return null;
  seen.add(position.id);
  return position.decor ? 'pop' : 'drop';
}

// Runs `then` once `button`'s own animation ends (not one inside it, as a bubble's).
function afterOwn(button, then) {
  button.addEventListener('animationend', function ended(event) {
    if (event.target !== button) return;
    button.removeEventListener('animationend', ended);
    then();
  });
}

/** Drops a friend's `button` in from `fall` pixels above where it stands, then `land`s it. */
export function dropIn(button, fall, { reduced, land }) {
  if (reduced) return land();
  button.style.setProperty('--fall', `${Math.round(fall)}px`);
  button.classList.add('arrive-drop');
  afterOwn(button, () => {
    button.classList.remove('arrive-drop');
    land();
  });
}

/** A puff of dust where a friend landed, in its `wrap`, gone once it has spread. */
export function dust(wrap) {
  const puff = document.createElement('span');
  puff.className = 'arrive-dust';
  puff.setAttribute('aria-hidden', 'true');
  wrap.append(puff);
  setTimeout(() => puff.remove(), 900);
}

/** Pops a gift's, a flower's or a tree's `button` up from its foot. */
export function popUp(button, { reduced }) {
  if (reduced) return;
  button.classList.add('arrive-pop');
  afterOwn(button, () => button.classList.remove('arrive-pop'));
}
