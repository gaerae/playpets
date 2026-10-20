// The line above the yard that says what is going on or what a press will do, and the agents' work
// beside the friend count. Which line is a pure choice (hintKey, busyLine), so it can be tested.
import { joinList, t } from '../core/i18n.js';
import { $, aiming, data, game, labels, name, recall } from '../core/state.js';
import { agentStateOf } from '../core/status.js';
import { scene } from './world.js';
import { worldAllows } from './worlds.js';

/** The hint's key, or the game's own words: a game first, then the tool in hand, then what there is
 * still to learn (a pat, until the first; then the lake, until it has been fished; catch.js). */
export function hintKey({ game, aiming, friends, patted, fished }) {
  if (game) return { text: game.hint };
  if (aiming === 'dig' || aiming === 'tree') return null;
  if (aiming) return { key: aiming === 'seed' ? 'hint.plant' : 'hint.treat' };
  if (!friends) return null;
  if (!patted) return { key: 'hint.pat' };
  return fished ? null : { key: 'hint.fish' };
}
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
  $('agent-summary').textContent = busy ? ` (${busy})` : '';
  const line = hintKey({
    game,
    aiming,
    friends: data.pets.length,
    patted: !!recall('patted'),
    fished: !worldAllows(scene.world, 'fishing') || recall('fished') === '1',
  });
  $('yard-hint').textContent = !line ? '' : (line.text ?? t(line.key));
  $('yard-hint').hidden = !line;
}
