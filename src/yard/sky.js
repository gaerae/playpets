// Start with a sunny spring day; Auto follows the clock and the sky when selected.
// A change of weather is remarked on by a friend or two (remarks.js).

import { onDensityChange } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { dropdown } from '../core/menu.js';
import { isSeason, selectedSeason, systemSouth } from '../core/season.js';
import { reduced } from '../core/sprites.js';
import { $, call, data, forget, ownsWebview, recall, remember, sceneValue } from '../core/state.js';
import { everyMinute } from '../core/ticker.js';
import { createEasel } from './easel.js';
import { byDate, eventStart, sceneEvent } from './events.js';
import { eventChanged } from './festival.js';
import { clearRainbowEnd, placeMark, placeRainbowEnd } from './rainbow-end.js';
import { cancelRemarks, momentRemark, remark } from './remarks.js';
import {
  autoWeather,
  harvestMoon,
  initialSceneChoices,
  moonLit,
  moonMask,
  moonPhase,
  PERIOD_MINUTES,
  periodFor,
  sceneCaption,
  seasonVars,
  sunAt,
} from './scene.js';
import { createScenery } from './scenery.js';
import { createMoments } from './sky-moments.js';
import { soundScene } from './sound.js';
import { seasonPickedByHand } from './winter.js';
import { scene, scenery, setScenery } from './world.js';
import { replacedBy, worldAllows, worldFor, worlds } from './worlds.js';

// The painted backdrop, made with the weather canvas.
let easel = null;
// South of the equator the seasons and the moon turn the other way (by the system's time zone,
// read by setupSky).
let south = false;
// The season's colours last set on the yard, to be taken off again when they change.
let painted = {};
// The moon's mask last set, so it is set again only when the phase has moved on.
let moonMaskShown = '';
// The moments the sky makes as the weather turns (sky-moments.js), each shown by a `moment-<id>`
// class on the yard that only showMoment sets, and the weather the shown one dresses the yard in.
const moments = createMoments(showMoment);
let dressed = null;
// Whether paintScene is running, so a moment that changes the yard's dress during it waits for it.
let painting = false;
// What a moment does besides its look: `begin(lasts)` says whether the friends point it out.
const MOMENT_PARTS = {
  // the rainbow's lines point at its end, so they wait for a patch of ground to dig
  rainbow: { begin: lasts => !!placeRainbowEnd(Date.now() + lasts), end: clearRainbowEnd },
  meteors: {
    begin: () => {
      scenery.shower(true);
      return true;
    },
    end: () => scenery.shower(false),
  },
  sunshower: {
    begin: () => {
      scenery.sunlit(true);
      return true;
    },
    end: () => scenery.sunlit(false),
  },
};
// What the person picked for the yard, or 'auto'.
let weatherChoice = 'auto';
let periodChoice = 'auto';
let seasonChoice = 'auto';
// What the entry point does as the scene changes (setupSky's options).
let seasonChanged = () => {};
let seasonPicked = () => {};
/** The line under the scene names the place: a background of the person's own by its name. Outdoors
 * it pairs the place with the weather and time of day ("A sunny day", caption.outdoor); indoor
 * weather stays outside the windows, so a room's line lists the place, the time of day and the
 * weather (caption.indoor*). Each language orders them in its own line. */
export function worldCaption(world, period, weather) {
  const place = worldFor(world).name || t(worldFor(world).label);
  if (worldAllows(world, 'sky')) return t('caption.outdoor', { scene: sceneCaption(period, weather), place });
  const parts = { place, period: t(`period.${period}`) };
  return worldAllows(world, 'weather')
    ? t('caption.indoor_weather', { ...parts, weather: t(`weather.${weather}`) })
    : t('caption.indoor', parts);
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
  // With the season picked by hand, the scene can call one up on any day.
  const event = worldAllows(scene.world, 'seasonalEffects')
    ? sceneEvent(now, south, scene.season, {
        chosen: isSeason(seasonChoice),
        period: scene.period,
        weather: scene.weather,
      })
    : null;
  scene.event = event?.id ?? null;
  // On the calendar the full moon comes on its own nights; a picked scene asked for it tonight.
  const fullMoon =
    !!event?.looks?.length &&
    (!byDate(event.id, now, south) || harvestMoon(now.getTime(), eventStart(event, now, south).getTime()));
  scenery.set(scene.period, scene.weather, scene.season, scene.event, scene.world);
  // After the scenery, so a meteor shower lands on tonight's stars. The harvest moon's look is the
  // event's own night, and no moment shares it.
  painting = true;
  moments({
    sky: worldAllows(scene.world, 'sky'),
    before,
    weather: scene.weather,
    period: scene.period,
    season: scene.season,
    quiet: fullMoon && scene.period === 'night',
  });
  painting = false;
  // The weather the yard is dressed in: its own, or a moment's (a sunshower keeps the clear day).
  const looks = dressed ?? scene.weather;
  // The scene's own classes on the yard (scenery.css): only these are changed here; the others
  // belong to whoever sets them (aiming, playing, the catch hand, the rainbow).
  setMarks(yard, [
    `world-${scene.world}`,
    `period-${scene.period}`,
    `weather-${looks}`,
    `season-${scene.season}`,
    ...(event ? [`event-${event.id}`, ...(event.looks || []).map(look => `look-${look}`)] : []),
    // the event's own full moon and the nights either side, for the harvest moon's look
    ...(fullMoon ? ['moon-full'] : []),
  ]);
  paintSeason(yard);
  paintSky(yard, now);
  $('sky-dot').className = `sun-dot ${scene.period === 'night' ? 'moon' : ''}`;
  $('scene-caption').textContent = worldCaption(scene.world, scene.period, scene.weather);
  $('weather').disabled = !worldAllows(scene.world, 'weather');
  $('weather').value = worldAllows(scene.world, 'weather') ? weatherChoice : 'clear';
  const note = worldFor(scene.world).about;
  $('world-note').textContent = note ? t(note) : '';
  $('world-note').hidden = !note;
  easel.set({ ...scene, weather: looks });
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
  // Tonight's real phase, the harvest moon too: its look shows only around the full moon (scenery.css).
  const lit = moonLit(moonPhase(now.getTime()), south),
    mask = `url("data:image/svg+xml,${encodeURIComponent(moonMask(lit))}")`;
  // The mask changes a few times a day; set again only then, so the moon is not redrawn every minute.
  if (mask !== moonMaskShown) yard.style.setProperty('--moon-lit', mask);
  moonMaskShown = mask;
}
function showMoment({ id, lasts, looks }, on) {
  const yard = $('yard'),
    mark = `moment-${id}`,
    parts = MOMENT_PARTS[id];
  yard.classList.toggle(mark, on);
  if (looks) {
    dressed = on ? looks : null;
    // Begun or ended by its own timer: the yard is dressed again now.
    if (!painting) paintScene();
  }
  if (!on) parts?.end();
  else if (parts?.begin(lasts) ?? true) momentRemark(id, () => yard.classList.contains(mark));
}
/** The season picked for the yard, or 'auto'. */
export const chosenSeason = () => seasonChoice;
/** The weather picked for the yard, or 'auto'. */
export const chosenWeather = () => weatherChoice;
/** Shows the yard in a season picked here or by the backend (December's winter, winter.js), which
 * already saved it; anything not a season is Auto. */
export function showSeason(choice) {
  seasonChoice = isSeason(choice) ? choice : 'auto';
  $('scene-season').value = seasonChoice;
  cancelRemarks();
  seasonPicked();
  paintScene();
}
// The place, season, time of day and weather picked are kept in state.json (`scene`), so they
// travel with the data folder. A value still in the webview's storage (sceneValue, state.js) moves
// over and leaves that storage once the app saved it, where that storage is this folder's own.
const SCENE_KEYS = ['world', 'weather', 'period', 'season'];
export const savedScene = () => Object.fromEntries(SCENE_KEYS.map(key => [key, sceneValue(key)]));
export async function keepScene(key, value) {
  try {
    await call('setScene', key, value);
    if (ownsWebview()) forget(key);
  } catch {
    // Not saved by the app: the webview keeps it, read again at the next start.
    if (ownsWebview()) remember(key, value);
  }
}
export function moveOldScene() {
  return Promise.all(
    SCENE_KEYS.map(key => {
      const old = recall(key);
      if (old === null || (!ownsWebview() && data.scene?.[key] != null)) return undefined;
      return keepScene(key, old);
    }),
  );
}
// Starts the sky: the chosen or automatic time and weather, and the minute-by-minute check. Called once, by app.js.
// `options`, each optional:
// - seasonChanged(season): after every repaint, with the season shown;
// - seasonPicked(): the person picked a season, before the scene is painted in it;
// - worldChanged(enter): the person picked another place; `enter()` moves the scene there and
//   paints it, so what has to stop in the old place goes before it and what is laid out again after;
// - landChanged(): the land was redrawn another way (its picture, or the painted fallback when the
//   picture could not be loaded), so the field may begin at another height.
export function setupSky(options = {}) {
  south = systemSouth();
  const none = () => {};
  seasonChanged = options.seasonChanged || none;
  seasonPicked = options.seasonPicked || none;
  const worldChanged = options.worldChanged || (enter => enter()),
    landChanged = options.landChanged || none;
  setScenery(createScenery($('weather-layer'), reduced, undefined, undefined, $('star-layer')));
  globalThis.window?.addEventListener?.('resize', placeMark);
  easel = createEasel($('yard'), reduced, landChanged);
  // On a screen of another density the backdrop and the weather are painted again at its pixels.
  onDensityChange(() => {
    easel.repaint();
    scenery.resize();
  });
  const saved = savedScene();
  moveOldScene();
  const initial = initialSceneChoices(saved);
  seasonChoice = initial.season;
  weatherChoice = initial.weather;
  periodChoice = initial.period;
  $('scene-season').value = seasonChoice;
  $('scene-season').onchange = () => {
    const choice = $('scene-season').value;
    keepScene('season', isSeason(choice) ? choice : 'auto');
    seasonPickedByHand(choice, new Date(), south);
    showSeason(choice);
  };
  scene.world = worldFor(saved.world).id;
  if (replacedBy(saved.world)) keepScene('world', scene.world);
  $('world').replaceChildren(
    ...worlds.map(world => {
      const option = document.createElement('option');
      option.value = world.id;
      option.textContent = world.name || t(world.label);
      return option;
    }),
  );
  $('world').value = scene.world;
  $('world').onchange = () => {
    cancelRemarks();
    worldChanged(() => {
      scene.world = worldFor($('world').value).id;
      keepScene('world', scene.world);
      paintScene();
    });
  };
  $('weather').value = weatherChoice;
  $('period').value = periodChoice;
  // The caption is the button for the time of day and the weather: a small panel under it.
  const sceneFocus = () => (document.body.classList.contains('compact') ? $('yard') : $('scene-button'));
  const chooser = dropdown(
    $('scene-button'),
    $('scene-menu'),
    () => {
      const page = $('scene-menu').querySelector('.scene-page:not([hidden])');
      (
        page?.querySelector('[aria-pressed="true"]') ||
        page?.querySelector('button:not([hidden]):not(:disabled), select:not([hidden]):not(:disabled)')
      )?.focus();
    },
    sceneFocus,
  );
  $('scene-close').addEventListener('click', () => {
    chooser.close();
    sceneFocus().focus();
  });
  $('period').onchange = () => {
    periodChoice = $('period').value;
    keepScene('period', periodChoice);
    paintScene();
  };
  $('weather').onchange = () => {
    weatherChoice = $('weather').value;
    keepScene('weather', weatherChoice);
    if (paintScene()) remark();
  };
  paintScene();
  everyMinute(() => {
    if (paintScene()) remark();
  });
}
