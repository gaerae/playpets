// When the yard's sounds play, and the controls for them. The sounds themselves are soundscape.js;
// what each scene sounds like is soundmix.js. They play while the sound is on (the backend keeps
// the setting: Atmosphere and the View menu) and the yard can be seen. A call comes now and then,
// with silence between: the audio runs for a call or a cue and a moment after it, and otherwise
// its context is suspended and costs nothing. A webview lets audio start only after the person has
// touched the page, so the first click or key starts it.
// Design: docs/design/2026-10-10-yard-sounds.md.

import { put, putAttribute } from '../core/dom.js';
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
  mix = mixFor({ period: 'day', weather: 'clear', season: 'spring' }),
  quiet = 0,
  until = 0;
const timers = new Set();
const on = () => data.sound?.on !== false;
const volume = () => data.sound?.volume ?? 40;
// How long the audio stays up after the last thing it played, so a room's ring dies away in it.
const TAIL_MS = 1500;
// Calls are placed this far ahead, so the audio has time to wake up before they sound.
const LEAD = 0.1;

// A timer that ends when the sound rests.
function later(ms, fn) {
  const id = setTimeout(() => {
    timers.delete(id);
    if (awake) fn();
  }, ms);
  timers.add(id);
}
const now = () => ctx.currentTime + LEAD;

// The audio runs for `seconds` of sound and the tail after it, then rests until the next.
function hear(seconds) {
  if (!awake) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  until = Math.max(until, Date.now() + (seconds + LEAD) * 1000 + TAIL_MS);
  clearTimeout(quiet);
  quiet = setTimeout(() => awake && ctx.suspend().catch(() => {}), until - Date.now());
}

// What happens by itself while the sound plays: each kind of call, a time or so a minute by the
// scene's mix. Each says how long it lasts.
const side = () => between(Math.random, [-0.8, 0.8]);
const CALLS = {
  birds() {
    const kinds = mix.birds >= 8 ? ['tit', 'trill', 'warble', 'dove'] : ['tit', 'trill', 'warble'];
    return scape.bird(kinds[Math.floor(Math.random() * kinds.length)], now(), side(), Math.random());
  },
  cicadas: () => scape.cicada(now(), side()),
  geese: () => scape.geese(now()),
  frogs: () => scape.frog(now(), side()),
  crickets: () => scape.crickets(now(), side()),
  drops: () => scape.drop(now(), between(Math.random, [0.08, 0.16])),
};
// One kind's calls: the next comes at random by the mix's rate, never on top of the last. A kind
// the scene has none of looks again later, in case the scene has changed.
function calls(name) {
  const rate = mix[name];
  if (!(rate > 0)) return later(20000, () => calls(name));
  const seconds = CALLS[name]();
  hear(seconds);
  later(seconds * 1000 + Math.max(1800, -Math.log(1 - Math.random()) * (60000 / rate)), () => calls(name));
}

function wake() {
  if (!ctx) {
    ctx = new AudioContext();
    scape = createSoundscape(ctx, ctx.destination);
  }
  if (awake) return;
  awake = true;
  scape.setMix(mix);
  scape.setVolume(volume(), ctx.currentTime, 0.05);
  // Started once while the touch allows it (refused before the page is touched; the first touch
  // tries again), it can then rest and wake by itself.
  hear(0);
  for (const name of Object.keys(CALLS)) later(between(Math.random, [300, 2500]), () => calls(name));
}
function rest() {
  if (!awake) return;
  awake = false;
  for (const id of timers) clearTimeout(id);
  timers.clear();
  clearTimeout(quiet);
  until = 0;
  scape.setVolume(0, ctx.currentTime, 0.12);
  setTimeout(() => awake || ctx.suspend().catch(() => {}), 700);
}
// Plays or rests as the setting, the window and the first touch allow.
function update() {
  if (on() && seen && touched) wake();
  else rest();
}

/** The scene changed (sky.js): its calls come from now on. */
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
  hear(name === 'plip' || name === 'splash' ? scape[name](now()) : scape.cue(name, now()));
}

/** A firework bursting `delay` ms from now, `pan` from -1 (left) to 1, `size` 1 for a full shell. */
export function boom(delay, pan, size) {
  if (!awake) return;
  hear(delay / 1000 + scape.boom(now() + delay / 1000, pan, size));
}

/** Atmosphere's sound toggle and volume, as the setting is now. */
export function renderSound() {
  const button = $('sound-button'),
    playing = on();
  putAttribute(button, 'aria-pressed', String(playing));
  put(button, 'title', t(playing ? 'sound.turn_off' : 'sound.turn_on'));
  const icon = button.querySelector('[data-icon]'),
    name = playing ? 'sound' : 'sound-off';
  if (icon.dataset.icon !== name) {
    icon.dataset.icon = name;
    icons(button);
  }
  if (document.activeElement !== $('sound-volume')) $('sound-volume').value = String(volume());
  put($('sound-volume'), 'disabled', !playing);
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
