// What the sky does as the weather turns, one moment at a time (sky.js shows them). Each row says
// the scene it belongs to and, with `before`, the weather it has to come from; the first row that
// can show does, and the next waits until it is over. A moment shows once and comes back only after
// the scene has left it. A seasonal event's look on the yard keeps them all away (`quiet`), so the
// two never pile up on one sky. How a moment looks is a `moment-<id>` class on the yard (scenery.css).

/** The moments, in the order they go first; `lasts` (ms) is null for one that lasts its scene, and
 * `looks` is the weather the yard is dressed in while one shows, where it is not the weather's own. */
export const MOMENTS = [
  // the rainbow after rain clears in daylight, its end glimmering on the ground (rainbow-end.js)
  { id: 'rainbow', before: 'rain', weather: 'clear', periods: ['morning', 'day', 'evening'], lasts: 240_000 },
  // rain from a clear sky while the sun is still out: the yard keeps its clear day (`looks`)
  { id: 'sunshower', before: 'clear', weather: 'rain', periods: ['morning', 'day'], looks: 'clear', lasts: 90_000 },
  // mist on the field on a clear autumn morning
  { id: 'mist', weather: 'clear', periods: ['morning'], seasons: ['autumn'], lasts: 180_000 },
  // snow stopping at night leaves the field glittering
  { id: 'snowlight', before: 'snow', weather: 'clear', periods: ['night'], lasts: 240_000 },
  // shooting stars often all through a clear summer night
  { id: 'meteors', weather: 'clear', periods: ['night'], seasons: ['summer'], lasts: null },
];

const fits = (m, s) =>
  s.sky &&
  !s.quiet &&
  s.weather === m.weather &&
  m.periods.includes(s.period) &&
  (!m.seasons || m.seasons.includes(s.season));

/** Returns `update(scene)` for every repaint, where `scene` is `{sky, before, weather, period, season,
 * quiet}`: whether the place has a sky, the weather before this repaint, the scene and whether an
 * event's look is on. It calls `show(moment, on)` with the
 * moment's row as it comes and goes. `set` and `clear` are the timers, for tests. */
export function createMoments(show, set = (run, ms) => setTimeout(run, ms), clear = timer => clearTimeout(timer)) {
  const spent = new Set();
  let shown = null,
    timer = null,
    last = null;
  // `show` may update the moments again before it returns (sky.js repaints the yard), so each
  // moment is put away or taken out first, its timer with it.
  const end = () => {
    const ending = shown;
    clear(timer);
    timer = null;
    shown = null;
    show(ending, false);
  };
  function update(scene) {
    last = scene;
    for (const m of MOMENTS)
      if (!fits(m, scene)) {
        spent.delete(m.id);
        if (shown === m) end();
      }
    if (shown) return;
    const next = MOMENTS.find(m => fits(m, scene) && !spent.has(m.id) && (!m.before || scene.before === m.before));
    if (!next) return;
    spent.add(next.id);
    shown = next;
    if (next.lasts)
      timer = set(() => {
        end();
        update(last);
      }, next.lasts);
    show(next, true);
  }
  return update;
}
