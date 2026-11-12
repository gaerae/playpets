// A seasonal event as the person meets it: its name beside the scene label, a card the first time
// it comes each year, and a friend who mentions it. What the events are and when: events.js.
import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { systemSouth } from '../core/season.js';
import { $, recall, remember, views } from '../core/state.js';
import { artSvg } from './art.js';
import { showCard } from './card.js';
import { eventGifts, giftKind } from './catalog.js';
import { byDate } from './events.js';
import { bubble } from './views.js';
import { scene } from './world.js';
import { worldAllows } from './worlds.js';

// The event whose card waits for the window to be shown.
let waiting = null,
  revealTimer;
/** The seasonal event changed (sky.js, when it paints the scene): `event` is the new one, or null. */
export function eventChanged(event) {
  clearTimeout(revealTimer);
  const chip = $('event-chip');
  chip.hidden = !event;
  if (!event) {
    waiting = null;
    return;
  }
  // Its gifts keep to its dates; a scene picked by hand calls up only the look (events.js).
  const name = t(`event.${event.id}.name`),
    about = byDate(event.id, new Date(), systemSouth())
      ? `${t(`event.${event.id}.about`)} ${t(`event.${event.id}.gift`)}`
      : t(`event.${event.id}.about`);
  chip.textContent = name;
  chip.title = about;
  // Once a year, the first time the yard is seen with it: a window started hidden (with desktop
  // mode at login) waits until it is shown, and the friends have come in by then.
  const seen = `event-${event.id}-${new Date().getFullYear()}`;
  if (recall(seen) === '1') return;
  if (document.hidden) {
    waiting = event;
    document.addEventListener('visibilitychange', () => waiting === event && eventChanged(event), { once: true });
    return;
  }
  waiting = null;
  revealTimer = setTimeout(() => {
    if (!worldAllows(scene.world, 'seasonalEffects') || scene.event !== event.id) return;
    if (document.hidden) {
      eventChanged(event);
      return;
    }
    remember(seen, '1');
    const art = event.art || giftKind(eventGifts(event.id)[0])?.art;
    showCard(art ? artSvg(art, 'class="decor-art"') : '', t('event.started', { name }), about, false);
    const friend = pick([...views.values()]);
    if (friend) bubble(friend, pick(list(`event.${event.id}.lines`)), 4000);
  }, 1800);
}
