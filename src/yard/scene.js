// Yard scenery: the time of day comes from the clock, the weather from the person.
import { list, t } from '../core/i18n.js';

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
  // Each language composes its own line: "포근한 아침의 놀이터", "A cosy morning in the yard".
  return t(`caption.${w}.${p}`);
}
// "Auto" lets the sky change on its own: one draw per 20-minute block, mostly clear.
export function autoWeather(ms) {
  let x = (Math.floor(ms / 1200000) * 2654435761) % 4294967296;
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  const roll = (x >>> 0) / 4294967296;
  return roll < 0.6 ? 'clear' : roll < 0.8 ? 'rain' : 'snow';
}
const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
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
