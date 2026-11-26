// A press on open yard ground sends a friend there, at walking pace (docs/design/2026-11-26-natural-
// walking.md): the selected friend, else the one nearest the spot. A spot it cannot stand on moves
// to the nearest one it can, and a ring of bent grass marks it until the friend gets there.
import { $, aiming, game, selected, views } from '../core/state.js';
import { dockBox, footOf, footTarget, underDock, yardToField } from './field.js';
import { groundProfile } from './ground.js';
import { nearest, sendTo } from './trips.js';
import { reachOf } from './views.js';
import { strollClear } from './wander.js';
import { blocked } from './workspace.js';

// Where else to look, in yard pixels, when the spot itself will not do: rings around it, nearest first.
const TRIES = [
  [0, 0],
  ...[24, 48, 72, 96, 120].flatMap(reach =>
    Array.from({ length: 12 }, (_, i) => [Math.cos((i / 6) * Math.PI) * reach, Math.sin((i / 6) * Math.PI) * reach]),
  ),
];

// A press that closed a menu, a dialog or the side panel only closed it; one made with a tool in hand
// or in a game was for that, even when its own click put the tool away (dropping the treat, the last
// seed). Read at the window in capture, before the menus' own document listeners shut them.
let pressClosed = false,
  pressHeld = false,
  busy = () => false;
/** Notes, at each press, whether it came while something was open over the yard or a tool was in
 * hand; `busy` says when nothing should be called away (a friend fishing). */
export function setupWalkHere({ busy: isBusy = () => false } = {}) {
  busy = isBusy;
  window.addEventListener(
    'pointerdown',
    () => {
      pressClosed =
        !!document.querySelector('[aria-expanded="true"], dialog[open]') || $('side-panel')?.hidden === false;
      pressHeld = aiming || !!game;
    },
    true,
  );
}

const able = v => !v.drag && !v.away && !v.duty && !v.frozen;
// The friend the press is for: the selected one (if it can go), else the nearest that can.
function whoGoes(px, py) {
  const chosen = views.get(selected);
  if (chosen) return able(chosen) ? chosen : null;
  return nearest(px, py, able);
}

/** The ground `v` may walk on, measured once for all its tries: whether it can go from field point
 * `from` to stand with its feet at (x, y), yard pixels. Not behind the dock, name tag and all
 * (reachOf), not onto a workspace's furniture, a tree, a flower or a gift, and around the lake. */
export function groundFor(v) {
  const ground = groundProfile(),
    dock = dockBox(),
    reach = reachOf(v);
  return (from, x, y) =>
    !underDock(x, y, reach, dock) && !blocked(x, y) && strollClear(from, yardToField(x, y), ground);
}

let marked = null;
// The mark at the spot (yard pixels), until `v` gets there or goes elsewhere.
function mark(v, px, py) {
  const ring = $('walk-mark');
  if (!ring) return () => {};
  ring.style.translate = `${Math.round(px)}px ${Math.round(py)}px`;
  ring.classList.remove('gone');
  ring.hidden = false;
  const own = {};
  marked = own;
  return () => {
    if (marked === own) ring.classList.add('gone');
  };
}

/** Sends a friend to the ground pressed at (px, py), yard pixels: whether one went. */
export function walkHere(px, py) {
  if (aiming || game || pressClosed || pressHeld || busy()) return false;
  const v = whoGoes(px, py);
  if (!v) return false;
  const allows = groundFor(v),
    feet = footOf(v),
    from = yardToField(feet.x, feet.y);
  for (const [dx, dy] of TRIES) {
    const x = px + dx,
      y = py + dy;
    if (!allows(from, x, y)) continue;
    const done = mark(v, x, y);
    sendTo(v, footTarget(v, x, y), { arrive: done, cancel: done });
    return true;
  }
  return false;
}
