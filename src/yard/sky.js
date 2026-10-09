// Scenery: time of day and weather each follow the clock and the sky unless the person picks one.
// Left alone, friends also remark on it, so the yard is worth leaving open.

import { language } from '../core/i18n.js';
import { pick, shuffle } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, data, game, recall, remember, views } from '../core/state.js';
import { createEasel } from './easel.js';
import {
  autoWeather,
  chatterFor,
  moonPhase,
  moonShade,
  PERIOD_MINUTES,
  PERIODS,
  periodFor,
  sceneCaption,
  seasonFor,
  seasonVars,
  southern,
  sunAt,
  WEATHERS,
} from './scene.js';
import { createScenery } from './scenery.js';
import { bubble } from './views.js';
import { delay } from './wander.js';
// The weather canvas, made by setupSky once the page is there.
export let scenery = null;
// The painted backdrop, made with it.
let easel = null;
export const scene = { period: 'day', weather: 'clear', season: 'spring' };
// South of the equator the seasons and the moon turn the other way (by the system's time zone).
const south = southern(Intl.DateTimeFormat().resolvedOptions().timeZone);
// The season's colours last set on the yard, to be taken off again when they change.
let painted = {};
// A rainbow follows rain that clears up in daylight, for a few minutes.
const RAINBOW_MS = 4 * 60 * 1000;
let rainbowTimer = null;
// What the person picked for the yard, or 'auto'.
let weatherChoice = 'auto';
let periodChoice = 'auto';
// Returns whether the weather changed.
export function paintScene() {
  const before = scene.weather,
    now = new Date(),
    yard = $('yard');
  scene.season = seasonFor(now, south);
  scene.period = periodChoice === 'auto' ? periodFor(now.getHours()) : periodChoice;
  scene.weather = weatherChoice === 'auto' ? autoWeather(now.getTime(), scene.season) : weatherChoice;
  const rainbow = yard.classList.contains('after-rain') || (before === 'rain' && scene.weather === 'clear');
  yard.className = `yard period-${scene.period} weather-${scene.weather} season-${scene.season}${aiming ? ' aiming' : ''}${game ? ' playing' : ''}`;
  paintSeason(yard);
  paintSky(yard, now);
  if (rainbow && scene.weather === 'clear' && scene.period !== 'night') showRainbow(yard);
  $('sky-dot').className = `sun-dot ${scene.period === 'night' ? 'moon' : ''}`;
  $('scene-caption').textContent = sceneCaption(scene.period, scene.weather);
  scenery.set(scene.period, scene.weather, scene.season);
  easel.set(scene);
  return before !== scene.weather;
}
// The season's colours, set on the yard as custom properties (scene.js SEASON_COLORS).
function paintSeason(yard) {
  const next = seasonVars(scene.season, scene.period, scene.weather);
  for (const name of Object.keys(painted)) if (!(name in next)) yard.style.removeProperty(name);
  for (const [name, value] of Object.entries(next)) if (painted[name] !== value) yard.style.setProperty(name, value);
  painted = next;
}
// The sun or the moon where the clock puts it (or the chosen time of day), and the moon's phase.
// Set once a minute: nothing in the sky moves in between.
function paintSky(yard, now) {
  const minutes = periodChoice === 'auto' ? now.getHours() * 60 + now.getMinutes() : PERIOD_MINUTES[scene.period];
  const { x, y } = sunAt(minutes);
  yard.style.setProperty('--orb-x', `${x.toFixed(1)}%`);
  yard.style.setProperty('--orb-y', `${y.toFixed(1)}%`);
  yard.style.setProperty('--moon-shade', String(moonShade(moonPhase(now.getTime()), south)));
}
function showRainbow(yard) {
  yard.classList.add('after-rain');
  clearTimeout(rainbowTimer);
  rainbowTimer = setTimeout(() => $('yard').classList.remove('after-rain'), RAINBOW_MS);
}
// A change in the weather is worth a remark from a friend or two.
// Its first draw is 0, which makes chatterFor talk about the weather; the rest are random.
function aboutTheWeather() {
  let first = true;
  return () => {
    if (!first) return Math.random();
    first = false;
    return 0;
  };
}
function remark() {
  if (game || scene.weather === 'clear') return;
  const speakers = shuffle([...views.values()]).slice(0, 2);
  speakers.forEach((v, i) => {
    setTimeout(
      () => {
        if (!game) bubble(v, chatterFor(scene.period, scene.weather, aboutTheWeather()), 3500);
      },
      700 + i * 900,
    );
  });
}
const CHATTER_DELAY = [40000, 110000];
let nextChatter = Infinity;
export function idleChatter(now) {
  if (now < nextChatter) return;
  nextChatter = now + delay(Math.random, CHATTER_DELAY);
  const quiet = [...views.values()].filter(
    v => v.bubble.hidden && !v.drag && (data.statuses[v.pet.id]?.state || 'idle') === 'idle',
  );
  if (quiet.length) bubble(pick(quiet), chatterFor(scene.period, scene.weather, Math.random), 3500);
}
// The clock at the top right: the time and the date in the app's language, changed on the minute.
const clockTime = new Intl.DateTimeFormat(language(), { hour: 'numeric', minute: '2-digit' }),
  clockDate = new Intl.DateTimeFormat(language(), { month: 'short', day: 'numeric', weekday: 'short' });
function tick() {
  const now = new Date();
  $('yard-clock').textContent = `${clockTime.format(now)} · ${clockDate.format(now)}`;
  setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
}
// Starts the sky: the chosen or automatic time and weather, and the minute-by-minute check. Called once, by app.js.
export function setupSky() {
  scenery = createScenery($('weather-layer'), reduced);
  easel = createEasel($('yard'), reduced);
  const saved = { weather: recall('weather'), period: recall('period') };
  if (saved.weather === 'auto' || WEATHERS[saved.weather]) weatherChoice = saved.weather;
  if (PERIODS[saved.period]) periodChoice = saved.period;
  nextChatter = performance.now() + delay(Math.random, CHATTER_DELAY);
  $('weather').value = weatherChoice;
  $('period').value = periodChoice;
  // The caption is the button for the time of day and the weather: a small menu under it.
  const menu = $('scene-menu'),
    button = $('scene-button'),
    show = open => {
      menu.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    };
  button.onclick = () => show(menu.hidden);
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) show(false);
  });
  menu.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    show(false);
    button.focus();
  });
  $('period').onchange = () => {
    periodChoice = $('period').value;
    remember('period', periodChoice);
    paintScene();
  };
  $('weather').onchange = () => {
    weatherChoice = $('weather').value;
    remember('weather', weatherChoice);
    if (paintScene()) remark();
  };
  paintScene();
  tick();
  setInterval(() => {
    if (paintScene()) remark();
  }, 60000);
}
