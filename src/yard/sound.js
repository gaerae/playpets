// When the yard's sounds play, and the controls for them. The sounds themselves are soundscape.js;
// what each scene sounds like is soundmix.js. They play while the sound is on (the backend keeps
// the setting: Settings, the chip by the clock, the View menu) and the yard can be seen. Otherwise
// the audio rests: its context is suspended and costs nothing. A webview lets audio start only
// after the person has touched the page, so the first click or key starts it.
// Design: docs/design/2026-10-10-yard-sounds.md.

import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { onShortcut } from '../core/keys.js';
import { between } from '../core/math.js';
import { $, call, data, guard } from '../core/state.js';
import { mixFor } from './soundmix.js';
import { createSoundscape } from './soundscape.js';

let ctx = null,
  scape = null,
  awake = false,
  seen = true,
  touched = false,
  mix = mixFor({ period: 'day', weather: 'clear', season: 'spring' });
const timers = new Set();
const on = () => data.sound?.on !== false;
const volume = () => data.sound?.volume ?? 40;

// A timer that ends when the sound rests.
function later(ms, fn) {
  const id = setTimeout(() => {
    timers.delete(id);
    if (awake) fn();
  }, ms);
  timers.add(id);
}
const now = () => ctx.currentTime + 0.05;

// What happens by itself while the sound plays: gusts, waves, birds, crickets, raindrops. Each
// schedules its next time, and looks at the scene's mix when it comes.
function gusts() {
  if (mix.leaves > 0) scape.gust(now());
  later(between(Math.random, [6000, 18000]), gusts);
}
function waves() {
  scape.lap(now());
  later(between(Math.random, [1800, 3800]), waves);
}
function birds() {
  if (mix.birds > 0) {
    const kinds = mix.birds >= 8 ? ['tit', 'trill', 'warble', 'dove'] : ['tit', 'trill', 'warble'];
    scape.bird(
      kinds[Math.floor(Math.random() * kinds.length)],
      now(),
      between(Math.random, [-0.8, 0.8]),
      Math.random(),
    );
  }
  // A call every so often by the mix's rate, never two on top of each other.
  const every = mix.birds > 0 ? 60000 / mix.birds : 20000;
  later(Math.max(1800, -Math.log(1 - Math.random()) * every), birds);
}
// Two crickets, each with its own pitch, rhythm and place, laid out a couple of seconds ahead.
const crickets = [
  { hz: 4300, every: 0.72, pan: -0.5, next: 0 },
  { hz: 4750, every: 0.86, pan: 0.55, next: 0 },
];
function cricketsTick() {
  if (mix.crickets > 0) {
    const until = ctx.currentTime + 2.2;
    for (const c of crickets) {
      if (c.next < ctx.currentTime) c.next = now() + Math.random() * c.every;
      for (; c.next < until; c.next += c.every * between(Math.random, [0.95, 1.05]))
        scape.chirp(c.next, c.hz, c.pan, 0.022 * mix.crickets);
    }
  }
  later(2000, cricketsTick);
}
function drops() {
  if (mix.rain > 0) scape.drop(now(), between(Math.random, [0.02, 0.06]));
  later(mix.rain > 0 ? between(Math.random, [120, 380]) : 4000, drops);
}

function wake() {
  if (!ctx) {
    ctx = new AudioContext();
    scape = createSoundscape(ctx, ctx.destination);
  }
  if (awake) return;
  awake = true;
  // Refused until the page is touched; the first touch tries again.
  ctx.resume().catch(() => {});
  scape.setMix(mix);
  scape.setVolume(volume(), ctx.currentTime, 1.2);
  for (const c of crickets) c.next = 0;
  for (const run of [gusts, waves, birds, cricketsTick, drops]) later(between(Math.random, [300, 2500]), run);
}
function rest() {
  if (!awake) return;
  awake = false;
  for (const id of timers) clearTimeout(id);
  timers.clear();
  scape.setVolume(0, ctx.currentTime, 0.12);
  setTimeout(() => awake || ctx.suspend().catch(() => {}), 700);
}
// Plays or rests as the setting, the window and the first touch allow.
function update() {
  if (on() && seen && touched) wake();
  else rest();
}

/** The scene changed (sky.js): the beds glide to its mix. */
export function soundScene(scene) {
  mix = mixFor(scene);
  if (awake) scape.setMix(mix);
}
/** The yard was hidden or shown again (app.js passes on the window's signal). */
export function soundSeen(visible) {
  seen = visible;
  update();
}
/** A tone for something a friend did (soundmix.js CUES), or a sound of the lake (plip, splash). */
export function cue(name) {
  if (!awake) return;
  if (name === 'plip' || name === 'splash') scape[name]();
  else scape.cue(name);
}

/** The chip by the clock and the Settings controls, as the setting is now. */
export function renderSound() {
  const button = $('sound-button'),
    playing = on();
  button.setAttribute('aria-pressed', String(playing));
  button.title = t(playing ? 'sound.turn_off' : 'sound.turn_on');
  const icon = button.querySelector('[data-icon]'),
    name = playing ? 'sound' : 'sound-off';
  if (icon.dataset.icon !== name) {
    icon.dataset.icon = name;
    icons(button);
  }
  $('sound-on').checked = playing;
  if (document.activeElement !== $('sound-volume')) $('sound-volume').value = String(volume());
  $('sound-volume').disabled = !playing;
  update();
  if (awake) scape.setVolume(volume());
}
/** Wires the controls and the first touch. Called once, by app.js. */
export function setupSound() {
  const set = guard((onOff, level) => call('setSound', onOff, level));
  const toggle = () => {
    touched = true;
    set(!on(), null);
  };
  $('sound-button').addEventListener('click', toggle);
  $('sound-on').addEventListener('change', e => {
    touched = true;
    set(e.target.checked, null);
  });
  // The volume follows the slider at once, and is saved when it is let go.
  $('sound-volume').addEventListener('input', e => {
    if (awake) scape.setVolume(Number(e.target.value), ctx.currentTime, 0.08);
  });
  $('sound-volume').addEventListener('change', e => set(null, Number(e.target.value)));
  // The macOS View menu has the key; elsewhere the page answers it (core/keys.js).
  onShortcut('sound', toggle);
  const first = () => {
    touched = true;
    update();
  };
  document.addEventListener('pointerdown', first, { once: true, capture: true });
  document.addEventListener('keydown', first, { once: true, capture: true });
  seen = !document.hidden;
  document.addEventListener('visibilitychange', () => soundSeen(!document.hidden));
}
