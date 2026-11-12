// Whether a kind of decoration is in the yard now. A built snowman ("seasons" in catalog.json) shows
// only while the yard shows one of its seasons; a Christmas gift ("shown" and "seasons") inside its
// window or while the yard shows winter, so a person who wants it picks the winter yard any day
// (docs/decisions/2026-11-12-scenes-before-dates.md). Neither leaves the garden: the rest of the
// time it waits out of sight with its place and its desktop spot, so it comes back where it was. A
// hidden one still counts toward the yard's 12, so the yard never holds more than that when it
// shows; out of sight, it takes no ground. The yard, its ground, friends' visits and the album's
// Set out ask here rather than reading a gift's `shown` or `seasons` themselves.

import { GIFTS, giftKind } from './catalog.js';
import { inEvent } from './events.js';
import { worldAllows } from './worlds.js';

/** Each window a gift can show in, by local month-day; fixed to the calendar in both hemispheres. */
export const SHOWN = Object.freeze({ december: Object.freeze({ from: '12-01', to: '01-07', fixed: true }) });

const monthDay = date => `${date.getMonth() + 1}-${date.getDate()}`;
// A kind with a rule shows when any of its rules lets it; one with none always. An unknown window
// name is no rule (the content tests keep every name in SHOWN).
const shows = (gift, md, season) => {
  const window = gift.shown && SHOWN[gift.shown];
  if (!window && !gift.seasons) return true;
  return (!!window && inEvent(window, md)) || !!gift.seasons?.includes(season);
};

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
