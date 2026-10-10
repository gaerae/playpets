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

// What changes by the clock (the clock itself, the scene, a plant's stage, a finished agent's state
// fading) looks once a minute, on one timer that wakes just after each minute turns.
const onTheMinute = [];
/** Calls `fn(new Date())` just after each minute turns, from the first call on. One that throws
 * does not stop the others. */
export function everyMinute(fn) {
  onTheMinute.push(fn);
  if (onTheMinute.length > 1) return;
  const wake = () => {
    const now = new Date();
    for (const f of onTheMinute)
      try {
        f(now);
      } catch (e) {
        console.error(e);
      }
    setTimeout(wake, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  };
  setTimeout(wake, 60_000 - (new Date().getSeconds() * 1000 + new Date().getMilliseconds()) + 50);
}
