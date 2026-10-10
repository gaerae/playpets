// The pages' frame loops. A timer, not requestAnimationFrame: the yard draws 20 or 10 times a
// second and the desktop 10, while an animation-frame loop wakes the display link, and WebKit with it,
// on every screen refresh (60-120 a second) only to skip most of them.

/** Something that comes now and then in the frame loop: `due(now)` is true once each time the wait
 * `wait()` gives has passed (counted from the first look), and `after(now, ms)` sets the next time. */
export function cadence(wait) {
  let next = 0;
  return {
    due(now) {
      if (!next) next = now + wait();
      if (now < next) return false;
      next = now + wait();
      return true;
    },
    after(now, ms) {
      next = now + ms;
    },
  };
}
// Calls `frame(now)` about every `ms` milliseconds. A frame may return how long to wait before
// the next one instead (a busier scene asks sooner). One that throws does not stop the loop.
export function every(ms, frame) {
  const run = () => {
    let next = ms;
    try {
      next = frame(performance.now()) || ms;
    } finally {
      setTimeout(run, next);
    }
  };
  setTimeout(run, ms);
}
