// Scenery: time of day and weather each follow the clock and the sky unless the person picks one.
// A change of weather is remarked on by a friend or two (remarks.js).

import { language, t } from '../core/i18n.js';
import { dropdown } from '../core/menu.js';
import { reduced } from '../core/sprites.js';
import { $, recall, remember, views } from '../core/state.js';
import { everyMinute } from '../core/ticker.js';
import { endFishing } from './catch.js';
import { renderDecor } from './decor.js';
import { createEasel } from './easel.js';
import { sceneEvent } from './events.js';
import { eventChanged } from './festival.js';
import { renderGarden } from './garden.js';
import { hint } from './hint.js';
import { endGame } from './play.js';
import { cancelRemarks, remark } from './remarks.js';
import {
  autoWeather,
  moonPhase,
  moonShade,
  PERIOD_MINUTES,
  PERIODS,
  periodFor,
  sceneCaption,
  seasonVars,
  selectedSeason,
  southern,
  sunAt,
  WEATHERS,
} from './scene.js';
import { createScenery } from './scenery.js';
import { soundScene } from './sound.js';
import { release } from './trips.js';
import { syncViews } from './views.js';
import { scene, scenery, setScenery } from './world.js';
import { worldAllows, worldFor, worlds } from './worlds.js';

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
let seasonChoice = 'auto';
let seasonChanged = () => {};
/** Indoor weather stays outside the windows, so its caption continues to name the room. */
export function worldCaption(world, period, weather) {
  return worldAllows(world, 'sky')
    ? sceneCaption(period, weather)
    : `${t(worldFor(world).label)} · ${t(`period.${period}`)}${worldAllows(world, 'weather') ? ` · ${t(`weather.${weather}`)}` : ''}`;
}
// Returns whether the weather changed.
export function paintScene() {
  const before = scene.weather,
    was = scene.event,
    now = new Date(),
    yard = $('yard');
  scene.season = selectedSeason(now, south, seasonChoice);
  scene.period = periodChoice === 'auto' ? periodFor(now.getHours()) : periodChoice;
  scene.weather = worldAllows(scene.world, 'weather')
    ? weatherChoice === 'auto'
      ? autoWeather(now.getTime(), scene.season)
      : weatherChoice
    : 'clear';
  // A seasonal event (events.js): a class on the yard, and one for each way it looks (scenery.css).
  const event = worldAllows(scene.world, 'seasonalEffects') ? sceneEvent(now, south, scene.season) : null;
  scene.event = event?.id ?? null;
  // The scene's own classes on the yard (scenery.css): only these are changed here; the others
  // belong to whoever sets them (aiming, playing, the catch hand, the rainbow).
  setMarks(yard, [
    `world-${scene.world}`,
    `period-${scene.period}`,
    `weather-${scene.weather}`,
    `season-${scene.season}`,
    ...(event ? [`event-${event.id}`, ...(event.looks || []).map(look => `look-${look}`)] : []),
  ]);
  paintSeason(yard);
  paintSky(yard, now);
  // Rain clearing in daylight starts the rainbow's few minutes; night or new weather takes it away.
  if (worldAllows(scene.world, 'sky') && before === 'rain' && scene.weather === 'clear' && scene.period !== 'night')
    showRainbow(yard);
  else if (!worldAllows(scene.world, 'sky') || scene.weather !== 'clear' || scene.period === 'night')
    yard.classList.remove('after-rain');
  $('sky-dot').className = `sun-dot ${scene.period === 'night' ? 'moon' : ''}`;
  $('scene-caption').textContent = worldCaption(scene.world, scene.period, scene.weather);
  $('weather').disabled = !worldAllows(scene.world, 'weather');
  $('weather').value = worldAllows(scene.world, 'weather') ? weatherChoice : 'clear';
  const note = worldFor(scene.world).about;
  $('world-note').textContent = note ? t(note) : '';
  $('world-note').hidden = !note;
  scenery.set(scene.period, scene.weather, scene.season, scene.event, scene.world);
  easel.set(scene);
  soundScene(scene);
  if (was !== scene.event) eventChanged(event);
  seasonChanged(scene.season);
  return before !== scene.weather;
}
// The classes the scene last set on the yard, to be taken off again when they change.
let marked = [];
function setMarks(yard, marks) {
  yard.classList.remove(...marked.filter(m => !marks.includes(m)));
  yard.classList.add(...marks);
  marked = marks;
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
// (a narrow yard shows the time alone, caption.css).
const clockTime = new Intl.DateTimeFormat(language(), { hour: 'numeric', minute: '2-digit' }),
  clockDate = new Intl.DateTimeFormat(language(), { month: 'short', day: 'numeric', weekday: 'short' });
function showTime(now) {
  $('clock-time').textContent = clockTime.format(now);
  $('clock-date').textContent = ` · ${clockDate.format(now)}`;
}
// Starts the sky: the chosen or automatic time and weather, and the minute-by-minute check. Called once, by app.js.
export function setupSky(options = {}) {
  seasonChanged = options.seasonChanged || (() => {});
  setScenery(createScenery($('weather-layer'), reduced));
  easel = createEasel($('yard'), reduced, endFishing);
  const saved = {
    world: recall('world'),
    weather: recall('weather'),
    period: recall('period'),
    season: recall('season'),
  };
  seasonChoice = ['spring', 'summer', 'autumn', 'winter'].includes(saved.season) ? saved.season : 'auto';
  $('season').value = seasonChoice;
  $('season').onchange = () => {
    const choice = $('season').value;
    seasonChoice = ['spring', 'summer', 'autumn', 'winter'].includes(choice) ? choice : 'auto';
    remember('season', seasonChoice);
    cancelRemarks();
    endFishing();
    paintScene();
  };
  scene.world = worldFor(saved.world).id;
  $('world').replaceChildren(
    ...worlds.map(world => {
      const option = document.createElement('option');
      option.value = world.id;
      option.textContent = t(world.label);
      return option;
    }),
  );
  $('world').value = scene.world;
  $('world').onchange = () => {
    cancelRemarks();
    endGame();
    endFishing();
    for (const v of views.values()) {
      release(v);
      v.away = false;
    }
    scene.world = worldFor($('world').value).id;
    remember('world', scene.world);
    paintScene();
    syncViews();
    renderGarden();
    renderDecor();
    hint();
  };
  if (saved.weather === 'auto' || WEATHERS[saved.weather]) weatherChoice = saved.weather;
  if (PERIODS[saved.period]) periodChoice = saved.period;
  $('weather').value = weatherChoice;
  $('period').value = periodChoice;
  // The caption is the button for the time of day and the weather: a small panel under it.
  dropdown($('scene-button'), $('scene-menu'), () => $('world').focus());
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
  showTime(new Date());
  everyMinute(now => {
    showTime(now);
    if (paintScene()) remark();
  });
}
