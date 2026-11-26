// The line above the yard that says what is going on or what a press will do, and the agents' work
// beside the friend count. Which line is a pure choice (hintKey, busyLine), so it can be tested.
import { put } from '../core/dom.js';
import { joinList, t } from '../core/i18n.js';
import { $, aiming, data, game, labels, name, recall } from '../core/state.js';
import { agentStateOf } from '../core/status.js';
import { learned, showHow } from './show-how.js';
import { scene } from './world.js';
import { worldAllows, worldHasSoil } from './worlds.js';

/** The hint's key, or the game's own words: a game first, then the tool in hand, then what there is
 * still to learn: a pat, until the first; the lake, until it has been fished (catch.js); then, where
 * there is `soil`, Dig until the first dig and Plant a seed once there are `seeds` until the first
 * is planted; then the Album once something is `found` in it, until it has been `opened`. */
export function hintKey({
  game,
  aiming,
  friends,
  patted,
  fished,
  soil = false,
  dug = true,
  seeds = 0,
  planted = true,
  found = false,
  opened = true,
}) {
  if (game) return { text: game.hint };
  // Every tool in hand, the picnic treat too, has the strip at the bottom saying what to do.
  if (aiming) return null;
  if (!friends) return null;
  if (!patted) return { key: 'hint.pat' };
  if (!fished) return { key: 'hint.fish' };
  if (soil && !dug) return { key: 'hint.dig' };
  if (soil && seeds && !planted) return { key: 'hint.sow' };
  return found && !opened ? { key: 'hint.album' } : null;
}
// A yard from before the hand taught the dock already shows its digging: a keepsake, a flower or a
// tree. The hand is for someone who has not found the shovel, not for them.
const dugBefore = () =>
  !!Object.keys(data.album?.treasures || {}).length || !!data.garden?.plants?.length || !!data.garden?.trees?.length;
// Whether anything at all is in the album yet: a catch, a bloom, a find or a gift.
const anyFound = () =>
  Object.values(data.album || {}).some(book => Object.keys(book || {}).length) || !!data.garden?.received?.length;
/** The agents' work in a few words: one busy friend named with its state, several counted. */
export function busyLine(friends, stateOf, nameOf, label) {
  const states = friends.map(stateOf),
    working = states.filter(s => s === 'working').length,
    waiting = states.filter(s => s === 'waiting').length,
    busy = friends.find(p => ['working', 'waiting'].includes(stateOf(p)));
  if (working + waiting > 1) return t('yard.busy_summary', { working, waiting });
  return busy ? joinList([nameOf(busy), label(stateOf(busy))]) : '';
}
/** Brings the hint and the agents' summary in line with the yard now. */
export function hint() {
  const busy = busyLine(
    data.pets,
    p => agentStateOf(data, p.id),
    name,
    state => labels[state],
  );
  put($('agent-summary'), 'textContent', busy ? ` (${busy})` : '');
  const line = hintKey({
    game,
    aiming,
    friends: data.pets.length,
    patted: !!recall('patted'),
    fished: !worldAllows(scene.world, 'fishing') || recall('fished') === '1',
    soil: worldHasSoil(scene.world),
    dug: learned('dig') || dugBefore(),
    seeds: data.garden?.seeds ?? 0,
    planted: learned('seed') || !!data.garden?.plants?.length,
    found: anyFound(),
    opened: learned('album'),
  });
  put($('yard-hint'), 'textContent', !line ? '' : (line.text ?? t(line.key)));
  put($('yard-hint'), 'hidden', !line);
  // and the same in a picture, for anyone who does not read it (show-how.js)
  showHow(line);
}
