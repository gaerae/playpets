// Yard scenery: the time of day comes from the clock, and the weather changes on its own unless the person picks one.
import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';

export const PERIODS = {
  morning: t('period.morning'),
  day: t('period.day'),
  evening: t('period.evening'),
  night: t('period.night'),
};
export const WEATHERS = { clear: t('weather.clear'), rain: t('weather.rain'), snow: t('weather.snow') };
export function periodFor(hour) {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}
export function sceneCaption(period, weather) {
  const p = PERIODS[period] ? period : 'day',
    w = WEATHERS[weather] ? weather : 'clear';
  // Each language composes its own line from the caption.* keys, e.g. "A cosy morning in the yard".
  return t(`caption.${w}.${p}`);
}
// "Auto" lets the sky change on its own: one draw per 20-minute block, mostly clear, and with
// the season's weather: snow only in winter, which also has the least rain.
const ODDS = { spring: [0.65, 1], summer: [0.62, 1], autumn: [0.7, 1], winter: [0.55, 0.68] };
export function autoWeather(ms, season = seasonFor(new Date(ms))) {
  let x = (Math.floor(ms / 1200000) * 2654435761) % 4294967296;
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  const roll = (x >>> 0) / 4294967296,
    [clear, rain] = ODDS[season] || ODDS.spring;
  return roll < clear ? 'clear' : roll < rain ? 'rain' : 'snow';
}
// The season by the month: March to May is spring north of the equator, autumn south of it.
const SEASONS = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
];
export function seasonFor(date, south = false) {
  return SEASONS[(date.getMonth() + (south ? 6 : 0)) % 12];
}
export function selectedSeason(date, south = false, choice = 'auto') {
  return ['spring', 'summer', 'autumn', 'winter'].includes(choice) ? choice : seasonFor(date, south);
}
// South of the equator, by the time zone the system is set to: no location is asked for.
const SOUTH =
  /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Port_Moresby)|^America\/(Argentina|Buenos_Aires|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bahia|Recife|Maceio|Campo_Grande|Cuiaba|Punta_Arenas)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka|Gaborone|Maseru|Mbabane|Blantyre|Lubumbashi)|^Indian\/(Mauritius|Reunion|Antananarivo)|^Atlantic\/Stanley/;
export const southern = zone => SOUTH.test(zone || '');
// What each season does to the yard, as colours for the custom properties in scenery.css: the round
// trees (--crown, and --maple for the one that turns first), the bushes (--leaf) and by day the
// fields. Morning shares the day's colours; evening and night keep their own light on the fields.
// Snow has its own colours for everything (scenery.css), so a snowy yard looks the same in any season.
export const SEASON_COLORS = {
  spring: {
    day: {
      '--crown': '#f4b6c8',
      '--crown-hi': '#fcdbe6',
      '--crown-lo': '#e290ad',
      '--maple': '#f7c9d6',
      '--maple-hi': '#fde8ef',
      '--maple-lo': '#e7a6bd',
      '--flower-a': '#f48fb1',
    },
    evening: {
      '--crown': '#e3a0ad',
      '--crown-hi': '#f3c3bd',
      '--crown-lo': '#c27c90',
      '--maple': '#e9b0b8',
      '--maple-hi': '#f6d0c7',
      '--maple-lo': '#c98a9c',
    },
    night: {
      '--crown': '#5e5070',
      '--crown-hi': '#75668a',
      '--crown-lo': '#463c58',
      '--maple': '#625474',
      '--maple-hi': '#796a8e',
      '--maple-lo': '#4a405c',
    },
  },
  summer: {
    day: {
      '--crown': '#4f9e50',
      '--crown-hi': '#86c46a',
      '--crown-lo': '#3a7f45',
      '--maple': '#57a457',
      '--maple-hi': '#8fca70',
      '--maple-lo': '#408649',
      '--far': '#a0cf7a',
      '--far-hi': '#b9de95',
      '--back': '#7dbd55',
      '--back-hi': '#9dd06c',
      '--front': '#6aab4a',
      '--front-hi': '#86c260',
    },
    evening: {},
    night: {},
  },
  autumn: {
    day: {
      '--crown': '#e6a03c',
      '--crown-hi': '#f5c862',
      '--crown-lo': '#c4702f',
      '--maple': '#d65a3a',
      '--maple-hi': '#ee8a5c',
      '--maple-lo': '#a9402e',
      '--leaf': '#8ea64f',
      '--leaf-hi': '#b9c46b',
      '--leaf-lo': '#6d8a40',
      '--far': '#d3d49a',
      '--far-hi': '#e4e2b0',
      '--back': '#c2c37e',
      '--back-hi': '#d7d496',
      '--front': '#adb469',
      '--front-hi': '#c4c47e',
      '--blade': '#9a9f55',
      '--flower-a': '#f0a35e',
    },
    evening: {
      '--crown': '#d4843a',
      '--crown-hi': '#eeb25c',
      '--crown-lo': '#a95a2c',
      '--maple': '#bf4a35',
      '--maple-hi': '#dc7a52',
      '--maple-lo': '#8e392c',
      '--leaf': '#7f9148',
      '--leaf-hi': '#b0b061',
      '--leaf-lo': '#5f773d',
    },
    night: {
      '--crown': '#5c4a39',
      '--crown-hi': '#705a45',
      '--crown-lo': '#45382c',
      '--maple': '#5a3934',
      '--maple-hi': '#6c4640',
      '--maple-lo': '#432b28',
    },
  },
  winter: {
    // Trees keep a muted winter green (as in Animal Crossing), so no bare branches stand about.
    day: {
      '--crown': '#6d8a6a',
      '--crown-hi': '#93ab87',
      '--crown-lo': '#506b52',
      '--maple': '#7d8a68',
      '--maple-hi': '#a3ad86',
      '--maple-lo': '#5d6b50',
      '--leaf': '#7f9a76',
      '--leaf-hi': '#a1b597',
      '--leaf-lo': '#637e5d',
      '--far': '#d0d2bb',
      '--far-hi': '#e0e1cf',
      '--back': '#bfc4a8',
      '--back-hi': '#d2d5bd',
      '--front': '#aab393',
      '--front-hi': '#bfc6a8',
      '--blade': '#8c9a78',
    },
    evening: {
      '--crown': '#647a5e',
      '--crown-hi': '#8f9a76',
      '--crown-lo': '#4a5d48',
      '--maple': '#6e7859',
      '--maple-hi': '#99996f',
      '--maple-lo': '#535c44',
    },
    night: {
      '--crown': '#2c463f',
      '--crown-hi': '#3d5a50',
      '--crown-lo': '#213733',
      '--maple': '#33473c',
      '--maple-hi': '#455c4e',
      '--maple-lo': '#263a32',
    },
  },
};
export function seasonVars(season, period, weather) {
  if (weather === 'snow') return {};
  const colors = SEASON_COLORS[season]?.[period === 'morning' ? 'day' : period];
  return colors ? { ...colors } : {};
}
// Where the sun (5:00 to 20:00) or the moon (20:00 to 5:00) stands, by minutes since midnight:
// x and y in percent of the yard, rising on the left, highest halfway, setting on the right.
const SUN_UP = 5 * 60,
  SUN_DOWN = 20 * 60,
  DAY = 24 * 60;
export function sunAt(minutes) {
  const m = ((minutes % DAY) + DAY) % DAY,
    sun = m >= SUN_UP && m < SUN_DOWN,
    span = sun ? SUN_DOWN - SUN_UP : DAY - SUN_DOWN + SUN_UP,
    p = sun ? (m - SUN_UP) / span : ((m - SUN_DOWN + DAY) % DAY) / span;
  return { body: sun ? 'sun' : 'moon', x: 8 + p * 80, y: 34 - Math.sin(Math.PI * p) * 26 };
}
// A chosen time of day shows the sky at this hour of it.
export const PERIOD_MINUTES = { morning: 7 * 60, day: 13 * 60, evening: 18 * 60 + 40, night: 23 * 60 + 30 };
// The moon's age as a share of its month: 0 new, 0.5 full (from a known new moon, 6 January 2000).
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14),
  LUNAR_MONTH = 29.530588853 * 86400000;
export function moonPhase(ms) {
  return ((((ms - NEW_MOON) / LUNAR_MONTH) % 1) + 1) % 1;
}
// Where the moon's shade sits, in percent of the moon's width: 0 covers it (new moon), ±100 is off
// to one side (full). Waxing, the lit side is on the right, as seen north of the equator.
export function moonShade(phase, south = false) {
  const shade = phase < 0.5 ? -(phase / 0.5) * 100 : ((1 - phase) / 0.5) * 100;
  return Math.round(south ? -shade : shade) || 0;
}
export const GREETINGS = {
  morning: list('greet.morning'),
  day: list('greet.day'),
  evening: list('greet.evening'),
  night: list('greet.night'),
};
export function greetingFor(period, rng) {
  return pick(GREETINGS[period] || GREETINGS.day, rng);
}
export const CHATTER = {
  rain: list('chatter.rain'),
  snow: list('chatter.snow'),
  morning: list('chatter.morning'),
  day: list('chatter.day'),
  evening: list('chatter.evening'),
  night: list('chatter.night'),
};
export function chatterFor(period, weather, rng) {
  const about = CHATTER[weather] && rng() < 0.6 ? weather : CHATTER[period] ? period : 'day';
  return pick(CHATTER[about], rng);
}
// Weather particles. Depth 0 is far (small, slow, lands near the horizon), 1 is close.
const HORIZON = 0.58;
export const groundFor = (depth, h) => h * (HORIZON + depth * (1 - HORIZON));
export function dropCount(kind, w, h) {
  if (kind === 'rain') return Math.min(320, Math.round((w * h) / 1400));
  if (kind === 'snow') return Math.min(220, Math.round((w * h) / 2400));
  return 0;
}
export function spawnDrop(kind, w, h, rng) {
  const x = rng() * w * 1.15,
    depth = rng(),
    y = rng() * groundFor(depth, h),
    phase = rng() * Math.PI * 2;
  if (kind === 'rain') {
    const vy = 0.5 + depth * 0.6;
    return { x, y, depth, phase, size: 8 + depth * 16, vy, vx: -vy * 0.18 };
  }
  return { x, y, depth, phase, size: 1.2 + depth * 2.6, vy: 0.025 + depth * 0.045, vx: 0 };
}
export function stepDrops(drops, kind, dt, w, h, rng) {
  const landed = [];
  for (const d of drops) {
    d.phase += dt * 0.0018;
    d.y += d.vy * dt;
    d.x += d.vx * dt + (kind === 'snow' ? Math.sin(d.phase) * (0.012 + d.depth * 0.02) * dt : 0);
    const ground = groundFor(d.depth, h);
    if (d.y >= ground) {
      landed.push({ x: d.x, y: ground, depth: d.depth });
      d.x = rng() * w * 1.15;
      d.y = -d.size - rng() * h * 0.3;
    } else if (d.x < -20) d.x += w * 1.15 + 20;
    else if (d.x > w * 1.15) d.x -= w * 1.15;
  }
  return landed;
}
// Petals in spring and leaves in autumn: a few at a time, in clear daylight, slower than snow and
// swaying as they fall. Depth works as for drops (groundFor).
export function fallerCount(season, period, weather, w) {
  if (weather !== 'clear' || period === 'night' || (season !== 'spring' && season !== 'autumn')) return 0;
  return Math.max(4, Math.min(12, Math.round(w / 110)));
}
export function spawnFaller(w, h, rng) {
  const depth = rng();
  return {
    x: rng() * w,
    depth,
    y: rng() * groundFor(depth, h),
    phase: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 0.004,
    size: 3 + depth * 4,
    tint: rng(),
    vy: 0.012 + depth * 0.02,
  };
}
// Returns the ones still falling: a landed one starts again above the yard, or, with `recycle`
// off (the spell is over), is gone.
export function stepFallers(fallers, dt, w, h, rng, recycle = true) {
  const kept = [];
  for (const f of fallers) {
    f.phase += dt * 0.0016;
    f.y += f.vy * dt;
    f.x += Math.sin(f.phase) * (0.02 + f.depth * 0.02) * dt - 0.006 * dt;
    if (f.y >= groundFor(f.depth, h) || f.x < -20) {
      if (!recycle) continue;
      f.x = rng() * w * 1.1;
      f.y = -10 - rng() * h * 0.2;
    }
    kept.push(f);
  }
  return kept;
}
