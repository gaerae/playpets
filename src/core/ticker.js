// The pages' frame loops. A timer, not requestAnimationFrame: the yard draws 20 or 10 times a
// second and the desktop 10, while an animation-frame loop wakes the display link, and WebKit with it,
// on every screen refresh (60-120 a second) only to skip most of them.

// Between two frames of a loop a moving friend would stand still, then jump. While it moves, each
// new place is reached by a short linear animation on the compositor, a little longer than a frame,
// from where the friend shows at that moment: it moves on every screen refresh without waking the
// loop. The animation starts at the timeline's time, not when the compositor takes it up: a CSS
// transition replaced every frame stops for a screen refresh each time in WebKit.
const glides = new WeakMap();
const FORMATS = {
  translate: ([x, y]) => `${x}px ${y}px`,
  transform: ([x, y]) => `translate(${x}px,${y}px)`,
};
/** Puts `node` at `to` ([x, y] px) by `property` (translate, or transform holding a translation
 * only): with `ms`, linearly over that long from where it shows now; at once without, and on its
 * first placing, so nothing slides in from the corner. */
export function moveTo(node, property, to, ms = 0) {
  const was = glides.get(node),
    value = FORMATS[property](to);
  if (was?.value === value) return;
  node.style[property] = value;
  const now = globalThis.document?.timeline?.currentTime;
  if (!ms || !was || !node.animate || now == null) {
    was?.animation?.cancel();
    glides.set(node, { to, value });
    return;
  }
  let from = was.to;
  if (was.animation) {
    const k = Math.min(1, Math.max(0, (now - was.start) / was.ms));
    from = was.from.map((f, i) => f + (was.to[i] - f) * k);
    was.animation.cancel();
  }
  const animation = node.animate([{ [property]: FORMATS[property](from) }, { [property]: value }], {
    duration: ms,
    easing: 'linear',
  });
  animation.startTime = now;
  glides.set(node, { to, value, from, start: now, ms, animation });
}
/** Ends a glide at once where it was going: a drag takes the friend on from there. */
export function halt(node) {
  const was = glides.get(node);
  if (!was?.animation) return;
  was.animation.cancel();
  glides.set(node, { to: was.to, value: was.value });
}

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
// the next one instead (a busier scene asks sooner), or Infinity to rest until the returned `wake()`
// is called, which runs the next frame at once. One that throws does not stop the loop.
export function every(ms, frame) {
  let timer = null,
    // A wake from inside a frame cannot set a timer of its own: the frame's end sets one too, and
    // the loop would run twice over. It asks the frame's end for the next frame at once instead.
    running = false,
    woken = false;
  const run = () => {
    timer = null;
    running = true;
    woken = false;
    let next = ms;
    try {
      next = frame(performance.now()) || ms;
    } finally {
      running = false;
      if (woken) next = 0;
      if (next !== Infinity) timer = setTimeout(run, next);
    }
  };
  timer = setTimeout(run, ms);
  return () => {
    if (running) {
      woken = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(run, 0);
  };
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
