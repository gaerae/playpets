// Whether a kind of decoration is in the yard now. A Christmas gift ("shown" in catalog.json) shows
// only inside its window and a built snowman ("seasons") only while the yard shows one of them, but
// neither leaves the garden: the rest of the year it waits out of sight with its place and its
// desktop spot, so it comes back where it was. A hidden one still counts toward the yard's 12, so
// the yard never holds more than that when the window opens; out of sight, it takes no ground. The
// yard, its ground, friends' visits and the album's Set out ask here rather than reading a gift's
// `shown` or `seasons` themselves.

import { GIFTS, giftKind } from './catalog.js';
import { inEvent } from './events.js';
import { worldAllows } from './worlds.js';

/** Each window a gift can show in, by local month-day; fixed to the calendar in both hemispheres. */
export const SHOWN = Object.freeze({ december: Object.freeze({ from: '12-01', to: '01-07', fixed: true }) });

const monthDay = date => `${date.getMonth() + 1}-${date.getDate()}`;
// An unknown window name hides nothing (the content tests keep every name in SHOWN).
const shows = (gift, md, season) =>
  !(gift.shown && SHOWN[gift.shown] && !inEvent(SHOWN[gift.shown], md)) &&
  !(gift.seasons && !gift.seasons.includes(season));

/** The season the yard shows in `scene` (world.js), or null in a place with no seasons to show
 * (worlds.json `seasonalEffects`), such as the studio: no snow there, so no snowman either. The
 * one answer to "does the yard show winter", for the gifts, the album and December's question. */
export function yardSeason(scene) {
  return worldAllows(scene.world, 'seasonalEffects') ? scene.season : null;
}
/** Whether a kind shows at `date` with the yard showing `season` (yardSeason); true for kinds with
 * no rule. */
export function decorShown(kind, date, season) {
  const gift = giftKind(kind);
  return !gift || shows(gift, monthDay(date), season);
}
/** The gift kinds out of sight at `date` in `season`, in catalogue order. */
export function hiddenKinds(date, season) {
  const md = monthDay(date);
  return GIFTS.filter(gift => !shows(gift, md, season)).map(gift => gift.id);
}
