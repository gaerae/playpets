// Most people keep the yard in its first season, so during the winter lights (December) the yard
// asks once a year whether to show winter until January 7. A yes keeps the season before beside
// the answer (state.json `winterAsked`), and the backend brings it back on January 8 unless another
// season was picked by hand since. Only an outdoor place asks: a room shows no yard to snow on.

import { confirmAction } from '../core/confirm.js';
import { t } from '../core/i18n.js';
import { selectedSeason, systemSouth } from '../core/season.js';
import { call, data } from '../core/state.js';
import { yardSeason } from './decor-shown.js';
import { eventOn } from './events.js';
import { scene } from './world.js';

/** Whether to ask now: the winter lights are on, the place has seasons, the yard is not showing
 * winter, and this year's December has not been asked yet. */
export function winterAsk(date, south, choice, asked, seasonal) {
  return (
    seasonal &&
    eventOn(date, south)?.id === 'lights' &&
    selectedSeason(date, south, choice) !== 'winter' &&
    asked?.year !== date.getFullYear()
  );
}
/** Whether winter shown on request is over: from January 8 of the year after the question, also
 * when the app first opens long after. */
export function winterOver(date, asked) {
  return !!asked?.previous && date >= new Date(asked.year + 1, 0, 8);
}

/** Whether the person is busy with something else: typing in a field, or in another dialog. The
 * question waits for a later minute, so a key meant for that field never answers it. */
export function occupied(doc = globalThis.document) {
  const at = doc?.activeElement;
  const typing = !!at && (at.localName === 'input' || at.localName === 'textarea' || !!at.isContentEditable);
  return typing || [...(doc?.querySelectorAll?.('dialog') ?? [])].some(dialog => dialog.open);
}

/** A season the person picked by hand during the lights is this December's answer, when it is not
 * winter: the yard does not then ask to show winter right after. Called by the season picker. */
export function seasonPickedByHand(choice, date = new Date(), south = systemSouth()) {
  const year = date.getFullYear();
  if (eventOn(date, south)?.id !== 'lights' || selectedSeason(date, south, choice) === 'winter') return;
  if (data.winterAsked?.year === year) return;
  data.winterAsked = { year, previous: null };
  call('answerWinter', year, null).catch(() => {});
}

// Starts the check, called by app.js before the sky. `choice()` is the season picked (sky.js
// chosenSeason), `show(season)` shows the yard in one the backend saved (sky.js showSeason), and
// `visible()` whether the person can see the yard to answer, `free()` whether they are not busy
// with something else (occupied).
// Returns `check()`, for each repaint of the scene. The first is the start-up paint: it brings the
// season back if winter is over, but asks nothing over a window still opening.
export function setupWinter({
  choice,
  show,
  ask = confirmAction,
  south = systemSouth(),
  visible = () => !document.hidden,
  free = () => !occupied(),
}) {
  let armed = false,
    busy = false;
  // An error leaves the answer to the next minute: asked again only if the backend's state did not
  // keep this one.
  const run = work => {
    busy = true;
    work()
      .catch(() => {})
      .finally(() => {
        busy = false;
      });
  };
  return function check() {
    const first = !armed;
    armed = true;
    if (busy) return;
    const now = new Date();
    // The season comes back on January 8 whether or not the yard is seen: the desktop shows it too.
    if (winterOver(now, data.winterAsked)) {
      run(async () => {
        const season = await call('endWinter');
        if (data.winterAsked) data.winterAsked.previous = null;
        show(season);
      });
      return;
    }
    if (first || !visible() || !free()) return;
    if (!winterAsk(now, south, choice(), data.winterAsked, yardSeason(scene) !== null)) return;
    const year = now.getFullYear();
    run(async () => {
      const yes = await ask({
        title: t('scene.winter_title'),
        body: t('scene.winter_body'),
        action: t('scene.winter_yes'),
        keep: t('scene.winter_keep'),
      });
      const previous = yes ? choice() : null;
      // Kept at once, so the next minute does not ask again while the backend saves it.
      data.winterAsked = { year, previous };
      await call('answerWinter', year, previous);
      if (yes) show('winter');
    });
  };
}
