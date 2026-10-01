// Scenery: time of day and weather each follow the clock and the sky unless the person picks one.
// Left alone, friends also remark on it, so the yard is worth leaving open.

import { shuffle } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, data, game, recall, remember, views } from '../core/state.js';
import { autoWeather, chatterFor, PERIODS, periodFor, sceneCaption, WEATHERS } from './scene.js';
import { createScenery } from './scenery.js';
import { bubble } from './views.js';
import { delay } from './wander.js';
// The weather canvas, made by setupSky once the page is there.
export let scenery = null;
export const scene = { period: 'day', weather: 'clear' };
// What the person picked for the yard, or 'auto'.
let weatherChoice = 'auto';
let periodChoice = 'auto';
// Returns whether the weather changed.
export function paintScene() {
  const before = scene.weather;
  scene.period = periodChoice === 'auto' ? periodFor(new Date().getHours()) : periodChoice;
  scene.weather = weatherChoice === 'auto' ? autoWeather(Date.now()) : weatherChoice;
  $('yard').className =
    `yard period-${scene.period} weather-${scene.weather}${aiming ? ' aiming' : ''}${game ? ' playing' : ''}`;
  $('sky-dot').className = `sun-dot ${scene.period === 'night' ? 'moon' : ''}`;
  $('scene-caption').textContent = sceneCaption(scene.period, scene.weather);
  scenery.set(scene.period, scene.weather);
  return before !== scene.weather;
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
  if (quiet.length)
    bubble(quiet[Math.floor(Math.random() * quiet.length)], chatterFor(scene.period, scene.weather, Math.random), 3500);
}
// Starts the sky: the chosen or automatic time and weather, and the minute-by-minute check. Called once, by app.js.
export function setupSky() {
  scenery = createScenery($('weather-layer'), reduced);
  const saved = { weather: recall('weather'), period: recall('period') };
  if (saved.weather === 'auto' || WEATHERS[saved.weather]) weatherChoice = saved.weather;
  if (PERIODS[saved.period]) periodChoice = saved.period;
  nextChatter = performance.now() + delay(Math.random, CHATTER_DELAY);
  $('weather').value = weatherChoice;
  $('period').value = periodChoice;
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
  setInterval(() => {
    if (paintScene()) remark();
  }, 60000);
}
