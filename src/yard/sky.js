// Scenery: time of day and weather each follow the clock and the sky unless the person picks one.
// A change of weather is remarked on by a friend or two (remarks.js).

import { language } from '../core/i18n.js';
import { dropdown } from '../core/menu.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, game, recall, remember } from '../core/state.js';
import { createEasel } from './easel.js';
import { eventOn } from './events.js';
import { eventChanged } from './festival.js';
import { remark } from './remarks.js';
import {
  autoWeather,
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
import { soundScene } from './sound.js';
import { scene, scenery, setScenery } from './world.js';

// The painted backdrop, made with the weather canvas.
let easel = null;
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
    was = scene.event,
    now = new Date(),
    yard = $('yard');
  scene.season = seasonFor(now, south);
  scene.period = periodChoice === 'auto' ? periodFor(now.getHours()) : periodChoice;
  scene.weather = weatherChoice === 'auto' ? autoWeather(now.getTime(), scene.season) : weatherChoice;
  // A seasonal event (events.js): a class on the yard, and one for each way it looks (scenery.css).
  const event = eventOn(now, south);
  scene.event = event?.id ?? null;
  const marks = event ? [` event-${event.id}`, ...(event.looks || []).map(look => ` look-${look}`)].join('') : '';
  // Classes the scene does not set are kept through a repaint: the rainbow while its time runs,
  // and the hand over something to catch while catching is possible (catch.js).
  const kept = ['after-rain', ...(aiming || game ? [] : ['can-catch'])]
    .filter(c => yard.classList.contains(c))
    .map(c => ` ${c}`)
    .join('');
  yard.className = `yard period-${scene.period} weather-${scene.weather} season-${scene.season}${marks}${aiming ? ' aiming' : ''}${game ? ' playing' : ''}${kept}`;
  paintSeason(yard);
  paintSky(yard, now);
  // Rain clearing in daylight starts the rainbow's few minutes; night or new weather takes it away.
  if (before === 'rain' && scene.weather === 'clear' && scene.period !== 'night') showRainbow(yard);
  else if (scene.weather !== 'clear' || scene.period === 'night') yard.classList.remove('after-rain');
  $('sky-dot').className = `sun-dot ${scene.period === 'night' ? 'moon' : ''}`;
  $('scene-caption').textContent = sceneCaption(scene.period, scene.weather);
  scenery.set(scene.period, scene.weather, scene.season, scene.event);
  easel.set(scene);
  soundScene(scene);
  if (was !== scene.event) eventChanged(event);
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
  // The harvest moon is full whatever the calendar says (an event's "fullmoon" look).
  const full = yard.classList.contains('look-fullmoon');
  yard.style.setProperty('--moon-shade', String(full ? 100 : moonShade(moonPhase(now.getTime()), south)));
}
function showRainbow(yard) {
  yard.classList.add('after-rain');
  clearTimeout(rainbowTimer);
  rainbowTimer = setTimeout(() => $('yard').classList.remove('after-rain'), RAINBOW_MS);
}
// The clock at the top right: the time and the date in the app's language, changed on the minute
// (a narrow yard shows the time alone, yard.css).
const clockTime = new Intl.DateTimeFormat(language(), { hour: 'numeric', minute: '2-digit' }),
  clockDate = new Intl.DateTimeFormat(language(), { month: 'short', day: 'numeric', weekday: 'short' });
function tick() {
  const now = new Date();
  $('clock-time').textContent = clockTime.format(now);
  $('clock-date').textContent = ` · ${clockDate.format(now)}`;
  setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
}
// Starts the sky: the chosen or automatic time and weather, and the minute-by-minute check. Called once, by app.js.
export function setupSky() {
  setScenery(createScenery($('weather-layer'), reduced));
  easel = createEasel($('yard'), reduced);
  const saved = { weather: recall('weather'), period: recall('period') };
  if (saved.weather === 'auto' || WEATHERS[saved.weather]) weatherChoice = saved.weather;
  if (PERIODS[saved.period]) periodChoice = saved.period;
  $('weather').value = weatherChoice;
  $('period').value = periodChoice;
  // The caption is the button for the time of day and the weather: a small panel under it.
  dropdown($('scene-button'), $('scene-menu'), () => $('period').focus());
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
