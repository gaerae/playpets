// What friends say on their own, without an AI: a word now and then about the hour and the weather,
// a remark when the weather changes, and (level 5, bond.js) something for the person. The lines
// are the string tables' (chatter.*, bond.dear), chosen by scene.js chatterFor.

import { list } from '../core/i18n.js';
import { between, pick, shuffle } from '../core/math.js';
import { data, game, views } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { levelOf } from './bond.js';
import { chatterFor } from './scene.js';
import { bubble } from './views.js';
import { scene } from './world.js';

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
/** The weather changed: a friend or two say something about it. */
export function remark() {
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
const chatter = cadence(() => between(Math.random, CHATTER_DELAY));
/** Called by the frame loop: now and then a quiet friend says something about the hour or the weather. */
export function idleChatter(now) {
  if (!chatter.due(now)) return;
  const quiet = [...views.values()].filter(
    v => v.bubble.hidden && !v.drag && (data.statuses[v.pet.id]?.state || 'idle') === 'idle',
  );
  if (!quiet.length) return;
  const v = pick(quiet);
  // The closest friends (level 5, bond.js) now and then say something to the person instead, and
  // during a seasonal event friends often talk about it.
  const dear = levelOf(v.pet.id) >= 5 && Math.random() < 0.35,
    festive = !dear && scene.event && Math.random() < 0.4;
  bubble(
    v,
    dear
      ? pick(list('bond.dear'))
      : festive
        ? pick(list(`event.${scene.event}.lines`))
        : chatterFor(scene.period, scene.weather, Math.random),
    3500,
  );
}
