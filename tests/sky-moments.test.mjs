import assert from 'node:assert/strict';
import test from 'node:test';
import { createMoments, MOMENTS } from '../src/yard/sky-moments.js';

const PERIODS = ['morning', 'day', 'evening', 'night'],
  WEATHERS = ['clear', 'rain', 'snow'],
  SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const lasts = id => MOMENTS.find(m => m.id === id).lasts;

// A fake clock for the moments' timers.
function clock() {
  let now = 0;
  const timers = new Set();
  return {
    set: (fn, ms) => {
      const timer = { fn, at: now + ms };
      timers.add(timer);
      return timer;
    },
    clear: timer => timers.delete(timer),
    tick(ms) {
      now += ms;
      for (const timer of Array.from(timers))
        if (timer.at <= now) {
          timers.delete(timer);
          timer.fn();
        }
    },
  };
}
function moments() {
  const shown = new Set(),
    time = clock(),
    update = createMoments((moment, on) => (on ? shown.add(moment.id) : shown.delete(moment.id)), time.set, time.clear);
  return { shown, time, update };
}
const sky = (before, weather, period, season = 'spring', more = {}) => ({
  sky: true,
  before,
  weather,
  period,
  season,
  quiet: false,
  ...more,
});

test('every moment can be brought about with the scene choices the yard offers', () => {
  const reached = new Set();
  for (const before of WEATHERS)
    for (const weather of WEATHERS)
      for (const period of PERIODS)
        for (const season of SEASONS) {
          const { shown, update } = moments();
          update(sky(before, weather, period, season));
          for (const id of shown) reached.add(id);
        }
  assert.deepEqual([...reached].sort(), MOMENTS.map(m => m.id).sort());
});

test('no two moments ever show at once, and the next waits for the one before to end', () => {
  for (const before of WEATHERS)
    for (const weather of WEATHERS)
      for (const period of PERIODS)
        for (const season of SEASONS) {
          const { shown, time, update } = moments();
          const scene = sky(before, weather, period, season);
          for (let step = 0; step < 8; step++) {
            update(scene);
            assert.ok(shown.size <= 1, JSON.stringify({ scene, shown: [...shown] }));
            time.tick(60_000);
          }
        }
  // An autumn morning after rain: the rainbow first, then the mist as soon as it fades.
  const { shown, time, update } = moments();
  update(sky('rain', 'clear', 'morning', 'autumn'));
  assert.deepEqual([...shown], ['rainbow']);
  time.tick(lasts('rainbow'));
  assert.deepEqual([...shown], ['mist']);
});

test("a seasonal event's look on the yard keeps every moment away", () => {
  const { shown, update } = moments();
  update(sky('snow', 'clear', 'night', 'winter', { quiet: true }));
  assert.equal(shown.size, 0);
  update(sky('snow', 'clear', 'night', 'winter'));
  assert.ok(shown.has('snowlight'));
  update(sky('clear', 'clear', 'night', 'winter', { quiet: true }));
  assert.equal(shown.size, 0, 'and takes one away that had begun');
});

test('indoors no moment shows', () => {
  const { shown, update } = moments();
  update(sky('rain', 'clear', 'day', 'spring', { sky: false }));
  update(sky('clear', 'rain', 'day', 'spring', { sky: false }));
  update(sky('clear', 'clear', 'night', 'summer', { sky: false }));
  assert.equal(shown.size, 0);
});

test('the rainbow stands for four minutes after rain clears in daylight, not at night', () => {
  const { shown, time, update } = moments();
  update(sky('rain', 'clear', 'evening'));
  assert.ok(shown.has('rainbow'));
  time.tick(lasts('rainbow') - 1);
  assert.ok(shown.has('rainbow'));
  time.tick(1);
  assert.ok(!shown.has('rainbow'));
  update(sky('rain', 'clear', 'night'));
  assert.ok(!shown.has('rainbow'));
  assert.equal(lasts('rainbow'), 4 * 60 * 1000);
});

test('a sunshower is the first minute and a half of rain from a clear daylight sky', () => {
  const { shown, time, update } = moments();
  update(sky('clear', 'rain', 'day'));
  assert.ok(shown.has('sunshower'));
  time.tick(lasts('sunshower'));
  assert.ok(!shown.has('sunshower'));
  update(sky('rain', 'rain', 'day'));
  assert.ok(!shown.has('sunshower'), 'not again in the same rain');
  update(sky('rain', 'clear', 'day'));
  update(sky('clear', 'rain', 'day'));
  assert.ok(shown.has('sunshower'), 'again once the sky has cleared and clouded over');
  update(sky('rain', 'rain', 'evening'));
  assert.ok(!shown.has('sunshower'), 'evening takes the sun away');
  update(sky('clear', 'rain', 'night'));
  assert.ok(!shown.has('sunshower'));
});

test('mist lies on clear autumn mornings, once a morning, and is gone by midday', () => {
  const { shown, time, update } = moments();
  update(sky('clear', 'clear', 'morning', 'autumn'));
  assert.ok(shown.has('mist'));
  time.tick(lasts('mist'));
  update(sky('clear', 'clear', 'morning', 'autumn'));
  assert.ok(!shown.has('mist'), 'once a morning');
  update(sky('clear', 'clear', 'day', 'autumn'));
  update(sky('clear', 'clear', 'morning', 'autumn'));
  assert.ok(shown.has('mist'), 'and the next morning again');
  update(sky('clear', 'clear', 'day', 'autumn'));
  assert.ok(!shown.has('mist'));
  update(sky('clear', 'clear', 'morning', 'spring'));
  assert.ok(!shown.has('mist'));
});

test('snow that stops at night leaves the field glittering under the moon', () => {
  const { shown, time, update } = moments();
  update(sky('snow', 'clear', 'night', 'winter'));
  assert.ok(shown.has('snowlight'));
  time.tick(lasts('snowlight'));
  assert.ok(!shown.has('snowlight'));
  update(sky('snow', 'clear', 'day', 'winter'));
  assert.ok(!shown.has('snowlight'));
});

test('meteors shower all through any clear summer night', () => {
  const { shown, time, update } = moments();
  update(sky('clear', 'clear', 'night', 'summer'));
  assert.ok(shown.has('meteors'));
  time.tick(6 * 60 * 60 * 1000);
  update(sky('clear', 'clear', 'night', 'summer'));
  assert.ok(shown.has('meteors'), 'for as long as the night lasts');
  update(sky('clear', 'rain', 'night', 'summer'));
  assert.ok(!shown.has('meteors'));
  for (const off of [{ season: 'autumn' }, { weather: 'rain' }, { period: 'evening' }]) {
    const other = moments();
    other.update({ ...sky('clear', 'clear', 'night', 'summer'), ...off });
    assert.ok(!other.shown.has('meteors'), JSON.stringify(off));
  }
});

test('a sunshower is dressed as a clear day, so the sun shines through the rain; no other moment changes the weather shown', () => {
  assert.deepEqual(
    MOMENTS.filter(m => m.looks).map(m => [m.id, m.looks]),
    [['sunshower', 'clear']],
  );
});

test('a moment that ends on its own timer may repaint the yard as it goes, and the next moment still comes and goes', () => {
  // sky.js repaints when a moment's dress comes off, and the repaint updates the moments again;
  // by then the weather may have turned.
  const shown = new Set(),
    time = clock();
  let scene = sky('clear', 'rain', 'day'),
    painting = false,
    update = null;
  const paint = () => {
    painting = true;
    update(scene);
    painting = false;
  };
  update = createMoments(
    (moment, on) => {
      assert.ok(moment, 'a moment is named every time');
      if (on) shown.add(moment.id);
      else {
        shown.delete(moment.id);
        if (!painting) paint();
      }
    },
    time.set,
    time.clear,
  );
  update(scene);
  assert.deepEqual([...shown], ['sunshower']);
  scene = sky('rain', 'clear', 'day');
  time.tick(lasts('sunshower'));
  assert.deepEqual([...shown], ['rainbow'], 'the rain cleared while the sunshower ended');
  time.tick(lasts('rainbow'));
  assert.deepEqual([...shown], [], 'and the rainbow fades in its time');
});
