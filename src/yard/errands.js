// A friend sent to a prop the person pressed: a spring shoot to dig up (shoots.js), fallen fruit to
// pick up (fallen-fruit.js). Each keeps its errands here, by the prop's id, as { v, end }: the
// prop's button is marked while a friend is on it, and calling them off lets the friends go.
import { t } from '../core/i18n.js';
import { selected, toast, views } from '../core/state.js';
import { forPerson, ownedBy, release } from './trips.js';

/** Ends an errand: the friend is let go while the errand is still what it is doing, else (something
 * else took it over) only the errand ends. */
export function letGo({ v, end }) {
  if (ownedBy(v, end)) release(v);
  else end();
}

/** The errands on the props drawn in `shown` (id → { button }). */
export function errands(shown) {
  const on = new Map();
  const mark = (id, flag) => shown.get(id)?.button.classList.toggle('picking', flag);
  return {
    has: id => on.has(id),
    get: id => on.get(id),
    busy: () => on.size > 0,
    start(id, task) {
      on.set(id, task);
      mark(id, true);
    },
    /** Clears `id` if `task` is still its errand: a late end leaves a newer one alone. */
    finish(id, task) {
      if (on.get(id) !== task) return;
      on.delete(id);
      mark(id, false);
    },
    /** Calls off the errands to the props `gone` says are gone, every one when it is left out (a new
     * window size or land): the friends go, the props stay. */
    cancelAll(gone = () => true) {
      // A Map goes on past entries deleted on the way, as each errand's end deletes its own.
      for (const [id, task] of on) if (gone(id)) letGo(task);
    },
  };
}

/** The friend to send to a prop at `spot` (yard pixels): the selected one when it is free, else whoever
 * forPerson picks. With none, a toast says why: `none` when the yard has no friend at all. */
export function friendFor(spot, none) {
  if (!views.size) {
    toast(t(none));
    return null;
  }
  const v = forPerson(spot.x, spot.y, views.get(selected));
  if (!v) toast(t('catch.busy'));
  return v;
}
